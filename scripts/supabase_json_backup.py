import os
import sys
import io
import json
import argparse
from datetime import datetime
from supabase import create_client, Client

# Forzar la salida estándar y de errores a UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# CONFIGURACIÓN DE SUPABASE
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://pfssrcyxpmnofezfnrct.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# CONFIGURACIÓN DE RUTAS
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if 'scripts' in os.path.abspath(__file__) else os.path.dirname(os.path.abspath(__file__))
BACKUP_DIR = os.path.join(BASE_DIR, "backups")
DATA_DIR = os.path.join(BASE_DIR, "data")

# Mapeo de estados en Supabase a sus respectivos archivos JSON
MAPEOMAP_ESTADOS = {
    "viendo": "viendo.json",
    "en_cola": "en_cola.json",
    "completadas": "completadas.json",
    "dropeadas": "dropeadas.json"
}


def hacer_backup_y_actualizar_json():
    print("🔄 Iniciando exportación de Supabase a JSON (Backup y actualización de datos)...")
    
    # 1. Obtener todas las series de la base de datos
    try:
        res = supabase.table("series").select("*").execute()
        series = res.data or []
    except Exception as e:
        print(f"❌ Error al consultar Supabase para el backup: {e}")
        return

    if not series:
        print("⚠️ La tabla de series está vacía. No se generarán los archivos.")
        return

    # 2. Agrupar las series según su estado
    datos_por_categoria = {estado: [] for estado in MAPEOMAP_ESTADOS.keys()}
    
    for serie in series:
        estado = serie.get("estado")
        if estado in datos_por_categoria:
            datos_por_categoria[estado].append(serie)
        else:
            # Si hay algún estado no contemplado, lo ignoramos o manejamos aparte
            print(f"⚠️ Estado desconocido encontrado en serie '{serie.get('titulo')}': {estado}")

    # 3. Crear directorios si no existen
    os.makedirs(BACKUP_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    
    try:
        # A. Guardar un backup histórico consolidado con todas las categorías y timestamp
        backup_filename = f"series_backup_{timestamp}.json"
        backup_path = os.path.join(BACKUP_DIR, backup_filename)
        with open(backup_path, "w", encoding="utf-8") as f:
            json.dump(datos_por_categoria, f, ensure_ascii=False, indent=4)
        print(f"📁 Backup histórico guardado en: {backup_path}")

        # B. Actualizar de forma independiente los archivos JSON en la carpeta data/
        for estado, nombre_archivo in MAPEOMAP_ESTADOS.items():
            file_path = os.path.join(DATA_DIR, nombre_archivo)
            lista_series = datos_por_categoria.get(estado, [])
            
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(lista_series, f, ensure_ascii=False, indent=4)
            print(f"💾 Archivo actualizado: data/{nombre_archivo} ({len(lista_series)} series)")

    except Exception as e:
        print(f"❌ Error al escribir los archivos JSON: {e}")
        return

    print("✅ ¡Backup y sincronización de JSON completados con éxito!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Genera respaldos y actualiza los archivos JSON individuales a partir de Supabase."
    )
    args = parser.parse_args()

    try:
        hacer_backup_y_actualizar_json()
    except Exception as e:
        print(f"❌ El script falló inesperadamente: {e}")