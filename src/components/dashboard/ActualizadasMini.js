import { ref, onMounted, computed } from 'vue'
import MiniSerieList from './MiniSerieList.js'
import { useSeriesData } from '../../composables/useSeriesData.js'
import { formatProximaFecha } from '../../utils/format.js'

export default {
    name: 'ActualizadasMini',
    components: { MiniSerieList },
    props: {
        limite: { type: Number, default: 6 }
    },
    setup(props) {
        const { fetchRecentlyUpdated } = useSeriesData()
        const series = ref([])
        const loading = ref(true)

        onMounted(async () => {
            series.value = await fetchRecentlyUpdated()
            loading.value = false
        })

        // Tampoco son series tuyas (tabla updated_series): enlazamos a
        // TheTVDB en vez de abrir la ficha de edición.
        const items = computed(() =>
            series.value.slice(0, props.limite).map((s) => ({
                key: 'actualizada-' + (s.tvdb_id ?? s.id ?? s.titulo),
                titulo: s.titulo,
                meta: (s.temporada && s.capitulo)
                    ? ('T' + s.temporada + ' · E' + s.capitulo)
                    : formatProximaFecha(s.last_aired),
                href: s.tvdb_id ? 'https://www.thetvdb.com/?tab=series&id=' + s.tvdb_id : null
            }))
        )

        return { loading, items }
    },
    template: `
        <div>
            <p v-if="loading" class="dashboard-widget-placeholder">Cargando…</p>
            <MiniSerieList v-else-if="items.length" :items="items" />
            <p v-else class="dashboard-widget-placeholder">No hay series actualizadas recientemente.</p>
        </div>
    `
}