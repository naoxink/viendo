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

// Devuelve la clase de color según la nota
function getNotaClass(notaString) {
    const nota = parseFloat(notaString);
    if (isNaN(nota)) return ''; 
    if (nota < 5) return 'bad';
    if (nota < 8) return 'medium';
    return 'good';
}

function renderSeriePoster(serie) {
    const posterSrc = serie.poster_path || serie.image_url || '';
    return posterSrc
        ? `<img class="serie-thumb" src="${posterSrc}" alt="${serie.titulo}" loading="lazy">`
        : '';
}

function formatearFecha(fechaStr) {
    if (!fechaStr) return '-';

    // Cambiamos el espacio por 'T' y añadimos 'Z' para indicar formato UTC
    const d = new Date(fechaStr.replace(' ', 'T') + 'Z');

    // Por si acaso el JSON tuviera un formato corrupto
    if (isNaN(d.getTime())) return fechaStr;

    // Extraemos los componentes con dos dígitos
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const año = String(d.getFullYear()).slice(-2);

    const horas = String(d.getHours()).padStart(2, '0');
    const minutos = String(d.getMinutes()).padStart(2, '0');
    const segundos = String(d.getSeconds()).padStart(2, '0'); // <-- Aquí estaba bien declarada

    // Devolvemos el formato exacto: dd.mm.YY H:i:s (corregido a 'segundos')
    return `${dia}.${mes}.${año} ${horas}:${minutos}:${segundos}`;
}

function renderStats(data, añoActual) {
    const statsContainer = document.getElementById('stats');
    const terminadasEsteAño = data.completadas.filter(s => s.vistoEn === añoActual).length
    const pendientes = data.viendo.filter(s => s.pendiente).length

    statsContainer.innerHTML = `
        <div class="stat-item">🍿 <b>${data.viendo.length}</b> en curso</div>
        ${pendientes > 0 ? `<div class="stat-item">🔔 <b>${pendientes}</b> por ver</div>` : ''}
        <div class="stat-item">🏆 <b>${terminadasEsteAño}</b> finalizadas en ${añoActual}</div>
    `;
}

function renderViendo(lista) {
    const container = document.getElementById('series-list');
    const todayStart = new Date();
    const todayTimestamp = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate()).getTime();
    const ordenada = [...lista].sort((a, b) => {
        const pendienteA = a.pendiente === true ? 1 : 0;
        const pendienteB = b.pendiente === true ? 1 : 0;
        if (pendienteA !== pendienteB) return pendienteB - pendienteA;

        const fechaA = a.proximaFecha && a.proximaFecha !== 'TBA' ? Date.parse(a.proximaFecha) : -Infinity;
        const fechaB = b.proximaFecha && b.proximaFecha !== 'TBA' ? Date.parse(b.proximaFecha) : -Infinity;

        const actualOPasadaA = pendienteA === 0 && fechaA !== -Infinity && fechaA <= todayTimestamp;
        const actualOPasadaB = pendienteB === 0 && fechaB !== -Infinity && fechaB <= todayTimestamp;
        if (actualOPasadaA !== actualOPasadaB) return actualOPasadaA ? 1 : -1;

        if (fechaA === -Infinity && fechaB === -Infinity) return 0;
        if (fechaA === -Infinity) return 1;
        if (fechaB === -Infinity) return -1;

        return fechaA - fechaB;
    });

    container.innerHTML = ordenada.map(s => `
        <div class="serie-card">
            ${renderSeriePoster(s)}
            <div class="info">
                <h2>${s.titulo} ${getRewatchBadge(s)}<span class="año-label">(${s.año})</span></h2>
                <p class="progress">T${s.temporada} • E${s.capitulo} 
                   ${s.pendiente ? '<span class="badge-pendiente">Pendiente</span>' : '<span class="badge-visto">Visto</span>'}
                </p>
                ${s.acumulados > 0 ? `<span class="badge-warning">+${s.acumulados} caps</span>` : ''}
                ${s.proximaFecha ? `
                    <p class="next-air">
                        📅 <strong>${s.proximaFecha === 'TBA' ? 'Sin fecha' : s.proximaFecha.split('-').reverse().join('.')}</strong>
                    </p>
                ` : ''}
            </div>
            <div>
                ${s.imdb_id
                    ? `<a href="https://www.imdb.com/title/${s.imdb_id}/" target="_blank" class="link-imdb">IMDb</a>`
                    : ''
                }
                ${s.tvdb_id
                    ? `<a href="https://www.thetvdb.com/?tab=series&id=${s.tvdb_id}" target="_blank" class="link-imdb">TVDB</a>`
                    : ''
                }
            </div>
        </div>
    `).join('');
}

function renderHistorico(completadas, añoActual) {
    const container = document.getElementById('history-list');
    
    // Filtramos usando 'vistoEn', y si no existe (por error), usamos 'año'
    const grupos = [
        { titulo: `Recientes (${añoActual-1}-${añoActual})`, filtro: (s) => (s.vistoEn || s.año) >= añoActual - 1, open: true },
        { titulo: `Anteriores (${añoActual-6}-${añoActual-2})`, filtro: (s) => (s.vistoEn || s.año) < añoActual - 1 && (s.vistoEn || s.año) >= añoActual - 6, open: false },
        { titulo: `Archivo (Antes de ${añoActual-6})`, filtro: (s) => (s.vistoEn || s.año) < añoActual - 6, open: false }
    ];

    container.innerHTML = grupos.map(grupo => {
        // Ordenamos por el año en que las viste (vistoEn)
        const series = completadas.filter(grupo.filtro).sort((a, b) => (b.vistoEn || b.año) - (a.vistoEn || a.año));
        
        if (series.length === 0) return '';

        return `
            <details class="año-section">
                <summary>
                    <span>${grupo.titulo}</span>
                    <span class="count">${series.length} series</span>
                </summary>
                <div class="año-content">
                    ${series.map(s => `
                        <div class="serie-card" data-titulo="${s.titulo.toLowerCase()}">
                            ${renderSeriePoster(s)}
                            <div class="info">
                                <h2>${s.titulo} <span class="nota-tag ${getNotaClass(s.nota)}">${s.nota}</span></h2>
                                <p class="progress">
                                    Finalizada en <b>${s.vistoEn || s.año}</b>
                                    ${getRewatchBadge(s)}
                                    <span class="original-year">(Estreno: ${s.año})</span>
                                </p>
                            </div>
                            <div>
                                ${s.imdb_id
                                    ? `<a href="https://www.imdb.com/title/${s.imdb_id}/" target="_blank" class="link-imdb">IMDb</a>`
                                    : ''
                                }
                                ${s.tvdb_id
                                    ? `<a href="https://www.thetvdb.com/?tab=series&id=${s.tvdb_id}" target="_blank" class="link-imdb">TVDB</a>`
                                    : ''
                                }
                            </div>
                        </div>
                    `).join('')}
                </div>
            </details>
        `;
    }).join('');
}

function renderEnCola(enCola) {
    const enColaContainer = document.getElementById('en-cola-container');
    // Si no hay series en cola, limpiamos el contenedor y no pintamos nada
    if (enCola.length === 0) {
        enColaContainer.innerHTML = '';
    } else {
        enColaContainer.innerHTML = `
            <details class="cola-section">
                <summary>
                    <span>⏳ En Cola / Pendientes</span>
                    <span class="count">${enCola.length} series</span>
                </summary>
                <div class="cola-content grid-series">
                    ${enCola.map(s => `
                        <div class="serie-card serie-en-cola">
                            ${renderSeriePoster(s)}
                            <div class="info">
                                <h2>${s.titulo}</h2>
                                <p class="progress">Por empezar • Temporada ${s.temporada || 1}</p>
                                ${s.proximaFecha ? `
                                    <p class="next-air">
                                        📅 <strong>${s.proximaFecha === 'TBA' ? 'Sin fecha' : s.proximaFecha.split('-').reverse().join('.')}</strong>
                                    </p>
                                ` : ''}
                            </div>
                            <div class="acciones-cola">
                                ${s.imdb_id
                                    ? `<a href="https://www.imdb.com/title/${s.imdb_id}/" target="_blank" class="link-imdb">IMDb</a>`
                                    : ''
                                }
                                ${s.tvdb_id
                                    ? `<a href="https://www.thetvdb.com/?tab=series&id=${s.tvdb_id}" target="_blank" class="link-imdb">TVDB</a>`
                                    : ''
                                }
                            </div>
                        </div>
                    `).join('')}
                </div>
            </details>
        `;
    }
}

function renderStatus() {
    fetch('status.json')
    .then(response => response.json())
    .then(status => {
        const statusContainer = document.getElementById('status-dashboard');
        
        const scriptClase = status.script_ok ? 'status-success' : 'status-error';
        const scriptTexto = status.script_ok ? 'Sincronizado' : 'Error';
        
        const notifTexto = status.notificacion_enviada 
            ? '🔔 Notificación enviada hoy' 
            : '🔕 Sin cambios notificados';

        statusContainer.innerHTML = `
            <div class="status-item">
                <span class="status-dot ${scriptClase}"></span>
                <span>Script: ${scriptTexto}</span>
            </div>
            <div class="status-item text-muted">
                <span>${notifTexto}</span>
            </div>
            <div class="status-item timestamp">
                Refrescado: ${formatearFecha(status.ultima_ejecucion)}
            </div>
        `;
    })
    .catch(err => console.log('Aún no existe el archivo de estados:', err));
}

async function setLastUpdateDate() {
  // Obtener la fecha de última modificación de data.csv
  let formatted = ''
  try {
    const res = await fetch('data.json', { method: 'HEAD' })
    const lastModified = res.headers.get('Last-Modified')
    if (lastModified) {
      const date = new Date(lastModified)
      formatted = date.toLocaleDateString('es-ES')
    } else {
      formatted = 'desconocida'
    }
  } catch (e) {
    formatted = 'desconocida'
  }
  document.querySelector('.last-update .date').textContent = formatted
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
        renderDropeadas(data.dropeadas);
        renderEnCola(data.en_cola || [])
        setLastUpdateDate()
        renderStatus()

    } catch (error) {
        console.error("Error cargando la App:", error);
    }
}

// El buscador se queda fuera, configurándose una sola vez
document.getElementById('history-search').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const sections = document.querySelectorAll('.año-section');

    sections.forEach((section, index) => {
        const cards = section.querySelectorAll('.serie-card, .serie-card-dropped');
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

function getRewatchBadge(serie) {
    if (!serie.rewatch) return '';
    const vecesTexto = serie.veces > 1 ? `<span>x${serie.veces}</span>` : '';
    return `<span class="badge-rewatch">Rewatch ${vecesTexto}</span>`;
}

function renderDropeadas(dropeadas) {
    const container = document.getElementById('dropped-container');
    if (!container || !dropeadas || dropeadas.length === 0) {
        if (container) container.innerHTML = '';
        return;
    }

    const ordenadas = [...dropeadas].sort((a, b) => a.titulo.localeCompare(b.titulo));

    container.innerHTML = `
        <details class="año-section dropped-section">
            <summary>
                <span>🗑️ Series Dropeadas</span>
                <span class="count">${ordenadas.length} series</span>
            </summary>
            <div class="año-content">
                ${ordenadas.map(s => `
                    <div class="serie-card-dropped" data-titulo="${s.titulo.toLowerCase()}">
                        <div class="info">
                            <h3>${s.titulo} <small>(${s.año})</small></h3>
                            <p class="dropped-meta">
                                Dropeada en <b>${s.vistoEn || s.año}</b> • Te quedaste en: <span>T${s.temporada} • E${s.capitulo}</span>
                            </p>
                        </div>
                        <div>
                            ${s.imdb_id
                                ? `<a href="https://www.imdb.com/title/${s.imdb_id}/" target="_blank" class="link-imdb">IMDb</a>`
                                : ''
                            }
                            ${s.tvdb_id
                                ? `<a href="https://www.thetvdb.com/?tab=series&id=${s.tvdb_id}" target="_blank" class="link-imdb">TVDB</a>`
                                : ''
                            }
                        </div>
                    </div>
                `).join('')}
            </div>
        </details>
    `;
}

// Arrancar
loadSeries();