import json
import requests
import os
from datetime import datetime

JSON_FILE = 'data.json'

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
    if not os.path.exists(JSON_FILE):
        print(f"❌ No se encuentra el archivo {JSON_FILE}")
        return

    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    completadas = data.get('completadas', [])
    viendo = data.get('viendo', [])
    
    if not completadas:
        print("🔕 No hay series en la lista de completadas para revisar.")
        return

    hoy = datetime.now().date()
    nuevas_completadas = []
    notificaciones = []
    hubo_cambios = False
    
    # El token se mantendrá en None hasta que sea estrictamente necesario registrarse
    token = None
    headers = {}

    for serie in completadas:
        tvdb_id = serie.get('tvdb_id')
        
        # FILTRO 1: Si no tiene ID, no podemos hacer nada
        if not tvdb_id:
            nuevas_completadas.append(serie)
            continue

        # FILTRO 2: Si ya está catalogada como Ended o Canceled, pasamos olímpicamente (0 peticiones API)
        estado_final = serie.get('estado_final')
        if estado_final in ["Ended", "Canceled"]:
            print(f"⏩ Saltando: {serie['titulo']} (Ya archivada definitivamente como '{estado_final}')")
            nuevas_completadas.append(serie)
            continue

        # Si llega aquí, es que no conocemos su estado final o sigue "viva" en emisión continua
        print(f"🔍 Evaluando potencial regreso de: {serie['titulo']}...")
        
        # Control de autenticación bajo demanda (Lazy Auth)
        if not token:
            print("🔑 Necesitamos consultar la API. Autenticando en TheTVDB...")
            api_key = os.environ.get('TVDB_API_KEY')
            token = obtener_token(api_key)
            if not token:
                print("❌ Abortando: No se pudo obtener el token de acceso.")
                # Conservamos el resto de series intactas y salimos
                nuevas_completadas.extend(completadas[completadas.index(serie):])
                return
            headers = {"Authorization": f"Bearer {token}"}

        # 1. COMPROBAR ESTADO GLOBAL DE LA SERIE
        url_info = f"https://api4.thetvdb.com/v4/series/{tvdb_id}"
        try:
            res_info = requests.get(url_info, headers=headers, timeout=10)
            res_info.raise_for_status()
            estado_serie = res_info.json()['data']['status']['name']
        except Exception as e:
            print(f"⚠️ No se pudo obtener el estado de '{serie['titulo']}': {e}")
            nuevas_completadas.append(serie)
            continue

        # Si la serie ha terminado ahora, le guardamos el estado para el mes que viene
        if estado_serie in ["Ended", "Canceled"]:
            print(f"🛑 '{serie['titulo']}' ha sido marcada en la API como '{estado_serie}'. Actualizando caché local.")
            serie['estado_final'] = estado_serie
            if 'vistoEn' not in serie:
                serie['vistoEn'] = hoy.year
            nuevas_completadas.append(serie)
            hubo_cambios = True
            continue

        # 2. SI SIGUE ACTIVA, COMPROBAMOS EPISODIOS FUTUROS
        url_eps = f"https://api4.thetvdb.com/v4/series/{tvdb_id}/episodes/default"
        try:
            res_eps = requests.get(url_eps, headers=headers, timeout=10)
            res_eps.raise_for_status()
            episodes = res_eps.json().get('data', {}).get('episodes', [])
        except Exception as e:
            print(f"⚠️ No se pudieron empaquetar los episodios de '{serie['titulo']}': {e}")
            nuevas_completadas.append(serie)
            continue

        futuros = []
        for ep in episodes:
            if ep.get('seasonNumber', 0) > 0 and ep.get('aired'):
                try:
                    fecha_ep = datetime.strptime(ep['aired'], '%Y-%m-%d').date()
                    if fecha_ep >= hoy:
                        futuros.append(ep)
                except ValueError:
                    continue

        if futuros:
            futuros.sort(key=lambda x: x['aired'])
            fecha_regreso = futuros[0]['aired']

            # Resucitamos la serie para tu sección "En Cola"
            serie['proximaFecha'] = fecha_regreso
            serie['pendiente'] = False
            serie['acumulados'] = 0
            serie.pop('estado_final', None)
            serie.pop('vistoEn', None)
            
            viendo.append(serie)
            notificaciones.append(f"🔄 *{serie['titulo']}*: ¡Vuelve a la vida! Próxima emisión el *{fecha_regreso}*. Movida a En Cola.")
            hubo_cambios = True
        else:
            # Sigue activa en la API pero no hay fechas de emisión a la vista todavía
            nuevas_completadas.append(serie)

    # GUARDAR DATOS SI HUBIERA CAMBIOS (YA SEA POR REVIVIR O POR GUARDAR UN ESTADO_FINAL)
    if hubo_cambios:
        data['completadas'] = nuevas_completadas
        data['viendo'] = viendo

        with open(JSON_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print("💾 Cambios sincronizados en data.json.")

        # Si hay alertas de Telegram de series que vuelven, se envían
        if notificaciones:
            tg_token = os.environ.get('TELEGRAM_BOT_TOKEN')
            tg_chat_id = os.environ.get('TELEGRAM_CHAT_ID')
            if tg_token and tg_chat_id:
                cabecera = "🎉 *¡Nuevas temporadas detectadas en tu archivo!* \n\n"
                enviar_telegram(tg_token, tg_chat_id, cabecera + "\n".join(notificaciones))
    else:
        print("☕ Todo en orden. No ha hecho falta actualizar ningún dato.")

if __name__ == "__main__":
    revisar_completadas()