import { computed } from 'vue'
import ViendoCard from './ViendoCard.js'
import { sortViendo } from '../utils/sorting.js'

export default {
    name: 'ViendoList',
    components: { ViendoCard },
    props: {
        series: { type: Array, default: () => [] }
    },
    setup(props) {
        const ordenada = computed(() => sortViendo(props.series))
        return { ordenada }
    },
    template: `
        <div id="series-list" class="grid">
            <ViendoCard v-for="serie in ordenada" :key="serie.titulo + serie.año" :serie="serie" />
        </div>
    `
}
