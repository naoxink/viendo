import os
import sys
import requests
from datetime import datetime
from supabase import create_client, Client

# CONFIGURACIÓN DE SUPABASE
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://pfssrcyxpmnofezfnrct.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmc3NyY3l4cG1ub2ZlemZucmN0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTE0MzUxMiwiZXhwIjoyMTAwNzE5NTEyfQ.Utz69UFiM2_3iYGHPLT28nH16VU9PfDCTx0IZngcMRw") # Usa service_role para scripts de backend

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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
    # 1. Cargamos las series completadas directamente desde Supabase
    res_completadas = supabase.table("series").select("*").eq("estado", "completadas").execute()
    completadas = res_completadas.data or []

    if not completadas:
        print("🔕 No hay series en la lista de completadas para revisar.")
        return

    hoy = datetime.now().date()
    notificaciones = []
    token = None
    headers = {}

    for serie in completadas:
        tvdb_id = serie.get('tvdb_id')
        serie_id = serie.get('id')
        
        if not tvdb_id:
            continue

        estado_final = serie.get('estado_final')
        if estado_final in ["Ended", "Canceled"]:
            print(f"⏩ Saltando: {serie['titulo']} (Ya archivada definitivamente como '{estado_final}')")
            continue

        print(f"🔍 Evaluando potencial regreso de: {serie['titulo']}...")
        
        if not token:
            print("🔑 Necesitamos consultar la API. Autenticando en TheTVDB...")
            api_key = os.environ.get('TVDB_API_KEY')
            token = obtener_token(api_key)
            if not token:
                print("❌ Abortando: No se pudo obtener el token de acceso.")
                return
            headers = {"Authorization": f"Bearer {token}"}

        # 1. COMPROBAR ESTADO GLOBAL DE LA SERIE
        url_info = f"https://api4.thetvdb.com/v4/series/{tvdb_id}"
        try:
            res_info = requests.get(url_info, headers=headers, timeout=10)
            res_info.raise_for_status()
            series_data = res_info.json().get('data', {})
            estado_serie = series_data.get('status', {}).get('name', 'Unknown')
            
            nueva_duracion = series_data.get('averageRuntime') or series_data.get('runtime') or 0
            
            # Preparamos el diccionario de actualización en Supabase para esta serie
            update_payload = {}
            if serie.get('duracion_media') != nueva_duracion:
                update_payload['duracion_media'] = nueva_duracion
            
        except Exception as e:
            print(f"⚠️ No se pudo obtener el estado de '{serie['titulo']}': {e}")
            continue

        # 2. OBTENER LOS EPISODIOS
        url_eps = f"https://api4.thetvdb.com/v4/series/{tvdb_id}/episodes/default"
        try:
            res_eps = requests.get(url_eps, headers=headers, timeout=10)
            res_eps.raise_for_status()
            episodes = res_eps.json().get('data', {}).get('episodes', [])
        except Exception as e:
            print(f"⚠️ No se pudieron empaquetar los episodios de '{serie['titulo']}': {e}")
            continue

        caps_por_temporada = {}
        for ep in episodes:
            s_num = ep.get('seasonNumber')
            aired = ep.get('aired')
            if isinstance(s_num, int) and s_num > 0 and aired:
                temporada_str = str(s_num)
                caps_por_temporada[temporada_str] = caps_por_temporada.get(temporada_str, 0) + 1
        
        if serie.get('capitulos_por_temporada') != caps_por_temporada:
            update_payload['capitulos_por_temporada'] = caps_por_temporada

        # 3. LÓGICA DE NEGOCIO Y CLASIFICACIÓN
        if estado_serie in ["Ended", "Canceled"]:
            print(f"🛑 '{serie['titulo']}' ha sido marcada en la API como '{estado_serie}'. Actualizando base de datos.")
            if serie.get('estado_final') != estado_serie:
                update_payload['estado_final'] = estado_serie
            if not serie.get('visto_en'):
                update_payload['visto_en'] = hoy.year
            
            if update_payload:
                supabase.table("series").update(update_payload).eq("id", serie_id).execute()
            continue

        # Evaluar episodios futuros
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

            # La serie vuelve a la vida: pasa a estado 'viendo', actualizamos fechas y limpiamos campos de finalizada
            update_payload.update({
                'proximaFecha': fecha_regreso,
                'pendiente': False,
                'acumulados': 0,
                'estado_final': None,
                'visto_en': None,
                'estado': 'viendo'
            })
            
            notificaciones.append(f"🔄 *{serie['titulo']}*: ¡Vuelve a la vida! Próxima emisión el *{fecha_regreso}*. Movida a Viendo.")
            
            print(f"   🎉 '{serie['titulo']}' ha anunciado nueva temporada para el {fecha_regreso}. Movida a Viendo.")
        else:
            # Si hay cambios menores (duración o capítulos), los guardamos
            pass

        # Aplicamos el update en Supabase
        if update_payload:
            supabase.table("series").update(update_payload).eq("id", serie_id).execute()

    if notificaciones:
        tg_token = os.environ.get('TELEGRAM_BOT_TOKEN')
        tg_chat_id = os.environ.get('TELEGRAM_CHAT_ID')
        if tg_token and tg_chat_id:
            cabecera = "🎉 *¡Nuevas temporadas detectadas!* \n\n"
            enviar_telegram(tg_token, tg_chat_id, cabecera + "\n".join(notificaciones))
        print("💾 Cambios sincronizados en Supabase y notificaciones enviadas.")
    else:
        print("☕ Todo en orden. No hay nuevos regresos de series completadas.")

if __name__ == "__main__":
    revisar_completadas()