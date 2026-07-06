import EnColaCard from './EnColaCard.js'

export default {
    name: 'ProximamenteList',
    components: { EnColaCard },
    props: {
        // Objeto tipo { "2026-07-06": [serie1, serie2], "2026-07-07": [serie3] }
        series: { type: Object, default: () => ({}) },
        titulo: { type: String, default: () => "" }
    },
    computed: {
        // Ordena las fechas cronológicamente y añade la etiqueta relativa
        gruposPorFecha() {
            return Object.keys(this.series)
                .sort() // Como son 'YYYY-MM-DD', el orden alfabético = orden cronológico
                .map(fecha => ({
                    fecha,
                    label: this.formatearFecha(fecha),
                    series: this.series[fecha]
                }));
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
            if (diffDias > 1) return `En ${diffDias} días`;
            return `Hace ${Math.abs(diffDias)} días`;
        }
    },
    template: `
        <div id="series-list" class="grid">
            <h3>{{ titulo }} <span class="count">{{ totalSeries }} series</span></h3>

            <div v-for="grupo in gruposPorFecha" :key="grupo.fecha" class="fecha-group">
                <h4 class="fecha-separador">{{ grupo.label }}</h4>
                <EnColaCard v-for="serie in grupo.series" :key="serie.titulo" :serie="serie" />
            </div>
        </div>
    `
}