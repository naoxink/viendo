import { ref, computed, onMounted } from 'vue'
import { useSeriesData } from '../composables/useSeriesData.js'
import StatusDashboard from './StatusDashboard.js'
import StatsBar from './StatsBar.js'
import ViendoList from './ViendoList.js'
import HistoricoList from './HistoricoList.js'
import EnColaList from './EnColaList.js'
import DropeadasList from './DropeadasList.js'

export default {
    name: 'App',
    components: { StatusDashboard, StatsBar, ViendoList, HistoricoList, EnColaList, DropeadasList },
    setup() {
        const { data, status, lastUpdate, loading, error, añoActual, loadAll } = useSeriesData()
        const searchTerm = ref('')

        onMounted(loadAll)

        const viendo = computed(() => data.value?.viendo ?? [])
        const completadas = computed(() => data.value?.completadas ?? [])
        const dropeadas = computed(() => data.value?.dropeadas ?? [])
        const enCola = computed(() => data.value?.en_cola ?? [])

        return {
            data, status, lastUpdate, loading, error, añoActual,
            searchTerm, viendo, completadas, dropeadas, enCola
        }
    },
    template: `
        <main class="container">
            <StatusDashboard :status="status" />
            <StatsBar v-if="data" :viendo="viendo" :completadas="completadas" :ano-actual="añoActual" />

            <h1>📺 Viendo actualmente</h1>
            <p v-if="loading">Cargando series...</p>
            <p v-else-if="error">No se ha podido cargar data.json. Revisa la consola para más detalles.</p>
            <ViendoList v-else :series="viendo" />

            <div class="last-update progress"><small>Actualizado el </small><small class="date">{{ lastUpdate }}</small></div>

            <EnColaList :series="enCola" />

            <div class="search-wrapper">
                <input type="search" id="history-search" v-model="searchTerm" placeholder="Buscar en el histórico...">
            </div>

            <h1 class="history-title">✅ Completadas</h1>
            <HistoricoList :completadas="completadas" :ano-actual="añoActual" :search-term="searchTerm" />

            <DropeadasList :series="dropeadas" :search-term="searchTerm" />
        </main>
    `
}
