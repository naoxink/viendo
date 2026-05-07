// Función para determinar el color según la nota
function getNotaClass(notaString) {
    const nota = parseFloat(notaString);
    if (isNaN(nota)) return ''; 
    if (nota < 5) return 'bad';
    if (nota < 8) return 'medium';
    return 'good';
}

async function loadSeries() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();
        
        const viendoOrdenadas = data.viendo.sort((a, b) => {
            // Si b es true (1) y a es false (0), el resultado es positivo y b sube.
            return (b.pendiente === true) - (a.pendiente === true);
        });

        // Renderizar "Viendo actualmente"
        const currentContainer = document.getElementById('series-list');
        currentContainer.innerHTML = viendoOrdenadas.map(s => `
            <div class="serie-card">
                <div class="info">
                    <h2>
                        ${s.titulo}
                        <span class="año-label">(${s.año})</span>
                    </h2>
                    <p class="progress">T${s.temporada} • E${s.capitulo} ${s.pendiente ? `<span class="badge-pendiente">Pendiente</span>` : `<span class="badge-visto">Visto</span>`}</p>
                </div>
                <a href="${s.link}" target="_blank" class="link-imdb">IMDb</a>
            </div>
        `).join('');

        const completadasOrdenadas = data.completadas.sort((a, b) => {
            return b.año - a.año; // Orden descendente numérico
        });

        const historyContainer = document.getElementById('history-list');
        historyContainer.innerHTML = completadasOrdenadas.map(s => {
            const colorClass = getNotaClass(s.nota); // Calculamos el color
            
            return `
                <div class="serie-card">
                    <div class="info">
                        <h2>${s.titulo} <span class="nota-tag ${colorClass}">${s.nota}</span></h2>
                        <p class="progress">Estrenada el ${s.año}</p>
                    </div>
                    <a href="${s.link}" target="_blank" class="link-imdb">IMDb</a>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error("Error:", error);
    }
}
loadSeries();

loadSeries();