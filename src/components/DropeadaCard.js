import LinksFooter from './shared/LinksFooter.js'

export default {
    name: 'DropeadaCard',
    components: { LinksFooter },
    props: {
        serie: { type: Object, required: true }
    },
    emits: ['select-serie'],
    template: `
        <div class="serie-card-dropped">
            <div class="info">
                <h3>{{ serie.titulo }} <small>({{ serie.año }})</small></h3>
                <p class="dropped-meta">
                    Dropeada en <b>{{ serie.vistoEn || serie.año }}</b><br>
                    Te quedaste en: <span>T{{ serie.temporada }} • E{{ serie.capitulo }}</span>
                </p>
            </div>
            <div>
                <LinksFooter :serie="serie" />
                <button class="details-btn" type="button" @click="$emit('select-serie', serie)" aria-label="Ver detalles de la serie" title="Ver detalles de la serie">?</button>
            </div>
        </div>
    `
}
