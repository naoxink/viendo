export default {
    name: 'MiniSerieList',
    props: {
        // Cada item admite: { key, titulo, meta, serie } para abrir el
        // detalle de una serie propia, o { key, titulo, meta, href } para
        // enlazar a una página externa (p.ej. TheTVDB) sin tocar tus datos.
        items: { type: Array, default: () => [] }
    },
    emits: ['select-serie'],
    template: `
        <ol class="stats-rank-list dashboard-mini-list">
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
                    <span class="stats-rank-inner">
                        <span class="stats-rank-title">{{ item.titulo }}</span>
                        <span class="stats-rank-leader"></span>
                    </span>
                    <span v-if="item.meta" class="next-air">{{ item.meta }}</span>
                </span>
                <span v-else class="dashboard-mini-list-row dashboard-mini-list-row-static">
                    <span class="stats-rank-inner">
                        <span class="stats-rank-title">{{ item.titulo }}</span>
                        <span class="stats-rank-leader"></span>
                    </span>
                    <span v-if="item.meta" class="next-air">{{ item.meta }}</span>
                </span>
            </li>
        </ol>
    `
}