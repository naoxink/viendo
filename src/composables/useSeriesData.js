import { ref, computed } from 'vue'

/**
 * Encapsula todo el acceso a los JSON estáticos del sitio.
 *
 * Ahora carga cada colección desde su propio archivo JSON fragmentado.
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
            const [viendo, enCola, dropeadas, completadas] = await Promise.all([
                fetch('data/viendo.json').then(res => res.json()),
                fetch('data/en_cola.json').then(res => res.json()),
                fetch('data/dropeadas.json').then(res => res.json()),
                fetch('data/completadas.json').then(res => res.json())
            ])

            data.value = {
                viendo: Array.isArray(viendo) ? viendo.map(s => { s.estado = 'viendo'; return s; }) : [],
                en_cola: Array.isArray(enCola) ? enCola.map(s => { s.estado = 'enCola'; return s; }) : [],
                dropeadas: Array.isArray(dropeadas) ? dropeadas.map(s => { s.estado = 'dropeada'; return s; }) : [],
                completadas: Array.isArray(completadas) ? completadas.map(s => { s.estado = 'completada'; return s; }) : []
            }
        } catch (e) {
            console.error('Error cargando los archivos de datos fragmentados:', e)
            error.value = e
        }
    }

    async function loadStatus() {
        try {
            const res = await fetch('data/status.json')
            status.value = await res.json()
        } catch (e) {
            // No es un error real: el archivo de estado puede no existir aún.
            console.log('Aún no existe el archivo de estados:', e)
            status.value = null
        }
    }

    async function loadLastUpdate() {
        try {
            const files = ['data/viendo.json', 'data/en_cola.json', 'data/dropeadas.json', 'data/completadas.json']
            const responses = await Promise.all(files.map(file => fetch(file, { method: 'HEAD' })))
            const lastModified = responses
                .map(res => res.headers.get('Last-Modified'))
                .filter(Boolean)
                .map(value => new Date(value).getTime())
                .sort((a, b) => b - a)[0]

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
