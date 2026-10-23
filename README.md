# Viendo

Aplicación web para organizar el seguimiento de series. Permite gestionar las series que estás viendo, dejar para más tarde, completar o abandonar; consultar detalles, estadísticas y próximos estrenos, y añadir títulos mediante búsqueda.

La interfaz está desarrollada con Vue 3 y módulos JavaScript nativos. Los datos se conectan a Supabase y a una API desplegada en Vercel. El repositorio también incluye scripts Python para administrar datos locales, actualizar metadatos y descargar pósteres.

## Ejecución local

No se necesita un proceso de compilación. Con Python instalado, inicia un servidor estático desde la raíz del proyecto:

```bash
python3 -m http.server 8000
```

Abre [http://localhost:8000](http://localhost:8000). La aplicación requiere conexión a Internet para cargar Vue desde jsDelivr y acceder a sus servicios de datos.