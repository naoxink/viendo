import HistoricoList from '../HistoricoList.js'
import DropeadasList from '../DropeadasList.js'

export default {
    name: 'ViewCompletadas',
    components: { HistoricoList, DropeadasList },
    props: {
        completadas: Array,
        dropeadas: Array,
        loading: Boolean,
        error: String,
        searchTerm: String,
        añoActual: Number
    },
    emits: ['update:searchTerm'],
    template: `
        <div class="view view-completadas">
            <section class="view-content">
                <h1>✅ Completadas y dropeadas</h1>
                <div class="search-wrapper">
                    <input
                        type="search"
                        id="history-search"
                        v-model="searchTerm"
                        @input="$emit('update:searchTerm', $event.target.value)"
                        placeholder="Buscar en el histórico..."
                    >
                </div>
                <p v-if="loading">Cargando series...</p>
                <p v-else-if="error">No se ha podido cargar los datos de series. Revisa la consola para más detalles.</p>
                <div v-else class="history-grid">
                    <HistoricoList :completadas="completadas" :ano-actual="añoActual" :search-term="searchTerm" />
                    <DropeadasList :series="dropeadas" :search-term="searchTerm" />
                </div>
            </section>
        </div>
    `
}
