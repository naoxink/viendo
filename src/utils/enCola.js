import { formatProximaFecha } from './format.js'

const ESTADOS_FINALES = ['Ended', 'Canceled']

/**
 * Secciones de "En cola", en el orden en que se muestran.
 * Cada serie cae en UNA sola (ver clasificarEnCola).
 */
export const SECCIONES_EN_COLA = [
    {
        key: 'proximamente',
        titulo: '📅 Próximamente',
        descripcion: 'Series con fecha de estreno confirmada.',
        abierta: true
    },
    {
        key: 'listas',
        titulo: '▶️ Listas para ver',
        descripcion: 'Ya hay capítulos emitidos esperándote.',
        abierta: true
    },
    {
        key: 'esperando',
        titulo: '⏳ Esperando nueva temporada',
        descripcion: 'Estás al día y aún no hay fecha de regreso.',
        abierta: false
    },
    {
        key: 'porEmpezar',
        titulo: '🆕 Por empezar',
        descripcion: 'Todavía no has visto ningún capítulo.',
        abierta: false
    },
    {
        key: 'terminadas',
        titulo: '🏁 Terminadas',
        descripcion: 'Series finalizadas: puedes verlas del tirón.',
        abierta: false
    }
]

const tieneFecha = (s) => Boolean(s.proxima_fecha) && s.proxima_fecha !== 'TBA'
const estaFinalizada = (s) => ESTADOS_FINALES.includes(s.estado_final)

/**
 * "Sin empezar" respeta tu convención: T1·E0 (o T1·E1 ya pendiente, que es lo
 * que devuelve calcularEstadoPendiente cuando el E1 ya se ha emitido).
 */
export function estaSinEmpezar(s) {
    const t = Number(s.temporada) || 1
    const c = Number(s.capitulo) || 0
    return t === 1 && (c === 0 || (Boolean(s.pendiente) && c === 1))
}

/** Devuelve la key de la sección a la que pertenece una serie en cola. */
export function clasificarEnCola(s) {
    const finalizada = estaFinalizada(s)

    // Con fecha futura y nada pendiente: lo siguiente que pasa es el estreno
    if (!s.pendiente && tieneFecha(s)) return 'proximamente'

    // Sin empezar: ver si es una serie cerrada (maratón) o una por empezar
    if (estaSinEmpezar(s)) return finalizada ? 'terminadas' : 'porEmpezar'

    // Empezada y con capítulos ya emitidos
    if (s.pendiente) return 'listas'

    // Empezada, al día y sin fecha
    return finalizada ? 'terminadas' : 'esperando'
}

const porTitulo = (a, b) =>
    (a.titulo || '').localeCompare(b.titulo || '', 'es', { sensitivity: 'base' })

const porFecha = (a, b) => a.proxima_fecha.localeCompare(b.proxima_fecha) || porTitulo(a, b)

/** Agrupa y ordena. Las secciones sin series no se devuelven. */
export function agruparEnCola(series = []) {
    const cubos = Object.fromEntries(SECCIONES_EN_COLA.map((s) => [s.key, []]))

    for (const serie of series) {
        cubos[clasificarEnCola(serie)].push(serie)
    }

    cubos.proximamente.sort(porFecha)
    for (const key of Object.keys(cubos)) {
        if (key !== 'proximamente') cubos[key].sort(porTitulo)
    }

    return SECCIONES_EN_COLA
        .map((seccion) => ({ ...seccion, series: cubos[seccion.key] }))
        .filter((seccion) => seccion.series.length > 0)
}

/** Línea de estado de la card (misma lógica que tenía EnColaCard). */
export function textoProgresoEnCola(s) {
    const t = Number(s.temporada) || 1
    const c = Number(s.capitulo) || 0
    const total = Number(s.capitulosPorTemporada?.[t]) || 0
    const pendiente = Boolean(s.pendiente)
    const hayFecha = tieneFecha(s)

    // Sin empezar
    if (t === 1 && (c === 0 || (pendiente && c === 1))) {
        return 'Por empezar • Temporada 1'
    }

    // Primer capítulo de una temporada nueva (T2+)
    if (t > 1 && (c === 0 || (pendiente && c === 1))) {
        if (pendiente) return `Temporada ${t - 1} completada • T${t} disponible`
        return hayFecha
            ? `Temporada ${t - 1} completada • Próxima: Temporada ${t}`
            : `Temporada ${t - 1} completada`
    }

    // Capítulos emitidos sin ver: temporada/capitulo = el que toca ver
    if (pendiente) return `Siguiente: T${t} • E${c}`

    // Al día y terminaste la temporada
    if (total > 0 && c >= total) {
        return hayFecha
            ? `Temporada ${t} completada • Próxima: Temporada ${t + 1}`
            : `Temporada ${t} completada`
    }

    // Empezada, a medias
    return `Vista hasta T${t} • E${c}`
}

/** { abs: '12.11.2026', rel: 'en 3 semanas' } — rel vacío si no aporta nada. */
export function fechaEnCola(fecha) {
    if (!fecha || fecha === 'TBA') return { abs: '', rel: '' }

    const abs = formatProximaFecha(fecha)
    const [y, m, d] = fecha.split('-').map(Number)
    if (!y || !m || !d) return { abs, rel: '' }

    // Fechas locales (no UTC) para no desfasar un día
    const hoy = new Date()
    const hoyTs = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()
    const dias = Math.round((new Date(y, m - 1, d).getTime() - hoyTs) / 86400000)

    let rel = ''
    if (dias === 0) rel = 'hoy'
    else if (dias === 1) rel = 'mañana'
    else if (dias > 1 && dias < 14) rel = `en ${dias} días`
    else if (dias >= 14 && dias <= 90) rel = `en ${Math.round(dias / 7)} semanas`
    else if (dias > 90) rel = `en ${Math.round(dias / 30)} meses`

    return { abs, rel }
}