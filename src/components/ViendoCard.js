import { computed, ref } from 'vue'
import PosterThumb from './shared/PosterThumb.js'
import LinksFooter from './shared/LinksFooter.js'
import RewatchBadge from './shared/RewatchBadge.js'
import SlowModeBadge from './shared/SlowModeBadge.js'
import SerieDetailsModal from './shared/SerieDetailsModal.js'
import { cardBgStyle, formatProximaFecha } from '../utils/format.js'

export default {
    name: 'ViendoCard',
    components: { PosterThumb, LinksFooter, RewatchBadge, SlowModeBadge, SerieDetailsModal },
    props: {
        serie: { type: Object, required: true }
    },
    setup(props) {
        const bgStyle = computed(() => cardBgStyle(props.serie))
        const proximaFechaTexto = computed(() => formatProximaFecha(props.serie.proximaFecha))
        const mostrarDetalles = ref(false)
        const abrirDetalles = () => { mostrarDetalles.value = true }
        const cerrarDetalles = () => { mostrarDetalles.value = false }
        const progreso = computed(() => {
            const caps = props.serie.capitulosPorTemporada;
            if (!caps || Object.keys(caps).length === 0) return 0;

            if (props.serie.rewatch) {
                // Progreso de toda la serie
                const totalCaps = Object.values(caps).reduce((a, b) => a + b, 0);
                // Asumimos que necesitas trackear el capítulo global actual
                return (props.serie.capitulo / totalCaps) * 100;
            } else {
                // Progreso de la temporada actual
                const capsTemporada = caps[props.serie.temporada] || 1;
                return (props.serie.capitulo / capsTemporada) * 100;
            }
        });
        return { bgStyle, proximaFechaTexto, mostrarDetalles, abrirDetalles, cerrarDetalles, progreso }
    },
    template: `
        <div class="serie-card" :style="bgStyle">
            <div class="serie-card-body">
                <PosterThumb :serie="serie" />
                <div class="info">
                    <h2>{{ serie.titulo }} <span class="año-label">({{ serie.año }})</span></h2>
                    <p class="progress">
                        T{{ serie.temporada }} • E{{ serie.capitulo }}
                        <span v-if="serie.pendiente" class="badge-pendiente">Pendiente</span>
                        <span v-else class="badge-visto">Visto</span>
                    </p>
                    <span v-if="serie.acumulados > 0" class="badge-warning">+{{ serie.acumulados }} caps</span>
                </div>
            </div>
            <div class="serie-card-footer">
                <LinksFooter :serie="serie" />
                <RewatchBadge :serie="serie" />
                <SlowModeBadge :serie="serie" />
                <p v-if="serie.proximaFecha" class="next-air">
                    📅 <strong>{{ proximaFechaTexto }}</strong>
                </p>
                <button class="details-btn" type="button" @click="abrirDetalles" aria-label="Ver detalles de la serie" title="Ver detalles de la serie">?</button>
            </div>
            <SerieDetailsModal :serie="serie" :visible="mostrarDetalles" @close="cerrarDetalles" />
            <div class="progress-bar-container">
                <div class="progress-bar-fill" :style="{ width: progreso + '%' }"></div>
            </div>
        </div>
    `
}
