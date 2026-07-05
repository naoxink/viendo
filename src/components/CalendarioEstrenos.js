export default {
  name: 'CalendarioEstrenos',
  props: {
    series: {
      type: [Array, Object],
      required: true,
      default: () => []
    }
  },
  data() {
    return {
      mostrarModal: false, // Controla la visibilidad del modal
      fechaReferencia: new Date(),
      diasSemana: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      nombresMeses: [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ]
    };
  },
  computed: {
    mesActual() { return this.fechaReferencia.getMonth(); },
    añoActual() { return this.fechaReferencia.getFullYear(); },
    nombreMesActual() { return this.nombresMeses[this.mesActual]; },
    seriesFormateadas() {
      if (!this.series) return [];
      if (Array.isArray(this.series)) return this.series;
      if (typeof this.series === 'object') return Object.values(this.series);
      return [];
    },
    estrenosPorDia() {
      const mapa = {};
      this.seriesFormateadas.forEach(serie => {
        if (serie && serie.proximaFecha) {
          const fechaKey = String(serie.proximaFecha).trim(); 
          if (!mapa[fechaKey]) mapa[fechaKey] = [];
          mapa[fechaKey].push(serie);
        }
      });
      return mapa;
    },
    paddingDias() {
      const primerDiaMes = new Date(this.añoActual, this.mesActual, 1);
      const diaSemana = primerDiaMes.getDay();
      return diaSemana === 0 ? 6 : diaSemana - 1;
    },
    diasDelMes() {
      const dias = [];
      const totalDias = new Date(this.añoActual, this.mesActual + 1, 0).getDate();
      const hoy = new Date();

      for (let i = 1; i <= totalDias; i++) {
        const diaStr = String(i).padStart(2, '0');
        const mesStr = String(this.mesActual + 1).padStart(2, '0');
        const fechaTexto = `${this.añoActual}-${mesStr}-${diaStr}`;
        const esHoy = hoy.getDate() === i && hoy.getMonth() === this.mesActual && hoy.getFullYear() === this.añoActual;

        dias.push({ numero: i, fechaTexto: fechaTexto, esHoy });
      }
      return dias;
    }
  },
  methods: {
    abrirCalendario() {
      this.mostrarModal = true;
      document.body.style.overflow = 'hidden'; // Evita el scroll del fondo
    },
    cerrarCalendario() {
      this.mostrarModal = false;
      document.body.style.overflow = ''; // Restaura el scroll
    },
    mesAnterior() { this.fechaReferencia = new Date(this.añoActual, this.mesActual - 1, 1); },
    mesSiguiente() { this.fechaReferencia = new Date(this.añoActual, this.mesActual + 1, 1); },
    clasePorEstado(serie) {
      if (serie.capitulo === 1) return 'estado-por-empezar'; 
      else return 'estado-viendo';
    }
  },
  template: `
    <div class="calendario-wrapper">
      <button @click="abrirCalendario" class="btn-trigger-calendario">
        📅 Ver Calendario de Estrenos
      </button>

      <div v-if="mostrarModal" class="cal-modal-overlay" @click.self="cerrarCalendario">
        <div class="cal-modal-content">
          
          <button @click="cerrarCalendario" class="cal-modal-close" aria-label="Cerrar modal">&times;</button>
          
          <div class="calendario-container">
            <div class="calendario-header">
              <button @click="mesAnterior" class="btn-nav">&lt; Anterior</button>
              <h2>{{ nombreMesActual }} {{ añoActual }}</h2>
              <button @click="mesSiguiente" class="btn-nav">Siguiente &gt;</button>
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
                :class="{ 'hoy': dia.esHoy, 'tiene-estrenos': estrenosPorDia[dia.fechaTexto] }"
              >
                <span class="numero-dia">{{ dia.numero }}</span>

                <div v-if="estrenosPorDia[dia.fechaTexto]" class="lista-estrenos">
                  <div
                    v-for="serie in estrenosPorDia[dia.fechaTexto]"
                    :key="serie.nombre || serie.titulo || serie.title"
                    class="chip-estreno"
                    :class="clasePorEstado(serie)"
                    :title="serie.nombre || serie.titulo || 'Serie'"
                  >
                    <span class="chip-text">📺 {{ serie.nombre || serie.titulo || serie.title }}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `
};