import EnColaList from '../EnColaList.js'
import { sortViendo } from '../../utils/sorting.js'
import ProximamenteList from '../ProximamenteList.js'

// Máximo de días hacia delante que se muestran en "Próximamente" (mes y medio)
const DIAS_MAX_PROXIMAMENTE = 45

export default {
    name: 'ViewEnCola',
    components: { EnColaList, ProximamenteList },
    props: {
        enCola: Array,
        viendo: Array,
        loading: Boolean,
        error: String
    },
    emits: ['select-serie', 'cambiar-vista'],
    computed: {
        proximamente() {
            const todas = [ ...this.viendo, ...this.enCola ]

            // Límite superior: hoy (a medianoche local) + 45 días
            const hoy = new Date()
            const limite = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + DIAS_MAX_PROXIMAMENTE).getTime()

            // Parseo "YYYY-MM-DD" como fecha local para evitar desfases por UTC
            const aTimestamp = (fecha) => {
                const [y, m, d] = fecha.split('-').map(Number)
                return new Date(y, m - 1, d).getTime()
            }

            let proximamente = sortViendo(todas)
            proximamente = proximamente.filter(s => {
                if (!s.proxima_fecha || s.proxima_fecha === 'TBA') return false
                const ts = aTimestamp(s.proxima_fecha)
                return !isNaN(ts) && ts <= limite
            })

            // Hacer objeto en base a las fechas
            proximamente = proximamente.reduce((acc, s) => {
                const fecha = s.proxima_fecha
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
                </template>

                <button v-if="isAdmin" @click="$emit('cambiar-vista', 'add-serie')" class="btn-add-header">
                    + Añadir
                </button>
            </section>
        </div>
    `
}