import EnColaCard from './EnColaCard.js'

export default {
    name: 'EnColaList',
    components: { EnColaCard },
    props: {
        series: { type: Array, default: () => [] },
        titulo: { type: String, default: () => "" }
    },
    template: `
        <div id="series-list" class="grid">
            <h3>{{ titulo }} <span class="count">{{ series.length }} series</span></h3>
            <EnColaCard v-for="serie in series" :key="serie.titulo" :serie="serie" @select-serie="$emit('select-serie', $event)" />
        </div>
    `
}
