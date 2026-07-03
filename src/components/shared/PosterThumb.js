import { computed, ref } from 'vue'

export default {
    name: 'PosterThumb',
    props: {
        serie: { type: Object, required: true }
    },
    setup(props) {
        const src = ref(props.serie.poster_path || props.serie.image_url || '')
        const fallback = () => {
            if (props.serie.image_url && src.value !== props.serie.image_url) {
                src.value = props.serie.image_url
            }
        }

        const hasSrc = computed(() => Boolean(src.value))
        return { src, hasSrc, fallback }
    },
    template: `
        <img v-if="hasSrc" class="serie-thumb" :src="src" :alt="serie.titulo" loading="lazy" @error="fallback">
    `
}
