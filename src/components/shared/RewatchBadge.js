import { userDevice } from '../../composables/userDevice.js';

export default {
    name: 'RewatchBadge',
    props: {
        serie: { type: Object, required: true }
    },
    setup() {
        const { isMobile } = userDevice();
        return { isMobile };
    },
    template: `
        <span v-if="serie.rewatch" class="badge-rewatch" :title="'Vista ' + serie.veces + ' veces'">
            <span v-if="!isMobile">Rewatch</span>
            <span v-else>RW</span>
            <span v-if="serie.veces > 1">x{{ serie.veces }}</span>
        </span>
    `
}
