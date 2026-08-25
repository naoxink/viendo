import { computed } from 'vue'
import PosterThumb from '../shared/PosterThumb.js'
import LinksFooter from '../shared/LinksFooter.js'
import RewatchBadge from '../shared/RewatchBadge.js'
import SlowModeBadge from '../shared/SlowModeBadge.js'
import { formatProximaFecha, cardBgStyle, getNotaClass } from '../../utils/format.js'
import { calcularEstadoPendiente } from '../../utils/episodios.js'
import { useSeriesData } from '../../composables/useSeriesData.js'

export default {
    name: 'ViewSerieDetail',
    components: { PosterThumb, LinksFooter, RewatchBadge, SlowModeBadge },
    props: {
        serie: { type: Object, required: true }
    },
    emits: ['back'],
    setup(props, { emit }) {
        const { updateShowStatus, updateShowField } = useSeriesData()

        // Campos cuya edición cambia "hasta dónde ha visto el usuario", y por
        // tanto invalidan pendiente/acumulados/proxima_fecha calculados.
        const CAMPOS_QUE_AFECTAN_PROGRESO = ['temporada', 'capitulo']

        const recalcularEstadoLocal = () => {
            if (!props.serie.fechas_episodios) return

            const estado = calcularEstadoPendiente(
                props.serie.fechas_episodios,
                props.serie.temporada,
                props.serie.capitulo
            )

            // Mutamos el objeto reactivo directamente, igual que ya hace
            // cambiarEstado() más abajo con props.serie.estado — así la
            // vista se actualiza al instante sin esperar a un loadData().
            props.serie.pendiente = estado.pendiente
            props.serie.acumulados = estado.acumulados
            props.serie.proxima_fecha = estado.proxima_fecha
        }

        // Método genérico para guardar cualquier campo de admin
        const actualizarCampo = async (campoDb, evento) => {
            if (!isAdmin.value) return

            // Dependiendo del input, extraemos el valor (checkbox usa .checked, inputs/selects usan .value)
            const valor = evento.target.type === 'checkbox' ? evento.target.checked : evento.target.value

            const idSerie = props.serie.id || props.serie.tvdb_id
            const resultado = await updateShowField(idSerie, campoDb, valor)

            if (!resultado.success) {
                console.error(`No se pudo actualizar ${campoDb}:`, resultado.error)
                return
            }

            if (CAMPOS_QUE_AFECTAN_PROGRESO.includes(campoDb)) {
                // updateShowField ya actualiza props.serie[campoDb] indirectamente
                // vía loadData(); pero por si el recalculo se pide antes de que
                // esa promesa resuelva del todo, forzamos también el valor
                // local con el que acabamos de guardar.
                props.serie[campoDb] = evento.target.type === 'number'
                    ? Number(valor)
                    : valor

                recalcularEstadoLocal()
            }
        }

        const hasNotas = computed(() => Boolean(props.serie?.notas?.toString().trim()))
        const nextAirText = computed(() => formatProximaFecha(props.serie?.proxima_fecha))
        const notaClase = computed(() => getNotaClass(props.serie.nota))
        const isAdmin = computed(() => sessionStorage.getItem('isAdmin') === 'true')

        const volver = () => emit('back')

        const cambiarEstado = async (nuevoEstado) => {
            const token = sessionStorage.getItem('adminToken')
            if (!token) {
                console.error('No se encontró el token de administrador en sessionStorage.')
                return
            }

            const idSerie = props.serie.id || props.serie.tvdb_id
            const resultado = await updateShowStatus(idSerie, nuevoEstado)

            if (resultado.success) {
                props.serie.estado = nuevoEstado
            } else {
                console.error('No se pudo actualizar el estado:', resultado.error)
            }
        }

        return { hasNotas, nextAirText, volver, notaClase, isAdmin, cambiarEstado, actualizarCampo }
    },
    methods: {
        estadoTexto(estado) {
            switch(estado) {
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
        <div class="view view-serie-detail">
            <header class="detail-top-bar">
                <button class="btn-back" @click="volver">← Volver</button>
            </header>

            <section class="view-content">
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

                            <div class="details-field" v-if="isAdmin">
                                <span class="details-field-label">Título</span>
                                <span class="details-field-value">
                                    <input type="text" :value="serie.titulo" @change="actualizarCampo('titulo', $event)" class="admin-input-small" />
                                </span>
                            </div>

                            <div class="details-field" v-if="serie.estado">
                                <span class="details-field-label">Estado</span>
                                <span class="details-field-value">
                                    <template v-if="!isAdmin">
                                        {{ estadoTexto(serie.estado) }}
                                    </template>
                                    <select v-else :value="serie.estado" @change="cambiarEstado($event.target.value)" class="admin-select-input">
                                        <option value="viendo">Viendo</option>
                                        <option value="enCola">En cola</option>
                                        <option value="completada">Completada</option>
                                        <option value="dropeada">Dropeada</option>
                                    </select>
                                </span>
                            </div>

                            <!-- Solo lectura: se deriva de fechas_episodios + temporada/capitulo -->
                            <div class="details-field">
                                <span class="details-field-label">Próximo episodio</span>
                                <span class="details-field-value">{{ nextAirText || 'Al día' }}</span>
                            </div>

                            <div class="details-field" v-if="serie.temporada && serie.estado === 'viendo'">
                                <span class="details-field-label">Progreso</span>
                                <span class="details-field-value">{{ 'T' + serie.temporada + ' · ' + 'E' + serie.capitulo }} ({{ serie.capitulo }}/{{ serie.capitulosPorTemporada[serie.temporada] }})</span>
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
                                <span class="details-field-value">
                                    <template v-if="isAdmin">
                                        <input type="text" :value="serie.vistoEn" @change="actualizarCampo('visto_en', $event)" class="admin-input-small" />
                                    </template>
                                    <template v-else>{{ serie.vistoEn }}</template>
                                 </span>
                            </div>

                            <!-- Editables: "hasta dónde he visto". Al cambiar,
                                 actualizarCampo() recalcula pendiente/acumulados/
                                 proxima_fecha automáticamente. -->
                            <div class="details-field" v-if="serie.temporada">
                                <span class="details-field-label">Temporada actual</span>
                                <span class="details-field-value">
                                    <template v-if="!isAdmin">T{{ serie.temporada }}</template>
                                    <input v-else type="number" min="1" :value="serie.temporada" @change="actualizarCampo('temporada', $event)" class="admin-input-small" />
                                </span>
                            </div>

                            <div class="details-field" v-if="serie.capitulo !== undefined">
                                <span class="details-field-label">Capítulo actual</span>
                                <span class="details-field-value">
                                    <template v-if="!isAdmin">E{{ serie.capitulo }}</template>
                                    <input v-else type="number" min="0" :value="serie.capitulo" @change="actualizarCampo('capitulo', $event)" class="admin-input-small" />
                                </span>
                            </div>

                            <div class="details-field">
                                <span class="details-field-label">Valoración</span>
                                <span class="details-field-value">
                                    <template v-if="!isAdmin">
                                        <span class="nota-tag" :class="notaClase">{{ serie.nota || '-' }}</span>
                                    </template>
                                    <input v-else type="text" :value="serie.nota" @change="actualizarCampo('nota', $event)" class="admin-input-small" />
                                </span>
                            </div>

                            <div class="details-field" v-if="serie.rewatch !== undefined">
                                <span class="details-field-label">Rewatch</span>
                                <span class="details-field-value">
                                    <RewatchBadge v-if="!isAdmin" :serie="serie" />
                                    <label v-else class="admin-checkbox-label">
                                        <input type="checkbox" :checked="serie.rewatch" @change="actualizarCampo('rewatch', $event)" />
                                        Sí
                                    </label>
                                </span>
                            </div>

                            <div class="details-field" v-if="isAdmin && serie.rewatch !== undefined">
                                <span class="details-field-label">Veces vista</span>
                                <span class="details-field-value">
                                    <label class="admin-checkbox-label">
                                        <input type="number" class="admin-input-small" :value="serie.veces" @change="actualizarCampo('veces', $event)" />
                                    </label>
                                </span>
                            </div>

                            <div class="details-field">
                                <span class="details-field-label">Modo tranqui</span>
                                <span class="details-field-value">
                                    <SlowModeBadge v-if="!isAdmin" :serie="serie" />
                                    <template v-if="!serie.slowmode && !isAdmin">No</template>
                                    <label v-else class="admin-checkbox-label">
                                        <input type="checkbox" :checked="serie.slowmode" @change="actualizarCampo('slow_mode', $event)" />
                                        Sí
                                    </label>
                                </span>
                            </div>

                            <!-- Solo lectura: derivado -->
                            <div class="details-field">
                                <span class="details-field-label">Capítulos acumulados</span>
                                <span class="details-field-value">
                                    <span v-if="serie.acumulados > 0" class="badge-warning">+{{ serie.acumulados }} caps</span>
                                    <span v-else>Al día</span>
                                </span>
                            </div>

                            <!-- Solo lectura: derivado -->
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

                        <p v-if="isAdmin" class="text-muted" style="font-size: 0.78rem; margin: -0.5rem 0 0.5rem;">
                            ℹ️ Próximo episodio, acumulados y pendiente se calculan
                            automáticamente a partir de las fechas de emisión guardadas.
                            Para corregirlos, ajusta <b>Temporada actual</b> / <b>Capítulo actual</b>.
                        </p>

                        <div class="details-field details-field-block">
                            <span class="details-field-label">NOTAS</span>
                            
                            <template v-if="!isAdmin">
                                <p class="details-notas-texto">{{ serie.notas || 'Sin notas' }}</p>
                            </template>
                            
                            <textarea 
                                v-else 
                                :value="serie.notas" 
                                @change="actualizarCampo('notas', $event)" 
                                class="admin-input admin-textarea-block"
                                placeholder="Añade tus notas personales..."
                                rows="3"
                            ></textarea>
                        </div>

                        <div class="details-links">
                            <LinksFooter :serie="serie" />
                        </div>
                    </div>
                </div>
            </section>
        </div>
    `
}