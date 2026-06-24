import { computed } from 'vue'
import DropeadaCard from './DropeadaCard.js'
import { matchesSearch } from '../utils/search.js'

export default {
    name: 'DropeadasList',
    components: { DropeadaCard },
    props: {
        series: { type: Array, default: () => [] },
        searchTerm: { type: String, default: '' }
    },
    setup(props) {
        const term = computed(() => props.searchTerm.trim().toLowerCase())

        const ordenadas = computed(() => [...props.series].sort((a, b) => a.titulo.localeCompare(b.titulo)))

        const filtradas = computed(() =>
            term.value ? ordenadas.value.filter((s) => matchesSearch(s, term.value)) : ordenadas.value
        )

        // Se muestra si hay dropeadas Y (no se está buscando, o hay coincidencias)
        const shouldShow = computed(() => props.series.length > 0 && filtradas.value.length > 0)

        // Por defecto cerrada; se abre sola mientras hay un término de búsqueda activo
        const isOpen = computed(() => term.value.length > 0)

        return { filtradas, shouldShow, isOpen }
    },
    template: `
        <div id="dropped-container">
            <details v-if="shouldShow" class="año-section dropped-section" :open="isOpen">
                <summary>
                    <span>🗑️ Series Dropeadas</span>
                    <span class="count">{{ filtradas.length }} series</span>
                </summary>
                <div class="año-content">
                    <DropeadaCard v-for="serie in filtradas" :key="serie.titulo" :serie="serie" />
                </div>
            </details>
        </div>
    `
}
