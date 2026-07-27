import os
import re
import sys
import io
import unicodedata
import requests
import argparse
from urllib.parse import urlparse
from supabase import create_client, Client

# Forzar la salida estándar y de errores a UTF-8 de manera estricta
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# CONFIGURACIÓN DE SUPABASE
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://pfssrcyxpmnofezfnrct.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmc3NyY3l4cG1ub2ZlemZucmN0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTE0MzUxMiwiZXhwIjoyMTAwNzE5NTEyfQ.Utz69UFiM2_3iYGHPLT28nH16VU9PfDCTx0IZngcMRw") # Usa service_role para scripts de backend

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# CONFIGURACIÓN DE RUTAS (para la carpeta local de pósters)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if 'scripts' in os.path.abspath(__file__) else os.path.dirname(os.path.abspath(__file__))
POSTERS_DIR = os.path.join(BASE_DIR, "posters")


def limpiar_texto_seguro(texto):
    """Elimina tildes y caracteres extraños para evitar errores ASCII en rutas o logs."""
    if not texto:
        return "serie"
    # Normaliza caracteres Unicode y elimina marcas diacríticas
    nfkd_form = unicodedata.normalize('NFKD', str(texto))
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)])


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
    titulo_raw = serie.get("titulo", "serie")

    # Limpiamos el título de forma segura para que no rompa el sistema de archivos con tildes o eñes
    titulo_limpio = limpiar_texto_seguro(titulo_raw)
    slug = (
        re.sub(r"[^A-Za-z0-9._-]+", "_", titulo_limpio).strip("_")
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
    # 1. Cargar todas las series desde Supabase
    res = supabase.table("series").select("*").execute()
    series_db = res.data or []

    # 2. Filtrar aquellas que tienen tvdb_id y no tienen poster_path
    series_sin_poster = [
        s for s in series_db 
        if s.get("tvdb_id") and not s.get("poster_path")
    ]

    print(
        f"📊 Encontradas {len(series_sin_poster)} series "
        f"con tvdb_id y sin poster en Supabase."
    )

    if not series_sin_poster:
        print("✨ No hay pósters pendientes de descarga.")
        return

    token = obtener_token(api_key)
    if not token:
        return

    headers = {"Authorization": f"Bearer {token}"}

    # 3. Procesar únicamente las necesarias
    for serie in series_sin_poster:
        tvdb_id = serie["tvdb_id"]
        serie_id = serie["id"]
        titulo = serie.get("titulo", "Sin título")

        print(f"🔍 Analizando: {titulo} (ID: {tvdb_id})...")
        update_payload = {}

        # Caso 1: ya tenemos la URL guardada en la base de datos
        image_url = serie.get("image_url")

        if image_url:
            print("   📦 Usando image_url almacenada en la BD")
            poster_path = guardar_poster_local(serie, image_url)

            if poster_path:
                update_payload["poster_path"] = poster_path
                supabase.table("series").update(update_payload).eq("id", serie_id).execute()
            continue

        # Caso 2: necesitamos consultar TheTVDB
        try:
            print("   🌐 Consultando TheTVDB...")
            url_info = f"https://api4.thetvdb.com/v4/series/{tvdb_id}"

            res_info = requests.get(url_info, headers=headers, timeout=10)
            res_info.raise_for_status()

            series_data = res_info.json().get("data", {})
            image_url = resolver_url_imagen(series_data.get("image"))

            if not image_url:
                print("   ⚠️ La serie no tiene imagen en TheTVDB")
                continue

            # Guardamos la URL y descargamos el póster localmente
            update_payload["image_url"] = image_url
            poster_path = guardar_poster_local(serie, image_url)

            if poster_path:
                update_payload["poster_path"] = poster_path

            # Actualizamos Supabase con la nueva información de la imagen
            if update_payload:
                supabase.table("series").update(update_payload).eq("id", serie_id).execute()

        except requests.exceptions.RequestException as e:
            print(f"   ⚠️ Error consultando TheTVDB: {e}")

        except Exception as e:
            print(f"   ⚠️ Error inesperado: {e}")

    print("\n💾 ¡Sincronización de pósters completada en Supabase!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description=(
            "Descarga posters para todas las series en Supabase "
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