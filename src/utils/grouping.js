/**
 * Agrupa las series completadas en 3 bloques según el año en que se vieron
 * (vistoEn, o año de estreno si no existe). Los grupos sin series no se
 * incluyen en el resultado (igual que el script original).
 */
export function groupHistorico(completadas, anoActual) {
    const grupos = [
        {
            key: 'recientes',
            titulo: `Recientes (${anoActual - 1}-${anoActual})`,
            filtro: (s) => (s.vistoEn || s.año) >= anoActual - 1,
            defaultOpen: false
        },
        {
            key: 'anteriores',
            titulo: `Anteriores (${anoActual - 6}-${anoActual - 2})`,
            filtro: (s) => (s.vistoEn || s.año) < anoActual - 1 && (s.vistoEn || s.año) >= anoActual - 6,
            defaultOpen: false
        },
        {
            key: 'archivo',
            titulo: `Archivo (Antes de ${anoActual - 6})`,
            filtro: (s) => (s.vistoEn || s.año) < anoActual - 6,
            defaultOpen: false
        }
    ]

    return grupos
        .map((g) => ({
            ...g,
            series: completadas
                .filter(g.filtro)
                .sort((a, b) => (b.vistoEn || b.año) - (a.vistoEn || a.año))
        }))
        .filter((g) => g.series.length > 0)
}
