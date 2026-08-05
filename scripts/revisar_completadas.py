import json
import requests
import os
import sys
from datetime import datetime

if __package__ in {None, ""}:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.data_store import load_data, save_data

def obtener_token(api_key):
    """Obtiene el token JWT v4 de TheTVDB."""
    if not api_key:
        print("❌ No se encontró la TVDB_API_KEY en las variables de entorno.")
        return None
    url = "https://api4.thetvdb.com/v4/login"
    try:
        response = requests.post(url, json={"apikey": api_key}, timeout=10)
        response.raise_for_status()
        return response.json()['data']['token']
    except Exception as e:
        print(f"❌ Error de autenticación en TheTVDB: {e}")
        return None

def enviar_telegram(token, chat_id, mensaje):
    if not token or not chat_id:
        return
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {"chat_id": chat_id, "text": mensaje, "parse_mode": "Markdown"}
    try:
        requests.post(url, json=payload, timeout=10)
    except Exception as e:
        print(f"⚠️ Error al enviar a Telegram: {e}")

def revisar_completadas():
    data = load_data(os.path.dirname(os.path.abspath(__file__)))

    completadas = data.get('completadas', [])
    viendo = data.get('viendo', [])
    
    if not completadas:
        print("🔕 No hay series en la lista de completadas para revisar.")
        return

    hoy = datetime.now().date()
    nuevas_completadas = []
    notificaciones = []
    hubo_cambios = False
    
    token = None
    headers = {}

    for serie in completadas:
        tvdb_id = serie.get('tvdb_id')
        
        if not tvdb_id:
            nuevas_completadas.append(serie)
            continue

        estado_final = serie.get('estado_final')
        if estado_final in ["Ended", "Canceled"]:
            print(f"⏩ Saltando: {serie['titulo']} (Ya archivada definitivamente como '{estado_final}')")
            nuevas_completadas.append(serie)
            continue

        print(f"🔍 Evaluando potencial regreso de: {serie['titulo']}...")
        
        if not token:
            print("🔑 Necesitamos consultar la API. Autenticando en TheTVDB...")
            api_key = os.environ.get('TVDB_API_KEY')
            token = obtener_token(api_key)
            if not token:
                print("❌ Abortando: No se pudo obtener el token de acceso.")
                nuevas_completadas.extend(completadas[completadas.index(serie):])
                return
            headers = {"Authorization": f"Bearer {token}"}

        # 1. COMPROBAR ESTADO GLOBAL DE LA SERIE
        url_info = f"https://api4.thetvdb.com/v4/series/{tvdb_id}"
        try:
            res_info = requests.get(url_info, headers=headers, timeout=10)
            res_info.raise_for_status()
            series_data = res_info.json().get('data', {})
            estado_serie = series_data.get('status', {}).get('name', 'Unknown')
            
            # Control estricto de cambios para evitar escrituras en disco innecesarias
            nueva_duracion = series_data.get('averageRuntime') or series_data.get('runtime') or 0
            if serie.get('duracionMedia') != nueva_duracion:
                serie['duracionMedia'] = nueva_duracion
                hubo_cambios = True
            
        except Exception as e:
            print(f"⚠️ No se pudo obtener el estado de '{serie['titulo']}': {e}")
            nuevas_completadas.append(serie)
            continue

        # 2. OBTENER LOS EPISODIOS
        url_eps = f"https://api4.thetvdb.com/v4/series/{tvdb_id}/episodes/default"
        try:
            res_eps = requests.get(url_eps, headers=headers, timeout=10)
            res_eps.raise_for_status()
            episodes = res_eps.json().get('data', {}).get('episodes', [])
        except Exception as e:
            print(f"⚠️ No se pudieron empaquetar los episodios de '{serie['titulo']}': {e}")
            nuevas_completadas.append(serie)
            continue

        # Conteo a prueba de nulos y tipos incorrectos de la API
        caps_por_temporada = {}
        for ep in episodes:
            s_num = ep.get('seasonNumber')
            aired = ep.get('aired')
            # Validamos que la temporada sea un entero, mayor que cero y tenga fecha
            if isinstance(s_num, int) and s_num > 0 and aired:
                temporada_str = str(s_num)
                caps_por_temporada[temporada_str] = caps_por_temporada.get(temporada_str, 0) + 1
        
        if serie.get('capitulosPorTemporada') != caps_por_temporada:
            serie['capitulosPorTemporada'] = caps_por_temporada
            hubo_cambios = True

        # 3. LÓGICA DE NEGOCIO Y CLASIFICACIÓN
        if estado_serie in ["Ended", "Canceled"]:
            print(f"🛑 '{serie['titulo']}' ha sido marcada en la API como '{estado_serie}'. Actualizando caché local.")
            if serie.get('estado_final') != estado_serie:
                serie['estado_final'] = estado_serie
                hubo_cambios = True
            if 'vistoEn' not in serie:
                serie['vistoEn'] = hoy.year
                hubo_cambios = True
            nuevas_completadas.append(serie)
            continue

        # Evaluar episodios futuros de forma segura
        futuros = []
        for ep in episodes:
            s_num = ep.get('seasonNumber')
            aired = ep.get('aired')
            if isinstance(s_num, int) and s_num > 0 and aired:
                try:
                    fecha_ep = datetime.strptime(aired, '%Y-%m-%d').date()
                    if fecha_ep >= hoy:
                        futuros.append(ep)
                except ValueError:
                    continue

        if futuros:
            futuros.sort(key=lambda x: x['aired'])
            fecha_regreso = futuros[0]['aired']

            serie['proxima_fecha'] = fecha_regreso
            serie['pendiente'] = False
            serie['acumulados'] = 0
            serie.pop('estado_final', None)
            serie.pop('vistoEn', None)
            
            viendo.append(serie)
            notificaciones.append(f"🔄 *{serie['titulo']}*: ¡Vuelve a la vida! Próxima emisión el *{fecha_regreso}*. Movida a En Cola.")
            hubo_cambios = True
        else:
            nuevas_completadas.append(serie)

    if hubo_cambios:
        data['completadas'] = nuevas_completadas
        data['viendo'] = viendo
        save_data(data, os.path.dirname(os.path.abspath(__file__)))
        print("💾 Cambios sincronizados en los archivos de datos.")
        
        if notificaciones:
            tg_token = os.environ.get('TELEGRAM_BOT_TOKEN')
            tg_chat_id = os.environ.get('TELEGRAM_CHAT_ID')
            if tg_token and tg_chat_id:
                cabecera = "🎉 *¡Nuevas temporadas detectadas en tu archivo!* \n\n"
                enviar_telegram(tg_token, tg_chat_id, cabecera + "\n".join(notificaciones))
    else:
        print("☕ Todo en orden. No ha hecho falta modificar ningún archivo.")


if __name__ == "__main__":
    revisar_completadas()