import { createClient } from '@supabase/supabase-js';
import {
  getTvdbToken, tvdbGet, getEpisodiosValidos, construirFechas, contarCapitulos
} from './_tvdb.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

function mapSeriesExtended(d) {
  const imdb = (d.remoteIds || []).find(r => r.sourceName === 'IMDB');
  const estadoApi = d.status?.name; // Continuing | Ended | Upcoming | Canceled...

  return {
    anio: d.firstAired ? parseInt(d.firstAired.slice(0, 4), 10) : null,
    imdb_id: imdb ? imdb.id : null,
    image_url: d.image || null,
    duracion_media: d.averageRuntime ?? null,
    estado_final: ['Ended', 'Canceled'].includes(estadoApi) ? estadoApi : null
  };
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

  try {
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
    let pendiente = true; // fallback si no podemos determinarlo
    let acumulados = 0;

    try {
      const token = await getTvdbToken();

      const extended = await tvdbGet(`/series/${tvdb_id}/extended`, token, 3000);
      metadata = mapSeriesExtended(extended.data);
      titulo = await getTituloEspanol(tvdb_id, token, extended.data.name);

      try {
        const eps = await getEpisodiosValidos(tvdb_id, token);
        const hoy = new Date().toISOString().slice(0, 10);

        const capitulos = contarCapitulos(eps);
        if (Object.keys(capitulos).length) metadata.capitulos_por_temporada = capitulos;
        metadata.fechas_episodios = construirFechas(eps);

        const conFecha = eps
          .filter(e => e.aired)
          .sort((a, b) =>
            a.aired.localeCompare(b.aired) || a.seasonNumber - b.seasonNumber || a.number - b.number);
        const primero = conFecha.find(e => e.seasonNumber === 1 && e.number === 1) || conFecha[0];

        if (primero) pendiente = primero.aired <= hoy;
        const emitidos = conFecha.filter(e => e.aired <= hoy).length;
        acumulados = pendiente ? Math.max(0, emitidos - 1) : 0;
      } catch (e) {
        // La serie se guarda igualmente sin episodios; el workflow diario o el botón de la ficha lo completan.
        console.error(`⚠️ No se pudieron obtener episodios de tvdb_id=${tvdb_id}:`, e.message);
      }
    } catch (e) {
      console.error('Fallo obteniendo datos de TVDB:', e);
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
      capitulo: 0,
      pendiente,
      acumulados,
      ...metadata,
      capitulos_por_temporada: metadata.capitulos_por_temporada ?? {}
    };

    const { data: serieInsertada, error: insertError } = await supabase
      .from('series')
      .insert([serieEsqueleto])
      .select()
      .single();

    if (insertError || !serieInsertada) {
      throw new Error(insertError ? insertError.message : 'No se pudo insertar la serie');
    }

    return res.status(200).json({ success: true, serie: serieInsertada });

  } catch (e) {
    console.error('Error inesperado en add-show:', e);
    return res.status(500).json({ success: false, error: e.message || 'Error desconocido' });
  }
}
