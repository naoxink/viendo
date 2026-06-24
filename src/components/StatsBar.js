import { computed } from 'vue'

export default {
    name: 'StatsBar',
    props: {
        viendo: { type: Array, default: () => [] },
        completadas: { type: Array, default: () => [] },
        anoActual: { type: Number, required: true }
    },
    setup(props) {
        const terminadasEsteAño = computed(
            () => props.completadas.filter((s) => s.vistoEn === props.anoActual).length
        )
        const pendientes = computed(() => props.viendo.filter((s) => s.pendiente).length)

        return { terminadasEsteAño, pendientes }
    },
    template: `
        <div id="stats" class="stats-bar">
            <div class="stat-item">🍿 <b>{{ viendo.length }}</b> en curso</div>
            <div class="stat-item" v-if="pendientes > 0">🔔 <b>{{ pendientes }}</b> por ver</div>
            <div class="stat-item">🏆 <b>{{ terminadasEsteAño }}</b> finalizadas en {{ anoActual }}</div>
        </div>
    `
}
