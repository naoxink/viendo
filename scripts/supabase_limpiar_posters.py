import os
import sys
import io
import argparse
from pathlib import Path
from supabase import create_client

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

ROOT = Path(__file__).resolve().parent.parent
POSTERS_DIR = ROOT / "posters"
EXTENSIONES = {".jpg", ".jpeg", ".png", ".webp"}
PAGE_SIZE = 1000


def obtener_posters_en_uso(db) -> set[str]:
    """Nombres de fichero referenciados por cualquier fila de `series`
    (viendo, en_cola, completadas y dropeadas)."""
    en_uso: set[str] = set()
    filas_totales = 0
    inicio = 0

    while True:
        res = (
            db.table("series")
            .select("poster_path")
            .range(inicio, inicio + PAGE_SIZE - 1)
            .execute()
        )
        filas = res.data or []
        filas_totales += len(filas)

        for fila in filas:
            ruta = fila.get("poster_path")
            if ruta:
                en_uso.add(Path(ruta).name)

        if len(filas) < PAGE_SIZE:
            break
        inicio += PAGE_SIZE

    if filas_totales == 0:
        raise RuntimeError("La tabla 'series' devolvió 0 filas; se aborta para no borrar todo.")

    return en_uso


def limpiar(dry_run: bool, max_ratio: float, force: bool) -> int:
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Faltan SUPABASE_URL / SUPABASE_KEY.")
        return 1

    if not POSTERS_DIR.is_dir():
        print("ℹ️ No existe la carpeta 'posters/'. Nada que limpiar.")
        return 0

    db = create_client(SUPABASE_URL, SUPABASE_KEY)

    try:
        en_uso = obtener_posters_en_uso(db)
    except Exception as exc:
        print(f"❌ No se pudo consultar Supabase: {exc}")
        return 1

    ficheros = [
        f for f in POSTERS_DIR.iterdir()
        if f.is_file() and f.suffix.lower() in EXTENSIONES
    ]
    huerfanos = [f for f in ficheros if f.name not in en_uso]

    print(f"📊 {len(ficheros)} pósters en disco · {len(en_uso)} en uso · {len(huerfanos)} huérfanos.")

    if not huerfanos:
        print("✨ No hay pósters que borrar.")
        return 0

    # Freno de seguridad: si va a desaparecer una parte enorme, algo va mal
    if ficheros and len(huerfanos) / len(ficheros) > max_ratio and not force:
        print(
            f"🛑 Se borraría más del {int(max_ratio * 100)}% de los pósters. "
            "Aborto por seguridad (usa --force si es intencionado)."
        )
        return 1

    for f in sorted(huerfanos):
        if dry_run:
            print(f"   [dry-run] borraría {f.name}")
            continue
        try:
            f.unlink()
            print(f"   🗑️ Borrado {f.name}")
        except OSError as exc:
            print(f"   ⚠️ No se pudo borrar {f.name}: {exc}")

    print("✅ Limpieza completada." if not dry_run else "ℹ️ Dry-run: no se ha borrado nada.")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Borra de posters/ los ficheros que ya no referencia ninguna serie de Supabase."
    )
    parser.add_argument("--dry-run", action="store_true", help="Solo muestra lo que borraría")
    parser.add_argument("--max-ratio", type=float, default=0.5,
                        help="Fracción máxima de pósters que se permite borrar de una vez (defecto 0.5)")
    parser.add_argument("--force", action="store_true", help="Ignora el freno de seguridad")
    args = parser.parse_args()

    sys.exit(limpiar(args.dry_run, args.max_ratio, args.force))