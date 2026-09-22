const pad = (n) => String(n).padStart(2, '0')
const aTexto = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const MAX_DOTS = 4

export default {
  name: 'CalendarioEstrenos',
  props: {
    series: { type: [Array, Object], required: true, default: () => [] }
  },
  emits: ['select-serie'],
  data() {
    return {
      mostrarModal: false,
      fechaReferencia: new Date(),
      selectedDia: null,
      verVistos: false,
      touchStartX: null,
      diasSemana: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      nombresMeses: [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ]
    }
  },
  computed: {
    hoyTexto() { return aTexto(new Date()) },
    mesActual() { return this.fechaReferencia.getMonth() },
    añoActual() { return this.fechaReferencia.getFullYear() },
    nombreMesActual() { return this.nombresMeses[this.mesActual] },
    esMesActual() {
      const h = new Date()
      return h.getMonth() === this.mesActual && h.getFullYear() === this.añoActual
    },
    seriesFormateadas() {
      if (!this.series) return []
      if (Array.isArray(this.series)) return this.series
      if (typeof this.series === 'object') return Object.values(this.series)
      return []
    },

    /** { 'YYYY-MM-DD': [ { key, serie, eps, label, estado } ] } */
    eventosPorDia() {
      const mapa = {}
      const hoy = this.hoyTexto
      // Añadimos 'inicio' y 'fin' al objeto de orden si ordenas el mapa posteriormente
      const orden = { inicio: 0, fin: 1, pendiente: 2, futuro: 3, visto: 4 }

      for (const serie of this.seriesFormateadas) {
        if (!serie || !serie.titulo) continue

        const porFecha = this.episodiosPorFecha(serie)
        for (const [fecha, eps] of Object.entries(porFecha)) {
          eps.sort((a, b) => a.t - b.t || a.c - b.c)

          const todosVistos = eps.every((ep) => this.esVisto(serie, ep))

          // Si no queremos ver eventos vistos y todos están vistos, saltamos
          if (!this.verVistos && todosVistos) continue

          // 1. Calculamos el estado base habitual
          let estado = todosVistos ? 'visto' : (fecha <= hoy ? 'pendiente' : 'futuro')

          // 2. Comprobamos si es inicio o final de temporada
          const primero = eps[0]
          const ultimo = eps[eps.length - 1]
          const mapaTemporadas = serie && (serie.capitulosPorTemporada || serie.capitulos_por_temporada)
          const totalCaps = mapaTemporadas && mapaTemporadas[ultimo.t]

          const esInicio = Number(primero.c) === 1
          const esFinal = totalCaps && Number(ultimo.c) === Number(totalCaps)

          // 3. Asignamos 'inicio' o 'fin' según corresponda
          if (esFinal) {
            estado = 'fin'
          } else if (esInicio) {
            estado = 'inicio'
          }

          if (!mapa[fecha]) mapa[fecha] = []
          mapa[fecha].push({
            key: `${serie.id || serie.tvdb_id || serie.titulo}-${fecha}`,
            serie,
            eps,
            label: this.etiquetaEpisodios(eps, serie),
            estado
          })
        }
      }

      return mapa
    },

    paddingDias() {
      const dia = new Date(this.añoActual, this.mesActual, 1).getDay()
      return dia === 0 ? 6 : dia - 1
    },
    diasDelMes() {
      const total = new Date(this.añoActual, this.mesActual + 1, 0).getDate()
      const dias = []
      for (let i = 1; i <= total; i++) {
        const fechaTexto = `${this.añoActual}-${pad(this.mesActual + 1)}-${pad(i)}`
        dias.push({
          numero: i,
          fechaTexto,
          esHoy: fechaTexto === this.hoyTexto,
          eventos: this.eventosPorDia[fechaTexto] || []
        })
      }
      return dias
    },
    totalCapitulosMes() {
      return this.diasDelMes.reduce(
        (acc, d) => acc + d.eventos.reduce((s, e) => s + e.eps.length, 0), 0
      )
    },
    eventosSeleccionado() {
      return this.selectedDia ? (this.eventosPorDia[this.selectedDia] || []) : []
    },
    tituloSeleccionado() {
      if (!this.selectedDia) return ''
      const [y, m, d] = this.selectedDia.split('-').map(Number)
      const txt = new Date(y, m - 1, d).toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long'
      })
      return txt.charAt(0).toUpperCase() + txt.slice(1)
    }
  },
  methods: {
    /** Devuelve { fecha: [{t, c}] } para una serie */
    episodiosPorFecha(serie) {
      const resultado = {}
      const fechas = serie.fechas_episodios

      if (fechas && Object.keys(fechas).length > 0) {
        for (const [t, caps] of Object.entries(fechas)) {
          for (const [c, fecha] of Object.entries(caps || {})) {
            if (!fecha) continue
            if (!resultado[fecha]) resultado[fecha] = []
            resultado[fecha].push({ t: Number(t), c: Number(c) })
          }
        }
        return resultado
      }

      // Fallback: serie sin sincronizar, solo conocemos proxima_fecha
      if (serie.proxima_fecha && serie.proxima_fecha !== 'TBA') {
        resultado[serie.proxima_fecha] = [
          { t: Number(serie.temporada) || 1, c: (Number(serie.capitulo) || 0) + 1 }
        ]
      }
      return resultado
    },

    /** En el frontend, si la serie está "pendiente", temporada/capitulo = el capítulo POR VER */
    esVisto(serie, ep) {
      const T = Number(serie.temporada) || 1
      const C = Number(serie.capitulo) || 0
      const cmp = ep.t !== T ? ep.t - T : ep.c - C
      return serie.pendiente ? cmp < 0 : cmp <= 0
    },

    etiquetaEpisodios(eps, serie) {
      if (!eps || !eps.length) return ''

      const primero = eps[0]
      const ultimo = eps[eps.length - 1]

      const mapaTemporadas = serie && (serie.capitulosPorTemporada || serie.capitulos_por_temporada)
      const totalCaps = mapaTemporadas && mapaTemporadas[ultimo.t]

      // Detectamos si es estreno de temporada (E1) y/o final de temporada
      const esInicio = Number(primero.c) === 1
      const esFinal = totalCaps && Number(ultimo.c) === Number(totalCaps)

      // Asignación de emojis (puedes cambiar las variables por los que prefieras)
      const emojiInicio = esInicio ? '🚀' : ''
      const emojiFinal = esFinal ? '🏁' : ''
      
      // Si coinciden en el mismo día (ej. temporada de 1 solo capítulo), mostrará ambos
      const sufijo = (emojiInicio || emojiFinal) ? ` ${emojiInicio}${emojiFinal}` : ''

      if (eps.length === 1) {
        return `T${primero.t}·E${primero.c}${sufijo}`
      }

      if (primero.t === ultimo.t) {
        return `T${primero.t}·E${primero.c}–${ultimo.c}${sufijo}`
      }

      return `T${primero.t}·E${primero.c} – T${ultimo.t}·E${ultimo.c}${sufijo}`
    },

    abrirCalendario() {
      this.fechaReferencia = new Date()
      this.selectedDia = this.hoyTexto
      this.mostrarModal = true
      document.body.style.overflow = 'hidden'
    },
    cerrarCalendario() {
      this.mostrarModal = false
      document.body.style.overflow = ''
    },
    mesAnterior() { this.fechaReferencia = new Date(this.añoActual, this.mesActual - 1, 1) },
    mesSiguiente() { this.fechaReferencia = new Date(this.añoActual, this.mesActual + 1, 1) },
    irAHoy() {
      this.fechaReferencia = new Date()
      this.selectedDia = this.hoyTexto
    },
    seleccionarDia(dia) {
      this.selectedDia = dia.fechaTexto
    },
    abrirSerie(serie) {
      this.$emit('select-serie', serie)
      this.cerrarCalendario()
    },
    onTouchStart(e) { this.touchStartX = e.changedTouches[0].clientX },
    onTouchEnd(e) {
      if (this.touchStartX === null) return
      const delta = e.changedTouches[0].clientX - this.touchStartX
      this.touchStartX = null
      if (Math.abs(delta) < 60) return
      delta < 0 ? this.mesSiguiente() : this.mesAnterior()
    },
    textoEstado(estado) {
      return { pendiente: 'Pendiente', futuro: 'Próximo', visto: 'Visto', fin: 'Final de temporada', inicio: 'Inicio de temporada' }[estado]
    },
    dotsVisibles(eventos) { return eventos.slice(0, MAX_DOTS) },
    dotsRestantes(eventos) { return Math.max(0, eventos.length - MAX_DOTS) },
    onKeydown(e) {
      if (e.key === 'Escape') this.cerrarCalendario()
    },
    abrirCalendario() {
      this.fechaReferencia = new Date()
      this.selectedDia = this.hoyTexto
      this.mostrarModal = true
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', this.onKeydown)
    },
    cerrarCalendario() {
      this.mostrarModal = false
      document.body.style.overflow = ''
      window.removeEventListener('keydown', this.onKeydown)
    }
  },
  beforeUnmount() {
    document.body.style.overflow = ''
    window.removeEventListener('keydown', this.onKeydown)
  },
    template: `
    <div class="calendario-wrapper">
      <div v-if="mostrarModal" class="cal-modal-overlay" @click.self="cerrarCalendario">
        <div class="cal-modal-content" role="dialog" aria-modal="true" aria-label="Calendario de estrenos">

          <button @click="cerrarCalendario" class="cal-modal-close" aria-label="Cerrar calendario">&times;</button>

          <div class="calendario-container" @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">

            <div class="calendario-header">
              <button @click="mesAnterior" class="btn-nav" aria-label="Mes anterior">&lsaquo;</button>
              <div class="cal-titulo">
                <h2>{{ nombreMesActual }} {{ añoActual }}</h2>
                <small class="cal-resumen">{{ totalCapitulosMes }} capítulos este mes</small>
              </div>
              <button @click="mesSiguiente" class="btn-nav" aria-label="Mes siguiente">&rsaquo;</button>
            </div>

            <div class="cal-toolbar">
              <button v-if="!esMesActual || selectedDia !== hoyTexto" @click="irAHoy" class="btn-nav btn-nav-ghost">Hoy</button>
              <label class="cal-toggle">
                <input type="checkbox" v-model="verVistos">
                Mostrar vistos
              </label>
              <div class="cal-leyenda">
                <span><i class="dot estado-pendiente"></i>Pendiente</span>
                <span><i class="dot estado-futuro"></i>Próximo</span>
                <span><i class="dot estado-visto"></i>Visto</span>
              </div>
            </div>

            <div class="dias-semana-grid">
              <div v-for="dia in diasSemana" :key="dia" class="dia-semana-label">{{ dia }}</div>
            </div>

            <div class="calendario-grid">
              <div v-for="p in paddingDias" :key="'pad-' + p" class="dia-calendario vacio"></div>

              <div
                v-for="dia in diasDelMes"
                :key="dia.fechaTexto"
                class="dia-calendario"
                :class="{
                  'hoy': dia.esHoy,
                  'tiene-estrenos': dia.eventos.length,
                  'seleccionado': dia.fechaTexto === selectedDia
                }"
                @click="seleccionarDia(dia)"
              >
                <span class="numero-dia">{{ dia.numero }}</span>

                <!-- Escritorio: chips -->
                <div v-if="dia.eventos.length" class="lista-estrenos">
                  <div
                    v-for="ev in dia.eventos"
                    :key="ev.key"
                    class="chip-estreno"
                    :class="'estado-' + ev.estado"
                    :title="ev.serie.titulo + ' · ' + ev.label"
                  >
                    <span class="chip-text">{{ ev.serie.titulo }}
                      <br>
                      <b>{{ ev.label }}</b>
                    </span>
                  </div>
                </div>

                <!-- Móvil: puntos -->
                <div v-if="dia.eventos.length" class="dot-list">
                  <i v-for="ev in dotsVisibles(dia.eventos)" :key="ev.key" class="dot" :class="'estado-' + ev.estado"></i>
                  <small v-if="dotsRestantes(dia.eventos)">+{{ dotsRestantes(dia.eventos) }}</small>
                </div>
              </div>
            </div>

            <!-- Detalle del día seleccionado -->
            <div class="cal-detalle" v-if="selectedDia">
              <h3>{{ tituloSeleccionado }}</h3>
              <p v-if="!eventosSeleccionado.length" class="cal-detalle-vacio">Sin estrenos este día.</p>
              <ul v-else class="cal-detalle-lista">
                <li v-for="ev in eventosSeleccionado" :key="ev.key" @click="abrirSerie(ev.serie)">
                  <i class="dot" :class="'estado-' + ev.estado"></i>
                  <span class="cal-detalle-titulo">{{ ev.serie.titulo }}</span>
                  <span class="cal-detalle-ep">{{ ev.label }}</span>
                  <span class="cal-detalle-estado" :class="'estado-' + ev.estado">{{ textoEstado(ev.estado) }}</span>
                </li>
              </ul>
            </div>

          </div>
        </div>
      </div>
    </div>
  `
}