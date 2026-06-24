export default {
    name: 'LinksFooter',
    props: {
        serie: { type: Object, required: true }
    },
    template: `
        <a v-if="serie.imdb_id"
           :href="'https://www.imdb.com/title/' + serie.imdb_id + '/'"
           target="_blank" class="link-imdb">IMDb</a>
        <a v-if="serie.tvdb_id"
           :href="'https://www.thetvdb.com/?tab=series&id=' + serie.tvdb_id"
           target="_blank" class="link-imdb">TVDB</a>
    `
}
