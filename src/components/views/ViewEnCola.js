import EnColaList from '../EnColaList.js'
import CalendarioEstrenos from '../CalendarioEstrenos.js'
import { sortViendo } from '../../utils/sorting.js'
import ProximamenteList from '../ProximamenteList.js'

export default {
    name: 'ViewEnCola',
    components: { EnColaList, CalendarioEstrenos, ProximamenteList },
    props: {
        enCola: Array,
        viendo: Array,
        loading: Boolean,
        error: String
    },
    computed: {
        proximamente() {
            const todas = [ ...this.viendo, ...this.enCola ]
            let proximamente = sortViendo(todas)
            proximamente = proximamente.filter(s => s.proximaFecha)
            // Hacer objeto en base a las fechas
            proximamente = proximamente.reduce((acc, s) => {
                const fecha = s.proximaFecha
                if (!acc[fecha]) acc[fecha] = []
                acc[fecha].push(s)
                return acc
            }, {})
            return proximamente
        }
    },
    template: `
        <div class="view view-en-cola">
            <section class="view-content">
                <ProximamenteList :series="proximamente" titulo="👀 Próximamente" />

                <p v-if="loading">Cargando series...</p>
                <p v-else-if="error">No se ha podido cargar los datos de series. Revisa la consola para más detalles.</p>
                <template v-else>
                    <EnColaList :series="enCola" titulo="📅 Series en cola" />
                    <CalendarioEstrenos :series="[...viendo, ...enCola]"></CalendarioEstrenos>
                </template>
            </section>
        </div>
    `
}
