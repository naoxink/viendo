import { ref, reactive } from 'vue'
import { useSeriesData } from '../../composables/useSeriesData.js'

export default {
    name: 'QuickAddSerie',
    setup() {
        const { insertShow } = useSeriesData()

        const nuevaSerie = reactive({
            tvdb_id: null,
            estado: 'en_cola'
        })

        const guardando = ref(false)
        const mensaje = ref('')
        const tipoMensaje = ref('')

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
            } catch (error) {
                tipoMensaje.value = 'error'
                mensaje.value = 'Hubo un error al guardar la serie.'
                console.error(error)
            } finally {
                guardando.value = false
            }
        }

        return { nuevaSerie, guardando, mensaje, tipoMensaje, guardarSerie }
    },
    template: `
        <form class="dashboard-quick-add" @submit.prevent="guardarSerie">
            <input
                type="number"
                v-model.number="nuevaSerie.tvdb_id"
                placeholder="ID de TheTVDB (ej: 392256)"
                class="admin-input"
                required
            />
            <select v-model="nuevaSerie.estado" class="admin-input">
                <option value="en_cola">En cola</option>
                <option value="viendo">Viendo</option>
            </select>
            <button type="submit" class="btn-submit" :disabled="guardando">
                {{ guardando ? 'Añadiendo…' : 'Añadir' }}
            </button>
            <div v-if="mensaje" :class="['mensaje', tipoMensaje]">{{ mensaje }}</div>
        </form>
    `
}