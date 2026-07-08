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

/** Convierte "8.5/10" en 8.5 (o null si la serie no tiene nota) */
export function parseNota(notaString) {
    const nota = parseFloat(notaString)
    return isNaN(nota) ? null : nota
}

/** Clase de color según la nota (0-10) de una serie completada */
export function getNotaClass(notaString) {
    const nota = parseNota(notaString)
    if (nota === null) return ''
    if (nota < 5) return 'bad'
    if (nota < 8) return 'medium'
    return 'good'
}

/** Objeto de estilo con la variable CSS --card-bg-image, o {} si no hay póster */
export function cardBgStyle(serie) {
    const src = serie.poster_path || serie.image_url
    return src ? { '--card-bg-image': `url('${src}')` } : {}
}

export const formatNumero = (num) => {
    // Convertimos a string, quitamos decimales si los hay, y aplicamos el regex
    const numeroComoString = Math.floor(Number(num) || 0).toString();
    
    // El regex busca grupos de 3 dígitos y les añade un punto
    return numeroComoString.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export const formatDuracion = (totalMinutos) => {
    if (!totalMinutos || totalMinutos <= 0) return '0 minutos';

    const minutos = Math.floor(totalMinutos);
    
    const unMinuto = 1;
    const unaHora = 60;
    const unDia = 24 * unaHora;
    const unaSemana = 7 * unDia;
    const unMes = 30 * unDia;
    const unAnio = 365 * unDia;

    const anios = Math.floor(minutos / unAnio);
    const meses = Math.floor((minutos % unAnio) / unMes);
    const semanas = Math.floor(((minutos % unAnio) % unMes) / unaSemana);
    const dias = Math.floor((((minutos % unAnio) % unMes) % unaSemana) / unDia);
    const horas = Math.floor(((((minutos % unAnio) % unMes) % unaSemana) % unDia) / unaHora);
    const mins = (((((minutos % unAnio) % unMes) % unaSemana) % unDia) % unaHora);

    // Creamos un array con las partes que tengan valor
    const partes = [];
    if (anios > 0) partes.push(`${anios} año${anios > 1 ? 's' : ''}`);
    if (meses > 0) partes.push(`${meses} mes${meses > 1 ? 'es' : ''}`);
    if (semanas > 0) partes.push(`${semanas} semana${semanas > 1 ? 's' : ''}`);
    if (dias > 0) partes.push(`${dias} día${dias > 1 ? 's' : ''}`);
    if (horas > 0) partes.push(`${horas} hora${horas > 1 ? 's' : ''}`);
    if (mins > 0) partes.push(`${mins} minuto${mins > 1 ? 's' : ''}`);

    return partes.join(', ');
};
