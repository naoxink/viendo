export default {
    name: 'RewatchBadge',
    props: {
        serie: { type: Object, required: true }
    },
    template: `
        <span
            v-if="serie.rewatch"
            class="badge-rewatch"
            :title="'Rewatch: vista ' + (serie.veces || 1) + ' veces'"
        >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4.5 12a7.5 7.5 0 0 1 13.1-5.1L18.5 6.5M19.5 12a7.5 7.5 0 0 1-13.1 5.1L5.5 17.5M18.5 6.5v3m0-3h-3M5.5 17.5v-3m0 3h3"/>
            </svg>
            <span class="badge-rewatch-count">x{{ serie.veces || 1 }}</span>
        </span>
    `
}
