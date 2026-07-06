import { computed } from 'vue'
import StatBarList from './shared/StatBarList.js'
import { parseNota, getNotaClass, formatProximaFecha } from '../utils/format.js'

/** A partir de un objeto { clave: cantidad }, genera filas listas para StatBarList */
function construirBarras(cuentas, formatearEtiqueta) {
    const claves = Object.keys(cuentas).sort((a, b) => Number(a) - Number(b))
    const max = Math.max(...claves.map((k) => cuentas[k]), 1)
    return claves.map((clave) => ({
        etiqueta: formatearEtiqueta ? formatearEtiqueta(clave) : clave,
        cantidad: cuentas[clave],
        pct: Math.round((cuentas[clave] / max) * 100)
    }))
}

export default {
    name: 'StatsPanel',
    components: { StatBarList },
    props: {
        viendo: { type: Array, default: () => [] },
        enCola: { type: Array, default: () => [] },
        dropeadas: { type: Array, default: () => [] },
        completadas: { type: Array, default: () => [] },
        anoActual: { type: Number, required: true }
    },
    methods: {
        getNotaClass(nota) {
            return getNotaClass(nota)
        }
    },
    setup(props) {
        const todas = computed(() => [
            ...props.viendo,
            ...props.enCola,
            ...props.dropeadas,
            ...props.completadas
        ])

        const conNota = computed(() =>
            todas.value
                .map((s) => ({ ...s, notaNum: parseNota(s.nota), notaClase: getNotaClass(s.nota) }))
                .filter((s) => s.notaNum !== null)
        )

        // --- Resumen ---
        const totalTrackeadas = computed(() => todas.value.length)

        const tasaAbandono = computed(() => {
            const total = props.completadas.length + props.dropeadas.length
            if (total === 0) return 0
            return Math.round((props.dropeadas.length / total) * 1000) / 10
        })

        const notaMedia = computed(() => {
            if (conNota.value.length === 0) return null
            const suma = conNota.value.reduce((acc, s) => acc + s.notaNum, 0)
            return Math.round((suma / conNota.value.length) * 10) / 10
        })

        const totalRevisitas = computed(() =>
            todas.value.reduce((acc, s) => acc + (s.rewatch ? (s.veces || 0) : 0), 0)
        )

        const totalAcumulados = computed(() =>
            props.viendo.reduce((acc, s) => acc + (s.acumulados || 0), 0)
        )

        // --- Notas ---
        const mejorValoradas = computed(() =>
            [...conNota.value].sort((a, b) => b.notaNum - a.notaNum).slice(0, 5)
        )

        const peorValoradas = computed(() =>
            [...conNota.value].sort((a, b) => a.notaNum - b.notaNum).slice(0, 5)
        )

        const distribucionNotas = computed(() => {
            const cuentas = {}
            for (let i = 0; i <= 10; i++) cuentas[i] = 0
            conNota.value.forEach((s) => {
                const redondeada = Math.min(10, Math.max(0, Math.round(s.notaNum)))
                cuentas[redondeada] += 1
            })
            return construirBarras(cuentas)
        })

        // --- Completadas por año visto ---
        const completadasPorAno = computed(() => {
            const cuentas = {}
            props.completadas.forEach((s) => {
                if (!s.vistoEn) return
                cuentas[s.vistoEn] = (cuentas[s.vistoEn] || 0) + 1
            })
            return construirBarras(cuentas)
        })

        // --- Décadas de estreno (de todo lo trackeado) ---
        const decadas = computed(() => {
            const cuentas = {}
            todas.value.forEach((s) => {
                if (!s.año) return
                const decada = Math.floor(s.año / 10) * 10
                cuentas[decada] = (cuentas[decada] || 0) + 1
            })
            return construirBarras(cuentas, (v) => `${v}s`)
        })

        // --- Rewatches ---
        const masRevisitadas = computed(() =>
            todas.value
                .filter((s) => s.veces && s.veces > 0)
                .sort((a, b) => b.veces - a.veces)
                .slice(0, 5)
        )

        const notaMediaRewatch = computed(() => {
            const lista = conNota.value.filter((s) => s.rewatch)
            if (lista.length === 0) return null
            return Math.round((lista.reduce((acc, s) => acc + s.notaNum, 0) / lista.length) * 10) / 10
        })

        const notaMediaPrimeraVez = computed(() => {
            const lista = conNota.value.filter((s) => !s.rewatch)
            if (lista.length === 0) return null
            return Math.round((lista.reduce((acc, s) => acc + s.notaNum, 0) / lista.length) * 10) / 10
        })

        // --- Backlog (episodios acumulados sin ver) ---
        const masAtrasadas = computed(() =>
            props.viendo
                .filter((s) => s.acumulados && s.acumulados > 0)
                .sort((a, b) => b.acumulados - a.acumulados)
                .slice(0, 5)
        )

        // --- Próximos estrenos ---
        const proximosEstrenos = computed(() =>
            [...props.viendo, ...props.enCola]
                .filter((s) => s.proximaFecha && s.proximaFecha !== 'TBA')
                .map((s) => ({
                    ...s,
                    fechaTexto: formatProximaFecha(s.proximaFecha),
                    fechaTs: Date.parse(s.proximaFecha)
                }))
                .filter((s) => !isNaN(s.fechaTs))
                .sort((a, b) => a.fechaTs - b.fechaTs)
                .slice(0, 5)
        )

        return {
            totalTrackeadas, tasaAbandono, notaMedia, totalRevisitas, totalAcumulados,
            mejorValoradas, peorValoradas, distribucionNotas,
            completadasPorAno, decadas,
            masRevisitadas, notaMediaRewatch, notaMediaPrimeraVez,
            masAtrasadas, proximosEstrenos
        }
    },
    template: `
        <span class="stats-section-title">{{ totalTrackeadas }} series</span>
        <div class="stats-panel-content">

            <div class="stats-kpi-grid">
                <div class="stats-kpi">
                    <span class="stats-kpi-value">{{ notaMedia ?? '—' }}</span>
                    <span class="stats-kpi-label">Nota media</span>
                </div>
                <div class="stats-kpi">
                    <span class="stats-kpi-value">{{ tasaAbandono }}%</span>
                    <span class="stats-kpi-label">Tasa de abandono</span>
                </div>
                <div class="stats-kpi">
                    <span class="stats-kpi-value">{{ totalRevisitas }}</span>
                    <span class="stats-kpi-label">Capítulos en rewatch</span>
                </div>
                <div class="stats-kpi">
                    <span class="stats-kpi-value">{{ totalAcumulados }}</span>
                    <span class="stats-kpi-label">Episodios acumulados</span>
                </div>
            </div>

            <div class="stats-section" v-if="distribucionNotas.length">
                <h3 class="stats-section-title">Distribución de notas</h3>
                <StatBarList :items="distribucionNotas" />
            </div>

            <div class="stats-section">
                <div v-if="mejorValoradas.length">
                    <h3 class="stats-section-title">Mejor valoradas</h3>
                    <ol class="stats-rank-list">
                        <li v-for="s in mejorValoradas" :key="s.titulo">
                            <span class="stats-rank-inner">
                                <span class="stats-rank-title">{{ s.titulo }}</span>
                                <span class="stats-rank-leader"></span>
                            </span>
                            <span class="nota-tag" :class="s.notaClase">{{ s.nota }}</span>
                        </li>
                    </ol>
                </div>
            </div>

            <div class="stats-section" v-if="peorValoradas.length">
                <h3 class="stats-section-title">Peor valoradas</h3>
                <ol class="stats-rank-list">
                    <li v-for="s in peorValoradas" :key="s.titulo">
                        <span class="stats-rank-inner">
                            <span class="stats-rank-title">{{ s.titulo }}</span>
                            <span class="stats-rank-leader"></span>
                        </span>
                        <span class="nota-tag" :class="s.notaClase">{{ s.nota }}</span>
                    </li>
                </ol>
            </div>

            <div class="stats-section" v-if="completadasPorAno.length">
                <h3 class="stats-section-title">Completadas por año</h3>
                <StatBarList :items="completadasPorAno" />
            </div>

            <div class="stats-section" v-if="decadas.length">
                <h3 class="stats-section-title">Por década de estreno</h3>
                <StatBarList :items="decadas" />
            </div>

            <div class="stats-section" v-if="masRevisitadas.length">
                <div>
                    <h3 class="stats-section-title">Más revisitadas</h3>
                    <ol class="stats-rank-list">
                        <li v-for="s in masRevisitadas" :key="s.titulo">
                            {{ s.titulo }} <span class="badge-rewatch">x{{ s.veces }}</span>
                        </li>
                    </ol>
                </div>
            </div>

            <div class="stats-section">
                <h3 class="stats-section-title">Rewatch vs. primera vez</h3>
                <ul class="stats-rank-list">
                    <li>
                        <span class="stats-rank-inner">
                            <span class="stats-rank-title">Nota media rewatch</span>
                            <span class="stats-rank-leader"></span>
                        </span>
                        <span class="nota-tag" :class="getNotaClass(notaMediaRewatch)">{{ notaMediaRewatch ?? '—' }}</span>
                    </li>
                    <li>
                        <span class="stats-rank-inner">
                            <span class="stats-rank-title">Nota media 1ª vez</span>
                            <span class="stats-rank-leader"></span>
                        </span>
                        <span class="nota-tag" :class="getNotaClass(notaMediaPrimeraVez)">{{ notaMediaPrimeraVez ?? '—' }}</span>
                    </li>
                </ul>
            </div>

            <div class="stats-section">
                <div v-if="proximosEstrenos.length">
                    <h3 class="stats-section-title">Próximos estrenos</h3>
                    <ol class="stats-rank-list">
                        <li v-for="s in proximosEstrenos" :key="s.titulo">
                            <span class="stats-rank-inner">
                                <span class="stats-rank-title">{{ s.titulo }}</span>
                                <span class="stats-rank-leader"></span>
                            </span>
                            <span class="next-air">{{ s.fechaTexto }}</span>
                        </li>
                    </ol>
                </div>
            </div>

            <div class="stats-section">
                <div v-if="masAtrasadas.length">
                    <h3 class="stats-section-title">Episodios por ver</h3>
                    <ol class="stats-rank-list">
                        <li v-for="s in masAtrasadas" :key="s.titulo">
                            {{ s.titulo }} <span class="badge-warning">{{ s.acumulados }} ep.</span>
                        </li>
                    </ol>
                </div>
            </div>

        </div>
    `
}
