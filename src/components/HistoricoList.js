import { computed } from 'vue'
import HistoricoCard from './HistoricoCard.js'
import { groupHistorico } from '../utils/grouping.js'
import { matchesSearch } from '../utils/search.js'

export default {
    name: 'HistoricoList',
    components: { HistoricoCard },
    props: {
        completadas: { type: Array, default: () => [] },
        anoActual: { type: Number, required: true },
        searchTerm: { type: String, default: '' }
    },
    setup(props) {
        const term = computed(() => props.searchTerm.trim().toLowerCase())

        // Grupos base (por año), recalculados solo si cambian las series o el año
        const gruposBase = computed(() => groupHistorico(props.completadas, props.anoActual))

        // Con término de búsqueda: filtramos series dentro de cada grupo y
        // descartamos los grupos que se queden sin resultados (equivalente al
        // display:none del script original).
        const grupos = computed(() => {
            if (!term.value) return gruposBase.value
            return gruposBase.value
                .map((g) => ({ ...g, series: g.series.filter((s) => matchesSearch(s, term.value)) }))
                .filter((g) => g.series.length > 0)
        })

        // Mientras se busca, todos los grupos visibles se abren automáticamente.
        // Sin búsqueda activa, cada grupo vuelve a su estado por defecto
        // (el primero abierto, el resto cerrados) — igual que el script original.
        function isOpen(grupo) {
            return term.value ? true : grupo.defaultOpen
        }

        return { grupos, isOpen }
    },
    template: `
        <div id="history-list" class="grid history">
            <details v-for="grupo in grupos" :key="grupo.key" class="año-section" :open="isOpen(grupo)">
                <summary>
                    <span>{{ grupo.titulo }}</span>
                    <span class="count">{{ grupo.series.length }} series</span>
                </summary>
                <div class="año-content">
                    <HistoricoCard v-for="serie in grupo.series" :key="serie.titulo" :serie="serie" />
                </div>
            </details>
        </div>
    `
}
