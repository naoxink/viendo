import LinksFooter from './shared/LinksFooter.js'

export default {
    name: 'DropeadaCard',
    components: { LinksFooter },
    props: {
        serie: { type: Object, required: true }
    },
    template: `
        <div class="serie-card-dropped">
            <div class="info">
                <h3>{{ serie.titulo }} <small>({{ serie.año }})</small></h3>
                <p class="dropped-meta">
                    Dropeada en <b>{{ serie.vistoEn || serie.año }}</b> •
                    Te quedaste en: <span>T{{ serie.temporada }} • E{{ serie.capitulo }}</span>
                </p>
            </div>
            <div>
                <LinksFooter :serie="serie" />
            </div>
        </div>
    `
}
