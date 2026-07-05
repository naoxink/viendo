import StatsPanel from '../StatsPanel.js'

export default {
    name: 'ViewStats',
    components: { StatsPanel },
    props: {
        viendo: Array,
        completadas: Array,
        dropeadas: Array,
        enCola: Array,
        data: Object,
        loading: Boolean,
        error: String,
        añoActual: Number
    },
    template: `
        <div class="view view-stats">
            <section class="view-content">
                <h1>📊 Estadísticas</h1>
                <p v-if="loading">Cargando estadísticas...</p>
                <p v-else-if="error">No se ha podido cargar los datos. Revisa la consola para más detalles.</p>
                <StatsPanel 
                    v-else
                    :viendo="viendo" 
                    :en-cola="enCola" 
                    :dropeadas="dropeadas" 
                    :completadas="completadas" 
                    :ano-actual="añoActual"
                />
            </section>
        </div>
    `
}
