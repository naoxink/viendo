import json
import requests
import argparse
from datetime import datetime

# CONFIGURACIÓN
JSON_FILE = 'data.json'

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

def actualizar_fechas(api_key):
    # 1. Cargar tu archivo JSON
    try:
        with open(JSON_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"❌ No se encontró el archivo {JSON_FILE}")
        return
    except json.JSONDecodeError:
        print(f"❌ El archivo {JSON_FILE} no tiene un formato JSON válido")
        return

    token = obtener_token(api_key)
    if not token:
        return

    headers = {"Authorization": f"Bearer {token}"}
    hoy = datetime.now().date()

    # 2. Recorrer la lista de series en seguimiento
    for serie in data.get('viendo', []):
        tvdb_id = serie.get('tvdb_id')
        if not tvdb_id:
            print(f"⚠️ Saltando '{serie.get('titulo', 'Sin título')}': No tiene tvdb_id configurado.")
            continue
            
        print(f"🔍 Analizando: {serie['titulo']} (ID: {tvdb_id})...")
        
        # Petición a la API para obtener el listado completo de episodios (orden default)
        url = f"https://api4.thetvdb.com/v4/series/{tvdb_id}/episodes/default"
        try:
            res = requests.get(url, headers=headers, timeout=10)
            if res.status_code != 200:
                print(f"❌ Error {res.status_code} al consultar la serie {serie['titulo']}")
                continue
        except requests.exceptions.RequestException as e:
            print(f"❌ Error de red con {serie['titulo']}: {e}")
            continue
            
        episodes = res.json().get('data', {}).get('episodes', [])
        if not episodes:
            print(f"⚠️ No se encontraron episodios para {serie['titulo']}")
            continue
        
        # Filtrar capítulos especiales (temporada 0) y los que no tienen fecha de estreno
        valid_eps = [e for e in episodes if e.get('seasonNumber', 0) > 0 and e.get('aired')]
        # Ordenar cronológicamente por temporada y número de episodio
        valid_eps.sort(key=lambda x: (x['seasonNumber'], x['number']))
        
        user_s = serie.get('temporada', 1)
        user_e = serie.get('capitulo', 0)
        esta_pendiente = serie.get('pendiente', False)
        
        # Clasificar episodios de la API según el día de hoy
        emitidos = []
        futuros = []
        
        for ep in valid_eps:
            try:
                fecha_emision = datetime.strptime(ep['aired'], '%Y-%m-%d').date()
                if fecha_emision <= hoy:
                    emitidos.append(ep)
                else:
                    futuros.append(ep)
            except ValueError:
                continue # Saltar si la fecha tiene un formato extraño

        # Buscar episodios ya emitidos que sean estrictamente posteriores a tu punto de guardado
        nuevos_emitidos = [
            ep for ep in emitidos 
            if ep['seasonNumber'] > user_s or (ep['seasonNumber'] == user_s and ep['number'] > user_e)
        ]
        
        # 3. Aplicar reglas de negocio según tu flujo de trabajo
        if not esta_pendiente:
            # CASO A: Estabas al día (viste el capítulo apuntado).
            if nuevos_emitidos:
                siguiente = nuevos_emitidos[0]
                serie['temporada'] = siguiente['seasonNumber']
                serie['capitulo'] = siguiente['number']
                serie['pendiente'] = True
                serie['acumulados'] = len(nuevos_emitidos) -1 # quitamos el que está marcado como pendiente
                serie.pop('proximaFecha', None)
                print(f"   ✨ ¡Nuevo capítulo detectado! Avanzado a T{serie['temporada']}E{serie['capitulo']} (Pendiente).")
            else:
                serie['acumulados'] = 0
                if futuros:
                    serie['proximaFecha'] = futuros[0]['aired']
                    print(f"   📅 Al día. Próximo estreno el: {serie['proximaFecha']}")
                else:
                    serie['proximaFecha'] = "TBA"
                    print("   📅 Al día. Sin fecha de regreso confirmada (TBA).")
                    
        else:
            # CASO B: Ya tenías el capítulo apuntado como pendiente.
            serie['acumulados'] = len(nuevos_emitidos)
            serie.pop('proximaFecha', None)
            print(f"   ⏳ Tienes trabajo acumulado: {serie['acumulados']} capítulos pendientes en total.")

    # 4. Guardar los cambios
    with open(JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
    print("\n💾 ¡El archivo data.json ha sido sincronizado y actualizado con éxito!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Actualiza las fechas de series desde TheTVDB.')
    parser.add_argument('--apikey', required=True, help='API Key de TheTVDB')
    
    args = parser.parse_args()
    
    actualizar_fechas(args.apikey)