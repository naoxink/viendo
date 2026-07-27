import { ref, computed } from 'vue'
import { createClient } from '@supabase/supabase-js'

// Inicializa Supabase con tus credenciales públicas (anon key)
// Nota: Puedes mover esto a un archivo de configuración compartido si lo prefieres
const SUPABASE_URL = 'https://pfssrcyxpmnofezfnrct.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmc3NyY3l4cG1ub2ZlemZucmN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNDM1MTIsImV4cCI6MjEwMDcxOTUxMn0.AtMp0cNUrSGcjrEZqT1C_iZEhfnF2x555dSl_ZrHiUI' // Recuerda usar la clave 'anon' pública en el cliente web

const _supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

/**
 * Encapsula todo el acceso a datos mediante Supabase.
 */
export function useSeriesData() {
    const data = ref(null)
    const status = ref(null) // Si usas status.json para algo externo, puedes mantenerlo o adaptarlo
    const lastUpdate = ref('')
    const loading = ref(true)
    const error = ref(null)

    const añoActual = computed(() => new Date().getFullYear())

    async function loadData() {
        try {
            // Hacemos una única petición a Supabase para traernos todas las series de la tabla
            const { data: rows, error: err } = await _supabase
                .from('series')
                .select('*')

            if (err) throw err

            // Inicializamos la estructura que espera tu aplicación
            const agrupado = {
                viendo: [],
                en_cola: [],
                dropeadas: [],
                completadas: []
            }

            // Mapeamos los estados de la base de datos a las claves de tu objeto frontend
            rows.forEach(item => {
                // Adaptamos las claves de la base de datos de vuelta a lo que espera tu app si difieren
                const serieMapeada = {
                    ...item,
                    año: item.anio,
                    vistoEn: item.visto_en,
                    duracionMedia: item.duracion_media,
                    capitulosPorTemporada: item.capitulos_por_temporada
                }

                // Dependiendo de lo que guardaras en la columna 'estado', lo metemos en su array correspondiente
                if (item.estado === 'viendo') {
                    serieMapeada.estado = 'viendo'
                    agrupado.viendo.push(serieMapeada)
                } else if (item.estado === 'en_cola' || item.estado === 'enCola') {
                    serieMapeada.estado = 'enCola'
                    agrupado.en_cola.push(serieMapeada)
                } else if (item.estado === 'dropeadas' || item.estado === 'dropeada') {
                    serieMapeada.estado = 'dropeada'
                    agrupado.dropeadas.push(serieMapeada)
                } else if (item.estado === 'completadas' || item.estado === 'completada') {
                    serieMapeada.estado = 'completada'
                    agrupado.completadas.push(serieMapeada)
                }
            })

            data.value = agrupado
        } catch (e) {
            console.error('Error cargando los datos desde Supabase:', e)
            error.value = e
        }
    }

    async function loadStatus() {
        try {
            const res = await fetch('data/status.json')
            status.value = await res.json()
        } catch (e) {
            status.value = null
        }
    }

    async function loadLastUpdate() {
        try {
            // Como ahora los datos vienen de Supabase, podemos consultar la fecha de la última modificación 
            // consultando el registro más reciente o usando la fecha actual de sincronización.
            const { data: row, error } = await _supabase
                .from('series')
                .select('created_at')
                .order('created_at', { ascending: false })
                .limit(1)

            if (error || !row || row.length === 0) {
                lastUpdate.value = 'desconocida'
                return
            }

            lastUpdate.value = new Date(row[0].created_at).toLocaleDateString('es-ES')
        } catch (e) {
            lastUpdate.value = 'desconocida'
        }
    }

    async function loadAll() {
        loading.value = true
        await Promise.allSettled([loadData(), loadStatus(), loadLastUpdate()])
        loading.value = false
    }

    return { data, status, lastUpdate, loading, error, añoActual, loadAll }
}