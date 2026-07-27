import { computed, ref } from 'vue'
import PosterThumb from './shared/PosterThumb.js'
import LinksFooter from './shared/LinksFooter.js'
import RewatchBadge from './shared/RewatchBadge.js'
import FinalStatusBadge from './shared/FinalStatusBadge.js'
import { cardBgStyle, getNotaClass } from '../utils/format.js'

export default {
    name: 'HistoricoCard',
    components: { PosterThumb, LinksFooter, RewatchBadge, FinalStatusBadge },
    props: {
        serie: { type: Object, required: true }
    },
    emits: ['select-serie'],
    setup(props) {
        const bgStyle = computed(() => cardBgStyle(props.serie))
        const notaClase = computed(() => getNotaClass(props.serie.nota))
        const mostrarDetalles = ref(false)
        const abrirDetalles = () => { mostrarDetalles.value = true }
        const cerrarDetalles = () => { mostrarDetalles.value = false }
        return { bgStyle, notaClase, mostrarDetalles, abrirDetalles, cerrarDetalles }
    },
    template: `
        <div class="serie-card" :style="bgStyle">
            <div class="serie-card-body">
                <PosterThumb :serie="serie" />
                <div class="info">
                    <h2>{{ serie.titulo }} <span class="nota-tag" :class="notaClase">{{ serie.nota || '-' }}</span></h2>
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
                <button class="details-btn" type="button" @click="$emit('select-serie', serie)" aria-label="Ver detalles de la serie" title="Ver detalles de la serie">?</button>
            </div>
        </div>
    `
}
