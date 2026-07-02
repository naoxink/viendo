import json
import os
import re
import requests
import argparse
from urllib.parse import urlparse

from scripts.data_store import load_data, save_data

# CONFIGURACIÓN
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
POSTERS_DIR = os.path.join(BASE_DIR, "posters")


def resolver_url_imagen(image_value):
    """Convierte el campo image de TheTVDB en una URL de imagen usable."""
    if not image_value:
        return None

    if image_value.startswith(("http://", "https://")):
        return image_value

    if image_value.startswith("/"):
        return f"https://artworks.thetvdb.com{image_value}"

    return f"https://artworks.thetvdb.com/banners/{image_value}"


def guardar_poster_local(serie, image_url):
    """Descarga la imagen de la serie en la carpeta posters si aún no existe."""
    if not image_url:
        return None

    os.makedirs(POSTERS_DIR, exist_ok=True)

    tvdb_id = serie.get("tvdb_id") or "serie"
    titulo = serie.get("titulo", "serie")

    slug = (
        re.sub(r"[^A-Za-z0-9._-]+", "_", titulo).strip("_")
        or f"serie_{tvdb_id}"
    )

    extension = os.path.splitext(urlparse(image_url).path)[1] or ".jpg"

    filename = f"{tvdb_id}_{slug}{extension}"
    local_path = os.path.join(POSTERS_DIR, filename)
    rel_path = os.path.join("posters", filename).replace(os.sep, "/")

    if os.path.exists(local_path):
        print(f"   📁 Ya existe: {rel_path}")
        return rel_path

    try:
        response = requests.get(image_url, timeout=20, stream=True)
        response.raise_for_status()

        with open(local_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

        print(f"   🖼️ Poster guardado en {rel_path}")
        return rel_path

    except requests.exceptions.RequestException as e:
        print(f"   ⚠️ No se pudo descargar la imagen: {e}")
        return None


def obtener_token(api_key):
    """Obtiene el token Bearer JWT v4 para autenticarse en TheTVDB."""
    url = "https://api4.thetvdb.com/v4/login"
    payload = {"apikey": api_key}

    try:
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        return response.json()["data"]["token"]

    except requests.exceptions.RequestException as e:
        print(f"❌ Error crítico al autenticar en TheTVDB: {e}")
        return None


def descargar_posters(api_key):
    # Cargar JSON
    data = load_data(BASE_DIR)

    token = obtener_token(api_key)
    if not token:
        return

    headers = {"Authorization": f"Bearer {token}"}

    # Buscar series candidatas
    series_sin_poster = []

    for categoria, series in data.items():
        if not isinstance(series, list):
            continue

        for serie in series:
            if (
                isinstance(serie, dict)
                and serie.get("tvdb_id")
                and not serie.get("poster_path")
            ):
                series_sin_poster.append(serie)

    print(
        f"📊 Encontradas {len(series_sin_poster)} series "
        f"con tvdb_id y sin poster."
    )

    # Procesar únicamente las necesarias
    for serie in series_sin_poster:
        tvdb_id = serie["tvdb_id"]
        titulo = serie.get("titulo", "Sin título")

        print(f"🔍 Analizando: {titulo} (ID: {tvdb_id})...")

        # Caso 1: ya tenemos la URL guardada
        image_url = serie.get("image_url")

        if image_url:
            print("   📦 Usando image_url almacenada")

            poster_path = guardar_poster_local(
                serie,
                image_url
            )

            if poster_path:
                serie["poster_path"] = poster_path

            continue

        # Caso 2: necesitamos consultar TheTVDB
        try:
            print("   🌐 Consultando TheTVDB...")

            url_info = f"https://api4.thetvdb.com/v4/series/{tvdb_id}"

            res_info = requests.get(
                url_info,
                headers=headers,
                timeout=10
            )

            res_info.raise_for_status()

            series_data = res_info.json().get("data", {})

            image_url = resolver_url_imagen(
                series_data.get("image")
            )

            if not image_url:
                print("   ⚠️ La serie no tiene imagen en TheTVDB")
                continue

            # Guardamos la URL para futuras ejecuciones
            serie["image_url"] = image_url

            poster_path = guardar_poster_local(
                serie,
                image_url
            )

            if poster_path:
                serie["poster_path"] = poster_path

        except requests.exceptions.RequestException as e:
            print(f"   ⚠️ Error consultando TheTVDB: {e}")

        except Exception as e:
            print(f"   ⚠️ Error inesperado: {e}")

    # Guardar cambios
    save_data(data, BASE_DIR)

    print("\n💾 ¡Sincronización completada!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description=(
            "Descarga posters para todas las series "
            "que tengan tvdb_id y no tengan poster_path."
        )
    )

    parser.add_argument(
        "--apikey",
        required=True,
        help="API Key de TheTVDB"
    )

    args = parser.parse_args()

    try:
        descargar_posters(args.apikey)

    except Exception as e:
        print(f"❌ El script falló inesperadamente: {e}")