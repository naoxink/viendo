import { ref } from 'vue'
import { CONFIG } from '../../utils/config.js'

export default {
    name: 'SerieSearchInput',
    emits: ['select'],
    setup(props, { emit }) {
        const query = ref('')
        const resultados = ref([])
        const buscando = ref(false)
        const errorBusqueda = ref(false)
        const mostrarSugerencias = ref(false)
        let debounceTimer = null

        const buscar = async (texto) => {
            const token = sessionStorage.getItem('adminToken')
            if (!token || !texto.trim()) {
                resultados.value = []
                return
            }

            buscando.value = true
            errorBusqueda.value = false

            try {
                const res = await fetch(
                    `${CONFIG.API_BASE_URL}/api/search-show?query=${encodeURIComponent(texto)}`,
                    { headers: { Authorization: token } }
                )

                if (!res.ok) throw new Error('Error en la búsqueda')

                const data = await res.json()
                resultados.value = data.success ? data.resultados : []
                if (!data.success) errorBusqueda.value = true
            } catch (e) {
                console.error('Error buscando en TheTVDB:', e)
                resultados.value = []
                errorBusqueda.value = true
            } finally {
                buscando.value = false
            }
        }

        const onInput = () => {
            mostrarSugerencias.value = true
            clearTimeout(debounceTimer)
            const texto = query.value
            debounceTimer = setTimeout(() => buscar(texto), 350)
        }

        const seleccionar = (serie) => {
            query.value = serie.titulo + (serie.anio ? ` (${serie.anio})` : '')
            resultados.value = []
            mostrarSugerencias.value = false
            emit('select', serie)
        }

        // Pequeño delay para que el @mousedown de la sugerencia se procese
        // antes de que el blur del input cierre el dropdown
        const cerrarSugerencias = () => {
            setTimeout(() => { mostrarSugerencias.value = false }, 150)
        }

        const linkFallback = () => {
            const texto = encodeURIComponent(query.value.trim())
            return `https://www.thetvdb.com/search?query=${texto}`
        }

        return {
            query, resultados, buscando, errorBusqueda, mostrarSugerencias,
            onInput, seleccionar, cerrarSugerencias, linkFallback
        }
    },
    template: `
        <div class="serie-search">
            <input
                type="text"
                v-model="query"
                @input="onInput"
                @focus="mostrarSugerencias = true"
                @blur="cerrarSugerencias"
                placeholder="Escribe el título de la serie…"
                class="admin-input"
                autocomplete="off"
            />

            <div v-if="mostrarSugerencias && query.trim()" class="serie-search-dropdown">
                <p v-if="buscando" class="serie-search-status">Buscando…</p>

                <ul v-else-if="resultados.length" class="serie-search-results">
                    <li v-for="serie in resultados" :key="serie.tvdb_id" @mousedown.prevent="seleccionar(serie)">
                        <img v-if="serie.imagen" :src="serie.imagen" :alt="serie.titulo" class="serie-search-thumb" loading="lazy">
                        <div v-else class="serie-search-thumb serie-search-thumb-placeholder"></div>
                        <span class="serie-search-info">
                            <span class="serie-search-titulo">{{ serie.titulo }}</span>
                            <span v-if="serie.anio" class="serie-search-anio">{{ serie.anio }}</span>
                        </span>
                    </li>
                </ul>

                <p v-else class="serie-search-status">
                    {{ errorBusqueda ? 'No se pudo buscar en TheTVDB.' : 'Sin resultados.' }}
                    <a :href="linkFallback()" target="_blank" rel="noopener" class="link">Buscar manualmente ↗</a>
                </p>
            </div>
        </div>
    `
}