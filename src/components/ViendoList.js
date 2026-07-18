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
            <div class="no-content" v-if="!ordenada.length">No estás viendo nada actualmente :(</div>
            <ViendoCard v-for="serie in ordenada" :key="serie.titulo + serie.año" :serie="serie" />
            <a class="thetvdbattribution" style="" href="https://thetvdb.com/subscribe">
                    <img src="https://www.thetvdb.com/images/attribution/logo1.png" height="45">
                    Metadata provided by TheTVDB. Please consider adding missing information or subscribing.
            </a>
        </div>
    `
}
