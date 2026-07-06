import EnColaCard from './EnColaCard.js'

export default {
    name: 'EnColaList',
    components: { EnColaCard },
    props: {
        series: { type: Array, default: () => [] }
    },
    template: `
        <div id="en-cola-container">
            <h3>⏳ En Cola / Pendientes <span class="count">{{ series.length }} series</span></h3>
            <EnColaCard v-for="serie in series" :key="serie.titulo" :serie="serie" />
        </div>
    `
}
