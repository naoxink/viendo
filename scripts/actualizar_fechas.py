import json
import os
import re
import requests
import argparse
from datetime import datetime, time
from urllib.parse import urlparse

from scripts.data_store import load_data, save_data

# CONFIGURACIÓN
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
POSTERS_DIR = os.path.join(BASE_DIR, 'posters')


def resolver_url_imagen(image_value):
    """Convierte el campo image de TheTVDB en una URL de imagen usable."""
    if not image_value:
        return None

    if image_value.startswith(("http://", "https://")):
        return image_value

    if image_value.startswith("/"):
        return f"https://artworks.thetvdb.com{image_value}"

    return f"https://artworks.thetvdb.com/banners/{image_value}"


def obtener_fecha_hora_emision(ep, hora_default=None):
    """Devuelve la fecha y hora de emisión del episodio, usando la hora de la serie si el capítulo no la trae."""
    aired = ep.get('aired')
    if not aired:
        return None

    try:
        fecha_emision = datetime.strptime(aired, '%Y-%m-%d').date()
    except ValueError:
        return None

    hora_str = ep.get('airTime') or ep.get('airedTime') or hora_default
    if hora_str:
        for fmt in ('%H:%M', '%H:%M:%S', '%I:%M %p', '%I:%M%p'):
            try:
                hora = datetime.strptime(hora_str, fmt).time()
                return datetime.combine(fecha_emision, hora)
            except ValueError:
                continue

    return None


def es_emision_futura(ep, ahora=None, hora_default=None):
    """Comprueba si el episodio está en el futuro usando la hora cuando exista; si no, solo la fecha."""
    if ahora is None:
        ahora = datetime.now()

    fecha_hora = obtener_fecha_hora_emision(ep, hora_default=hora_default)
    if fecha_hora is not None:
        return fecha_hora > ahora

    aired = ep.get('aired')
    if not aired:
        return False

    try:
        fecha_emision = datetime.strptime(aired, '%Y-%m-%d').date()
    except ValueError:
        return False

    return fecha_emision > ahora.date()


def guardar_poster_local(serie, image_url):
    """Descarga la imagen de la serie en la carpeta posters si aún no existe."""
    if not image_url:
        return None

    os.makedirs(POSTERS_DIR, exist_ok=True)

    tvdb_id = serie.get('tvdb_id') or 'serie'
    titulo = serie.get('titulo', 'serie')
    slug = re.sub(r'[^A-Za-z0-9._-]+', '_', titulo).strip('_') or f"serie_{tvdb_id}"
    extension = os.path.splitext(urlparse(image_url).path)[1] or '.jpg'
    filename = f"{tvdb_id}_{slug}{extension}"
    local_path = os.path.join(POSTERS_DIR, filename)
    rel_path = os.path.join('posters', filename).replace(os.sep, '/')

    if os.path.exists(local_path):
        return rel_path

    try:
        response = requests.get(image_url, timeout=20, stream=True)
        response.raise_for_status()
        with open(local_path, 'wb') as f:
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
        return response.json()['data']['token']
    except requests.exceptions.RequestException as e:
        print(f"❌ Error crítico al autenticar en TheTVDB: {e}")
        return None

def enviar_notificacion_telegram(token, chat_id, mensaje):
    """Envía un mensaje de texto a un chat de Telegram."""
    if not token or not chat_id:
        return
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": mensaje,
        "parse_mode": "Markdown" # Nos permite usar negritas con *texto*
    }
    try:
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        return True
    except requests.exceptions.RequestException as e:
        print(f"⚠️ No se pudo enviar la notificación de Telegram: {e}")
        return False

def actualizar_fechas(api_key):
    # 1. Cargar tu archivo JSON
    data = load_data(BASE_DIR)

    token = obtener_token(api_key)
    if not token:
        return

    headers = {"Authorization": f"Bearer {token}"}
    ahora = datetime.now()
    hoy = ahora.date()
    notificaciones = [] # <--- Lista para acumular los cambios

    # Preparamos las listas
    viendo_actual = data.get('viendo', [])
    completadas = data.get('completadas', [])
    
    nuevas_viendo = []

    # 2. Recorrer la lista de series en seguimiento
    for serie in viendo_actual:
        tvdb_id = serie.get('tvdb_id')
        if not tvdb_id:
            print(f"⚠️ Saltando '{serie.get('titulo', 'Sin título')}': No tiene tvdb_id configurado.")
            nuevas_viendo.append(serie)
            continue
            
        print(f"🔍 Analizando: {serie['titulo']} (ID: {tvdb_id})...")
        
        # OBTENER EL ESTADO GLOBAL DE LA SERIE (Y LA IMAGEN SI EXISTE)
        url_info = f"https://api4.thetvdb.com/v4/series/{tvdb_id}"
        series_data = {}
        try:
            res_info = requests.get(url_info, headers=headers, timeout=10)
            series_data = res_info.json().get('data', {})
            estado_serie = series_data.get('status', {}).get('name', 'Unknown')
        except (requests.exceptions.RequestException, KeyError, ValueError):
            estado_serie = "Unknown"

        remote_image_url = resolver_url_imagen(series_data.get('image'))
        serie['image_url'] = remote_image_url
        serie['poster_path'] = serie.get('poster_path') or guardar_poster_local(serie, remote_image_url)

        # OBTENER LOS EPISODIOS
        url_eps = f"https://api4.thetvdb.com/v4/series/{tvdb_id}/episodes/default"
        try:
            res_eps = requests.get(url_eps, headers=headers, timeout=10)
            if res_eps.status_code != 200:
                print(f"❌ Error {res_eps.status_code} al consultar episodios.")
                nuevas_viendo.append(serie)
                continue
            episodes = res_eps.json().get('data', {}).get('episodes', [])
        except requests.exceptions.RequestException as e:
            print(f"❌ Error de red: {e}")
            nuevas_viendo.append(serie)
            continue
            
        if not episodes:
            print(f"⚠️ No se encontraron episodios.")
            nuevas_viendo.append(serie)
            continue
        
        # Filtrar y ordenar
        valid_eps = [e for e in episodes if e.get('seasonNumber', 0) > 0 and e.get('aired')]
        valid_eps.sort(key=lambda x: (x['seasonNumber'], x['number']))
        
        user_s = serie.get('temporada', 1)
        user_e = serie.get('capitulo', 0)
        esta_pendiente = serie.get('pendiente', False)
        
        emitidos = []
        futuros = []
        
        hora_serie = None
        serie_data = series_data or {}
        schedule = serie_data.get('status', {}).get('name', '')
        if schedule:
            pass

        for ep in valid_eps:
            hora_serie = serie_data.get('airsTime') or serie_data.get('airTime') or serie_data.get('airs', {}).get('time') or hora_serie
            if es_emision_futura(ep, ahora, hora_default=hora_serie):
                futuros.append(ep)
            else:
                emitidos.append(ep)

        nuevos_emitidos = [
            ep for ep in emitidos 
            if ep['seasonNumber'] > user_s or (ep['seasonNumber'] == user_s and ep['number'] > user_e)
        ]
        
        # 3. APLICAR REGLAS DE NEGOCIO
        if not esta_pendiente:
            if nuevos_emitidos:
                siguiente = nuevos_emitidos[0]
                serie['temporada'] = siguiente['seasonNumber']
                serie['capitulo'] = siguiente['number']
                serie['pendiente'] = True
                serie['acumulados'] = len(nuevos_emitidos) - 1
                serie.pop('proximaFecha', None)
                print(f"   ✨ ¡Nuevo capítulo detectado! Avanzado a T{serie['temporada']}E{serie['capitulo']} (Pendiente).")
                nuevas_viendo.append(serie)
                notificaciones.append(f"✨ *{serie['titulo']}*: ¡Nuevo capítulo disponible! Avanzado a T{serie['temporada']}E{serie['capitulo']}.")
            else:
                serie['acumulados'] = 0
                
                # CASO: SERIE FINALIZADA Y USUARIO AL DÍA
                if not futuros and estado_serie in ["Ended", "Canceled"]:
                    # Mantenemos los campos de seguimiento vivos
                    serie['proximaFecha'] = "TBA" # Reemplazamos fechas antiguas por TBA
                    serie['estado_final'] = estado_serie
                    serie['vistoEn'] = hoy.year # Archiva en 2026 (o el año actual) para el render
                    
                    if 'nota' not in serie:
                        serie['nota'] = "-" # Para evitar undefined en el frontend
                        
                    completadas.append(serie)
                    print(f"   🏆 ¡Serie terminada ({estado_serie})! Movida a Completadas automáticamente en {hoy.year} conservando su progreso.")
                    notificaciones.append(f"   🏆 ¡Serie terminada ({estado_serie})! Movida a Completadas automáticamente en {hoy.year} conservando su progreso.")
                else:
                    if futuros:
                        serie['proximaFecha'] = futuros[0]['aired']
                        print(f"   📅 Al día. Próximo estreno el: {serie['proximaFecha']}")
                        # Si la fecha ha cambiado respecto a la que tenías guardada, puedes avisar:
                        fecha_nueva = futuros[0]['aired']
                        if serie.get('proximaFecha') != fecha_nueva:
                            notificaciones.append(f"📅 *{serie['titulo']}*: Nueva fecha de estreno confirmada para el *{fecha_nueva}*.")
                    else:
                        serie['proximaFecha'] = "TBA"
                        print("   📅 Al día. Sin fecha de regreso confirmada (TBA).")
                    nuevas_viendo.append(serie)
                    
        else:
            serie['acumulados'] = len(nuevos_emitidos)
            serie.pop('proximaFecha', None)
            print(f"   ⏳ Tienes trabajo acumulado: {serie['acumulados']} capítulos pendientes extra.")
            nuevas_viendo.append(serie)

    # 4. GUARDAR LOS CAMBIOS EN EL JSON
    data['viendo'] = nuevas_viendo
    data['completadas'] = completadas

    save_data(data, BASE_DIR)

    print("\n💾 ¡Los archivos de datos fragmentados han sido sincronizados con éxito!")
    # 5. ENVIAR NOTIFICACIONES SI HAY CAMBIOS
    import os
    tg_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    tg_chat_id = os.environ.get('TELEGRAM_CHAT_ID')

    if notificaciones and tg_token and tg_chat_id:
        cabecera = "🤖 *Resumen de actualización de series:*\n\n"
        mensaje_final = cabecera + "\n".join(notificaciones)
        notificacion_ok = enviar_notificacion_telegram(tg_token, tg_chat_id, mensaje_final)
        return notificacion_ok # Sí o No envía notificación

    return False # No envía notificación

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Actualiza fechas de series y gestiona finalizadas automáticamente.')
    parser.add_argument('--apikey', required=True, help='API Key de TheTVDB')
    
    args = parser.parse_args()

    # Estructura inicial del estado
    status_data = {
        "ultima_ejecucion": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "script_ok": False,
        "notificacion_enviada": False
    }
    
    try:
        status_data["notificacion_enviada"] = actualizar_fechas(args.apikey)
        status_data["script_ok"] = True

    except Exception as e:
        print(f"❌ El script falló inesperadamente: {e}")
        status_data["script_ok"] = False
        
    finally:
        # Esto se ejecuta SIEMPRE, vaya bien o vaya mal el script
        # Nota: Para saber si hubo notificación, modifica el final de tu función actualizar_fechas
        # para que devuelva 'True' si envió el mensaje a Telegram, y recógelo aquí:
        # hizo_notificacion = actualizar_fechas(args.apikey)
        
        with open('status.json', 'w', encoding='utf-8') as f:
            json.dump(status_data, f, indent=2, ensure_ascii=False)