import { computed } from 'vue'
import PosterThumb from './PosterThumb.js'
import LinksFooter from './LinksFooter.js'
import { formatProximaFecha } from '../../utils/format.js'

export default {
    name: 'SerieDetailsModal',
    components: { PosterThumb, LinksFooter },
    props: {
        serie: { type: Object, required: true },
        visible: { type: Boolean, required: true }
    },
    emits: ['close'],
    setup(props, { emit }) {
        const hasNotas = computed(() => Boolean(props.serie?.notas?.toString().trim()))
        const nextAirText = computed(() => formatProximaFecha(props.serie.proximaFecha))

        const cerrar = () => emit('close')

        return { hasNotas, nextAirText, cerrar }
    },
    methods: {
        estadoTexto(serie) {
            switch(serie.estado) {
                case 'viendo': return 'Viendo';
                case 'enCola': return 'En cola';
                case 'completada': return 'Completada';
                case 'dropeada': return 'Dropeada';
            }
        }
    },
    template: `
        <teleport to="body">
            <div v-if="visible" class="details-modal-overlay" @click.self="cerrar">
                <div class="details-modal-content" role="dialog" aria-modal="true" aria-label="Ficha técnica de la serie">
                    <button class="details-modal-close" @click="cerrar" aria-label="Cerrar">&times;</button>
                    <div class="details-sheet">
                        <div class="details-poster">
                            <PosterThumb :serie="serie" />
                        </div>
                        <div class="details-main">
                            <div class="details-header">
                                <h2>{{ serie.titulo }}</h2>
                                <p class="details-subtitle">{{ serie.año ? 'Estreno ' + serie.año : 'Serie' }}</p>
                            </div>

                            <div class="details-fields">
                                <div class="details-field">
                                    <span class="details-field-label">Estado</span>
                                    <span class="details-field-value">{{ estadoTexto(serie) || 'No disponible' }}</span>
                                </div>
                                <div class="details-field" v-if="serie.proximaFecha">
                                    <span class="details-field-label">Próximo episodio</span>
                                    <span class="details-field-value">{{ nextAirText }}</span>
                                </div>
                                <div class="details-field" v-if="serie.vistoEn">
                                    <span class="details-field-label">Visto en</span>
                                    <span class="details-field-value">{{ serie.vistoEn }}</span>
                                </div>
                                <div class="details-field" v-if="serie.temporada">
                                    <span class="details-field-label">Temporada</span>
                                    <span class="details-field-value">{{ serie.temporada }}</span>
                                </div>
                                <div class="details-field" v-if="serie.capitulo">
                                    <span class="details-field-label">Capítulo</span>
                                    <span class="details-field-value">{{ serie.capitulo }}</span>
                                </div>
                            </div>

                            <div class="details-field" v-if="hasNotas">
                                <span class="details-field-label">Notas</span>
                                <strong class="details-field-value">{{ serie.notas }}</strong>
                            </div>

                            <div class="details-links">
                                <LinksFooter :serie="serie" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </teleport>
    `
}
