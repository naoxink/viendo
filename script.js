// Placeholder Base64 Indestructible (Mini-cuadrado gris)
const placeholderBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAYAAAACCAYAAAB7Xa1eAAAAAXNSR0IArs4c6QAAABJJREFUGFdjZEADjIxgms0QAABYpAEB9B9S9AAAAABJRU5ErkJggg==";

async function loadSeries() {
    try {
        const response = await fetch('data.json');
        const series = await response.json();
        const container = document.getElementById('series-list');

        container.innerHTML = series.map(s => `
            <div class="serie-card">
                <img src="${s.poster}" 
                     alt="${s.titulo}" 
                     class="serie-poster"
                     onerror="this.onerror=null; this.src='${placeholderBase64}';">
                <div class="serie-content">
                    <div class="info">
                        <h2>${s.titulo}</h2>
                        <p class="progress">T${s.temporada} • E${s.capitulo}</p>
                    </div>
                    <a href="${s.link}" target="_blank" class="link-imdb">Ficha ↗</a>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error("Error cargando el JSON:", error);
    }
}

loadSeries();