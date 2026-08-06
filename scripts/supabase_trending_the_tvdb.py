
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

# Supabase desde ENV o valores por defecto (cambiar si corresponde)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

supabase: Client | None = None


def get_supabase_client() -> Client | None:
	global supabase
	if supabase is not None:
		return supabase

	if not SUPABASE_KEY:
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


def vaciar_trending_table():
	"""Borra todas las filas de `trending_series` (si existe)."""
	db = get_supabase_client()
	if db is None:
		print("⚠️ No hay SUPABASE_KEY configurada; no se vacía la tabla en modo local.")
		return

	try:
		# Eliminar todo usando una condición amplia (tvdb_id != 0)
		db.table("trending_series").delete().neq("tvdb_id", 0).execute()
		print("🗑️ Tabla 'trending_series' vaciada.")
	except Exception as exc:
		print(f"⚠️ No se pudo vaciar 'trending_series' (¿existe la tabla?): {exc}")


def insertar_trending(payload: list[dict]):
	if not payload:
		print("ℹ️ No hay nuevas filas para insertar en 'trending_series'.")
		return

	db = get_supabase_client()
	if db is None:
		print("⚠️ No hay SUPABASE_KEY configurada; no se insertan filas en Supabase en modo local.")
		return

	try:
		res = db.table("trending_series").insert(payload).execute()
		print(f"✅ Insertadas {len(res.data or [])} filas en 'trending_series'.")
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
		"next_aired": s.get("next_aired"),
		"status": s.get("status"),
		"created_at": datetime.utcnow().isoformat()
	}


def _parse_maybe_datetime(value) -> datetime | None:
	if not value:
		return None

	if isinstance(value, datetime):
		return value

	texto = str(value).strip()
	if not texto:
		return None

	# Intentar ISO first
	try:
		return datetime.fromisoformat(texto)
	except Exception:
		pass

	for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
		try:
			return datetime.strptime(texto, fmt)
		except Exception:
			continue

	return None


def is_next_aired_future(value) -> bool:
	dt = _parse_maybe_datetime(value)
	if dt is None:
		return False
	return dt > datetime.now()


def main():
	parser = argparse.ArgumentParser(description="Pobla semanal de trending en Supabase (evita duplicados con series existentes)")
	parser.add_argument("--thetvdb-api-key", dest="apikey", required=True)
	parser.add_argument("--limit", type=int, default=20)
	parser.add_argument("--min-score", type=float, default=0.0)
	parser.add_argument("--require-next", action="store_true", help="Sólo incluir series con próxima emisión en el futuro")
	parser.add_argument("--dry-run", action="store_true", help="No escribe en Supabase, sólo muestra lo que haría")

	args = parser.parse_args()

	provider = TheTVDB(args.apikey)

	print("🌐 Solicitando trending desde TheTVDB...")
	trending = provider.get_trending(limit=args.limit, min_score=args.min_score)

	if not trending:
		print("⚠️ Recibidos 0 resultados de trending.")
		return

	print(f"✅ Recibidos {len(trending)} resultados de trending.")

	existentes = obtener_tvdb_ids_existentes()
	nuevos = []

	for s in trending:
		sid = s.get("id")
		try:
			sid_int = int(sid) if sid is not None else None
		except Exception:
			sid_int = None

		if sid_int and sid_int in existentes:
			print(f"➡️ Saltando {s.get('name')} (tvdb_id={sid_int}) — ya en series.")
			continue

		# Si se requiere próxima emisión, descartamos si no está en el futuro
		if args.require_next:
			if not is_next_aired_future(s.get("next_aired")):
				print(f"➡️ Saltando {s.get('name')} (tvdb_id={sid_int}) — no tiene próxima emisión futura.")
				continue

		nuevos.append(build_payload_item(s))

	print(f"ℹ️ Nuevas series para insertar: {len(nuevos)}")

	if args.dry_run:
		for item in nuevos:
			print(item)
		return

	# Vaciar tabla y subir nuevas
	vaciar_trending_table()
	insertar_trending(nuevos)


if __name__ == "__main__":
	main()

