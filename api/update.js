import { Octokit } from "@octokit/rest";

export default async function handler(req, res) {
// 1. Cabecera dinámica: permite al sitio que hace la petición
  const origin = req.headers.origin;
  const allowedOrigins = ['https://naoxink.github.io']; // Cambia esto por tu URL real de GitHub Pages

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // EL TRUCO PARA EL NAVEGADOR:
  // Si es una petición de comprobación (OPTIONS), respondemos OK inmediatamente
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.headers['authorization'] !== process.env.ADMIN_TOKEN) return res.status(401).end();

  const { tvdbId, temporada, capitulo } = req.body;
  const octokit = new Octokit({ auth: process.env.GITHUB_PAT });
  const path = 'data/viendo.json'; // O el archivo que toque

  try {
    // 1. Leer archivo actual
    const { data: fileData } = await octokit.repos.getContent({ owner: 'naoxink', repo: 'viendo', path });
    const content = JSON.parse(Buffer.from(fileData.content, 'base64').toString());

    // 2. Modificar el JSON
    const serie = content.find(s => s.tvdb_id === tvdbId);

    if (serie) {
      const totalEnTemporada = serie.capitulosPorTemporada[serie.temporada] || 0;
          
      // Asumimos que marcamos 1 capítulo como visto
      let nextCap = serie.capitulo + 1;
      let nextTemp = serie.temporada;

      // 1. Lógica de cambio de temporada
      if (nextCap > totalEnTemporada) {
          nextCap = 1;
          nextTemp += 1;
          
          if (serie.capitulosPorTemporada[nextTemp]) {
              // Hay nueva temporada, por defecto está pendiente de empezar
              serie.pendiente = true;
          } else {
              // No hay más temporadas registradas (Finalizada o Cancelada)
              serie.pendiente = false;
          }
      } else {
          // 2. Lógica dentro de la misma temporada
          if (serie.acumulados > 0) {
              serie.acumulados -= 1;
              // Si tras restar 1 aún quedan acumulados, sigue pendiente. Si no, no.
              serie.pendiente = (serie.acumulados > 0); 
          } else {
              // No hay acumulados. Comprobamos la fecha de emisión del próximo
              // Asumimos formato ISO 'YYYY-MM-DD' en serie.proximaFecha
              if (serie.proximaFecha) {
                  const hoy = new Date();
                  const fechaProximo = new Date(serie.proximaFecha);
                  
                  // Si la fecha del próximo es en el futuro, no hay nada que ver hoy -> Pendiente = false (al día)
                  // Si la fecha es pasada o igual a hoy, ya se emitió -> Pendiente = true (tienes que verlo)
                  serie.pendiente = (fechaProximo <= hoy);
              } else {
                  // Si no hay fecha definida y no hay acumulados, asumimos que no hay nada pendiente
                  serie.pendiente = false;
              }
          }
      }

      // Actualizamos los campos en el objeto original
      serie.temporada = nextTemp;
      serie.capitulo = nextCap;
    } else {
        res.status(200).json({ success: false, error: 'Serie no encontrada' })
    }

    // 3. Guardar
    await octokit.repos.createOrUpdateFileContents({
      owner: 'naoxink', repo: 'viendo', path,
      message: `Update: ${serie.titulo} T${serie.temporada} E${serie.capitulo}`,
      content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
      sha: fileData.sha
    });

    res.status(200).json({ success: true, serie });
  } catch (e) { res.status(500).json({ error: e.message }); }
}