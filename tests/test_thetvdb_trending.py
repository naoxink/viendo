import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.providers.thetvdb import TheTVDB


def get_api_key(args) -> str:
    api_key = args.apikey or os.environ.get('apikey') or os.environ.get('TVDB_API_KEY') or os.environ.get('THETVDB_API_KEY')
    if not api_key:
        raise RuntimeError('No TVDB API key configured. Use --apikey or set env TVDB_API_KEY/THETVDB_API_KEY.')
    return api_key


def main() -> int:
    parser = argparse.ArgumentParser(description='Ejecuta el método get_trending del provider TheTVDB y muestra el resultado.')
    parser.add_argument('--apikey', help='API key para TheTVDB')
    parser.add_argument('--limit', type=int, default=20, help='Número máximo de series a devolver.')
    parser.add_argument('--min-score', type=float, default=0.0, help='Puntuación mínima para filtrar series.')
    args = parser.parse_args()

    api_key = get_api_key(args)
    provider = TheTVDB(api_key)

    print('🌐 Solicitando trending desde TheTVDB...')
    trending = provider.get_trending(limit=args.limit, min_score=args.min_score)

    print(f'✅ Recibidos {len(trending)} resultados de trending.')

    for index, serie in enumerate(trending, start=1):
        print(f'--- Serie #{index} ---')
        print(f'tvdb_id: {serie.get("id")}')
        print(f'name: {serie.get("name")}')
        print(f'score: {serie.get("score")}')
        print(f'status: {serie.get("status")}')
        print(f'next_aired: {serie.get("next_aired")}')
        print(f'airsDays: {serie.get("airsDays")}')
        print(f'airsTime: {serie.get("airsTime")}')
        print(f'overview: {serie.get("overview")!r}')
        print()

    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except RuntimeError as exc:
        print(f'❌ {exc}')
        raise SystemExit(1)
