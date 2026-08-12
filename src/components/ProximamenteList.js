import ProximamenteCard from './ProximamenteCard.js'

export default {
    name: 'ProximamenteList',
    components: { ProximamenteCard },
    props: {
        // Objeto tipo { "2026-07-06": [serie1, serie2], "2026-07-07": [serie3] }
        series: { type: Object, default: () => ({}) },
        titulo: { type: String, default: () => "" }
    },
    emits: ['select-serie'],
    computed: {
        // Agrupa por la etiqueta relativa para mostrar juntos, por ejemplo, todos los "En 1 mes"
        gruposPorFecha() {
            const grupos = Object.keys(this.series).reduce((acc, fecha) => {
                const label = this.formatearFecha(fecha);
                if (!acc[label]) {
                    acc[label] = { label, fechas: [], series: [] };
                }
                acc[label].fechas.push(fecha);
                acc[label].series.push(...this.series[fecha]);
                return acc;
            }, {});

            return Object.values(grupos)
                .sort((a, b) => {
                    const fechaA = a.fechas.sort()[0];
                    const fechaB = b.fechas.sort()[0];
                    return fechaA.localeCompare(fechaB);
                });
        },
        totalSeries() {
            return Object.values(this.series)
                .reduce((total, series) => total + series.length, 0);
        }
    },
    methods: {
        formatearFecha(fechaStr) {
            // Normalizamos "hoy" a medianoche para comparar solo días completos
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);

            // Parseamos manualmente en vez de `new Date(fechaStr)` para evitar
            // el desfase de un día que provoca interpretar la fecha como UTC
            const [anio, mes, dia] = fechaStr.split('-').map(Number);
            const fecha = new Date(anio, mes - 1, dia);
            fecha.setHours(0, 0, 0, 0);

            const diffDias = Math.round((fecha - hoy) / 86400000);

            if (diffDias === 0) return 'Hoy';
            if (diffDias === 1) return 'Mañana';
            if (diffDias === -1) return 'Ayer';
            if (diffDias > 1 && diffDias < 7) return `En ${diffDias} días`;
            if (diffDias >= 7 && diffDias < 30) return `En ${Math.floor(diffDias / 7)} semana${Math.floor(diffDias / 7) > 1 ? 's' : ''}`;
            if (diffDias >= 30) return `En ${Math.floor(diffDias / 30)} mes${Math.floor(diffDias / 30) > 1 ? 'es' : ''}`;
            return `Hace ${Math.abs(diffDias)} días`;
        }
    },
    template: `
        <div id="series-list" class="proximamente-list" class="grid">
            <h3>{{ titulo }} <span class="count">{{ totalSeries }} series</span></h3>

            <div v-for="grupo in gruposPorFecha" :key="grupo.fecha" class="fecha-group">
                <h4 class="fecha-separador">{{ grupo.label }}</h4>
                <ProximamenteCard v-for="serie in grupo.series" :key="serie.titulo" :serie="serie" @select-serie="$emit('select-serie', $event)" />
            </div>
        </div>
    `
}