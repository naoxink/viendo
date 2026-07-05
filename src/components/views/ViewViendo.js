import StatusDashboard from '../StatusDashboard.js'
import StatsBar from '../StatsBar.js'
import ViendoList from '../ViendoList.js'

export default {
    name: 'ViewViendo',
    components: { StatusDashboard, StatsBar, ViendoList },
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
    template: `
        <div class="view view-viendo">
            <div class="view-header">
                <StatusDashboard :status="status" />
                <StatsBar v-if="data" :viendo="viendo" :completadas="completadas" :ano-actual="añoActual" />
            </div>

            <section class="view-content">
                <h1>📺 Viendo actualmente</h1>
                <p v-if="loading">Cargando series...</p>
                <p v-else-if="error">No se ha podido cargar los datos de series. Revisa la consola para más detalles.</p>
                <ViendoList v-else :series="viendo" />
                <div class="last-update progress"><small>Actualizado el </small><small class="date">{{ lastUpdate }}</small></div>
            </section>
        </div>
    `
}
