import { computed } from 'vue'
import MiniSerieList from './MiniSerieList.js'
import { sortViendo } from '../../utils/sorting.js'
import { formatProximaFecha } from '../../utils/format.js'

export default {
    name: 'ProximosEstrenosMini',
    components: { MiniSerieList },
    props: {
        viendo: { type: Array, default: () => [] },
        enCola: { type: Array, default: () => [] },
        limite: { type: Number, default: 6 }
    },
    emits: ['select-serie'],
    setup(props) {
        const formatFechaRelativa = (fecha) => {
            if (!fecha) return ''

            const [year, month, day] = fecha.split('-').map(Number)

            const hoy = new Date()

            const hoyUTC = Date.UTC(
                hoy.getFullYear(),
                hoy.getMonth(),
                hoy.getDate()
            )

            const fechaUTC = Date.UTC(
                year,
                month - 1,
                day
            )

            const diferenciaDias = Math.round(
                (fechaUTC - hoyUTC) / (1000 * 60 * 60 * 24)
            )

            if (diferenciaDias === 0) return 'Hoy'
            if (diferenciaDias === 1) return 'Mañana'
            if (diferenciaDias === 7) return 'En una semana'

            return formatProximaFecha(fecha)
        }
        // Misma fuente y mismo orden que ya usa ViewEnCola para su lista de
        // "Próximamente" (viendo + en_cola, ordenadas por sortViendo,
        // quedándonos solo con las que tienen fecha confirmada).
        const items = computed(() =>
            sortViendo([...props.viendo, ...props.enCola])
                .filter((s) => s.proxima_fecha && s.proxima_fecha !== 'TBA')
                .slice(0, props.limite)
                .map((s) => ({
                    key: s.titulo + '-' + s.proxima_fecha,
                    titulo: s.titulo,
                    meta: formatFechaRelativa(s.proxima_fecha),
                    serie: s
                }))
        )

        return { items }
    },
    template: `
        <div>
            <MiniSerieList v-if="items.length" :items="items" @select-serie="$emit('select-serie', $event)" />
            <p v-else class="dashboard-widget-placeholder">No hay estrenos próximos por ahora.</p>
        </div>
    `
}