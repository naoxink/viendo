"""Pobla `trending_series` en Supabase con el trending semanal REAL de TMDB.

Por qué TMDB y no TheTVDB: el `score` de TheTVDB es un ranking de popularidad
acumulada, así que siempre ganan las series veteranas con muchas temporadas.
El endpoint /trending/tv de TMDB sí refleja lo que se está viendo ahora mismo.

TMDB identifica las series con su propio id, pero la app trabaja con `tvdb_id`
(add-show, enlaces, pósters), así que para cada candidato se pide el detalle
con `external_ids` y se descartan las series que no tengan tvdb_id.

Requiere la columna `rank` en la tabla:
    alter table trending_series add column if not exists rank integer;
"""
import os
import sys
import io
import argparse
from collections import Counter
from datetime import date, datetime, timezone

import requests
from supabase import create_client, Client

# Forzar la salida en UTF-8 en entornos variados
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_IMG = "https://image.tmdb.org/t/p/w500"

# Géneros que "siempre están en tendencia" y no aportan: Talk, News, Soap
GENEROS_EXCLUIDOS_DEFECTO = [10767, 10763, 10766]

# TMDB -> vocabulario que ya usaba la tabla (TheTVDB)
ESTADOS = {
    "Returning Series": "Continuing",
    "Ended": "Ended",
    "Canceled": "Canceled",
    "In Production": "Upcoming",
    "Planned": "Upcoming",
    "Pilot": "Upcoming",
}


def get_supabase_client() -> Client | None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def tmdb_get(session: requests.Session, api_key: str, path: str, **params) -> dict:
    params.setdefault("api_key", api_key)
    params.setdefault("language", "es-ES")
    response = session.get(f"{TMDB_BASE}{path}", params=params, timeout=20)
    response.raise_for_status()
    return response.json()


def obtener_tvdb_ids_existentes(db: Client | None) -> set[int]:
    """tvdb_id de todo lo que ya tienes en `series` (viendo, cola, completadas, dropeadas)."""
    if db is None:
        print("⚠️ Sin credenciales de Supabase; asumo que no hay series existentes.")
        return set()
    try:
        res = db.table("series").select("tvdb_id").range(0, 9999).execute()
        return {int(f["tvdb_id"]) for f in (res.data or []) if f.get("tvdb_id")}
    except Exception as exc:
        print(f"⚠️ Error consultando series existentes en Supabase: {exc}")
        return set()


def obtener_trending(session, api_key, window: str, pages: int) -> list[dict]:
    """Trending de TMDB manteniendo su orden original."""
    resultados: list[dict] = []
    for page in range(1, pages + 1):
        data = tmdb_get(session, api_key, f"/trending/tv/{window}", page=page)
        items = data.get("results") or []
        if not items:
            break
        resultados.extend(items)
        if page >= data.get("total_pages", page):
            break
    return resultados


def anio_de(fecha: str | None) -> int | None:
    if fecha and fecha[:4].isdigit():
        return int(fecha[:4])
    return None


def prefiltro(item: dict, args, anio_min: int) -> str | None:
    """Descartes baratos, con los datos que ya trae el listado de trending."""
    if args.languages and item.get("original_language") not in args.languages:
        return "idioma"
    if set(item.get("genre_ids") or []) & set(args.exclude_genres):
        return "género excluido"
    anio = anio_de(item.get("first_air_date"))
    if anio is None or anio < anio_min:
        return "demasiado antigua"
    return None


def postfiltro(detalle: dict, args, existentes: set[int]) -> tuple[str | None, int | None]:
    """Descartes que necesitan el detalle de la serie."""
    tvdb_id = (detalle.get("external_ids") or {}).get("tvdb_id")
    if not tvdb_id:
        return "sin tvdb_id", None
    if (detalle.get("number_of_seasons") or 0) > args.max_seasons:
        return "demasiadas temporadas", None
    if int(tvdb_id) in existentes:
        return "ya en series", None
    return None, int(tvdb_id)


def construir_payload(detalle: dict, tvdb_id: int, posicion: int) -> dict:
    poster = detalle.get("poster_path")
    siguiente = detalle.get("next_episode_to_air") or {}
    estado = detalle.get("status")
    return {
        "tvdb_id": tvdb_id,
        "titulo": detalle.get("name") or detalle.get("original_name"),
        "anio": anio_de(detalle.get("first_air_date")),
        "score": round(detalle.get("vote_average") or 0, 1),
        "overview": detalle.get("overview"),
        "image_url": f"{TMDB_IMG}{poster}" if poster else None,
        "next_aired": siguiente.get("air_date"),
        "status": ESTADOS.get(estado, estado),
        "rank": posicion,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def vaciar_trending_table(db: Client):
    try:
        db.table("trending_series").delete().neq("tvdb_id", 0).execute()
        print("🗑️ Tabla 'trending_series' vaciada.")
    except Exception as exc:
        print(f"⚠️ No se pudo vaciar 'trending_series' (¿existe la tabla?): {exc}")


def insertar_trending(db: Client, payload: list[dict]):
    try:
        res = db.table("trending_series").insert(payload).execute()
        print(f"✅ Insertadas {len(res.data or [])} filas en 'trending_series'.")
    except Exception as exc:
        print(f"❌ Error al insertar en Supabase (¿falta la columna 'rank'?): {exc}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Pobla el trending semanal de TMDB en Supabase (con filtros anti-veteranas)"
    )
    parser.add_argument("--tmdb-api-key", default=os.environ.get("TMDB_API_KEY"),
                        help="API key v3 de TMDB (o variable TMDB_API_KEY)")
    parser.add_argument("--limit", type=int, default=20, help="Series a guardar")
    parser.add_argument("--window", choices=["day", "week"], default="week",
                        help="Ventana del trending de TMDB")
    parser.add_argument("--pages", type=int, default=5,
                        help="Páginas de trending a recorrer (20 series por página)")
    parser.add_argument("--max-seasons", type=int, default=4,
                        help="Descarta series con más temporadas que estas")
    parser.add_argument("--max-age-years", type=int, default=6,
                        help="Descarta series estrenadas hace más de N años")
    parser.add_argument("--languages", nargs="+", default=["es", "en"],
                        help="Idiomas originales permitidos (códigos TMDB). Vacío = todos")
    parser.add_argument("--exclude-genres", nargs="*", type=int,
                        default=GENEROS_EXCLUIDOS_DEFECTO,
                        help="IDs de género de TMDB a excluir (defecto: talk, news, soap)")
    parser.add_argument("--dry-run", action="store_true",
                        help="No escribe en Supabase, solo muestra lo que haría")
    args = parser.parse_args()

    if not args.tmdb_api_key:
        print("❌ Falta la API key de TMDB (--tmdb-api-key o TMDB_API_KEY).")
        return 1

    session = requests.Session()
    anio_min = date.today().year - args.max_age_years
    db = get_supabase_client()
    existentes = obtener_tvdb_ids_existentes(db)

    print(f"🌐 Solicitando trending ({args.window}) a TMDB...")
    try:
        trending = obtener_trending(session, args.tmdb_api_key, args.window, args.pages)
    except requests.RequestException as exc:
        status = getattr(exc.response, "status_code", None)
        print(f"❌ Error consultando el trending de TMDB (HTTP {status}).")
        return 1
    print(f"✅ Recibidas {len(trending)} series en tendencia.")

    payload: list[dict] = []
    descartes: Counter = Counter()

    for item in trending:
        if len(payload) >= args.limit:
            break

        motivo = prefiltro(item, args, anio_min)
        if motivo:
            descartes[motivo] += 1
            continue

        try:
            detalle = tmdb_get(session, args.tmdb_api_key, f"/tv/{item['id']}",
                               append_to_response="external_ids")
        except requests.RequestException as exc:
            status = getattr(exc.response, "status_code", None)
            print(f"⚠️ No se pudo obtener el detalle de '{item.get('name')}' (HTTP {status}).")
            descartes["error de detalle"] += 1
            continue

        motivo, tvdb_id = postfiltro(detalle, args, existentes)
        if motivo:
            descartes[motivo] += 1
            continue

        payload.append(construir_payload(detalle, tvdb_id, len(payload) + 1))

    print(f"ℹ️ Seleccionadas {len(payload)} series. Descartadas: {dict(descartes) or 'ninguna'}")

    if not payload:
        print("⚠️ Ninguna serie pasó los filtros; se conserva el trending anterior.")
        return 1

    if args.dry_run:
        for item in payload:
            print(f"  #{item['rank']:>2} {item['titulo']} ({item['anio']}) "
                  f"⭐{item['score']} tvdb_id={item['tvdb_id']}")
        return 0

    if db is None:
        print("⚠️ Sin credenciales de Supabase; no se escribe nada.")
        return 1

    # Vaciar tabla y subir las nuevas
    vaciar_trending_table(db)
    insertar_trending(db, payload)
    return 0


if __name__ == "__main__":
    sys.exit(main())