import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

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

  // 3. Solo permitimos método POST para el login
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  // Validar token de seguridad
  if (req.headers['authorization'] !== process.env.ADMIN_TOKEN) {
    return res.status(401).end();
  }

  // Recibimos los datos básicos de la nueva serie
  const { titulo, tvdb_id, estado } = req.body;

  if (!titulo || !tvdb_id || !estado) {
    return res.status(400).json({ success: false, error: 'Faltan parámetros: se requiere "titulo", "tvdb_id" y "estado"' });
  }

  // Validar que el estado sea uno de los permitidos
  const estadosPermitidos = ['viendo', 'en_cola', 'completadas', 'dropeadas'];
  if (!estadosPermitidos.includes(estado)) {
    return res.status(400).json({ success: false, error: 'Estado no válido' });
  }

  // Construimos el esqueleto inicial evitando columnas que no existan en caché
  const serieEsqueleto = {
    titulo,
    tvdb_id,
    estado,
    temporada: 1,
    capitulo: 1,
    capitulos_por_temporada: {}
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