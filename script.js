async function loadSeries() {
    try {
        const response = await fetch('data.json');
        const series = await response.json();
        const container = document.getElementById('series-list');

        container.innerHTML = series.map(s => `
            <div class="serie-card">
                <div class="info">
                    <h2>${s.titulo}</h2>
                    <p class="progress">Temporada ${s.temporada}, Episodio ${s.capitulo}</p>
                </div>
                <a href="${s.link}" target="_blank" class="link-imdb">IMDb</a>
            </div>
        `).join('');
    } catch (error) {
        console.error("Error cargando la lista:", error);
    }
}

loadSeries();