import os
import re
import requests
import argparse
from urllib.parse import urlparse

# ==========================================
# IMPORTACIÓN A PRUEBA DE FALLOS
# ==========================================
try:
    # Intenta la importación absoluta (por si lo ejecutas desde la raíz o con PYTHONPATH)
    from scripts.data_store import load_data, save_data
except ModuleNotFoundError:
    # Si falla, hace una importación relativa local (porque ambos archivos están en /scripts)
    from data_store import load_data, save_data

# ==========================================
# CONFIGURACIÓN DE RUTAS
# ==========================================
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
    # 1. Cargar datos fragmentados
    data = load_data(BASE_DIR)

    token = obtener_token(api_key)
    if not token:
        return

    headers = {
        'Authorization': f'Bearer {token}',
        'Accept': 'application/json'
    }

    modificado = False

    # 2. Recorrer la nueva estructura de diccionario (viendo, en_cola, etc.)
    for categoria, series in data.items():
        if not isinstance(series, list):
            continue

        for serie in series:
            tvdb_id = serie.get('tvdb_id')
            if not tvdb_id:
                continue

            titulo = serie.get('titulo', 'Serie sin título')

            # Detectar si le falta algún dato
            falta_caps = 'capitulosPorTemporada' not in serie or not serie['capitulosPorTemporada']
            falta_duracion = 'duracionMedia' not in serie or serie.get('duracionMedia') == 0
            falta_estado_final = 'estado_final' not in serie
            falta_poster = not serie.get("poster_path")

            if falta_caps or falta_duracion or falta_estado_final or falta_poster:
                print(f"🔄 Actualizando datos faltantes para: {titulo} (ID: {tvdb_id}) [{categoria}]")
                
                # Petición única al endpoint extendido
                url = f"https://api4.thetvdb.com/v4/series/{tvdb_id}/extended?meta=episodes"
                
                try:
                    res = requests.get(url, headers=headers, timeout=15)
                    res.raise_for_status()
                    api_data = res.json().get('data', {})

                    # -- A. Actualizar Duración Media --
                    if falta_duracion:
                        serie['duracionMedia'] = api_data.get('averageRuntime', 0)
                        print(f"   + duracionMedia: {serie['duracionMedia']} min")

                    # -- B. Actualizar Capítulos por Temporada --
                    if falta_caps:
                        episodios = api_data.get('episodes', [])
                        valid_eps = [ep for ep in episodios if ep.get('seasonNumber', 0) > 0 and ep.get('aired')]
                        caps_por_temp = {}
                        for ep in valid_eps:
                            t = str(ep['seasonNumber'])
                            caps_por_temp[t] = caps_por_temp.get(t, 0) + 1
                        
                        serie['capitulosPorTemporada'] = caps_por_temp
                        print(f"   + capitulosPorTemporada: {caps_por_temp}")

                    # -- C. Actualizar Estado Final --
                    if falta_estado_final:
                        estado_api = api_data.get('status', {}).get('name', '')
                        serie['estado_final'] = estado_api in ['Ended', 'Canceled']
                        print(f"   + estado_final: {serie['estado_final']} ({estado_api})")

                    # -- D. Descargar Póster (usando tu nueva lógica) --
                    if falta_poster:
                        image_url = resolver_url_imagen(api_data.get('image'))
                        if image_url:
                            serie["image_url"] = image_url
                            poster_path = guardar_poster_local(serie, image_url)
                            if poster_path:
                                serie["poster_path"] = poster_path
                        else:
                            print(f"   - La API no devolvió imagen para el póster.")

                    modificado = True

                except requests.exceptions.RequestException as e:
                    print(f"  ❌ Error al obtener info de {titulo}: {e}")

    # 3. Guardar cambios usando data_store si hubo modificaciones
    if modificado:
        save_data(data, BASE_DIR)
        print("\n✅ Archivos JSON actualizados correctamente con los nuevos metadatos.")
    else:
        print("\n✨ Todo está al día. No había series con datos faltantes.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Completa metadatos faltantes y descarga pósters de series en la base de datos fragmentada."
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