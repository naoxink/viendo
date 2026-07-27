import os
import json
from supabase import create_client, Client

# Configura aquí tus credenciales de Supabase
URL: str = "https://pfssrcyxpmnofezfnrct.supabase.co"
KEY: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmc3NyY3l4cG1ub2ZlemZucmN0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTE0MzUxMiwiZXhwIjoyMTAwNzE5NTEyfQ.Utz69UFiM2_3iYGHPLT28nH16VU9PfDCTx0IZngcMRw"

supabase: Client = create_client(URL, KEY)

# Mapeo de archivo JSON -> valor que guardaremos en la columna 'estado'
ARCHIVOS_ESTADOS = {
    "data/viendo.json": "viendo",
    "data/completadas.json": "completadas",
    "data/en_cola.json": "en_cola",
    "data/dropeadas.json": "dropeadas"
}

def migrar_datos():
    todos_los_datos = []

    for ruta_archivo, estado_valor in ARCHIVOS_ESTADOS.items():
        if not os.path.exists(ruta_archivo):
            print(f"⚠️ No se encontró el archivo {ruta_archivo}, se omite.")
            continue

        with open(ruta_archivo, "r", encoding="utf-8") as f:
            lista_series = json.load(f)
            print(f"📂 Leídos {len(lista_series)} registros de {ruta_archivo} (estado: {estado_valor})")

            for item in lista_series:
                serie_adaptada = {
                    "titulo": item.get("titulo"),
                    "anio": item.get("año"),
                    "visto_en": item.get("vistoEn"),
                    "temporada": item.get("temporada"),
                    "capitulo": item.get("capitulo"),
                    "pendiente": item.get("pendiente", False),
                    "nota": item.get("nota"),
                    "tvdb_id": item.get("tvdb_id"),
                    "imdb_id": item.get("imdb_id"),
                    "acumulados": item.get("acumulados", 0),
                    "image_url": item.get("image_url"),
                    "poster_path": item.get("poster_path"),
                    "notas": item.get("notas"),
                    "estado_final": item.get("estado_final", ""),
                    "duracion_media": item.get("duracionMedia"),
                    "capitulos_por_temporada": item.get("capitulosPorTemporada", {}),
                    "estado": estado_valor  # Asignamos la categoría según el archivo
                }
                todos_los_datos.append(serie_adaptada)

    if not todos_los_datos:
        print("❌ No se encontraron datos para migrar.")
        return

    # --- FILTRAR DUPLICADOS POR tvdb_id ---
    unicos = {}
    for item in todos_los_datos:
        tvdb_id = item.get("tvdb_id")
        if tvdb_id:
            # Si se repite, sobrescribirá con el último encontrado
            unicos[tvdb_id] = item
        else:
            # Por si alguna serie no viniera con tvdb_id
            unicos[len(unicos)] = item
            
    datos_finales = list(unicos.values())
    print(f"🧹 Después de eliminar duplicados locales, quedan {len(datos_finales)} series únicas.")
    # -------------------------------------

    print(f"🚀 Subiendo un total de {len(datos_finales)} series a Supabase...")
    
    response = supabase.table("series").upsert(datos_finales).execute()
    
    print("✅ ¡Migración multichivo completada con éxito!")

if __name__ == "__main__":
    migrar_datos()