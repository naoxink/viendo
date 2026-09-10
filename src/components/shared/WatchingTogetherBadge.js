export default {
    name: 'WatchingTogetherBadge',
    props: {
        serie: { type: Object, required: true }
    },
    template: `
        <span
            v-if="serie.viendo_con_alguien"
            class="badge-watching-together"
            title="Viendo con alguien"
        >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="8" cy="7" r="2.75"/>
                <path d="M4 18c.9-2 2.9-3.2 5-3.2s4.1 1.2 5 3.2"/>
                <circle cx="16" cy="7" r="2.25"/>
                <path d="M13 18c.8-1.6 2.4-2.6 4.2-2.6 1.1 0 2.2.3 3.1.9"/>
            </svg>
        </span>
    `
}
