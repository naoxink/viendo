import { computed, ref } from 'vue'
import PosterThumb from './shared/PosterThumb.js'
import LinksFooter from './shared/LinksFooter.js'
import RewatchBadge from './shared/RewatchBadge.js'
import SlowModeBadge from './shared/SlowModeBadge.js'
import { cardBgStyle, formatProximaFecha } from '../utils/format.js'
import { CONFIG } from '../utils/config.js'

export default {
    name: 'ViendoCard',
    components: { PosterThumb, LinksFooter, RewatchBadge, SlowModeBadge },
    props: {
        serie: { type: Object, required: true }
    },
    emits: ['select-serie'],
    setup(props) {
        const bgStyle = computed(() => cardBgStyle(props.serie))
        const proximaFechaTexto = computed(() => formatProximaFecha(props.serie.proxima_fecha))
        const isAdmin = computed(() => sessionStorage.getItem('isAdmin') === 'true');
        const progreso = computed(() => {
            const caps = props.serie.capitulosPorTemporada;
            if (!caps || Object.keys(caps).length === 0) return 0;

            if (props.serie.rewatch) {
                const totalCaps = Object.values(caps).reduce((a, b) => a + b, 0);
                return (props.serie.capitulo / totalCaps) * 100;
            } else {
                const capsTemporada = caps[props.serie.temporada] || 1;
                return (props.serie.capitulo / capsTemporada) * 100;
            }
        });
        return { bgStyle, proximaFechaTexto, progreso, isAdmin }
    },
    methods: {
        async marcarComoVisto(serie) {
            const token = sessionStorage.getItem('adminToken');
            
            try {
                const res = await fetch(`${CONFIG.API_BASE_URL}/api/update`, {
                    method: 'POST',
                    headers: {
                        'Authorization': token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        tvdbId: serie.tvdb_id,
                        temporada: serie.temporada,
                        capitulo: serie.capitulo
                    })
                });

                if (!res.ok) {
                    throw new Error(`Error en el servidor: ${res.status}`);
                }

                const data = await res.json(); 

                if (data.success) {
                    Object.assign(serie, data.serie);
                } else {
                    console.error('La API devolvió un error:', data.error);
                }

            } catch (error) {
                console.error('Error al marcar como visto:', error);
            }
        },
        totalCapsTemporada(serie) {
            return serie.capitulosPorTemporada[serie.temporada] || 0;
        },
        seleccionarSerie(serie) {
            console.log('Seleccionando serie:', serie.titulo);
            this.$emit('select-serie', serie)
        }
    },
    template: `
        <div class="serie-card" :style="bgStyle">
            <div class="serie-card-body">
                <PosterThumb :serie="serie" />
                <div class="info">
                    <h2>{{ serie.titulo }} <span class="año-label">({{ serie.año }})</span></h2>
                    <p class="progress">
                        T{{ serie.temporada }} • E{{ serie.capitulo }}
                        <span v-if="serie.pendiente" class="badge-pendiente">Pendiente</span>
                        <span v-else class="badge-visto">Visto</span>
                        <div></div>
                    </p>
                    <span v-if="serie.acumulados > 0" class="badge-warning">+{{ serie.acumulados }} caps</span>
                </div>
                <button v-if="isAdmin && serie.pendiente" aria-label="Marcar como visto" class="btn-check" :class="{ 'visto': !serie.pendiente }" @click="marcarComoVisto(serie)"></button>
            </div>
            <div class="serie-card-footer">
                <LinksFooter :serie="serie" />
                <RewatchBadge :serie="serie" />
                <SlowModeBadge :serie="serie" />
                <p v-if="serie.proxima_fecha" class="next-air">
                    📅 <strong>{{ proximaFechaTexto }}</strong>
                </p>
                <button class="details-btn" type="button" @click="seleccionarSerie(serie)" aria-label="Ver detalles de la serie" title="Ver detalles de la serie">?</button>
            </div>
            <div class="progress-bar-container" :title="totalCapsTemporada(serie) + ' capítulos esta temporada ' + serie.temporada">
                <div class="progress-bar-fill" :style="{ width: progreso + '%' }"></div>
            </div>
        </div>
    `
}