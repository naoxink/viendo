import { computed } from 'vue'
import PosterThumb from './PosterThumb.js'
import LinksFooter from './LinksFooter.js'
import RewatchBadge from './RewatchBadge.js'
import { formatProximaFecha, cardBgStyle, getNotaClass } from '../../utils/format.js'

export default {
    name: 'SerieDetailsModal',
    components: { PosterThumb, LinksFooter, RewatchBadge },
    props: {
        serie: { type: Object, required: true },
        visible: { type: Boolean, required: true }
    },
    emits: ['close'],
    setup(props, { emit }) {
        const hasNotas = computed(() => Boolean(props.serie?.notas?.toString().trim()))
        const nextAirText = computed(() => formatProximaFecha(props.serie?.proxima_fecha))
        const notaClase = computed(() => getNotaClass(props.serie.nota))

        const cerrar = () => emit('close')

        return { hasNotas, nextAirText, cerrar, notaClase }
    },
    methods: {
        estadoTexto(serie) {
            switch(serie.estado) {
                case 'viendo': return 'Viendo';
                case 'enCola': return 'En cola';
                case 'completada': return 'Completada';
                case 'dropeada': return 'Dropeada';
            }
        },
        progresoTemporada(temporada, episodios) {
            temporada = Number(temporada)

            if (temporada < this.serie.temporada)
                return 100

            if (temporada > this.serie.temporada)
                return 0

            return Math.round((this.serie.capitulo / episodios) * 100)
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
                                <p class="details-subtitle">
                                    {{ serie.año ? 'Estreno ' + serie.año : 'Serie' }}
                                </p>
                            </div>

                            <div class="details-fields">

                                <div class="details-field" v-if="serie.estado">
                                    <span class="details-field-label">Estado</span>
                                    <span class="details-field-value">{{ estadoTexto(serie) }}</span>
                                </div>

                                <div class="details-field" v-if="serie.proxima_fecha">
                                    <span class="details-field-label">Próximo episodio</span>
                                    <span class="details-field-value">{{ nextAirText }}</span>
                                </div>

                                <div class="details-field" v-if="serie.temporada && serie.estado === 'viendo'">
                                    <span class="details-field-label">Progreso</span>
                                    <span class="details-field-value">{{ 'T' + serie.temporada + ' · ' + 'E' + serie.capitulo }} ({{ serie.capitulo }}/{{ serie.capitulosPorTemporada[serie.temporada] }})</span>
                                </div>

                                <div class="details-field" v-if="serie.temporada && serie.capitulo && serie.capitulosPorTemporada">
                                    <span class="details-field-label">Progreso de la temporada</span>
                                    <span class="details-field-value">
                                        <progress
                                            v-if="serie.capitulosPorTemporada?.[serie.temporada]"
                                            :value="serie.capitulo"
                                            :max="serie.capitulosPorTemporada[serie.temporada]"
                                        ></progress>
                                    </span>
                                </div>


<details class="details-seasons" v-if="serie.capitulosPorTemporada">
    <summary>
        <span class="details-field-label">Temporadas</span>
        <span style="margin-right: 1rem;">({{ Object.keys(serie.capitulosPorTemporada).length }})</span>
    </summary>
    <div
        class="details-seasons-grid"
        v-if="serie.capitulosPorTemporada"
    >
        <div
            v-for="(episodios, temporada) in serie.capitulosPorTemporada"
            :key="temporada"
            class="details-season"
            :style="{ '--progress': progresoTemporada(temporada, episodios) + '%' }"
        >
            <span>T{{ temporada }}</span>

            <span>
                {{
                    Number(temporada) === serie.temporada
                        ? serie.capitulo + '/' + episodios
                        : episodios
                }}
            </span>
        </div>
    </div>
</details>

                                <div class="details-field" v-if="serie.duracionMedia">
                                    <span class="details-field-label">Duración media</span>
                                    <span class="details-field-value">{{ serie.duracionMedia }} min</span>
                                </div>

                                <div class="details-field" v-if="serie.vistoEn">
                                    <span class="details-field-label">Completada en</span>
                                    <span class="details-field-value">{{ serie.vistoEn }}</span>
                                </div>

                                <div class="details-field" v-if="serie.nota">
                                    <span class="details-field-label">Valoración</span>
                                    <span class="details-field-value">
                                        <span class="nota-tag" :class="notaClase">{{ serie.nota || '-' }}</span>
                                    </span>
                                </div>

                                <div class="details-field" v-if="serie.rewatch !== undefined">
                                    <span class="details-field-label">Rewatch</span>
                                    <span class="details-field-value">
                                        <RewatchBadge :serie="serie" />
                                    </span>
                                </div>

                                <div class="details-field" v-if="serie.acumulados !== undefined">
                                    <span class="details-field-label">Capítulos acumulados</span>
                                    <span class="details-field-value">
                                        <span v-if="serie.acumulados > 0" class="badge-warning">+{{ serie.acumulados }} caps</span>
                                    </span>
                                </div>

                                <div class="details-field" v-if="serie.pendiente !== undefined">
                                    <span class="details-field-label">Pendiente</span>
                                    <span class="details-field-value">
                                        {{ serie.pendiente ? 'Sí' : 'No' }}
                                    </span>
                                </div>

                                <div
                                    class="details-field"
                                    v-if="serie.duracionMedia && serie.temporada && serie.capitulo && serie.capitulosPorTemporada"
                                >
                                    <span class="details-field-label">Tiempo visto</span>
                                    <span class="details-field-value">
                                        {{
                                            Math.round(
                                                (
                                                    Object.entries(serie.capitulosPorTemporada)
                                                        .filter(([t]) => Number(t) < serie.temporada)
                                                        .reduce((a, [, c]) => a + c, 0)
                                                    + serie.capitulo
                                                ) * serie.duracionMedia / 60
                                            )
                                        }} h
                                    </span>
                                </div>

                            </div>

                            <div class="details-field" v-if="hasNotas">
                                <span class="details-field-label">Notas</span><br>
                                <span>{{ serie.notas }}</span>
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
