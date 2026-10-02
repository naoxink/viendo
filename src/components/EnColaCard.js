import { computed, ref } from 'vue'
import PosterThumb from './shared/PosterThumb.js'
import LinksFooter from './shared/LinksFooter.js'
import RewatchBadge from './shared/RewatchBadge.js'
import FinalStatusBadge from './shared/FinalStatusBadge.js'
import { cardBgStyle, formatProximaFecha } from '../utils/format.js'

export default {
    name: 'EnColaCard',
    components: { PosterThumb, LinksFooter, RewatchBadge, FinalStatusBadge },
    props: {
        serie: { type: Object, required: true }
    },
    emits: ['select-serie'],
    setup(props) {
        const bgStyle = computed(() => cardBgStyle(props.serie))
        const proximaFechaTexto = computed(() => formatProximaFecha(props.serie.proxima_fecha))

        const progresoTexto = computed(() => {
            const s = props.serie
            const t = Number(s.temporada) || 1
            const c = Number(s.capitulo) || 0
            const total = Number(s.capitulosPorTemporada?.[t]) || 0
            const pendiente = Boolean(s.pendiente)
            const hayFecha = s.proxima_fecha && s.proxima_fecha !== 'TBA'

            // Sin empezar. Cubre T1·E0, y T1·E1 pendiente (que es lo que
            // calcularEstadoPendiente devuelve para un E0 con el E1 ya emitido)
            if (t === 1 && (c === 0 || (pendiente && c === 1))) {
                return `Por empezar • Temporada 1`
            }

            // Primer capítulo de una temporada nueva (T2+):
            //  - E0 con el E1 aún sin emitir  -> c === 0, pendiente false
            //  - E0 con el E1 ya emitido      -> c === 1, pendiente true
            if (t > 1 && (c === 0 || (pendiente && c === 1))) {
                if (pendiente) return `Temporada ${t - 1} completada • T${t} disponible`
                return hayFecha
                    ? `Temporada ${t - 1} completada • Próxima: Temporada ${t}`
                    : `Temporada ${t - 1} completada`
            }

            // Capítulos emitidos sin ver (c > 1): temporada/capitulo = el que toca ver
            if (pendiente) {
                return `Siguiente: T${t} • E${c}`
            }

            // Al día y terminaste la temporada
            if (total > 0 && c >= total) {
                return hayFecha
                    ? `Temporada ${t} completada • Próxima: Temporada ${t + 1}`
                    : `Temporada ${t} completada`
            }

            // Empezada, a medias
            return `Vista hasta T${t} • E${c}`
        })
        const mostrarDetalles = ref(false)
        const abrirDetalles = () => { mostrarDetalles.value = true }
        const cerrarDetalles = () => { mostrarDetalles.value = false }
        return { bgStyle, proximaFechaTexto, progresoTexto, mostrarDetalles, abrirDetalles, cerrarDetalles }
    },
    template: `
        <div class="serie-card" :style="bgStyle">
            <div class="serie-card-body">
                <PosterThumb :serie="serie" />
                <div class="info">
                    <h2>{{ serie.titulo }}</h2>
                    <p class="progress">{{ progresoTexto }}</p>
                    <p v-if="serie.proxima_fecha" class="next-air">
                        📅 <strong>{{ proximaFechaTexto }}</strong>
                    </p>
                </div>
            </div>
            <div class="serie-card-footer">
                <LinksFooter :serie="serie" />
                <RewatchBadge :serie="serie" />
                <FinalStatusBadge :serie="serie" />
                <button class="details-btn" type="button" @click="$emit('select-serie', serie)" aria-label="Ver detalles de la serie" title="Ver detalles de la serie">?</button>
            </div>
        </div>
    `
}