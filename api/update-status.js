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

  // Recibimos el id de la serie y el nuevo estado
  const { id, estadoNuevo } = req.body;

  if (!id || !estadoNuevo) {
    return res.status(400).json({ success: false, error: 'Faltan parámetros: se requiere "id" y "estadoNuevo"' });
  }

  // Validar que el estado sea uno de los permitidos para evitar errores en base de datos
  const estadosPermitidos = ['viendo', 'en_cola', 'completadas', 'dropeadas'];
  if (!estadosPermitidos.includes(estadoNuevo)) {
    return res.status(400).json({ success: false, error: 'Estado no válido' });
  }

  try {
    // Actualizar el estado directamente en Supabase usando el id único de la serie
    const { data: serieActualizada, error: updateError } = await supabase
      .from('series')
      .update({ estado: estadoNuevo })
      .eq('id', id)
      .select()
      .single();

    if (updateError || !serieActualizada) {
      throw new Error(updateError ? updateError.message : 'Serie no encontrada');
    }

    res.status(200).json({ success: true, serie: serieActualizada });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}