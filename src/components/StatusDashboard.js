import { computed } from 'vue'
import { formatearFecha } from '../utils/format.js'

export default {
    name: 'StatusDashboard',
    props: {
        status: { type: Object, default: null }
    },
    setup(props) {
        const scriptClase = computed(() => (props.status?.script_ok ? 'status-success' : 'status-error'))
        const scriptTexto = computed(() => (props.status?.script_ok ? 'Sinc.' : 'Error'))
        const notifTexto = computed(() =>
            props.status?.notificacion_enviada ? '🔔 Enviado' : '🔕 No enviado'
        )
        const ultimaEjecucion = computed(() => formatearFecha(props.status?.ultima_ejecucion))

        return { scriptClase, scriptTexto, notifTexto, ultimaEjecucion }
    },
    template: `
        <div v-if="status" id="status-dashboard" class="status-container">
            <div class="status-item">
                <span class="status-dot" :class="scriptClase"></span>
                <span class="text-muted timestamp">{{ ultimaEjecucion }}</span>
            </div>
            <div class="status-item text-muted">
                <span>{{ notifTexto }}</span>
            </div>
        </div>
    `
}
