import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  // 1. Cabecera dinámica: permite al sitio que hace la petición
  const origin = req.headers.origin;
  const allowedOrigins = ['https://naoxink.github.io'];

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Si es una petición de comprobación (OPTIONS), respondemos OK inmediatamente
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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

    // 2. Aplicar la lógica de avance de temporada y capítulo
    const totalEnTemporada = (serie.capitulos_por_temporada || {})[serie.temporada] || 0;
        
    let nextCap = serie.capitulo + 1;
    let nextTemp = serie.temporada;
    let nextPendiente = serie.pendiente;
    let nextAcumulados = serie.acumulados || 0;

    // Lógica de cambio de temporada
    if (totalEnTemporada > 0 && nextCap > totalEnTemporada) {
        nextCap = 1;
        nextTemp += 1;
        
        const tieneSiguienteTemporada = (serie.capitulos_por_temporada || {})[nextTemp];
        if (tieneSiguienteTemporada) {
            nextPendiente = true;
        } else {
            nextPendiente = false;
        }
    } else {
        // Lógica dentro de la misma temporada
        if (nextAcumulados > 0) {
            nextAcumulados -= 1;
            nextPendiente = (nextAcumulados > 0); 
        } else {
            if (serie.proxima_fecha) {
                const hoy = new Date();
                const fechaProximo = new Date(serie.proxima_fecha);
                nextPendiente = (fechaProximo <= hoy);
            } else {
                nextPendiente = false;
            }
        }
    }

    // Si es rewatch (o es una serie finalizada) tomamos todos los capítulos de 'capitulos_por_temporada'
    // y los sumamos a acumulados restando los que llevamos vistos
    if ((serie.rewatch || serie.estado_final === 'Ended') && serie.capitulos_por_temporada) {
        const totalCapitulos = Object.values(serie.capitulos_por_temporada || {}).reduce((acc, val) => acc + val, 0);
        nextAcumulados = totalCapitulos - (nextTemp - 1) * totalEnTemporada - nextCap;
        nextPendiente = (nextAcumulados > 0);
    }

    const datosActualizados = {
        temporada: nextTemp,
        capitulo: nextCap,
        pendiente: nextPendiente,
        acumulados: nextAcumulados
    };

    // 3. Guardar los cambios directamente en Supabase
    const { error: updateError } = await supabase
      .from('series')
      .update(datosActualizados)
      .eq('id', serie.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Fusionamos los datos nuevos para devolver la respuesta esperada
    const serieModificada = { ...serie, ...datosActualizados };

    res.status(200).json({ success: true, serie: serieModificada });
  } catch (e) { 
    res.status(500).json({ error: e.message }); 
  }
}