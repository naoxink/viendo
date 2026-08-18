import { useSeriesData } from '../../composables/useSeriesData.js'
import PosterThumb from '../shared/PosterThumb.js'
import { cardBgStyle, formatProximaFecha } from '../../utils/format.js'
import { ref, onMounted } from 'vue'
import LinksFooter from '../shared/LinksFooter.js'

export default {
  name: 'ViewDiscover',
  components: { PosterThumb, LinksFooter },
  setup() {
    const { fetchUpcomingSeries, fetchTrendingSeries, fetchRecentlyUpdated } = useSeriesData()
    
    const activeTab = ref('upcoming')
    const upcomingList = ref([])
    const trendingList = ref([])
    const updatedList  = ref([])
    const loading = ref(true)

    onMounted(async () => {
      loading.value = true
      try {
        const [upcoming, trending, updated] = await Promise.all([
          fetchUpcomingSeries(),
          fetchTrendingSeries(),
          fetchRecentlyUpdated()
        ])
        upcomingList.value = upcoming
        trendingList.value = trending
        updatedList.value  = updated
      } catch (err) {
        console.error("Error al cargar descubrimientos:", err)
      } finally {
        loading.value = false
      }
    })

    // Función auxiliar para aplicar el estilo de fondo igual que en ProximamenteCard
    const getCardStyle = (serie) => {
      return cardBgStyle(serie)
    }

    // Método para copiar al portapapeles
    const copyTvdbId = async (tvdbId) => {
      try {
        await navigator.clipboard.writeText(tvdbId.toString())
        copiedId.value = tvdbId
        setTimeout(() => {
          if (copiedId.value === tvdbId) {
            copiedId.value = null
          }
        }, 2000) // Restablece el estado después de 2 segundos
      } catch (err) {
        console.error('Error al copiar al portapapeles:', err)
      }
    }

    return {
      activeTab,
      upcomingList,
      trendingList,
      updatedList,
      loading,
      getCardStyle,
      copyTvdbId
    }
  },
    template: `
        <div class="view-container">
        <!-- Cabecera y pestañas -->
        <div class="view-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
            <h2 style="margin: 0;">Descubrir</h2>
            <div class="discover-tabs" style="display: inline-flex; gap: 0.3rem; background-color: var(--surface); padding: 0.3rem; border-radius: 9999px; border: 1px solid var(--border);">
            <button 
                :class="['tab-btn', { active: activeTab === 'upcoming' }]"
                @click="activeTab = 'upcoming'"
                style="background: transparent; border: none; color: var(--text-muted); padding: 0.4rem 1rem; border-radius: 9999px; font-size: 0.85rem; font-weight: 600; cursor: pointer;"
            >
                Estrenos 🚀
            </button>
            <button 
                :class="['tab-btn', { active: activeTab === 'trending' }]"
                @click="activeTab = 'trending'"
                style="background: transparent; border: none; color: var(--text-muted); padding: 0.4rem 1rem; border-radius: 9999px; font-size: 0.85rem; font-weight: 600; cursor: pointer;"
            >
                Trending 🔥
            </button>
            <button 
                :class="['tab-btn', { active: activeTab === 'updated' }]"
                @click="activeTab = 'updated'"
                style="background: transparent; border: none; color: var(--text-muted); padding: 0.4rem 1rem; border-radius: 9999px; font-size: 0.85rem; font-weight: 600; cursor: pointer;"
            >
                Actualizadas 🆕
            </button>
            </div>
        </div>

        <div v-if="loading" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            <p>Cargando novedades...</p>
        </div>

        <!-- Listado de Próximos Estrenos -->
        <div v-else-if="activeTab === 'upcoming'" class="series-grid">
            <div v-for="serie in upcomingList" :key="serie.tvdb_id" class="serie-card" :style="getCardStyle(serie)">
            <div class="serie-card-body">
                <PosterThumb :serie="serie" />
                <div class="info">
                <h2>{{ serie.titulo }}</h2>
                <p class="progress" v-if="serie.first_aired">
                    📅 <strong>{{ serie.first_aired }}</strong>
                </p>
                <p class="next-air" v-if="serie.days_until_premiere !== null">
                    ⏳ {{ serie.days_until_premiere === 0 ? '¡Estreno hoy!' : 'Faltan ' + serie.days_until_premiere + ' días' }}
                </p>
                </div>
            </div>
            <div class="serie-card-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem;">
                <span class="badge" v-if="serie.score" style="font-size: 0.75rem; color: var(--text-muted);">⭐ {{ serie.score }}</span>
                <LinksFooter :serie="serie" />
                <!-- Botón para copiar TVDB ID -->
                <button 
                @click="copyTvdbId(serie.tvdb_id)" 
                class="details-btn" 
                type="button" 
                style="font-size: 0.75rem; padding: 0.2rem 0.5rem; cursor: pointer;"
                :title="'Copiar TVDB ID: ' + serie.tvdb_id"
                >
                {{ copiedId === serie.tvdb_id ? '¡Copiado! ✓' : 'ID: ' + serie.tvdb_id }}
                </button>
            </div>
            </div>
            <div v-if="upcomingList.length === 0" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            <p>No hay próximos estrenos registrados.</p>
            </div>
        </div>

        <!-- Listado de Trending -->
        <div v-else-if="activeTab === 'trending'" class="series-grid">
            <div v-for="(serie, index) in trendingList" :key="serie.tvdb_id" class="serie-card" :style="getCardStyle(serie)">
              <div class="serie-card-body">
                  <PosterThumb :serie="serie" />
                  <div class="info">
                  <h2>{{ serie.titulo }}</h2>
                  <p class="progress" v-if="serie.anio">
                      Año: <strong>{{ serie.anio }}</strong>
                  </p>
                  <p class="next-air" v-if="serie.score">
                      🔥 Score: <strong>{{ serie.score }}</strong>
                  </p>
                  </div>
              </div>
              <div class="serie-card-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem;">
                  <span class="badge" style="font-size: 0.75rem; font-weight: bold; background: #f59e0b; color: #000; padding: 0.1rem 0.4rem; border-radius: 4px;">#{{ index + 1 }} Trending</span>
                  <LinksFooter :serie="serie" />
                  <!-- Botón para copiar TVDB ID -->
                  <button 
                  @click="copyTvdbId(serie.tvdb_id)" 
                  class="details-btn" 
                  type="button" 
                  style="font-size: 0.75rem; padding: 0.2rem 0.5rem; cursor: pointer;"
                  :title="'Copiar TVDB ID: ' + serie.tvdb_id"
                  >
                  {{ copiedId === serie.tvdb_id ? '¡Copiado! ✓' : 'ID: ' + serie.tvdb_id }}
                  </button>
              </div>
            </div>
            <div v-if="trendingList.length === 0" style="text-align: center; padding: 3rem; color: var(--text-muted);">
              <p>No hay series en tendencia en este momento.</p>
            </div>
        </div>

        <!-- Listado de Actualizadas -->
        <div v-else-if="activeTab === 'updated'" class="series-grid">
            <div v-for="(serie, index) in updatedList" :key="serie.tvdb_id" class="serie-card" :style="getCardStyle(serie)">
              <div class="serie-card-body">
                  <PosterThumb :serie="serie" />
                  <div class="info">
                  <h2>{{ serie.titulo }}</h2>
                  <p class="progress" v-if="serie.anio">
                      Año: <strong>{{ serie.anio }}</strong>
                  </p>
                  </div>
              </div>
              <div class="serie-card-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem;">
                  <LinksFooter :serie="serie" />
                  <span class="next-air" v-if="serie.last_aired">
                      <strong>{{ serie.last_aired }}</strong>
                  </span>
                  <!-- Botón para copiar TVDB ID -->
                  <button 
                  @click="copyTvdbId(serie.tvdb_id)" 
                  class="details-btn" 
                  type="button" 
                  style="font-size: 0.75rem; padding: 0.2rem 0.5rem; cursor: pointer;"
                  :title="'Copiar TVDB ID: ' + serie.tvdb_id"
                  >
                  {{ copiedId === serie.tvdb_id ? '¡Copiado! ✓' : 'ID: ' + serie.tvdb_id }}
                  </button>
              </div>
            </div>
            <div v-if="updatedList.length === 0" style="text-align: center; padding: 3rem; color: var(--text-muted);">
              <p>No hay series actualizadas en este momento.</p>
            </div>
        </div>

        </div>
    `
}