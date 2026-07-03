import { computed } from 'vue'
import PosterThumb from './shared/PosterThumb.js'
import LinksFooter from './shared/LinksFooter.js'
import RewatchBadge from './shared/RewatchBadge.js'
import FinalStatusBadge from './shared/FinalStatusBadge.js'
import SerieDetailsModal from './shared/SerieDetailsModal.js'
import { cardBgStyle, getNotaClass } from '../utils/format.js'

export default {
    name: 'HistoricoCard',
    components: { PosterThumb, LinksFooter, RewatchBadge, FinalStatusBadge, SerieDetailsModal },
    props: {
        serie: { type: Object, required: true }
    },
    setup(props) {
        const bgStyle = computed(() => cardBgStyle(props.serie))
        const notaClase = computed(() => getNotaClass(props.serie.nota))
        return { bgStyle, notaClase }
    },
    template: `
        <div class="serie-card" :style="bgStyle">
            <div class="serie-card-body">
                <PosterThumb :serie="serie" />
                <div class="info">
                    <h2>{{ serie.titulo }} <span class="nota-tag" :class="notaClase">{{ serie.nota }}</span></h2>
                    <p class="progress">
                        Finalizada en <b>{{ serie.vistoEn || serie.año }}</b>
                        <span class="original-year">(Estreno: {{ serie.año }})</span>
                    </p>
                </div>
            </div>
            <div class="serie-card-footer">
                <LinksFooter :serie="serie" />
                <RewatchBadge :serie="serie" />
                <FinalStatusBadge :serie="serie" />
                <button class="details-btn" type="button" @click="abrirDetalles" aria-label="Ver detalles de la serie" title="Ver detalles de la serie">ℹ</button>
            </div>
            <SerieDetailsModal :serie="serie" :visible="mostrarDetalles" @close="cerrarDetalles" />
        </div>
    `
}
