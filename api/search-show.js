const supabaseAuthCheck = process.env.ADMIN_TOKEN;

let tvdbToken = null;
let tvdbTokenExp = 0;

async function fetchWithTimeout(url, options = {}, ms = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getTvdbToken() {
  const now = Date.now();
  if (tvdbToken && now < tvdbTokenExp) return tvdbToken;

  const res = await fetchWithTimeout('https://api4.thetvdb.com/v4/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apikey: process.env.TVDB_API_KEY })
  }, 3000);

  if (!res.ok) throw new Error('Login TVDB falló: ' + res.status);
  const json = await res.json();
  tvdbToken = json.data.token;
  tvdbTokenExp = now + 1000 * 60 * 60 * 24; // refresco cada 24h
  return tvdbToken;
}

function resolverUrlImagen(image) {
  if (!image) return null;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  if (image.startsWith('/')) return `https://artworks.thetvdb.com${image}`;
  return `https://artworks.thetvdb.com/banners/${image}`;
}

function extraerTvdbId(item) {
  if (item.tvdb_id) {
    const n = parseInt(item.tvdb_id, 10);
    if (!isNaN(n)) return n;
  }
  if (item.id) {
    const match = String(item.id).match(/(\d+)$/);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', 'https://naoxink.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }
  if (req.headers['authorization'] !== supabaseAuthCheck) {
    return res.status(401).end();
  }

  const query = (req.query.query || '').toString().trim();
  if (!query) {
    return res.status(400).json({ success: false, error: 'Falta el parámetro "query"' });
  }

  try {
    const token = await getTvdbToken();
    const url = `https://api4.thetvdb.com/v4/search?query=${encodeURIComponent(query)}&type=series`;

    const tvdbRes = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${token}` }
    }, 4000);

    if (!tvdbRes.ok) {
      throw new Error(`Búsqueda TVDB falló: ${tvdbRes.status}`);
    }

    const json = await tvdbRes.json();

    const resultados = (json.data || [])
      .slice(0, 8)
      .map(item => ({
        tvdb_id: extraerTvdbId(item),
        titulo: item.translations?.spa || item.name,
        anio: item.year ? parseInt(item.year, 10) : null,
        imagen: resolverUrlImagen(item.image_url || item.image)
      }))
      .filter(r => r.tvdb_id);

    return res.status(200).json({ success: true, resultados });
  } catch (e) {
    console.error('Error buscando en TheTVDB:', e);
    return res.status(502).json({ success: false, error: e.message || 'Error desconocido' });
  }
}