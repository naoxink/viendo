export default {
    name: 'RewatchBadge',
    props: {
        serie: { type: Object, required: true }
    },
    template: `
        <span v-if="serie.rewatch" class="badge-rewatch" :title="'Vista ' + serie.veces + ' veces'">
            Rewatch <span v-if="serie.veces > 1">x{{ serie.veces }}</span>
        </span>
    `
}
