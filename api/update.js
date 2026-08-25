import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Umbral configurable: a partir de cuántos días entre capítulo y capítulo
// se considera "modo tranqui"
const DIAS_UMBRAL_SLOW_MODE = 10;

export default async function handler(req, res) {
  // 1. Cabeceras CORS (Permitiendo tu GitHub Pages)
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', 'https://naoxink.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // 2. Interceptar el Preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. Solo permitimos método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  if (req.headers['authorization'] !== process.env.ADMIN_TOKEN) {
    return res.status(401).end();
  }

  const { tvdbId } = req.body;

  try {
    // 1. Buscar la serie en Supabase por su tvdb_id
    const { data: seriesList, error: fetchError } = await supabase
      .from('series')
      .select('*')
      .eq('tvdb_id', tvdbId);

    if (fetchError || !seriesList || seriesList.length === 0) {
      return res.status(200).json({ success: false, error: 'Serie no encontrada' });
    }

    const serie = seriesList[0];

    // 2. Avanzar al siguiente capítulo. Solo miramos capitulos_por_temporada
    // para saber si toca cruzar de temporada; ya NO calculamos aquí
    // pendiente/acumulados/proxima_fecha — eso lo deriva el frontend en
    // tiempo real a partir de 'fechas_episodios' + (temporada, capitulo).
    const totalEnTemporada = (serie.capitulos_por_temporada || {})[serie.temporada] || 0;

    let nextCap = serie.capitulo + 1;
    let nextTemp = serie.temporada;

    if (totalEnTemporada > 0 && nextCap > totalEnTemporada) {
      nextCap = 1;
      nextTemp += 1;
    }

    // 3. Slow mode: igual que antes, se basa en cuánto tardas en marcar capítulos
    const ahora = new Date();
    const ultimoVisto = serie.ultimo_capitulo_visto_en ? new Date(serie.ultimo_capitulo_visto_en) : null;

    let nuevoSlowMode = serie.slow_mode;
    if (ultimoVisto) {
      const diasTranscurridos = (ahora - ultimoVisto) / (1000 * 60 * 60 * 24);
      nuevoSlowMode = diasTranscurridos >= DIAS_UMBRAL_SLOW_MODE;
    }

    const datosActualizados = {
      temporada: nextTemp,
      capitulo: nextCap,
      ultimo_capitulo_visto_en: ahora.toISOString(),
      slow_mode: nuevoSlowMode
    };

    // 4. Guardar los cambios directamente en Supabase
    const { error: updateError } = await supabase
      .from('series')
      .update(datosActualizados)
      .eq('id', serie.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const serieModificada = { ...serie, ...datosActualizados };

    res.status(200).json({ success: true, serie: serieModificada });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}