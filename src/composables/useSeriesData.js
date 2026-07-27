import { ref, computed } from 'vue'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://pfssrcyxpmnofezfnrct.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmc3NyY3l4cG1ub2ZlemZucmN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNDM1MTIsImV4cCI6MjEwMDcxOTUxMn0.AtMp0cNUrSGcjrEZqT1C_iZEhfnF2x555dSl_ZrHiUI'

const _supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// --- ESTADO GLOBAL COMPARTIDO (Singleton) ---
const data = ref(null)
const status = ref(null)
const lastUpdate = ref('')
const loading = ref(true)
const error = ref(null)
// -------------------------------------------

export function useSeriesData() {
    const añoActual = computed(() => new Date().getFullYear())

    async function loadData() {
        try {
            const { data: rows, error: err } = await _supabase
                .from('series')
                .select('*')

            if (err) throw err

            const agrupado = {
                viendo: [],
                en_cola: [],
                dropeadas: [],
                completadas: []
            }

            rows.forEach(item => {
                const serieMapeada = {
                    ...item,
                    año: item.anio,
                    vistoEn: item.visto_en,
                    duracionMedia: item.duracion_media,
                    capitulosPorTemporada: item.capitulos_por_temporada
                }

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

    async function updateShowStatus(id, estadoNuevo) {
        try {
            let estadoDb = estadoNuevo
            if (estadoNuevo === 'enCola') estadoDb = 'en_cola'
            if (estadoNuevo === 'dropeada') estadoDb = 'dropeadas'
            if (estadoNuevo === 'completada') estadoDb = 'completadas'

            const { data: updatedRow, error: err } = await _supabase
                .from('series')
                .update({ estado: estadoDb })
                .eq('id', id)
                .select()
                .single()

            if (err) throw err

            // Al estar 'data' fuera, recargar los datos actualiza al instante a cualquier componente conectado
            await loadData()

            return { success: true, data: updatedRow }
        } catch (e) {
            console.error('Error al actualizar el estado de la serie en Supabase:', e)
            error.value = e
            return { success: false, error: e.message }
        }
    }

    async function updateShowField(id, campoDb, valorNuevo) {
        try {
            const { data: updatedRow, error: err } = await _supabase
                .from('series')
                .update({ [campoDb]: valorNuevo })
                .eq('id', id)
                .select()
                .single()

            if (err) throw err

            // Recargamos los datos globales para que se refleje instantáneamente en toda la app
            await loadData()

            return { success: true, data: updatedRow }
        } catch (e) {
            console.error(`Error al actualizar el campo ${campoDb} en Supabase:`, e)
            error.value = e
            return { success: false, error: e.message }
        }
    }

    return { data, status, lastUpdate, loading, error, añoActual, loadAll, updateShowStatus, updateShowField }
}