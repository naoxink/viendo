export default {
    name: 'RewatchBadge',
    props: {
        serie: { type: Object, required: true }
    },
    template: `
        <span v-if="serie.estado_final" class="badge-final-status">
            {{ serie.estado_final }}
        </span>
    `
}
