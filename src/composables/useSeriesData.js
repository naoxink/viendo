import { ref, computed } from 'vue'
import { createClient } from '@supabase/supabase-js'
import { CONFIG } from '../utils/config'

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
        const token = sessionStorage.getItem('adminToken')
        if (!token) {
            return { success: false, error: 'No se encontró el token de administrador' }
        }

        try {
            let estadoDb = estadoNuevo
            if (estadoNuevo === 'enCola') estadoDb = 'en_cola'
            if (estadoNuevo === 'dropeada') estadoDb = 'dropeadas'
            if (estadoNuevo === 'completada') estadoDb = 'completadas'

            const res = await fetch(`${CONFIG.API_BASE_URL}/api/update-status`, {
                method: 'POST',
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id, estadoNuevo: estadoDb })
            })

            if (!res.ok) {
                throw new Error(`Error en el servidor: ${res.status}`)
            }

            const data = await res.json()

            if (!data.success) {
                throw new Error(data.error || 'Error desconocido en la API')
            }

            await loadData()

            return { success: true, data: data.serie }
        } catch (e) {
            console.error('Error al actualizar el estado de la serie:', e)
            error.value = e
            return { success: false, error: e.message }
        }
    }

    async function updateShowField(id, campoDb, valorNuevo) {
        const token = sessionStorage.getItem('adminToken')
        if (!token) {
            return { success: false, error: 'No se encontró el token de administrador' }
        }

        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/update-field`, {
                method: 'POST',
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id, campoDb, valorNuevo })
            })

            if (!res.ok) {
                throw new Error(`Error en el servidor: ${res.status}`)
            }

            const data = await res.json()

            if (!data.success) {
                throw new Error(data.error || 'Error desconocido en la API')
            }

            await loadData()

            return { success: true, data: data.data }
        } catch (e) {
            console.error(`Error al actualizar el campo ${campoDb}:`, e)
            error.value = e
            return { success: false, error: e.message }
        }
    }

    async function insertShow(serieEsqueleto) {
        const token = sessionStorage.getItem('adminToken')
        if (!token) {
            return { success: false, error: 'No se encontró el token de administrador' }
        }

        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/add-show`, {
                method: 'POST',
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(serieEsqueleto)
            })

            if (!res.ok) {
                throw new Error(`Error en el servidor: ${res.status}`)
            }

            const data = await res.json()

            if (!data.success) {
                throw new Error(data.error || 'Error desconocido en la API')
            }

            await loadData()

            return { success: true, data: data.serie }
        } catch (e) {
            console.error("Error al insertar la nueva serie:", e)
            error.value = e
            return { success: false, error: e.message }
        }
    }

    return { data, status, lastUpdate, loading, error, añoActual, loadAll, updateShowStatus, updateShowField, insertShow }
}