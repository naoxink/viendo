import { ref, reactive } from 'vue'
import { useSeriesData } from '../../composables/useSeriesData.js'
import SerieSearchInput from '../shared/SerieSearchInput.js'

export default {
    name: 'ViewAddSerie',
    components: { SerieSearchInput },
    setup(props, { emit }) {
        const { insertShow } = useSeriesData()

        const nuevaSerie = reactive({
            tvdb_id: null,
            estado: 'en_cola'
        })

        const serieSeleccionada = ref(null)
        const mostrarIdManual = ref(false)
        const guardando = ref(false)
        const mensaje = ref('')
        const tipoMensaje = ref('')

        const onSeleccionarSerie = (serie) => {
            serieSeleccionada.value = serie
            nuevaSerie.tvdb_id = serie.tvdb_id
        }

        const guardarSerie = async () => {
            if (!nuevaSerie.tvdb_id) {
                tipoMensaje.value = 'error'
                mensaje.value = 'Busca una serie o introduce un ID de TheTVDB.'
                return
            }

            guardando.value = true
            mensaje.value = ''

            try {
                const resultado = await insertShow({
                    tvdb_id: nuevaSerie.tvdb_id,
                    estado: nuevaSerie.estado
                })

                if (!resultado.success) {
                    throw new Error(resultado.error)
                }

                tipoMensaje.value = 'success'
                mensaje.value = '¡Serie añadida! Los metadatos se actualizarán pronto.'

                nuevaSerie.tvdb_id = null
                nuevaSerie.estado = 'en_cola'
                serieSeleccionada.value = null

            } catch (error) {
                tipoMensaje.value = 'error'
                mensaje.value = 'Hubo un error al guardar la serie.'
                console.error(error)
            } finally {
                guardando.value = false
            }
        }

        return {
            nuevaSerie, serieSeleccionada, mostrarIdManual,
            guardando, mensaje, tipoMensaje,
            onSeleccionarSerie, guardarSerie
        }
    },
    template: `
        <div class="view view-add-serie">

            <div class="view-header">
                <h2>Añadir Nueva Serie</h2>
                <p class="text-muted">Busca el título y elige el resultado correcto. El sistema descargará el resto de metadatos automáticamente.</p>
            </div>

            <div class="view-content">
                <form @submit.prevent="guardarSerie" class="form-add">

                    <div class="form-group">
                        <label>Buscar serie</label>
                        <SerieSearchInput @select="onSeleccionarSerie" />

                        <p v-if="serieSeleccionada" class="serie-search-selected">
                            ✅ Seleccionada: <b>{{ serieSeleccionada.titulo }}</b>
                            <span v-if="serieSeleccionada.anio">({{ serieSeleccionada.anio }})</span>
                            — ID {{ serieSeleccionada.tvdb_id }}
                        </p>

                        <a class="link" style="font-size: 0.8rem;" @click="mostrarIdManual = !mostrarIdManual">
                            {{ mostrarIdManual ? 'Ocultar ID manual' : '¿No aparece? Introducir ID manualmente' }}
                        </a>

                        <input
                            v-if="mostrarIdManual"
                            type="number"
                            v-model.number="nuevaSerie.tvdb_id"
                            placeholder="ID de TheTVDB, ej: 392256"
                            class="admin-input"
                            style="margin-top: 0.5rem;"
                        />
                    </div>

                    <div class="form-group">
                        <label for="estado">¿Dónde la guardamos?</label>
                        <select id="estado" v-model="nuevaSerie.estado">
                            <option value="en_cola">En Cola / Pendiente</option>
                            <option value="viendo">Viendo actualmente</option>
                        </select>
                    </div>

                    <button type="submit" class="btn-submit" :disabled="guardando">
                        {{ guardando ? 'Guardando...' : 'Añadir Serie' }}
                    </button>

                    <div v-if="mensaje" :class="['mensaje', tipoMensaje]">
                        {{ mensaje }}
                    </div>
                </form>
            </div>
        </div>
    `
}