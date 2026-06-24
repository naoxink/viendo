import { computed } from 'vue'

export default {
    name: 'PosterThumb',
    props: {
        serie: { type: Object, required: true }
    },
    setup(props) {
        const src = computed(() => props.serie.poster_path || props.serie.image_url || '')
        return { src }
    },
    template: `
        <img v-if="src" class="serie-thumb" :src="src" :alt="serie.titulo" loading="lazy">
    `
}
