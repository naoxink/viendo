import { userDevice } from '../../composables/userDevice.js';

export default {
    name: 'SlowModeBadge',
    props: {
        serie: { type: Object, required: true }
    },
    setup() {
        const { isMobile } = userDevice();
        return { isMobile };
    },
    template: `
        <span v-if="serie.slow_mode" class="badge-slowmode" title="Viendo de tranquileo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
            </svg>
            <span v-if="!isMobile">SLOW MODE</span>
            <span v-else>SM</span>
        </span>
    `
}
