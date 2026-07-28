import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  // 1. Cabecera dinámica para CORS
  const origin = req.headers.origin;
  const allowedOrigins = ['https://naoxink.github.io'];

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Responder inmediatamente a las peticiones preflight de CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Validar token de seguridad
  if (req.headers['authorization'] !== process.env.ADMIN_TOKEN) {
    return res.status(401).end();
  }

  // Solo permitimos método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  // Recibimos los datos de la petición
  const { id, campoDb, valorNuevo } = req.body;

  if (!id || !campoDb || valorNuevo === undefined) {
    return res.status(400).json({ success: false, error: 'Faltan parámetros: se requiere "id", "campoDb" y "valorNuevo"' });
  }

  // Lista blanca de campos permitidos para actualizar por seguridad
  const camposPermitidos = [
    'titulo', 'estado', 'temporada', 'capitulo', 'rewatch', 'veces', 
    'nota', 'pendiente', 'duracion_media', 'visto_en', 'notas', 'slow_mode'
  ];

  if (!camposPermitidos.includes(campoDb)) {
    return res.status(400).json({ success: false, error: 'Campo no permitido para actualización' });
  }

  try {
    const { data: updatedRow, error: updateError } = await supabase
      .from('series')
      .update({ [campoDb]: valorNuevo })
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updatedRow) {
      throw new Error(updateError ? updateError.message : 'Serie no encontrada');
    }

    res.status(200).json({ success: true, data: updatedRow });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}