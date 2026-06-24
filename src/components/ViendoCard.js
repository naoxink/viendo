import { computed } from 'vue'
import PosterThumb from './shared/PosterThumb.js'
import LinksFooter from './shared/LinksFooter.js'
import RewatchBadge from './shared/RewatchBadge.js'
import SlowModeBadge from './shared/SlowModeBadge.js'
import { cardBgStyle, formatProximaFecha } from '../utils/format.js'

export default {
    name: 'ViendoCard',
    components: { PosterThumb, LinksFooter, RewatchBadge, SlowModeBadge },
    props: {
        serie: { type: Object, required: true }
    },
    setup(props) {
        const bgStyle = computed(() => cardBgStyle(props.serie))
        const proximaFechaTexto = computed(() => formatProximaFecha(props.serie.proximaFecha))
        return { bgStyle, proximaFechaTexto }
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
            </div>
        </div>
    `
}
