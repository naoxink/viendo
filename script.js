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
        
        // Renderizar "Viendo actualmente"
        const currentContainer = document.getElementById('series-list');
        currentContainer.innerHTML = data.viendo.map(s => `
            <div class="serie-card">
                <div class="info">
                    <h2>${s.titulo}</h2>
                    <p class="progress">T${s.temporada} • E${s.capitulo}</p>
                </div>
                <a href="${s.link}" target="_blank" class="link-imdb">IMDb</a>
            </div>
        `).join('');

        const historyContainer = document.getElementById('history-list');
        historyContainer.innerHTML = data.completadas.map(s => {
            const colorClass = getNotaClass(s.nota); // Calculamos el color
            
            return `
                <div class="serie-card">
                    <div class="info">
                        <h2>${s.titulo} <span class="nota-tag ${colorClass}">${s.nota}</span></h2>
                        <p class="progress">Finalizada en ${s.año}</p>
                    </div>
                    <a href="${s.link}" target="_blank" class="link-imdb">Ficha</a>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error("Error:", error);
    }
}
loadSeries();

loadSeries();