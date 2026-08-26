import { ref, computed } from 'vue'
import MiniSerieList from './MiniSerieList.js'
import { matchesSearch } from '../../utils/search.js'

const ETIQUETAS_COLECCION = {
    viendo: '📺 Viendo',
    en_cola: '📅 En cola',
    completadas: '✅ Completada',
    dropeadas: '🗑️ Dropeada'
}

export default {
    name: 'SearchGeneral',
    components: { MiniSerieList },
    props: {
        viendo: { type: Array, default: () => [] },
        enCola: { type: Array, default: () => [] },
        completadas: { type: Array, default: () => [] },
        dropeadas: { type: Array, default: () => [] },
        limite: { type: Number, default: 8 }
    },
    emits: ['select-serie'],
    setup(props) {
        const searchTerm = ref('')

        // Unimos las 4 colecciones marcando de dónde viene cada serie, para
        // poder buscar en todas a la vez con el mismo matchesSearch que ya
        // usa la búsqueda de "Completadas", y para mostrar de qué colección
        // viene cada resultado.
        const todas = computed(() => [
            ...props.viendo.map((serie) => ({ serie, coleccion: 'viendo' })),
            ...props.enCola.map((serie) => ({ serie, coleccion: 'en_cola' })),
            ...props.completadas.map((serie) => ({ serie, coleccion: 'completadas' })),
            ...props.dropeadas.map((serie) => ({ serie, coleccion: 'dropeadas' }))
        ])

        const term = computed(() => searchTerm.value.trim().toLowerCase())

        const resultados = computed(() => {
            if (!term.value) return []

            return todas.value
                .filter(({ serie }) => matchesSearch(serie, term.value))
                .slice(0, props.limite)
                .map(({ serie, coleccion }) => ({
                    key: coleccion + '-' + serie.titulo,
                    titulo: serie.titulo,
                    meta: [serie.año, ETIQUETAS_COLECCION[coleccion]].filter(Boolean).join(' · '),
                    serie,
                    nota: serie.nota || null
                }))
        })

        return { searchTerm, term, resultados }
    },
    template: `
        <div class="dashboard-search">
            <input
                type="search"
                v-model="searchTerm"
                placeholder="Buscar por título, nota, año…"
                class="admin-input dashboard-search-input"
            >
            <MiniSerieList
                v-if="resultados.length"
                :items="resultados"
                :show-posters="true"
                @select-serie="$emit('select-serie', $event)"
            />
            <p v-else-if="term" class="dashboard-widget-placeholder">Sin resultados para "{{ searchTerm }}".</p>
            <p v-else class="dashboard-widget-placeholder">Escribe para buscar entre todas tus series.</p>
        </div>
    `
}