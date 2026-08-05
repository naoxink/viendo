/**
 * Orden de "viendo actualmente":
 * 1) Pendientes primero
 * 2) Entre los no pendientes, los que tienen fecha de emisión ya pasada quedan
 *    al final del grupo "no pendiente" (para no tapar lo que aún está al día)
 * 3) El resto, por fecha de próximo episodio ascendente
 * 4) Sin fecha (o "TBA") siempre al final de su grupo
 */
export function sortViendo(lista) {
    const hoy = new Date()
    const todayTimestamp = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()

    return [...lista].sort((a, b) => {
        const pendienteA = a.pendiente === true ? 1 : 0
        const pendienteB = b.pendiente === true ? 1 : 0
        if (pendienteA !== pendienteB) return pendienteB - pendienteA

        const fechaA = a.proxima_fecha && a.proxima_fecha !== 'TBA' ? Date.parse(a.proxima_fecha) : -Infinity
        const fechaB = b.proxima_fecha && b.proxima_fecha !== 'TBA' ? Date.parse(b.proxima_fecha) : -Infinity

        const actualOPasadaA = pendienteA === 0 && fechaA !== -Infinity && fechaA <= todayTimestamp
        const actualOPasadaB = pendienteB === 0 && fechaB !== -Infinity && fechaB <= todayTimestamp
        if (actualOPasadaA !== actualOPasadaB) return actualOPasadaA ? 1 : -1

        if (fechaA === -Infinity && fechaB === -Infinity) return 0
        if (fechaA === -Infinity) return 1
        if (fechaB === -Infinity) return -1

        return fechaA - fechaB
    })
}
