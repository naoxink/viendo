import { ref, reactive } from 'vue'
import { useSeriesData } from '../../composables/useSeriesData.js'

export default {
    name: 'ViewAddSerie',
    setup(props, { emit }) {
        const { insertShow } = useSeriesData()

        const nuevaSerie = reactive({
            tvdb_id: null,
            estado: 'en_cola'
        })

        const guardando = ref(false)
        const mensaje = ref('')
        const tipoMensaje = ref('')

        const guardarSerie = async () => {
            guardando.value = true
            mensaje.value = ''
            
            const serieEsqueleto = {
                tvdb_id: nuevaSerie.tvdb_id,
                estado: nuevaSerie.estado
            }

            try {
                const resultado = await insertShow(serieEsqueleto)

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

        return {
            nuevaSerie,
            guardando,
            mensaje,
            tipoMensaje,
            guardarSerie
        }
    },
    template: `
        <div class="view view-add-serie">

            <div class="view-header">
                <h2>Añadir Nueva Serie</h2>
                <p class="text-muted">Introduce el ID de TheTVDB. El sistema descargará el resto de metadatos automáticamente.</p>
            </div>
            
            <div class="view-content">
                <form @submit.prevent="guardarSerie" class="form-add">

                    <div class="form-group">
                        <label for="tvdb_id">ID de TheTVDB</label>
                        <input 
                            type="number" 
                            id="tvdb_id" 
                            v-model.number="nuevaSerie.tvdb_id" 
                            placeholder="Ej: 392256" 
                            required 
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