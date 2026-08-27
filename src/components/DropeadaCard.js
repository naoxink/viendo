import { computed } from 'vue'
import PosterThumb from './shared/PosterThumb.js'
import LinksFooter from './shared/LinksFooter.js'
import FinalStatusBadge from './shared/FinalStatusBadge.js'
import { cardBgStyle } from '../utils/format.js'

export default {
    name: 'DropeadaCard',
    components: { PosterThumb, LinksFooter, FinalStatusBadge },
    props: {
        serie: { type: Object, required: true }
    },
    emits: ['select-serie'],
    setup(props) {
        const bgStyle = computed(() => cardBgStyle(props.serie))
        return { bgStyle }
    },
    template: `
        <div class="serie-card serie-card-dropeada" :style="bgStyle">
            <div class="serie-card-body">
                <PosterThumb :serie="serie" />
                <div class="info">
                    <h2>
                        {{ serie.titulo }}
                        <span class="badge-dropeada">Dropeada</span>
                    </h2>
                    <p class="progress">
                        Abandonada en <b>{{ serie.vistoEn || serie.año }}</b>
                        <span class="original-year">(Estreno: {{ serie.año }})</span>
                    </p>
                    <p class="progress dropped-progress">
                        Te quedaste en: <span>T{{ serie.temporada }} · E{{ serie.capitulo }}</span>
                    </p>
                </div>
            </div>
            <div class="serie-card-footer">
                <LinksFooter :serie="serie" />
                <FinalStatusBadge :serie="serie" />
                <button class="details-btn" type="button" @click="$emit('select-serie', serie)" aria-label="Ver detalles de la serie" title="Ver detalles de la serie">?</button>
            </div>
        </div>
    `
}