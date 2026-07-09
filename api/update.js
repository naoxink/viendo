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
        // TODO: Calcular temporada, capítulo y pendiente según los capítulos por temporada y la fecha de próximo capítulo
        serie.temporada = temporada;
        serie.capitulo = capitulo + 1;
        serie.pendiente = true
    } else {
        res.status(200).json({ success: false, error: 'Serie no encontrada' })
    }

    // 3. Guardar
    // await octokit.repos.createOrUpdateFileContents({
    //   owner: 'naoxink', repo: 'viendo', path,
    //   message: `Update: ${serieNombre} T${temporada} E${capitulo}`,
    //   content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
    //   sha: fileData.sha
    // });

    res.status(200).json({ success: true, serie });
  } catch (e) { res.status(500).json({ error: e.message }); }
}