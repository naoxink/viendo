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
    emits: ['select-serie', 'cambiar-vista'],
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
        },
        isAdmin() {
            return sessionStorage.getItem('isAdmin') === 'true'
        }
    },
    template: `
        <div class="view view-en-cola">
            <section class="view-content">
                <ProximamenteList :series="proximamente" titulo="👀 Próximamente" @select-serie="$emit('select-serie', $event)" />

                <p v-if="loading">Cargando series...</p>
                <p v-else-if="error">No se ha podido cargar los datos de series. Revisa la consola para más detalles.</p>
                <template v-else>
                    <EnColaList :series="enCola" titulo="📅 Series en cola" @select-serie="$emit('select-serie', $event)" />
                    <CalendarioEstrenos :series="[...viendo, ...enCola]"></CalendarioEstrenos>
                </template>

                <button v-if="isAdmin" @click="$emit('cambiar-vista', 'add-serie')" class="btn-add-header">
                    + Añadir
                </button>
            </section>
        </div>
    `
}
