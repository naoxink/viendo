import { computed } from 'vue'
import PosterThumb from './shared/PosterThumb.js'
import { textoProgresoEnCola, fechaEnCola } from '../utils/enCola.js'

/**
 * Card compacta de "En cola": póster pequeño, título, una línea de estado y,
 * a la derecha, la fecha de estreno o los capítulos acumulados.
 * Toda la card abre el detalle (enlaces, badges y demás viven allí).
 */
export default {
    name: 'EnColaCard',
    components: { PosterThumb },
    props: {
        serie: { type: Object, required: true }
    },
    emits: ['select-serie'],
    setup(props, { emit }) {
        const progresoTexto = computed(() => textoProgresoEnCola(props.serie))
        const fecha = computed(() => fechaEnCola(props.serie.proxima_fecha))
        const abrir = () => emit('select-serie', props.serie)

        return { progresoTexto, fecha, abrir }
    },
    template: `
        <article
            class="cola-card"
            role="button"
            tabindex="0"
            :aria-label="'Ver detalles de ' + serie.titulo"
            @click="abrir"
            @keydown.enter.prevent="abrir"
            @keydown.space.prevent="abrir"
        >
            <PosterThumb :serie="serie" />
            <span class="cola-card-info">
                <span class="cola-card-title">
                    {{ serie.titulo }}
                    <span v-if="serie.año" class="año-label">({{ serie.año }})</span>
                </span>
                <span class="cola-card-status">{{ progresoTexto }}</span>
            </span>
            <span v-if="fecha.abs || serie.acumulados > 0" class="cola-card-side">
                <span v-if="fecha.abs" class="next-air">📅 {{ fecha.abs }}</span>
                <small v-if="fecha.rel" class="cola-card-rel">{{ fecha.rel }}</small>
                <span v-if="serie.acumulados > 0" class="badge-warning">+{{ serie.acumulados }} caps</span>
            </span>
        </article>
    `
}