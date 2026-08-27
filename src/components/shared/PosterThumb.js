import { computed, ref } from 'vue'

export default {
    name: 'PosterThumb',
    props: {
        serie: { type: Object, required: true }
    },
    setup(props) {
        const src = ref(props.serie.poster_path || props.serie.image_url || '')
        const failed = ref(false)

        const fallback = () => {
            // Primer intento fallido: probamos con la URL remota si existe
            if (props.serie.image_url && src.value !== props.serie.image_url) {
                src.value = props.serie.image_url
                return
            }
            // Si también falla (o no había nada), mostramos el placeholder
            failed.value = true
        }

        const hasSrc = computed(() => Boolean(src.value) && !failed.value)

        return { src, hasSrc, fallback }
    },
    template: `
        <img v-if="hasSrc" class="serie-thumb" :src="src" :alt="serie.titulo" loading="lazy" @error="fallback">
        <div v-else class="serie-thumb serie-thumb-placeholder" :title="serie.titulo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <path d="M21 15l-5-5L5 21"/>
            </svg>
        </div>
    `
}