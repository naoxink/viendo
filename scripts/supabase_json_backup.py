import os
import sys
import io
import json
import requests
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

# CONFIGURACIÓN DE RUTAS (para guardar los JSON de backup en la raíz o carpeta de backups)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if 'scripts' in os.path.abspath(__file__) else os.path.dirname(os.path.abspath(__file__))
BACKUP_DIR = os.path.join(BASE_DIR, "backups")


def hacer_backup_json():
    print("🔄 Iniciando exportación de Supabase a JSON (Backup semanal)...")
    
    # 1. Obtener todas las series de la base de datos
    try:
        res = supabase.table("series").select("*").execute()
        series = res.data or []
    except Exception as e:
        print(f"❌ Error al consultar Supabase para el backup: {e}")
        return

    if not series:
        print("⚠️ La tabla de series está vacía. No se generará el backup.")
        return

    # 2. Reestructurar los datos según las categorías originales (viendo, completadas, etc.)
    # Puedes ajustar las categorías según cómo las guardases en tus antiguos JSON
    categorias_validas = ["viendo", "en_cola", "completadas", "pendientes"] # Ajusta si usas otras
    
    datos_por_categoria = {}
    
    # Agrupamos por el campo 'estado' de la tabla
    for serie in series:
        estado = serie.get("estado", "otros")
        if estado not in datos_por_categoria:
            datos_por_categoria[estado] = []
        datos_por_categoria[estado].append(serie)

    # 3. Crear directorio de backups si no existe
    os.makedirs(BACKUP_DIR, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    
    # Opción A: Guardar un único archivo consolidado o un archivo por categoría
    # Guardaremos un archivo general con el timestamp y un 'latest.json' de referencia
    backup_filename = f"series_backup_{timestamp}.json"
    backup_path = os.path.join(BACKUP_DIR, backup_filename)
    latest_path = os.path.join(BASE_DIR, "series_data.json") # O la estructura que prefieras

    try:
        # Guardar backup histórico con fecha
        with open(backup_path, "w", encoding="utf-8") as f:
            json.dump(datos_por_categoria, f, ensure_ascii=False, indent=4)
        print(f"📁 Backup histórico guardado en: {backup_path}")

        # Guardar versión actual/latest en la raíz del repo (por si otros scripts locales lo leen)
        with open(latest_path, "w", encoding="utf-8") as f:
            json.dump(datos_por_categoria, f, ensure_ascii=False, indent=4)
        print(f"💾 Archivo JSON principal actualizado en: {latest_path}")

    except Exception as e:
        print(f"❌ Error al escribir los archivos JSON de backup: {e}")
        return

    print("✅ ¡Backup semanal completado con éxito!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Genera un respaldo en formato JSON a partir de los datos actuales de Supabase."
    )
    args = parser.parse_args()

    try:
        hacer_backup_json()
    except Exception as e:
        print(f"❌ El script falló inesperadamente: {e}")