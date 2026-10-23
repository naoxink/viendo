import { ref, reactive, computed, onMounted } from 'vue'
import { useSeriesData } from '../../composables/useSeriesData.js'
import PosterThumb from '../shared/PosterThumb.js'
import LinksFooter from '../shared/LinksFooter.js'
import { cardBgStyle } from '../../utils/format.js'

const TABS = [
  { key: 'upcoming', label: 'Estrenos 🚀', vacio: 'No hay próximos estrenos registrados.' },
  { key: 'trending', label: 'Trending 🔥', vacio: 'No hay series en tendencia en este momento.' },
  { key: 'updated', label: 'Actualizadas 🆕', vacio: 'No hay series actualizadas en este momento.' }
]

export default {
  name: 'ViewDiscover',
  components: { PosterThumb, LinksFooter },
  emits: ['back'],
  setup() {
    const {
      data, insertShow,
      fetchUpcomingSeries, fetchTrendingSeries, fetchRecentlyUpdated
    } = useSeriesData()

    const isAdmin = computed(() => sessionStorage.getItem('isAdmin') === 'true')
    const activeTab = ref('upcoming')
    const listas = reactive({ upcoming: [], trending: [], updated: [] })
    const loading = ref(true)

    // Estado de "añadir" por tvdb_id: 'adding' | 'added' | 'error'
    const estados = reactive({})
    const errores = reactive({})

    onMounted(async () => {
      loading.value = true
      try {
        const [upcoming, trending, updated] = await Promise.all([
          fetchUpcomingSeries(),
          fetchTrendingSeries(),
          fetchRecentlyUpdated()
        ])
        listas.upcoming = upcoming
        listas.trending = trending
        listas.updated = updated
      } catch (err) {
        console.error('Error al cargar descubrimientos:', err)
      } finally {
        loading.value = false
      }
    })

    // tvdb_id de todo lo que ya tienes (viendo, en cola, completadas, dropeadas)
    const idsExistentes = computed(() => {
      const ids = new Set()
      for (const coleccion of Object.values(data.value || {})) {
        for (const s of coleccion) {
          if (s.tvdb_id) ids.add(Number(s.tvdb_id))
        }
      }
      return ids
    })

    // Se ocultan las que ya tienes, salvo las que acabas de añadir desde aquí
    // (así ves el "✓ En cola" en lugar de que la card desaparezca).
    const visibles = computed(() =>
      (listas[activeTab.value] || []).filter((s) => {
        const id = Number(s.tvdb_id)
        return !idsExistentes.value.has(id) || Boolean(estados[id])
      })
    )

    const ocultas = computed(() => (listas[activeTab.value] || []).length - visibles.value.length)
    const tabActual = computed(() => TABS.find((t) => t.key === activeTab.value))

    const rangoTrending = (serie) => listas.trending.indexOf(serie) + 1

    const textoBoton = (id) => {
      switch (estados[id]) {
        case 'adding': return 'Añadiendo…'
        case 'added': return '✓ En cola'
        case 'error': return 'Reintentar'
        default: return '+ A cola'
      }
    }

    const anadir = async (serie) => {
      const id = Number(serie.tvdb_id)
      if (!id || estados[id] === 'adding' || estados[id] === 'added') return

      estados[id] = 'adding'
      errores[id] = ''

      // insertShow ya recarga los datos al terminar, así que la serie aparece
      // en "En cola" sin hacer nada más.
      const resultado = await insertShow({ tvdb_id: id, estado: 'en_cola' })

      if (resultado.success) {
        estados[id] = 'added'
      } else {
        estados[id] = 'error'
        errores[id] = resultado.error || 'No se pudo añadir la serie.'
      }
    }

    return {
      TABS, activeTab, tabActual, loading, isAdmin,
      visibles, ocultas, estados, errores,
      rangoTrending, textoBoton, anadir, cardBgStyle
    }
  },
  template: `
    <div class="view view-discover">
      <header class="detail-top-bar">
        <button type="button" class="btn-back" @click="$emit('back')">← Volver</button>
      </header>

      <section class="view-content">
        <div class="discover-header">
          <h2>🔭 Descubrir</h2>
          <div class="discover-tabs" role="tablist">
            <button
              v-for="tab in TABS"
              :key="tab.key"
              type="button"
              role="tab"
              :aria-selected="activeTab === tab.key"
              :class="['tab-btn', { active: activeTab === tab.key }]"
              @click="activeTab = tab.key"
            >{{ tab.label }}</button>
          </div>
        </div>

        <p v-if="loading" class="discover-status">Cargando novedades...</p>

        <template v-else>
          <p v-if="ocultas > 0" class="discover-status">
            {{ ocultas }} {{ ocultas === 1 ? 'serie oculta' : 'series ocultas' }} porque ya {{ ocultas === 1 ? 'está' : 'están' }} en tu biblioteca.
          </p>

          <div v-if="visibles.length" class="series-grid">
            <div
              v-for="serie in visibles"
              :key="activeTab + '-' + serie.tvdb_id"
              class="serie-card"
              :style="cardBgStyle(serie)"
            >
              <div class="serie-card-body">
                <PosterThumb :serie="serie" />
                <div class="info">
                  <h2>{{ serie.titulo }}</h2>

                  <template v-if="activeTab === 'upcoming'">
                    <p class="progress" v-if="serie.first_aired">📅 <strong>{{ serie.first_aired }}</strong></p>
                    <p class="next-air" v-if="serie.days_until_premiere !== null && serie.days_until_premiere !== undefined">
                      ⏳ {{ serie.days_until_premiere === 0 ? '¡Estreno hoy!' : 'Faltan ' + serie.days_until_premiere + ' días' }}
                    </p>
                  </template>

                  <template v-else-if="activeTab === 'trending'">
                    <p class="progress" v-if="serie.anio">Año: <strong>{{ serie.anio }}</strong></p>
                    <p class="next-air" v-if="serie.score">🔥 Score: <strong>{{ serie.score }}</strong></p>
                  </template>

                  <template v-else>
                    <p class="progress" v-if="serie.anio">Año: <strong>{{ serie.anio }}</strong></p>
                    <p class="progress" v-if="serie.temporada && serie.capitulo">T{{ serie.temporada }} · E{{ serie.capitulo }}</p>
                  </template>
                </div>
              </div>

              <div class="serie-card-footer">
                <span v-if="activeTab === 'trending'" class="discover-rank">#{{ rangoTrending(serie) }}</span>
                <span v-if="activeTab === 'upcoming' && serie.score" class="discover-score">⭐ {{ serie.score }}</span>
                <span v-if="activeTab === 'updated' && serie.last_aired" class="next-air"><strong>{{ serie.last_aired }}</strong></span>
                <LinksFooter :serie="serie" />

                <button
                  v-if="isAdmin && serie.tvdb_id"
                  type="button"
                  :class="['btn-add-card', { added: estados[serie.tvdb_id] === 'added', error: estados[serie.tvdb_id] === 'error' }]"
                  :disabled="estados[serie.tvdb_id] === 'adding' || estados[serie.tvdb_id] === 'added'"
                  :aria-label="'Añadir ' + serie.titulo + ' a la cola'"
                  @click="anadir(serie)"
                >{{ textoBoton(serie.tvdb_id) }}</button>
              </div>

              <p v-if="errores[serie.tvdb_id]" class="discover-card-error">{{ errores[serie.tvdb_id] }}</p>
            </div>
          </div>

          <p v-else class="discover-status">
            {{ ocultas > 0 ? 'Ya tienes todas las series de esta lista.' : tabActual.vacio }}
          </p>
        </template>
      </section>
    </div>
  `
}
