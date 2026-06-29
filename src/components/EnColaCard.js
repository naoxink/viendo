import { computed } from 'vue'
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
    setup(props) {
        const bgStyle = computed(() => cardBgStyle(props.serie))
        const proximaFechaTexto = computed(() => formatProximaFecha(props.serie.proximaFecha))
        return { bgStyle, proximaFechaTexto }
    },
    template: `
        <div class="serie-card serie-en-cola" :style="bgStyle">
            <div class="serie-card-body">
                <PosterThumb :serie="serie" />
                <div class="info">
                    <h2>{{ serie.titulo }}</h2>
                    <p class="progress">Por empezar • Temporada {{ serie.temporada || 1 }}</p>
                    <p v-if="serie.proximaFecha" class="next-air">
                        📅 <strong>{{ proximaFechaTexto }}</strong>
                    </p>
                </div>
            </div>
            <div class="serie-card-footer">
                <LinksFooter :serie="serie" />
                <RewatchBadge :serie="serie" />
                <FinalStatusBadge :serie="serie" />
            </div>
        </div>
    `
}
