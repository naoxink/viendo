import { computed } from 'vue'
import ViendoCard from '../ViendoCard.js'
import ProximosEstrenosMini from '../dashboard/ProximosEstrenosMini.js'
import QuickAddSerie from '../dashboard/QuickAddSerie.js'
import TrendingMini from '../dashboard/TrendingMini.js'
import ActualizadasMini from '../dashboard/ActualizadasMini.js'

export default {
    name: 'ViewDashboard',
    components: { ViendoCard, ProximosEstrenosMini, QuickAddSerie, TrendingMini, ActualizadasMini },
    props: {
        viendo: { type: Array, default: () => [] },
        enCola: { type: Array, default: () => [] },
        añoActual: { type: Number, required: true }
    },
    emits: ['select-serie', 'show-login'],
    setup(props) {
        const isAdmin = computed(() => sessionStorage.getItem('isAdmin') === 'true')

        // Fase 1: pendientes. Fase 2: próximos estrenos + quick-add.
        // Fase 3: trending + actualizadas.
        // Queda pendiente la Fase 4 (búsqueda general).
        const pendientes = computed(() => props.viendo.filter((s) => s.pendiente))

        return { isAdmin, pendientes }
    },
    template: `
        <div class="view view-dashboard">
            <section class="view-content">

                <div class="dashboard-header">
                    <h1>🏠 Dashboard</h1>
                    <a v-if="!isAdmin" class="link" @click="$emit('show-login')">Login</a>
                </div>

                <div class="dashboard-grid">

                    <div class="dashboard-col">

                        <div class="dashboard-widget">
                            <h3 class="dashboard-widget-title">
                                <span>🔔 Pendientes</span>
                                <span class="count">{{ pendientes.length }} series</span>
                            </h3>
                            <div v-if="pendientes.length" class="dashboard-pendientes-grid">
                                <ViendoCard
                                    v-for="serie in pendientes"
                                    :key="serie.titulo + serie.año"
                                    :serie="serie"
                                    @select-serie="$emit('select-serie', $event)"
                                />
                            </div>
                            <p v-else class="dashboard-widget-placeholder">No tienes capítulos pendientes ahora mismo.</p>
                        </div>

                        <div class="dashboard-widget">
                            <h3 class="dashboard-widget-title">
                                <span>👀 Próximos estrenos</span>
                            </h3>
                            <ProximosEstrenosMini
                                :viendo="viendo"
                                :en-cola="enCola"
                                @select-serie="$emit('select-serie', $event)"
                            />
                        </div>

                        <div class="dashboard-widget">
                            <h3 class="dashboard-widget-title">
                                <span>🔍 Buscar en mis series</span>
                            </h3>
                            <p class="dashboard-widget-placeholder">Próximamente (Fase 4).</p>
                        </div>

                    </div>

                    <div class="dashboard-col">

                        <div class="dashboard-widget" v-if="isAdmin">
                            <h3 class="dashboard-widget-title">
                                <span>➕ Añadir serie</span>
                            </h3>
                            <QuickAddSerie />
                        </div>

                        <div class="dashboard-widget">
                            <h3 class="dashboard-widget-title">
                                <span>🆕 Actualizadas</span>
                            </h3>
                            <ActualizadasMini />
                        </div>

                        <div class="dashboard-widget">
                            <h3 class="dashboard-widget-title">
                                <span>🔥 Trending</span>
                            </h3>
                            <TrendingMini />
                        </div>

                    </div>

                </div>
            </section>
        </div>
    `
}