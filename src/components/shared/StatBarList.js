export default {
    name: 'StatBarList',
    props: {
        // [{ etiqueta: '2026', cantidad: 5, pct: 100 }, ...]
        items: { type: Array, default: () => [] }
    },
    template: `
        <div class="stat-bars">
            <div class="stat-bar-row" v-for="item in items" :key="item.etiqueta">
                <span class="stat-bar-label">{{ item.etiqueta }}</span>
                <div class="stat-bar-track">
                    <div class="stat-bar-fill" :style="{ width: item.pct + '%' }"></div>
                </div>
                <span class="stat-bar-value">{{ item.cantidad }}</span>
            </div>
        </div>
    `
}
