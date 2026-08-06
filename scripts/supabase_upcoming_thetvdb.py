import os
import sys
import io
import argparse
from datetime import datetime
from supabase import create_client, Client

# Añadir root del proyecto al path (como hacen los tests) para imports relativos
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
	sys.path.insert(0, str(ROOT))

from scripts.providers.thetvdb import TheTVDB

# Forzar la salida en UTF-8 en entornos variados
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Supabase desde ENV (sin valor por defecto real: usa un placeholder vacío)
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


def obtener_tvdb_ids_existentes() -> set[int]:
	"""Devuelve el set de tvdb_id ya guardados en la tabla `series`."""
	db = get_supabase_client()
	if db is None:
		print("⚠️ No hay SUPABASE_KEY configurada; asumiendo que no existen series en Supabase.")
		return set()

	try:
		res = db.table("series").select("tvdb_id").execute()
		filas = res.data or []
		return {int(f.get("tvdb_id")) for f in filas if f.get("tvdb_id")}
	except Exception as exc:  # pragma: no cover - supabase errors at runtime
		print(f"⚠️ Error consultando series existentes en Supabase: {exc}")
		return set()


def vaciar_upcoming_table():
	"""Borra todas las filas de `upcoming_series` (si existe)."""
	db = get_supabase_client()
	if db is None:
		print("⚠️ No hay SUPABASE_KEY configurada; no se vacía la tabla en modo local.")
		return

	try:
		db.table("upcoming_series").delete().neq("tvdb_id", 0).execute()
		print("🗑️ Tabla 'upcoming_series' vaciada.")
	except Exception as exc:
		print(f"⚠️ No se pudo vaciar 'upcoming_series' (¿existe la tabla?): {exc}")


def insertar_upcoming(payload: list[dict]):
	if not payload:
		print("ℹ️ No hay nuevas filas para insertar en 'upcoming_series'.")
		return

	db = get_supabase_client()
	if db is None:
		print("⚠️ No hay SUPABASE_KEY configurada; no se insertan filas en Supabase en modo local.")
		return

	try:
		res = db.table("upcoming_series").insert(payload).execute()
		print(f"✅ Insertadas {len(res.data or [])} filas en 'upcoming_series'.")
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
		"first_aired": s.get("first_aired"),
		"days_until_premiere": s.get("days_until_premiere"),
		"status": s.get("status"),
		"created_at": datetime.utcnow().isoformat()
	}


def main():
	parser = argparse.ArgumentParser(description="Pobla semanal de próximos estrenos en Supabase (evita duplicados con series existentes)")
	parser.add_argument("--thetvdb-api-key", dest="apikey", required=True)
	parser.add_argument("--limit", type=int, default=20)
	parser.add_argument("--order-by", choices=["score", "date"], default="score")
	parser.add_argument("--days-ahead", type=int, default=30, help="Ventana en días hacia adelante para considerar un estreno próximo")
	parser.add_argument("--languages", nargs="+", default=["spa", "eng"], help="Idiomas a incluir, p. ej. --languages spa eng")
	parser.add_argument("--dry-run", action="store_true", help="No escribe en Supabase, sólo muestra lo que haría")

	args = parser.parse_args()

	provider = TheTVDB(args.apikey)

	print("🌐 Solicitando próximos estrenos desde TheTVDB...")
	upcoming = provider.get_upcoming_premieres(limit=20, days_ahead=60, order_by=args.order_by)

	if not upcoming:
		print("⚠️ Recibidos 0 resultados de upcoming.")
		return

	print(f"✅ Recibidos {len(upcoming)} resultados de upcoming.")

	existentes = obtener_tvdb_ids_existentes()
	nuevos = []

	for s in upcoming:
		sid = s.get("id")
		try:
			sid_int = int(sid) if sid is not None else None
		except Exception:
			sid_int = None

		if sid_int and sid_int in existentes:
			print(f"➡️ Saltando {s.get('name')} (tvdb_id={sid_int}) — ya en series.")
			continue

		nuevos.append(build_payload_item(s))

	print(f"ℹ️ Nuevos estrenos para insertar: {len(nuevos)}")

	if args.dry_run:
		for item in nuevos:
			print(item)
		return

	# Vaciar tabla y subir nuevas
	vaciar_upcoming_table()
	insertar_upcoming(nuevos)


if __name__ == "__main__":
	main()