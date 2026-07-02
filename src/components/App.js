import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useSeriesData } from '../composables/useSeriesData.js'
import StatusDashboard from './StatusDashboard.js'
import StatsBar from './StatsBar.js'
import StatsPanel from './StatsPanel.js'
import ViendoList from './ViendoList.js'
import HistoricoList from './HistoricoList.js'
import EnColaList from './EnColaList.js'
import DropeadasList from './DropeadasList.js'
import CalendarioEstrenos from './CalendarioEstrenos.js'

export default {
    name: 'App',
    components: { StatusDashboard, StatsBar, StatsPanel, ViendoList, HistoricoList, EnColaList, DropeadasList, CalendarioEstrenos },
    setup() {
        const { data, status, lastUpdate, loading, error, añoActual, loadAll } = useSeriesData()
        const searchTerm = ref('')
        const themePreference = ref('auto')

        const applyTheme = (preference = themePreference.value) => {
            const resolvedTheme = preference === 'auto'
                ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                : preference

            document.documentElement.setAttribute('data-theme', resolvedTheme)
            document.documentElement.setAttribute('data-theme-preference', preference)
        }

        const syncSystemTheme = () => {
            if (themePreference.value === 'auto') {
                applyTheme('auto')
            }
        }

        onMounted(() => {
            loadAll()

            try {
                const storedTheme = localStorage.getItem('viendo-theme')
                if (storedTheme === 'auto' || storedTheme === 'light' || storedTheme === 'dark') {
                    themePreference.value = storedTheme
                }
            } catch (error) {
                console.warn('No se pudo leer el tema guardado:', error)
            }

            applyTheme(themePreference.value)

            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
            mediaQuery.addEventListener?.('change', syncSystemTheme)

            onBeforeUnmount(() => {
                mediaQuery.removeEventListener?.('change', syncSystemTheme)
            })
        })

        watch(themePreference, (value) => {
            try {
                localStorage.setItem('viendo-theme', value)
            } catch (error) {
                console.warn('No se pudo guardar el tema:', error)
            }

            applyTheme(value)
        })

        const viendo = computed(() => data.value?.viendo ?? [])
        const completadas = computed(() => data.value?.completadas ?? [])
        const dropeadas = computed(() => data.value?.dropeadas ?? [])
        const enCola = computed(() => data.value?.en_cola ?? [])

        return {
            data, status, lastUpdate, loading, error, añoActual,
            searchTerm, themePreference, viendo, completadas, dropeadas, enCola
        }
    },
    template: `
        <main class="container">
            <div class="theme-selector">
                <label for="theme-select">Tema</label>
                <select id="theme-select" v-model="themePreference">
                    <option value="auto">Automático</option>
                    <option value="light">Claro</option>
                    <option value="dark">Oscuro</option>
                </select>
            </div>

            <div class="dashboard-shell">
                <div class="dashboard-top">
                    <StatusDashboard :status="status" />
                    <StatsBar v-if="data" :viendo="viendo" :completadas="completadas" :ano-actual="añoActual" />
                </div>

                <div class="dashboard-main">
                    <section class="dashboard-primary">
                        <h1>📺 Viendo actualmente</h1>
                        <p v-if="loading">Cargando series...</p>
                        <p v-else-if="error">No se ha podido cargar los datos de series. Revisa la consola para más detalles.</p>
                        <ViendoList v-else :series="viendo" />

                        <div class="last-update progress"><small>Actualizado el </small><small class="date">{{ lastUpdate }}</small></div>
                    </section>

                    <aside class="dashboard-sidebar">
                        <StatsPanel v-if="data" :viendo="viendo" :en-cola="enCola" :dropeadas="dropeadas" :completadas="completadas" :ano-actual="añoActual" />
                        <EnColaList :series="enCola" />
                        <CalendarioEstrenos :series="[...viendo, ...enCola]"></CalendarioEstrenos>
                    </aside>
                </div>

                <section class="history-panel">
                    <h1 class="history-title">✅ Completadas</h1>
                    <div class="search-wrapper">
                        <input type="search" id="history-search" v-model="searchTerm" placeholder="Buscar en el histórico...">
                    </div>
                    <div class="history-grid">
                        <HistoricoList :completadas="completadas" :ano-actual="añoActual" :search-term="searchTerm" />
                        <DropeadasList :series="dropeadas" :search-term="searchTerm" />
                    </div>
                </section>
            </div>
        </main>
    `
}
