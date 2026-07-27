export default {
    name: 'RewatchBadge',
    props: {
        serie: { type: Object, required: true }
    },
    template: `
        <span v-if="serie.estado_final && !['true', 'false'].includes(serie.estado_final.toString())" class="badge-final-status">
            {{ serie.estado_final }}
        </span>
    `
}
