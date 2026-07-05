import EnColaList from '../EnColaList.js'
import CalendarioEstrenos from '../CalendarioEstrenos.js'

export default {
    name: 'ViewEnCola',
    components: { EnColaList, CalendarioEstrenos },
    props: {
        enCola: Array,
        viendo: Array,
        loading: Boolean,
        error: String
    },
    template: `
        <div class="view view-en-cola">
            <section class="view-content">
                <h1>📅 Series en cola</h1>
                <p v-if="loading">Cargando series...</p>
                <p v-else-if="error">No se ha podido cargar los datos de series. Revisa la consola para más detalles.</p>
                <template v-else>
                    <EnColaList :series="enCola" />
                    <CalendarioEstrenos :series="[...viendo, ...enCola]"></CalendarioEstrenos>
                </template>
            </section>
        </div>
    `
}
