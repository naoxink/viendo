import os
import re
import sys
import requests
import argparse
from urllib.parse import urlparse
from supabase import create_client, Client

from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.episodios_calc import construir_fechas_por_temporada, calcular_estado_pendiente

# CONFIGURACIÓN DE SUPABASE
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://pfssrcyxpmnofezfnrct.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY") # Usa service_role para scripts de backend

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# CONFIGURACIÓN DE RUTAS (para la carpeta de pósters locales)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if 'scripts' in os.path.abspath(__file__) else os.path.dirname(os.path.abspath(__file__))
POSTERS_DIR = os.path.join(BASE_DIR, "posters")

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

    slug = re.sub(r"[^A-Za-z0-9._-]+", "_", titulo).strip("_") or f"serie_{tvdb_id}"
    extension = os.path.splitext(urlparse(image_url).path)[1] or ".jpg"

    filename = f"{tvdb_id}_{slug}{extension}"
    local_path = os.path.join(POSTERS_DIR, filename)
    rel_path = os.path.join("posters", filename).replace(os.sep, "/")

    if os.path.exists(local_path):
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

def completar_metadatos(api_key):
    # 1. Cargar todas las series directamente desde Supabase
    res = supabase.table("series").select("*").execute()
    series_db = res.data or []

    if not series_db:
        print("🔕 No hay series en la base de datos.")
        return

    token = obtener_token(api_key)
    if not token:
        return

    headers = {
        'Authorization': f'Bearer {token}',
        'Accept': 'application/json'
    }

    actualizadas_count = 0

    # 2. Recorrer la lista de series
    for serie in series_db:
        tvdb_id = serie.get('tvdb_id')
        serie_id = serie.get('id')
        if not tvdb_id:
            continue

        titulo = serie.get('titulo', 'Serie sin título')

        # Detectar si le falta algún dato (mapeando a los nombres de columna en Supabase)
        falta_caps = not serie.get('capitulos_por_temporada')
        falta_fechas = not serie.get('fechas_episodios')  # 👈 nuevo
        falta_duracion = not serie.get('duracion_media') or serie.get('duracion_media') == 0
        falta_estado_final = 'estado_final' not in serie
        falta_poster = not serie.get("poster_path")

        if falta_caps or falta_fechas or falta_duracion or falta_estado_final or falta_poster:
            print(f"🔄 Actualizando datos faltantes para: {titulo} (ID: {tvdb_id})...")
            
            # Petición única al endpoint extendido de TheTVDB
            url = f"https://api4.thetvdb.com/v4/series/{tvdb_id}/extended?meta=episodes"
            
            try:
                res_api = requests.get(url, headers=headers, timeout=15)
                res_api.raise_for_status()
                api_data = res_api.json().get('data', {})

                update_payload = {}

                # -- A. Actualizar Duración Media --
                if falta_duracion:
                    duracion = api_data.get('averageRuntime', 0) or api_data.get('runtime', 0)
                    update_payload['duracion_media'] = duracion
                    print(f"   + duracion_media: {duracion} min")

                # -- B. Capítulos por temporada + fechas por capítulo --
                # Reutilizamos la misma llamada a la API para rellenar ambos campos,
                # así no gastamos una petición extra solo por las fechas.
                if falta_caps or falta_fechas:
                    episodios = api_data.get('episodes', [])
                    valid_eps = [ep for ep in episodios if ep.get('seasonNumber', 0) > 0]

                    if falta_caps:
                        caps_por_temp = {}
                        for ep in valid_eps:
                            if not ep.get('aired'):
                                continue
                            t = str(ep['seasonNumber'])
                            caps_por_temp[t] = caps_por_temp.get(t, 0) + 1
                        update_payload['capitulos_por_temporada'] = caps_por_temp
                        print(f"   + capitulos_por_temporada: {caps_por_temp}")

                    if falta_fechas:
                        fechas_por_temp = construir_fechas_por_temporada(valid_eps)
                        update_payload['fechas_episodios'] = fechas_por_temp
                        print(f"   + fechas_episodios: {sum(len(c) for c in fechas_por_temp.values())} capítulos con fecha")

                # -- C. Actualizar Estado Final --
                if falta_estado_final:
                    estado_api = api_data.get('status', {}).get('name', '')
                    update_payload['estado_final'] = estado_api if estado_api in ['Ended', 'Canceled'] else None
                    print(f"   + estado_final: {update_payload['estado_final']} ({estado_api})")

                # -- D. Descargar Póster --
                if falta_poster:
                    image_url = resolver_url_imagen(api_data.get('image'))
                    if image_url:
                        update_payload["image_url"] = image_url
                        poster_path = guardar_poster_local(serie, image_url)
                        if poster_path:
                            update_payload["poster_path"] = poster_path
                    else:
                        print(f"   - La API no devolvió imagen para el póster.")

                # Si hay datos nuevos, hacemos el update en Supabase
                if update_payload:
                    supabase.table("series").update(update_payload).eq("id", serie_id).execute()
                    actualizadas_count += 1

            except requests.exceptions.RequestException as e:
                print(f"  ❌ Error al obtener info de {titulo}: {e}")

    if actualizadas_count > 0:
        print(f"\n✅ Base de datos de Supabase actualizada correctamente ({actualizadas_count} series modificadas).")
    else:
        print("\n✨ Todo está al día. No había series con metadatos faltantes.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Completa metadatos faltantes (incluyendo fechas por capítulo) y descarga pósters de series en Supabase."
    )
    parser.add_argument(
        "--apikey",
        required=True,
        help="API Key de TheTVDB"
    )
    args = parser.parse_args()

    try:
        completar_metadatos(args.apikey)
    except Exception as e:
        print(f"❌ El script falló inesperadamente: {e}")