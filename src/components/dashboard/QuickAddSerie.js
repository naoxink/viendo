import { ref, reactive } from 'vue'
import { useSeriesData } from '../../composables/useSeriesData.js'
import SerieSearchInput from '../shared/SerieSearchInput.js'

export default {
    name: 'QuickAddSerie',
    components: { SerieSearchInput },
    setup() {
        const { insertShow } = useSeriesData()

        const nuevaSerie = reactive({
            tvdb_id: null,
            estado: 'en_cola'
        })

        const serieSeleccionada = ref(null)
        const guardando = ref(false)
        const mensaje = ref('')
        const tipoMensaje = ref('')

        const onSeleccionarSerie = (serie) => {
            serieSeleccionada.value = serie
            nuevaSerie.tvdb_id = serie.tvdb_id
        }

        const guardarSerie = async () => {
            if (!nuevaSerie.tvdb_id) return

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

        return { nuevaSerie, serieSeleccionada, guardando, mensaje, tipoMensaje, onSeleccionarSerie, guardarSerie }
    },
    template: `
        <form class="dashboard-quick-add" @submit.prevent="guardarSerie">
            <SerieSearchInput @select="onSeleccionarSerie" />
            <select v-model="nuevaSerie.estado" class="admin-input">
                <option value="en_cola">En cola</option>
                <option value="viendo">Viendo</option>
            </select>
            <button type="submit" class="btn-submit" :disabled="guardando || !nuevaSerie.tvdb_id">
                {{ guardando ? 'Añadiendo…' : 'Añadir' }}
            </button>
            <div v-if="mensaje" :class="['mensaje', tipoMensaje]">{{ mensaje }}</div>
        </form>
    `
}