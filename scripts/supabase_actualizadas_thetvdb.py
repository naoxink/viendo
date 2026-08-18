import os
import sys
import io
import argparse
from datetime import datetime
from supabase import create_client, Client

from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.providers.thetvdb import TheTVDB

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

supabase: Client | None = None


def get_supabase_client() -> Client | None:
    global supabase
    if supabase is not None:
        return supabase
    if not SUPABASE_KEY or not SUPABASE_URL:
        return None
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    return supabase


def resolver_url_imagen(image_value: str | None) -> str | None:
    if not image_value:
        return None
    if image_value.startswith(("http://", "https://")):
        return image_value
    if image_value.startswith("/"):
        return f"https://artworks.thetvdb.com{image_value}"
    return f"https://artworks.thetvdb.com/banners/{image_value}"


def vaciar_actualizadas_table():
    db = get_supabase_client()
    if db is None:
        print("⚠️ No hay SUPABASE_KEY configurada; no se vacía la tabla en modo local.")
        return
    try:
        db.table("updated_series").delete().neq("tvdb_id", 0).execute()
        print("🗑️ Tabla 'updated_series' vaciada.")
    except Exception as exc:
        print(f"⚠️ No se pudo vaciar 'updated_series' (¿existe la tabla?): {exc}")


def insertar_actualizadas(payload: list[dict]):
    if not payload:
        print("ℹ️ No hay nuevas filas para insertar en 'updated_series'.")
        return
    db = get_supabase_client()
    if db is None:
        print("⚠️ No hay SUPABASE_KEY configurada; no se insertan filas en Supabase en modo local.")
        return
    try:
        res = db.table("updated_series").insert(payload).execute()
        print(f"✅ Insertadas {len(res.data or [])} filas en 'updated_series'.")
    except Exception as exc:
        print(f"❌ Error al insertar en Supabase: {exc}")


def build_payload_item(s: dict) -> dict:
    return {
        "tvdb_id": int(s.get("id")) if s.get("id") is not None else None,
        "titulo": s.get("name"),
        "anio": s.get("year"),
        "score": s.get("score"),
        "overview": s.get("overview"),
        "image_url": resolver_url_imagen(s.get("image") or s.get("thumbnail")),
        "last_aired": s.get("last_aired"),
        "status": s.get("status"),
        "created_at": datetime.utcnow().isoformat()
    }


def main():
    parser = argparse.ArgumentParser(
        description="Pobla semanal de series recién actualizadas en Supabase"
    )
    parser.add_argument("--thetvdb-api-key", dest="apikey", required=True)
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--min-score", type=float, default=60.0)
    parser.add_argument("--recent-days", type=int, default=14)
    parser.add_argument("--languages", nargs="+", default=["spa", "eng"])
    parser.add_argument("--dry-run", action="store_true")

    args = parser.parse_args()

    provider = TheTVDB(args.apikey, language="eng")

    print("🌐 Solicitando series recién actualizadas desde TheTVDB...")
    actualizadas = provider.get_recently_updated(
        limit=args.limit,
        min_score=args.min_score,
        languages=tuple(args.languages),
        recent_days=args.recent_days
    )

    if not actualizadas:
        print("⚠️ Recibidos 0 resultados de actualizadas.")
        return

    print(f"✅ Recibidos {len(actualizadas)} resultados de actualizadas.")

    payload = [build_payload_item(s) for s in actualizadas]

    if args.dry_run:
        for item in payload:
            print(item)
        return

    vaciar_actualizadas_table()
    insertar_actualizadas(payload)


if __name__ == "__main__":
    main()