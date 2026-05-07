// 1. EL LISTENER (Fuera de la carga de datos, se ejecuta una sola vez)
document.getElementById('history-search').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const sections = document.querySelectorAll('.año-section');

    sections.forEach((section, index) => {
        const cards = section.querySelectorAll('.serie-card');
        let coincidenciasEnSeccion = 0;

        cards.forEach(card => {
            const infoTotal = card.innerText.toLowerCase();
            
            if (infoTotal.includes(term)) {
                card.style.display = 'flex';
                coincidenciasEnSeccion++;
            } else {
                card.style.display = 'none';
            }
        });

        // 1. Decidir si mostrar la sección
        section.style.display = coincidenciasEnSeccion > 0 ? 'block' : 'none';
        
        // 2. Lógica de apertura/cierre inteligente
        if (term.length > 0) {
            // Si hay búsqueda, abrimos si hay resultados
            if (coincidenciasEnSeccion > 0) section.open = true;
        } else {
            // SI EL INPUT ESTÁ VACÍO: Restablecemos el estado original
            // El primer bloque (Recientes) es el index 0
            section.open = (index === 0);
            // Aseguramos que todas las secciones vuelvan a ser visibles
            section.style.display = 'block';
        }
    });
});

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
        const añoActual = new Date().getFullYear();
        
        // --- CÁLCULO DE ESTADÍSTICAS ---
        const enCurso = data.viendo.length;
        const pendientes = data.viendo.filter(s => s.pendiente).length;
        const terminadasEsteAño = data.completadas.filter(s => s.año === añoActual).length;

        const statsContainer = document.getElementById('stats');
        statsContainer.innerHTML = `
            <div class="stat-item">🍿 <b>${enCurso}</b> en curso</div>
            ${pendientes > 0 ? `<div class="stat-item">🔔 <b>${pendientes}</b> por ver</div>` : ''}
            <div class="stat-item">🏆 <b>${terminadasEsteAño}</b> finalizadas en ${añoActual}</div>
        `;

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

        // --- LÓGICA DE HISTÓRICO DINÁMICO ---
        
        // Definimos los tres grupos
        const grupos = [
            { 
                titulo: `Recientes (${añoActual - 1}-${añoActual})`, 
                filtro: (s) => s.año >= añoActual - 1,
                open: true 
            },
            { 
                titulo: `Anteriores (${añoActual - 6}-${añoActual - 2})`, 
                filtro: (s) => s.año < añoActual - 1 && s.año >= añoActual - 6,
                open: false 
            },
            { 
                titulo: `Archivo (Antes de ${añoActual - 6})`, 
                filtro: (s) => s.año < añoActual - 6,
                open: false 
            }
        ];

        const historyContainer = document.getElementById('history-list');
        historyContainer.innerHTML = grupos.map(grupo => {
            // Filtramos las series que pertenecen a este rango
            const seriesEnGrupo = data.completadas
                .filter(grupo.filtro)
                .sort((a, b) => b.año - a.año); // Ordenar por año dentro del grupo

            if (seriesEnGrupo.length === 0) return ''; // No mostrar grupo si está vacío

            return `
                <details class="año-section" ${grupo.open ? 'open' : ''}>
                    <summary>
                        ${grupo.titulo} 
                        <span class="count">${seriesEnGrupo.length} series</span>
                    </summary>
                    <div class="año-content">
                        ${seriesEnGrupo.map(s => `
                            <div class="serie-card">
                                <div class="info">
                                    <h2>${s.titulo} <span class="nota-tag ${getNotaClass(s.nota)}">${s.nota}</span></h2>
                                    <p class="progress">Finalizada en ${s.año}</p>
                                </div>
                                <a href="${s.link}" target="_blank" class="link-imdb">Ficha</a>
                            </div>
                        `).join('')}
                    </div>
                </details>
            `;
        }).join('');


        
    } catch (error) {
        console.error("Error:", error);
    }
}
loadSeries();

loadSeries();