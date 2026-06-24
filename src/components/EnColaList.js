import EnColaCard from './EnColaCard.js'

export default {
    name: 'EnColaList',
    components: { EnColaCard },
    props: {
        series: { type: Array, default: () => [] }
    },
    template: `
        <div id="en-cola-container">
            <details v-if="series.length > 0" class="cola-section">
                <summary>
                    <span>⏳ En Cola / Pendientes</span>
                    <span class="count">{{ series.length }} series</span>
                </summary>
                <div class="cola-content grid-series">
                    <EnColaCard v-for="serie in series" :key="serie.titulo" :serie="serie" />
                </div>
            </details>
        </div>
    `
}
