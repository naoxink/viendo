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
        const ultimaEjecucion = computed(() => {
            const hoy = new Date();
            const hoyLocal = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
            
            if (props.status?.ultima_ejecucion.substring(0, 10) === hoyLocal) {
                return 'Hoy'
            }

            return formatearFecha(props.status?.ultima_ejecucion)
        })

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
