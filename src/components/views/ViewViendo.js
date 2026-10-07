import StatusDashboard from '../StatusDashboard.js'
import StatsBar from '../StatsBar.js'
import ViendoList from '../ViendoList.js'
import ViendoConAlguienSwitch from '../shared/ViendoConAlguienSwitch.js'
import { useViendoFilter } from '../../composables/useViendoFilter.js'
import { computed } from 'vue'

export default {
    name: 'ViewViendo',
    components: { StatusDashboard, StatsBar, ViendoList, ViendoConAlguienSwitch },
    props: {
        viendo: Array,
        status: Object,
        lastUpdate: String,
        loading: Boolean,
        error: String,
        data: Object,
        completadas: Array,
        añoActual: Number
    },
    computed: {
        isAdmin() {
            return sessionStorage.getItem('isAdmin') === 'true'
        }
    },
    setup(props) {
        const { filtrar } = useViendoFilter()
        const viendoVisible = computed(() => filtrar(props.viendo))
        return { viendoVisible }
    },
    emits: ['show-login', 'select-serie'],
    template: `
        <div class="view view-viendo">
            <div class="view-header">
                <StatusDashboard :status="status" />
            </div>

            <section class="view-content">
                <h1>📺 Viendo actualmente</h1>
                <p v-if="loading">Cargando series...</p>
                <p v-else-if="error">No se ha podido cargar los datos de series. Revisa la consola para más detalles.</p>
                <ViendoList v-else :series="viendoVisible" @select-serie="$emit('select-serie', $event)" />
                <ViendoConAlguienSwitch :series="viendo" />
                <div class="last-update progress"><small>Actualizado el </small><small class="date">{{ lastUpdate }}</small></div>

                <a class="thetvdbattribution" style="" href="https://thetvdb.com/subscribe">
                        <img src="https://www.thetvdb.com/images/attribution/logo1.png" height="45">
                        Metadata provided by TheTVDB. Please consider adding missing information or subscribing.
                </a>

                <div class="text-center" v-if="!isAdmin">
                    <a ref="javascript:() => false" class="link" @click="$emit('show-login')">Login</a>
                </div>
            </section>
        </div>
    `
}
