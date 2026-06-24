import { ref, computed } from 'vue'

/**
 * Encapsula todo el acceso a los JSON estáticos del sitio.
 *
 * Diferencia deliberada respecto al script original: aquí cada fuente
 * (data.json, status.json, fecha de última modificación) se carga de forma
 * independiente. En el script original, si fallaba el fetch de data.json,
 * el dashboard de estado tampoco llegaba a pintarse porque todo colgaba del
 * mismo try/catch secuencial. Con esto, un fallo en una fuente no afecta a
 * las demás.
 */
export function useSeriesData() {
    const data = ref(null)
    const status = ref(null)
    const lastUpdate = ref('')
    const loading = ref(true)
    const error = ref(null)

    const añoActual = computed(() => new Date().getFullYear())

    async function loadData() {
        try {
            const res = await fetch('data.json')
            data.value = await res.json()
        } catch (e) {
            console.error('Error cargando data.json:', e)
            error.value = e
        }
    }

    async function loadStatus() {
        try {
            const res = await fetch('status.json')
            status.value = await res.json()
        } catch (e) {
            // No es un error real: el archivo de estado puede no existir aún.
            console.log('Aún no existe el archivo de estados:', e)
            status.value = null
        }
    }

    async function loadLastUpdate() {
        try {
            const res = await fetch('data.json', { method: 'HEAD' })
            const lastModified = res.headers.get('Last-Modified')
            lastUpdate.value = lastModified
                ? new Date(lastModified).toLocaleDateString('es-ES')
                : 'desconocida'
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
