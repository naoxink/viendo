import PosterThumb from '../shared/PosterThumb.js'
import { getNotaClass } from '../../utils/format.js'

export default {
    name: 'MiniSerieList',
    components: { PosterThumb },
    props: {
        // Cada item admite: { key, titulo, meta, serie } para abrir el
        // detalle de una serie propia, o { key, titulo, meta, href } para
        // enlazar a una página externa (p.ej. TheTVDB) sin tocar tus datos.
        items: { type: Array, default: () => [] },
        // Si es true, las filas que traen "serie" muestran también un
        // mini-póster (PosterThumb ya se degrada solo si la serie no tiene
        // imagen). No afecta a las filas con "href".
        showPosters: { type: Boolean, default: false }
    },
    methods: {
        getNotaClass(nota) {
            if (!nota) return '';
            return getNotaClass(nota)
        }
    },
    emits: ['select-serie'],
    template: `
        <ol class="stats-rank-list dashboard-mini-list" :class="{ 'dashboard-mini-list--with-posters': showPosters }">
            <li v-for="item in items" :key="item.key">
                <a
                    v-if="item.href"
                    :href="item.href"
                    target="_blank"
                    rel="noopener"
                    class="dashboard-mini-list-row"
                >
                    <span class="stats-rank-inner">
                        <span class="stats-rank-title">{{ item.titulo }}</span>
                        <span class="stats-rank-leader"></span>
                    </span>
                    <span v-if="item.meta" class="next-air">{{ item.meta }}</span>
                </a>
                <span
                    v-else-if="item.serie"
                    class="dashboard-mini-list-row"
                    @click="$emit('select-serie', item.serie)"
                >
                    <PosterThumb v-if="showPosters" :serie="item.serie" class="dashboard-mini-list-poster" />
                    <span class="stats-rank-inner">
                        <span class="stats-rank-title">{{ item.titulo }}</span>
                        <span class="stats-rank-leader"></span>
                    </span>
                    <span v-if="item.meta" class="next-air">{{ item.meta }}</span>
                    <span v-if="item.nota" class="nota-tag" :class="getNotaClass(item.nota)">{{ item.nota }}</span>
                </span>
                <span v-else class="dashboard-mini-list-row dashboard-mini-list-row-static">
                    <span class="stats-rank-inner">
                        <span class="stats-rank-title">{{ item.titulo }}</span>
                        <span class="stats-rank-leader"></span>
                    </span>
                    <span v-if="item.meta" class="next-air">{{ item.meta }}</span>
                    <span v-if="item.nota" class="nota-tag" :class="getNotaClass(item.nota)">{{ item.nota }}</span>
                </span>
            </li>
        </ol>
    `
}