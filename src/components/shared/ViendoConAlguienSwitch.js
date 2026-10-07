import { useViendoFilter } from '../../composables/useViendoFilter.js'

export default {
    name: 'ViendoConAlguienSwitch',
    props: {
        // Lista completa (sin filtrar) para saber si merece la pena mostrar el switch
        series: { type: Array, default: () => [] }
    },
    setup(props) {
        const { mostrarTodas, ocultas, hayConAlguien } = useViendoFilter()
        return { mostrarTodas, ocultas, hayConAlguien }
    },
    template: `
        <label v-if="hayConAlguien(series)" class="switch-con-alguien">
            <input type="checkbox" v-model="mostrarTodas" />
            <span class="switch-track"><span class="switch-thumb"></span></span>
            <span class="switch-label">
                Mostrar también las que veo con alguien
                <small v-if="!mostrarTodas && ocultas(series)">({{ ocultas(series) }} ocultas)</small>
            </span>
        </label>
    `
}