import os
import re
import sys
import requests
import argparse
from datetime import datetime, date
from urllib.parse import urlparse
from supabase import create_client, Client

from scripts.episodios_calc import construir_fechas_por_temporada, calcular_estado_pendiente

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://pfssrcyxpmnofezfnrct.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
POSTERS_DIR = os.path.join(BASE_DIR, 'posters')


def resolver_url_imagen(image_value):
    if not image_value:
        return None
    if image_value.startswith(("http://", "https://")):
        return image_value
    if image_value.startswith("/"):
        return f"https://artworks.thetvdb.com{image_value}"
    return f"https://artworks.thetvdb.com/banners/{image_value}"


def guardar_poster_local(serie, image_url):
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
    url = "https://api4.thetvdb.com/v4/login"
    try:
        response = requests.post(url, json={"apikey": api_key}, timeout=10)
        response.raise_for_status()
        return response.json()['data']['token']
    except requests.exceptions.RequestException as e:
        print(f"❌ Error crítico al autenticar en TheTVDB: {e}")
        return None


def enviar_notificacion_telegram(token, chat_id, mensaje):
    if not token or not chat_id:
        return
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {"chat_id": chat_id, "text": mensaje, "parse_mode": "Markdown"}
    try:
        requests.post(url, json=payload, timeout=10)
        return True
    except requests.exceptions.RequestException as e:
        print(f"⚠️ No se pudo enviar la notificación de Telegram: {e}")
        return False


def _parsear_fecha_proxima(valor):
    if not valor or valor == 'TBA':
        return None
    texto = str(valor).strip()
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%d'):
        try:
            return datetime.strptime(texto, fmt).date()
        except ValueError:
            continue
    return None


def necesita_refresh(serie, hoy):
    """Decide, SIN llamar a la API, si merece la pena resincronizar esta
    serie hoy. Es el filtro que evita pegarle a TheTVDB todos los días
    para todas las series."""
    fechas = serie.get('fechas_episodios')
    if not fechas:
        return True  # nunca sincronizada

    estado = calcular_estado_pendiente(fechas, serie.get('temporada'), serie.get('capitulo'), hoy=hoy)

    if estado['pendiente']:
        # Ya sabemos con las fechas guardadas que hay algo por ver.
        # No hace falta ir a la API hasta que el usuario se ponga al día.
        return False

    proxima = estado['proxima_fecha']
    if not proxima:
        return True  # sin fecha futura conocida: puede que TVDB ya la haya anunciado

    fecha_guardada = _parsear_fecha_proxima(proxima)
    return fecha_guardada is not None and fecha_guardada <= hoy  # esa fecha ya pasó, toca refrescar


def obtener_episodios_validos(tvdb_id, headers):
    url_eps = f"https://api4.thetvdb.com/v4/series/{tvdb_id}/episodes/default"
    try:
        res_eps = requests.get(url_eps, headers=headers, timeout=10)
        if res_eps.status_code != 200:
            print(f"   ❌ Error {res_eps.status_code} al consultar episodios.")
            return None
        episodes = res_eps.json().get('data', {}).get('episodes', [])
    except requests.exceptions.RequestException as e:
        print(f"   ❌ Error de red: {e}")
        return None
    return [e for e in episodes if (e.get('seasonNumber') or 0) > 0]


def sincronizar_serie(serie, headers, hoy):
    """Refresca capitulos_por_temporada, fechas_episodios, duracion_media,
    imagen y estado_final desde TheTVDB. Ya NO calcula ni escribe
    pendiente/acumulados/proxima_fecha — eso lo deriva el frontend."""
    tvdb_id = serie.get('tvdb_id')

    url_info = f"https://api4.thetvdb.com/v4/series/{tvdb_id}"
    series_data = {}
    estado_serie = "Unknown"
    try:
        res_info = requests.get(url_info, headers=headers, timeout=10)
        series_data = res_info.json().get('data', {})
        estado_serie = series_data.get('status', {}).get('name', 'Unknown')
    except (requests.exceptions.RequestException, KeyError, ValueError):
        pass

    valid_eps = obtener_episodios_validos(tvdb_id, headers)
    if valid_eps is None:
        return None

    caps_por_temporada = {}
    for ep in valid_eps:
        if not ep.get('aired'):
            continue
        t = str(ep['seasonNumber'])
        caps_por_temporada[t] = caps_por_temporada.get(t, 0) + 1

    fechas_episodios = construir_fechas_por_temporada(valid_eps)
    remote_image_url = resolver_url_imagen(series_data.get('image'))

    update_payload = {
        "capitulos_por_temporada": caps_por_temporada,
        "fechas_episodios": fechas_episodios,
        "duracion_media": series_data.get('averageRuntime') or series_data.get('runtime') or serie.get('duracion_media') or 0,
        "image_url": remote_image_url or serie.get('image_url'),
        "poster_path": serie.get('poster_path') or guardar_poster_local(serie, remote_image_url)
    }

    return {
        "update_payload": update_payload,
        "estado_serie": estado_serie,
        "fechas_episodios": fechas_episodios
    }


def procesar_viendo(headers, ahora, hoy, notificaciones):
    res = supabase.table("series").select("*").eq("estado", "viendo").execute()
    for serie in (res.data or []):
        titulo = serie.get('titulo', 'Sin título')
        tvdb_id = serie.get('tvdb_id')
        serie_id = serie.get('id')

        if not tvdb_id:
            print(f"⚠️ Saltando '{titulo}': no tiene tvdb_id.")
            continue

        if not necesita_refresh(serie, hoy):
            print(f"⏭️ '{titulo}': sin cambios esperados hoy, no se consulta la API.")
            continue

        print(f"🔍 Resincronizando: {titulo} (ID: {tvdb_id})...")
        resultado = sincronizar_serie(serie, headers, hoy)
        if resultado is None:
            continue

        update_payload = resultado["update_payload"]
        estado_serie = resultado["estado_serie"]
        fechas_nuevas = resultado["fechas_episodios"]

        estado_antes = calcular_estado_pendiente(
            serie.get('fechas_episodios') or {}, serie.get('temporada'), serie.get('capitulo'), hoy=hoy
        )
        estado_despues = calcular_estado_pendiente(
            fechas_nuevas, serie.get('temporada'), serie.get('capitulo'), hoy=hoy
        )

        # ¿Ha aparecido un capítulo nuevo por ver que antes no estaba?
        if estado_despues['pendiente'] and not estado_antes['pendiente']:
            print(f"   ✨ ¡Nuevo capítulo detectado! T{estado_despues['temporada']}E{estado_despues['capitulo']}")
            notificaciones.append(
                f"✨ *{titulo}*: ¡Nuevo capítulo disponible! T{estado_despues['temporada']}E{estado_despues['capitulo']}."
            )

        # ¿La serie ha terminado y el usuario está al día?
        if not estado_despues['pendiente'] and estado_serie in ("Ended", "Canceled"):
            update_payload.update({
                "estado_final": estado_serie,
                "visto_en": hoy.year,
                "estado": "completadas",
                "nota": serie.get('nota') or "-"
            })
            print(f"   🏆 ¡Serie terminada ({estado_serie})! Movida a Completadas en {hoy.year}.")
            notificaciones.append(f"🏆 *{titulo}*: ¡Serie terminada ({estado_serie})! Movida a Completadas en {hoy.year}.")

        res_update = supabase.table("series").update(update_payload).eq("id", serie_id).execute()
        if not res_update.data:
            print(f"   ⚠️ ¡ALERTA! Supabase no actualizó '{titulo}'. Revisa 'service_role' o RLS.")
            notificaciones.append(f"⚠️ ¡ALERTA! Supabase no actualizó '{titulo}'. Revisa 'service_role' o RLS.")


def procesar_en_cola(headers, hoy):
    """Igual de perezoso: solo llama a la API a las series en_cola que
    puedan tener novedades, y solo refresca datos crudos."""
    res = supabase.table("series").select("*").eq("estado", "en_cola").execute()
    for serie in (res.data or []):
        titulo = serie.get('titulo', 'Sin título')
        tvdb_id = serie.get('tvdb_id')
        serie_id = serie.get('id')

        if not tvdb_id:
            continue

        if serie.get('estado_final') in ("Ended", "Canceled") and serie.get('fechas_episodios'):
            continue  # ya finalizada y ya sincronizada: no va a cambiar

        if not necesita_refresh(serie, hoy):
            continue

        print(f"🔍 Resincronizando (en cola): {titulo} (ID: {tvdb_id})...")
        resultado = sincronizar_serie(serie, headers, hoy)
        if resultado is None:
            continue

        update_payload = resultado["update_payload"]
        if resultado["estado_serie"] in ("Ended", "Canceled"):
            update_payload["estado_final"] = resultado["estado_serie"]

        supabase.table("series").update(update_payload).eq("id", serie_id).execute()


def actualizar_fechas(api_key):
    token = obtener_token(api_key)
    if not token:
        return False

    headers = {"Authorization": f"Bearer {token}"}
    ahora = datetime.now()
    hoy = ahora.date()
    notificaciones = []

    procesar_viendo(headers, ahora, hoy, notificaciones)
    procesar_en_cola(headers, hoy)

    print("\n💾 ¡Series activas revisadas y sincronizadas donde hacía falta!")

    tg_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    tg_chat_id = os.environ.get('TELEGRAM_CHAT_ID')

    if notificaciones and tg_token and tg_chat_id:
        cabecera = "🤖 *Resumen de actualización de series:*\n\n"
        return enviar_notificacion_telegram(tg_token, tg_chat_id, cabecera + "\n".join(notificaciones))

    return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Sincroniza series activas con TheTVDB solo cuando hace falta.')
    parser.add_argument('--apikey', required=True, help='API Key de TheTVDB')
    args = parser.parse_args()

    status_data = {
        "updated": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "script_ok": False,
        "notification_sent": False
    }

    try:
        status_data["notification_sent"] = actualizar_fechas(args.apikey)
        status_data["script_ok"] = True
    except Exception as e:
        print(f"❌ El script falló inesperadamente: {e}")
        status_data["script_ok"] = False
    finally:
        res = supabase.table("status").update(status_data).eq("viendo", True).execute()
        if not res.data:
            print("   ⚠️ ¡ALERTA! Supabase no actualizó 'status'.")