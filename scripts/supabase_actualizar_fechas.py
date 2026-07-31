import os
import re
import sys
import json
import requests
import argparse
from datetime import datetime, date, time
from urllib.parse import urlparse
from supabase import create_client, Client

# CONFIGURACIÓN DE SUPABASE
# Puedes inyectarlas por variables de entorno o dejarlas fijas como prefieras
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://pfssrcyxpmnofezfnrct.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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


def _parsear_fecha_proxima(valor):
    """Convierte valores de fecha de emisión a un datetime comparable."""
    if not valor or valor == 'TBA':
        return None

    if isinstance(valor, datetime):
        return valor

    if isinstance(valor, date):
        return datetime.combine(valor, time.min)

    texto = str(valor).strip()
    if not texto:
        return None

    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%d', '%Y/%m/%d'):
        try:
            return datetime.strptime(texto, fmt)
        except ValueError:
            continue

    return None


def limpiar_fechas_pasadas_en_cola(ahora=None):
    """Elimina la fecha de próxima emisión de las series en_cola cuando ya ha pasado directamente en Supabase."""
    if ahora is None:
        ahora = datetime.now()

    # Traemos las series que están en cola
    res = supabase.table("series").select("id, proximaFecha, estado").eq("estado", "en_cola").execute()
    en_cola = res.data or []

    for serie in en_cola:
        proxima_fecha = serie.get('proximaFecha')
        fecha_parsed = _parsear_fecha_proxima(proxima_fecha)
        if fecha_parsed is not None and fecha_parsed <= ahora:
            # Actualizamos en Supabase poniendo proximaFecha a null o eliminándola
            supabase.table("series").update({"proximaFecha": None}).eq("id", serie["id"]).execute()


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
        "parse_mode": "Markdown"
    }
    try:
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        return True
    except requests.exceptions.RequestException as e:
        print(f"⚠️ No se pudo enviar la notificación de Telegram: {e}")
        return False


def actualizar_fechas(api_key):
    # 1. Cargar las series que están en estado 'viendo' desde Supabase
    res_viendo = supabase.table("series").select("*").eq("estado", "viendo").execute()
    viendo_actual = res_viendo.data or []

    token = obtener_token(api_key)
    if not token:
        return False

    headers = {"Authorization": f"Bearer {token}"}
    ahora = datetime.now()
    hoy = ahora.date()
    notificaciones = []

    # Limpiamos fechas pasadas en cola directamente en Supabase
    limpiar_fechas_pasadas_en_cola(ahora=ahora)

    # 2. Recorrer la lista de series en seguimiento
    for serie in viendo_actual:
        tvdb_id = serie.get('tvdb_id')
        serie_id = serie.get('id') # ID interno de Supabase para actualizar con precisión
        
        if not tvdb_id:
            print(f"⚠️ Saltando '{serie.get('titulo', 'Sin título')}': No tiene tvdb_id configurado.")
            continue
            
        print(f"🔍 Analizando: {serie['titulo']} (ID: {tvdb_id})...")
        
        # OBTENER EL ESTADO GLOBAL DE LA SERIE
        url_info = f"https://api4.thetvdb.com/v4/series/{tvdb_id}"
        series_data = {}
        try:
            res_info = requests.get(url_info, headers=headers, timeout=10)
            series_data = res_info.json().get('data', {})
            estado_serie = series_data.get('status', {}).get('name', 'Unknown')
            serie['duracion_media'] = series_data.get('averageRuntime') or series_data.get('runtime') or 0
        except (requests.exceptions.RequestException, KeyError, ValueError):
            estado_serie = "Unknown"
            serie['duracion_media'] = 0

        remote_image_url = resolver_url_imagen(series_data.get('image'))
        serie['image_url'] = remote_image_url
        serie['poster_path'] = serie.get('poster_path') or guardar_poster_local(serie, remote_image_url)

        # OBTENER LOS EPISODIOS
        url_eps = f"https://api4.thetvdb.com/v4/series/{tvdb_id}/episodes/default"
        try:
            res_eps = requests.get(url_eps, headers=headers, timeout=10)
            if res_eps.status_code != 200:
                print(f"❌ Error {res_eps.status_code} al consultar episodios.")
                continue
            episodes = res_eps.json().get('data', {}).get('episodes', [])
        except requests.exceptions.RequestException as e:
            print(f"❌ Error de red: {e}")
            continue
            
        if not episodes:
            print(f"⚠️ No se encontraron episodios.")
            continue
        
        # Filtrar y ordenar
        valid_eps = [e for e in episodes if e.get('seasonNumber', 0) > 0 and e.get('aired')]
        valid_eps.sort(key=lambda x: (x['seasonNumber'], x['number']))

        caps_por_temporada = {}
        for ep in valid_eps:
            temporada_str = str(ep['seasonNumber'])
            caps_por_temporada[temporada_str] = caps_por_temporada.get(temporada_str, 0) + 1
        
        serie['capitulos_por_temporada'] = caps_por_temporada

        user_s = serie.get('temporada', 1)
        user_e = serie.get('capitulo', 0)
        esta_pendiente = serie.get('pendiente', False)
        
        emitidos = []
        futuros = []
        
        hora_serie = None
        for ep in valid_eps:
            hora_serie = series_data.get('airsTime') or series_data.get('airTime') or series_data.get('airs', {}).get('time') or hora_serie
            if es_emision_futura(ep, ahora, hora_default=hora_serie):
                futuros.append(ep)
            else:
                emitidos.append(ep)

        nuevos_emitidos = [
            ep for ep in emitidos 
            if ep['seasonNumber'] > user_s or (ep['seasonNumber'] == user_s and ep['number'] > user_e)
        ]
        
        # 3. APLICAR REGLAS DE NEGOCIO Y ACTUALIZAR SUPABASE
        update_payload = {
            "duracion_media": serie.get('duracion_media'),
            "image_url": serie.get('image_url'),
            "poster_path": serie.get('poster_path'),
            "capitulos_por_temporada": serie.get('capitulos_por_temporada')
        }

        if not esta_pendiente:
            if nuevos_emitidos:
                siguiente = nuevos_emitidos[0]
                serie['temporada'] = siguiente['seasonNumber']
                serie['capitulo'] = siguiente['number']
                serie['pendiente'] = True
                serie['acumulados'] = len(nuevos_emitidos) - 1
                serie['proximaFecha'] = None
                
                update_payload.update({
                    "temporada": serie['temporada'],
                    "capitulo": serie['capitulo'],
                    "pendiente": True,
                    "acumulados": serie['acumulados'],
                    "proximaFecha": None
                })
                
                print(f"   ✨ ¡Nuevo capítulo detectado! Avanzado a T{serie['temporada']}E{serie['capitulo']} (Pendiente).")
                notificaciones.append(f"✨ *{serie['titulo']}*: ¡Nuevo capítulo disponible! Avanzado a T{serie['temporada']}E{serie['capitulo']}.")
            else:
                serie['acumulados'] = 0
                update_payload["acumulados"] = 0
                
                # CASO: SERIE FINALIZADA Y USUARIO AL DÍA
                if not futuros and estado_serie in ["Ended", "Canceled"]:
                    serie['proximaFecha'] = None
                    serie['estado_final'] = estado_serie
                    serie['visto_en'] = hoy.year
                    if not serie.get('nota'):
                        serie['nota'] = "-"
                    
                    serie['estado'] = "completadas" # Cambia de estado en Supabase
                    
                    update_payload.update({
                        "proximaFecha": None,
                        "estado_final": estado_serie,
                        "visto_en": hoy.year,
                        "nota": serie['nota'],
                        "estado": "completadas"
                    })
                    
                    print(f"   🏆 ¡Serie terminada ({estado_serie})! Movida a Completadas automáticamente en {hoy.year}.")
                    notificaciones.append(f"   🏆 ¡Serie terminada ({estado_serie})! Movida a Completadas automáticamente en {hoy.year}.")
                else:
                    if futuros:
                        serie['proximaFecha'] = futuros[0]['aired']
                        print(f"   📅 Al día. Próximo estreno el: {serie['proximaFecha']}")
                    else:
                        serie['proximaFecha'] = None
                        print("   📅 Al día. Sin fecha de regreso confirmada (TBA).")
                    
                    update_payload["proximaFecha"] = serie['proximaFecha']
        else:
            serie['acumulados'] = len(nuevos_emitidos)
            serie['proximaFecha'] = None
            
            update_payload.update({
                "acumulados": serie['acumulados'],
                "proximaFecha": None
            })
            print(f"   ⏳ Tienes trabajo acumulado: {serie['acumulados']} capítulos pendientes extra.")

        # Ejecutamos el update en Supabase para esta serie concreta
        res = supabase.table("series").update(update_payload).eq("id", serie_id).execute()

        # CHIVATO DE SEGURIDAD: Verificamos si realmente se ha modificado la fila
        if not res.data:
            print(f"   ⚠️ ¡ALERTA! Supabase ha devuelto un array vacío para '{serie['titulo']}'. La base de datos no se ha actualizado. Revisa si estás usando la clave 'service_role' o si RLS está bloqueando la escritura.")
            notificaciones.append(f"   ⚠️ ¡ALERTA! Supabase ha devuelto un array vacío para '{serie['titulo']}'. La base de datos no se ha actualizado. Revisa si estás usando la clave 'service_role' o si RLS está bloqueando la escritura.")

    print("\n💾 ¡La base de datos en Supabase ha sido sincronizada con éxito!")

    # 5. ENVIAR NOTIFICACIONES SI HAY CAMBIOS
    tg_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    tg_chat_id = os.environ.get('TELEGRAM_CHAT_ID')

    if notificaciones and tg_token and tg_chat_id:
        cabecera = "🤖 *Resumen de actualización de series:*\n\n"
        mensaje_final = cabecera + "\n".join(notificaciones)
        notificacion_ok = enviar_notificacion_telegram(tg_token, tg_chat_id, mensaje_final)
        return notificacion_ok

    return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Actualiza fechas de series en Supabase y gestiona finalizadas automáticamente.')
    parser.add_argument('--apikey', required=True, help='API Key de TheTVDB')
    
    args = parser.parse_args()

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
        res = supabase.table("status").update(status_data).eq("viendo", True).execute()
        if not res.data:
            print(f"   ⚠️ ¡ALERTA! Supabase ha devuelto un array vacío para 'status'. La base de datos no se ha actualizado.")
        # Como ya no guardamos status.json localmente de la misma forma, 
        # puedes optar por seguir escribiéndolo localmente si lo usas o subirlo también. 
        # Aquí lo mantenemos local para que tu app web lo siga leyendo si recurre al fetch de status.json.
        status_path = os.path.join(BASE_DIR, 'data', 'status.json')
        os.makedirs(os.path.dirname(status_path), exist_ok=True)
        with open(status_path, 'w', encoding='utf-8') as f:
            json.dump(status_data, f, indent=2, ensure_ascii=False)