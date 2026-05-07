// 1. Definimos la función de inicialización del buscador
function setupSearch() {
    const searchInput = document.getElementById('history-search');
    
    // Eliminamos cualquier listener previo para no duplicar
    searchInput.replaceWith(searchInput.cloneNode(true));
    
    // Volvemos a capturar el elemento tras clonarlo
    const nuevoInput = document.getElementById('history-search');

    nuevoInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const sections = document.querySelectorAll('.año-section');

        sections.forEach((section, index) => {
            const cards = section.querySelectorAll('.serie-card');
            let matches = 0;

            cards.forEach(card => {
                // 1. Buscamos el elemento del título (el h2)
                const tituloElemento = card.querySelector('h2');
                
                if (tituloElemento) {
                    // 2. IMPORTANTE: Clonamos el nodo para poder manipularlo sin romper la web
                    const clonTitulo = tituloElemento.cloneNode(true);
                    
                    // 3. Si tienes la nota (span) o el año (small) dentro del h2, los borramos del clon
                    // para que NO busque en la nota ni en etiquetas extra
                    const extras = clonTitulo.querySelectorAll('span, small, .nota-tag');
                    extras.forEach(el => el.remove());

                    // 4. Ahora sí, tenemos el texto limpio de la serie
                    const nombreSerie = clonTitulo.innerText.toLowerCase().trim();
                    const isMatch = nombreSerie.includes(term);
                    
                    // 5. Aplicamos el cambio visual
                    card.style.display = isMatch ? 'flex' : 'none';
                    
                    if (isMatch) matches++;
                }
            });

            // Lógica de visibilidad de la sección
            if (term.length > 0) {
                section.style.display = matches > 0 ? 'block' : 'none';
                if (matches > 0) section.open = true;
            } else {
                section.style.display = 'block';
                section.open = (index === 0);
            }
        });
    });
}

// 2. En tu función principal, asegúrate del orden:
async function loadSeries() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();
        const añoActual = new Date().getFullYear();

        renderStats(data, añoActual);
        renderViendo(data.viendo);
        renderHistorico(data.completadas, añoActual);

        // ¡IMPORTANTE! Configura el buscador después de que el HTML exista
        setupSearch();

    } catch (error) {
        console.error("Error:", error);
    }
}

// Devuelve la clase de color según la nota
function getNotaClass(notaString) {
    const nota = parseFloat(notaString);
    if (isNaN(nota)) return ''; 
    if (nota < 5) return 'bad';
    if (nota < 8) return 'medium';
    return 'good';
}


function renderStats(data, añoActual) {
    const statsContainer = document.getElementById('stats');
    const terminadasEsteAño = data.completadas.filter(s => s.año === añoActual).length
    const pendientes = data.viendo.filter(s => s.pendiente).length

    statsContainer.innerHTML = `
        <div class="stat-item">🍿 <b>${data.viendo.length}</b> en curso</div>
        ${pendientes > 0 ? `<div class="stat-item">🔔 <b>${pendientes}</b> por ver</div>` : ''}
        <div class="stat-item">🏆 <b>${terminadasEsteAño}</b> finalizadas en ${añoActual}</div>
    `;
}

function renderViendo(lista) {
    const container = document.getElementById('series-list');
    const ordenada = [...lista].sort((a, b) => (b.pendiente === true) - (a.pendiente === true));

    container.innerHTML = ordenada.map(s => `
        <div class="serie-card">
            <div class="info">
                <h2>${s.titulo} <span class="año-label">(${s.año})</span></h2>
                <p class="progress">T${s.temporada} • E${s.capitulo} 
                   ${s.pendiente ? '<span class="badge-pendiente">Pendiente</span>' : '<span class="badge-visto">Visto</span>'}
                </p>
            </div>
            <a href="${s.link}" target="_blank" class="link-imdb">IMDb</a>
        </div>
    `).join('');
}

function renderHistorico(completadas, añoActual) {
    const container = document.getElementById('history-list');
    
    const grupos = [
        { titulo: `Recientes (${añoActual-1}-${añoActual})`, filtro: (s) => s.año >= añoActual - 1, open: true },
        { titulo: `Anteriores (${añoActual-6}-${añoActual-2})`, filtro: (s) => s.año < añoActual - 1 && s.año >= añoActual - 6, open: false },
        { titulo: `Archivo (Antes de ${añoActual-6})`, filtro: (s) => s.año < añoActual - 6, open: false }
    ];

    container.innerHTML = grupos.map(grupo => {
        const series = completadas.filter(grupo.filtro).sort((a, b) => b.año - a.año);
        if (series.length === 0) return '';

        return `
            <details class="año-section" ${grupo.open ? 'open' : ''}>
                <summary>
                    <span>${grupo.titulo}</span>
                    <span class="count">${series.length} series</span>
                </summary>
                <div class="año-content">
                    ${series.map(s => `
                        <div class="serie-card">
                            <div class="info">
                                <h2>${s.titulo} <span class="nota-tag ${getNotaClass(s.nota)}">${s.nota}</span></h2>
                                <p class="progress">Estrenada en ${s.año}</p>
                            </div>
                            <a href="${s.link}" target="_blank" class="link-imdb">Ficha</a>
                        </div>
                    `).join('')}
                </div>
            </details>
        `;
    }).join('');
}

async function loadSeries() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();
        const añoActual = new Date().getFullYear();

        // Ejecutamos cada parte por separado
        renderStats(data, añoActual);
        renderViendo(data.viendo);
        renderHistorico(data.completadas, añoActual);

    } catch (error) {
        console.error("Error cargando la App:", error);
    }
}

// El buscador se queda fuera, configurándose una sola vez
document.getElementById('history-search').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const sections = document.querySelectorAll('.año-section');

    sections.forEach((section, index) => {
        const cards = section.querySelectorAll('.serie-card');
        let matches = 0;

        cards.forEach(card => {
            const match = card.innerText.toLowerCase().includes(term);
            card.style.display = match ? 'flex' : 'none';
            if (match) matches++;
        });

        section.style.display = matches > 0 ? 'block' : 'none';
        if (term.length > 0) {
            if (matches > 0) section.open = true;
        } else {
            section.open = (index === 0);
            section.style.display = 'block';
        }
    });
});

// Arrancar
loadSeries();