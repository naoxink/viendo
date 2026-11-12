import { createClient } from '@supabase/supabase-js';
import {
  getTvdbToken, tvdbGet, getEpisodiosValidos, construirFechas, contarCapitulos
} from './_tvdb.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', 'https://naoxink.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Método no permitido' });
  if (req.headers['authorization'] !== process.env.ADMIN_TOKEN) return res.status(401).end();

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ success: false, error: 'Falta el parámetro "id"' });

  try {
    const { data: serie, error } = await supabase.from('series').select('*').eq('id', id).single();
    if (error || !serie) throw new Error(error?.message || 'Serie no encontrada');
    if (!serie.tvdb_id) {
      return res.status(400).json({ success: false, error: 'La serie no tiene tvdb_id' });
    }

    const token = await getTvdbToken();
    const [extended, eps] = await Promise.all([
      tvdbGet(`/series/${serie.tvdb_id}/extended`, token, 4000),
      getEpisodiosValidos(serie.tvdb_id, token)
    ]);
    const d = extended.data;

    const update = {
      fechas_episodios: construirFechas(eps),
      capitulos_por_temporada: contarCapitulos(eps),
      duracion_media: d.averageRuntime ?? serie.duracion_media ?? 0
    };
    const estadoApi = d.status?.name;
    if (estadoApi === 'Ended' || estadoApi === 'Canceled') update.estado_final = estadoApi;
    if (!serie.image_url && d.image) update.image_url = d.image;

    const { data: actualizada, error: upErr } = await supabase
      .from('series').update(update).eq('id', id).select().single();
    if (upErr) throw new Error(upErr.message);

    return res.status(200).json({ success: true, serie: actualizada });
  } catch (e) {
    console.error('Error en refresh-show:', e);
    return res.status(502).json({ success: false, error: e.message });
  }
}