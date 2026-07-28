import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useSeriesData } from '../composables/useSeriesData.js'
import BottomNav from './BottomNav.js'
import ViewViendo from './views/ViewViendo.js'
import ViewEnCola from './views/ViewEnCola.js'
import ViewCompletadas from './views/ViewCompletadas.js'
import ViewStats from './views/ViewStats.js'
import ViewSerieDetail from './views/ViewSerieDetail.js'
import ViewAddSerie from './views/ViewAddSerie.js'

const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('admin_token');

if (token) {
  sessionStorage.setItem('isAdmin', 'true');
  sessionStorage.setItem('adminToken', token);
  // Limpiar la URL para que el token no se quede ahí visible
  window.history.replaceState({}, document.title, window.location.pathname);
}

export default {
    name: 'App',
    components: { BottomNav, ViewViendo, ViewEnCola, ViewCompletadas, ViewStats, ViewSerieDetail, ViewAddSerie },
    setup() {
        const { data, status, lastUpdate, loading, error, añoActual, loadAll } = useSeriesData()
        const searchTerm = ref('')
        const themePreference = ref('auto')
        const activeView = ref('viendo')
        const selectedSerie = ref(null)

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
                const storedView = localStorage.getItem('viendo-active-view')
                if (storedView && ['viendo', 'en-cola', 'completadas', 'stats', 'detalle'].includes(storedView)) {
                    activeView.value = storedView
                }
            } catch (error) {
                console.warn('No se pudo leer las preferencias guardadas:', error)
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

        watch(activeView, (value) => {
            try {
                if (value !== 'detalle') {
                    selectedSerie.value = null
                }
                localStorage.setItem('viendo-active-view', value)
            } catch (error) {
                console.warn('No se pudo guardar la vista activa:', error)
            }
        })

        // Método para abrir el detalle de una serie desde cualquier vista
        const abrirDetalle = (serie) => {
            console.log('Abriendo detalle de la serie:', serie.titulo);
            selectedSerie.value = serie
            activeView.value = 'detalle'
        }

        // Método para volver a la vista anterior o principal
        const volverAtras = () => {
            selectedSerie.value = null
            activeView.value = 'viendo' // O la vista por defecto que prefieras
        }

        const cambiarVista = vista => {
            if (vista !== 'detalle') {
                selectedSerie.value = null
            }
            activeView.value = vista
        }

        const viendo = computed(() => data.value?.viendo ?? [])
        const completadas = computed(() => data.value?.completadas ?? [])
        const dropeadas = computed(() => data.value?.dropeadas ?? [])
        const enCola = computed(() => data.value?.en_cola ?? [])

        return {
            data, status, lastUpdate, loading, error, añoActual,
            searchTerm, themePreference, activeView, viendo, completadas,
            dropeadas, enCola, abrirDetalle, volverAtras, selectedSerie, cambiarVista
        }
    },
    template: `
        <main class="app-container">
            <div class="theme-selector">
                <label for="theme-select">Tema</label>
                <select id="theme-select" v-model="themePreference">
                    <option value="auto">Automático</option>
                    <option value="light">Claro</option>
                    <option value="dark">Oscuro</option>
                </select>
            </div>

            <div class="views-container">
                <ViewViendo 
                    v-if="activeView === 'viendo'"
                    :viendo="viendo"
                    :status="status"
                    :last-update="lastUpdate"
                    :loading="loading"
                    :error="error"
                    :data="data"
                    :completadas="completadas"
                    :año-actual="añoActual"
                    @select-serie="abrirDetalle"
                />
                
                <ViewEnCola 
                    v-if="activeView === 'en-cola'"
                    :en-cola="enCola"
                    :viendo="viendo"
                    :loading="loading"
                    :error="error"
                    @select-serie="abrirDetalle"
                    @cambiar-vista="cambiarVista"
                />
                
                <ViewCompletadas 
                    v-if="activeView === 'completadas'"
                    :completadas="completadas"
                    :dropeadas="dropeadas"
                    :loading="loading"
                    :error="error"
                    :search-term="searchTerm"
                    @update:search-term="searchTerm = $event"
                    :año-actual="añoActual"
                    @select-serie="abrirDetalle"
                />
                
                <ViewStats 
                    v-if="activeView === 'stats'"
                    :viendo="viendo"
                    :completadas="completadas"
                    :dropeadas="dropeadas"
                    :en-cola="enCola"
                    :data="data"
                    :loading="loading"
                    :error="error"
                    :año-actual="añoActual"
                    @select-serie="abrirDetalle"
                />
                
                <!-- Nueva vista de detalle de serie -->
                <ViewSerieDetail
                    v-if="activeView === 'detalle' && selectedSerie"
                    :serie="selectedSerie"
                    @back="volverAtras"
                />

                <ViewAddSerie
                    v-if="activeView === 'add-serie'"
                />
            </div>

            <BottomNav :active-view="activeView" @change-view="activeView = $event" />
        </main>
    `
}
