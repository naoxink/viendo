import { computed } from 'vue'
import EnColaSection from '../EnColaSection.js'
import { agruparEnCola } from '../../utils/enCola.js'

export default {
    name: 'ViewEnCola',
    components: { EnColaSection },
    props: {
        enCola: { type: Array, default: () => [] },
        loading: Boolean,
        error: [String, Object]
    },
    emits: ['select-serie', 'cambiar-vista'],
    setup(props) {
        const secciones = computed(() => agruparEnCola(props.enCola))
        const isAdmin = computed(() => sessionStorage.getItem('isAdmin') === 'true')
        return { secciones, isAdmin }
    },
    template: `
        <div class="view view-en-cola">
            <section class="view-content">
                <div class="cola-header">
                    <h1>📥 En cola</h1>
                    <div class="cola-actions">
                        <button type="button" class="btn-discover-header" @click="$emit('cambiar-vista', 'discover')">
                            🔭 Descubrir
                        </button>
                        <button v-if="isAdmin" type="button" class="btn-add-header" @click="$emit('cambiar-vista', 'add-serie')">
                            + Añadir
                        </button>
                    </div>
                </div>

                <p v-if="loading">Cargando series...</p>
                <p v-else-if="error">No se ha podido cargar los datos de series. Revisa la consola para más detalles.</p>

                <template v-else>
                    <div v-if="secciones.length" class="cola-sections">
                        <EnColaSection
                            v-for="seccion in secciones"
                            :key="seccion.key"
                            :titulo="seccion.titulo"
                            :descripcion="seccion.descripcion"
                            :series="seccion.series"
                            :abierta="seccion.abierta"
                            @select-serie="$emit('select-serie', $event)"
                        />
                    </div>
                    <div v-else class="no-content">
                        Tu cola está vacía.
                        <button type="button" class="btn-link" @click="$emit('cambiar-vista', 'discover')">Descubre series nuevas</button>
                    </div>
                </template>
            </section>
        </div>
    `
}