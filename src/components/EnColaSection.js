import EnColaCard from './EnColaCard.js'

export default {
    name: 'EnColaSection',
    components: { EnColaCard },
    props: {
        titulo: { type: String, required: true },
        descripcion: { type: String, default: '' },
        series: { type: Array, default: () => [] },
        abierta: { type: Boolean, default: false }
    },
    emits: ['select-serie'],
    template: `
        <details class="cola-section" :open="abierta">
            <summary>
                <span>{{ titulo }}</span>
                <span class="count">{{ series.length }} series</span>
            </summary>
            <div class="cola-content">
                <p v-if="descripcion" class="cola-section-hint">{{ descripcion }}</p>
                <div class="cola-list">
                    <EnColaCard
                        v-for="serie in series"
                        :key="serie.id || serie.tvdb_id || serie.titulo"
                        :serie="serie"
                        @select-serie="$emit('select-serie', $event)"
                    />
                </div>
            </div>
        </details>
    `
}