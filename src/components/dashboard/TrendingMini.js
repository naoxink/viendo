import { ref, onMounted, computed } from 'vue'
import MiniSerieList from './MiniSerieList.js'
import { useSeriesData } from '../../composables/useSeriesData.js'

export default {
    name: 'TrendingMini',
    components: { MiniSerieList },
    props: {
        limite: { type: Number, default: 6 }
    },
    setup(props) {
        const { fetchTrendingSeries } = useSeriesData()
        const series = ref([])
        const loading = ref(true)

        onMounted(async () => {
            series.value = await fetchTrendingSeries()
            loading.value = false
        })

        // No son series tuyas (vienen de la tabla trending_series), así que
        // enlazamos a TheTVDB en vez de abrir la ficha de edición.
        const items = computed(() =>
            series.value.slice(0, props.limite).map((s) => ({
                key: 'trending-' + (s.tvdb_id ?? s.id ?? s.titulo),
                titulo: s.titulo,
                meta: s.score ? '⭐ ' + Number(s.score).toFixed(1) : '',
                href: s.tvdb_id ? 'https://www.thetvdb.com/?tab=series&id=' + s.tvdb_id : null
            }))
        )

        return { loading, items }
    },
    template: `
        <div>
            <p v-if="loading" class="dashboard-widget-placeholder">Cargando…</p>
            <MiniSerieList v-else-if="items.length" :items="items" />
            <p v-else class="dashboard-widget-placeholder">No hay datos de trending disponibles todavía.</p>
        </div>
    `
}