from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent

print(f"ROOT = {ROOT}")
print(f"Existe scripts: {(ROOT / 'scripts').exists()}")

sys.path.insert(0, str(ROOT))

print(sys.path[:3])

from scripts.providers.thetvdb import TheTVDB

API_KEY = "c0fd090c-ea45-437a-9b48-783a9a529aec"
PIN = None      # o tu PIN

provider = TheTVDB(API_KEY, PIN)

print("Autenticando...")

provider._authenticate()

print("OK")

print()

print("Buscando Rick And Morty...")

series = provider.search("Rick And Morty")

print(series)

print()

serie = provider.get_series("Rick And Morty")

print(serie)

print()

serie = provider.get_series_by_id(
    serie["id"]
)

print(serie["name"])
print(serie["year"])
print(serie["image"])

print()

episodes = provider.get_episodes(
    serie["id"]
)

print(len(episodes))

episode = provider.get_episode(
    serie["id"],
    1,
    1
)

print()

print(episode)

print()

for season in provider.get_seasons(
    serie["id"]
):

    print(season)

provider.download_poster(
    serie,
    "poster.jpg"
)

print("Poster descargado.")