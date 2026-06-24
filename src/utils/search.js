/**
 * El script original buscaba con `card.innerText.toLowerCase().includes(term)`,
 * es decir, sobre TODO el texto visible de la tarjeta (título, nota, año...),
 * leyendo directamente el DOM ya pintado. Aquí replicamos ese mismo
 * comportamiento (busca por título, nota, año y temporada/episodio) pero de
 * forma explícita sobre los datos, sin depender del HTML renderizado: así
 * sigue funcionando aunque cambie el markup de la tarjeta en el futuro.
 */
export function matchesSearch(serie, term) {
    const texto = [
        serie.titulo,
        serie.nota,
        serie.año,
        serie.vistoEn,
        serie.temporada != null ? `T${serie.temporada}` : '',
        serie.capitulo != null ? `E${serie.capitulo}` : ''
    ]
        .filter((v) => v !== undefined && v !== null && v !== '')
        .join(' ')
        .toLowerCase()

    return texto.includes(term)
}
