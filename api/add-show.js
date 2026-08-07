import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Cache en memoria del módulo (persiste entre invocaciones "warm")
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
  tvdbTokenExp = now + 1000 * 60 * 60 * 24; // refrescamos cada 24h por seguridad
  return tvdbToken;
}

async function tvdbGet(path, token, ms = 3000) {
  const res = await fetchWithTimeout(`https://api4.thetvdb.com/v4${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  }, ms);
  if (!res.ok) throw new Error(`TVDB ${path} falló: ${res.status}`);
  return res.json();
}

function mapSeriesExtended(d) {
  const imdb = (d.remoteIds || []).find(r => r.sourceName === 'IMDB');
  return {
    anio: d.firstAired ? parseInt(d.firstAired.slice(0, 4), 10) : null,
    imdb_id: imdb ? imdb.id : null,
    image_url: d.image || null,
    duracion_media: d.averageRuntime ?? null
  };
}

async function getCapitulosPorTemporada(tvdb_id, token) {
  const conteo = {};
  let page = 0;
  const MAX_PAGES = 3;

  while (page < MAX_PAGES) {
    const json = await tvdbGet(
      `/series/${tvdb_id}/episodes/default?page=${page}`,
      token,
      2000
    );
    const episodios = json.data?.episodes || [];
    for (const ep of episodios) {
      if (ep.seasonNumber == null) continue;
      const key = String(ep.seasonNumber);
      conteo[key] = (conteo[key] || 0) + 1;
    }
    const next = json.links?.next;
    if (!next) break;
    page++;
  }
  return conteo;
}

// Título en español. Si no hay traducción disponible, cae al nombre original.
async function getTituloEspanol(tvdb_id, token, nombreOriginal) {
  try {
    const trad = await tvdbGet(`/series/${tvdb_id}/translations/spa`, token, 2500);
    if (trad?.data?.name) return trad.data.name;
  } catch (e) {
    console.warn('Sin traducción al español, usando nombre original:', e.message);
  }
  return nombreOriginal || null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', 'https://naoxink.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }
  if (req.headers['authorization'] !== process.env.ADMIN_TOKEN) {
    return res.status(401).end();
  }

  // Ya no recibimos "titulo" del cliente
  const { tvdb_id, estado } = req.body;
  if (!tvdb_id || !estado) {
    return res.status(400).json({ success: false, error: 'Faltan parámetros: se requiere "tvdb_id" y "estado"' });
  }

  const estadosPermitidos = ['viendo', 'en_cola', 'completadas', 'dropeadas'];
  if (!estadosPermitidos.includes(estado)) {
    return res.status(400).json({ success: false, error: 'Estado no válido' });
  }

  let metadata = {};
  let titulo = null;

  try {
    const token = await getTvdbToken();

    const extended = await tvdbGet(`/series/${tvdb_id}/extended`, token, 3000);
    metadata = mapSeriesExtended(extended.data);
    titulo = await getTituloEspanol(tvdb_id, token, extended.data.name);

    try {
      const capitulos_por_temporada = await getCapitulosPorTemporada(tvdb_id, token);
      if (Object.keys(capitulos_por_temporada).length > 0) {
        metadata.capitulos_por_temporada = capitulos_por_temporada;
      }
    } catch (e) {
      console.warn('No se pudieron obtener episodios por temporada:', e.message);
    }
  } catch (e) {
    // Sin título no podemos insertar de forma consistente: cortamos aquí
    return res.status(502).json({
      success: false,
      error: 'No se pudo obtener información de TheTVDB: ' + e.message
    });
  }

  if (!titulo) {
    return res.status(502).json({
      success: false,
      error: 'TheTVDB no devolvió un título válido para este tvdb_id'
    });
  }

  const serieEsqueleto = {
    titulo,
    tvdb_id,
    estado,
    temporada: 1,
    capitulo: 1,
    capitulos_por_temporada: {},
    ...metadata
  };

  try {
    const { data: serieInsertada, error: insertError } = await supabase
      .from('series')
      .insert([serieEsqueleto])
      .select()
      .single();
    if (insertError || !serieInsertada) {
      throw new Error(insertError ? insertError.message : 'No se pudo insertar la serie');
    }
    res.status(200).json({ success: true, serie: serieInsertada });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}