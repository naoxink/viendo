/**
 * Formatea timestamps tipo "YYYY-MM-DD HH:mm:ss" (UTC) que llegan de status.json
 * al formato "dd.mm.YY H:i:s".
 */
export function formatearFecha(fechaStr) {
    if (!fechaStr) return '-'

    const d = new Date(fechaStr.replace(' ', 'T') + 'Z')
    if (isNaN(d.getTime())) return fechaStr

    const dia = String(d.getDate()).padStart(2, '0')
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    const año = String(d.getFullYear()).slice(-2)
    const horas = String(d.getHours()).padStart(2, '0')
    const minutos = String(d.getMinutes()).padStart(2, '0')
    const segundos = String(d.getSeconds()).padStart(2, '0')

    return `${dia}.${mes}.${año} ${horas}:${minutos}:${segundos}`
}

/** "2026-07-04" -> "04.07.2026" · "TBA" -> "Sin fecha" */
export function formatProximaFecha(fecha) {
    if (!fecha) return ''
    if (fecha === 'TBA') return 'Sin fecha'
    return fecha.split('-').reverse().join('.')
}

/** Clase de color según la nota (0-10) de una serie completada */
export function getNotaClass(notaString) {
    const nota = parseFloat(notaString)
    if (isNaN(nota)) return ''
    if (nota < 5) return 'bad'
    if (nota < 8) return 'medium'
    return 'good'
}

/** Objeto de estilo con la variable CSS --card-bg-image, o {} si no hay póster */
export function cardBgStyle(serie) {
    const src = serie.poster_path || serie.image_url
    return src ? { '--card-bg-image': `url('${src}')` } : {}
}
