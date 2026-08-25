/** Puerto directo del cálculo Python: sin red, solo mirando fechas guardadas. */
export function calcularEstadoPendiente(fechasEpisodios, temporadaActual, capituloActual, hoy = new Date()) {
    temporadaActual = temporadaActual || 1
    capituloActual = capituloActual || 0

    const hoyTs = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()

    const entradas = []
    for (const [t, caps] of Object.entries(fechasEpisodios || {})) {
        for (const [c, fecha] of Object.entries(caps || {})) {
            entradas.push({ t: Number(t), c: Number(c), fecha })
        }
    }
    entradas.sort((a, b) => a.t - b.t || a.c - b.c)

    const posteriores = entradas.filter(e => e.t > temporadaActual || (e.t === temporadaActual && e.c > capituloActual))

    const emitido = (e) => e.fecha && Date.parse(e.fecha) <= hoyTs

    const emitidos = posteriores.filter(emitido)
    const futuros = posteriores.filter(e => e.fecha && !emitido(e)).sort((a, b) => a.fecha.localeCompare(b.fecha))

    if (emitidos.length > 0) {
        const [siguiente] = emitidos
        return {
            temporada: siguiente.t,
            capitulo: siguiente.c,
            pendiente: true,
            acumulados: emitidos.length - 1,
            proxima_fecha: null
        }
    }

    return {
        temporada: temporadaActual,
        capitulo: capituloActual,
        pendiente: false,
        acumulados: 0,
        proxima_fecha: futuros[0]?.fecha ?? null
    }
}