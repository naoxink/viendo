import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

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

  const { id, confirmado } = req.body || {};

  if (!id) {
    return res.status(400).json({ success: false, error: 'Falta el parámetro "id"' });
  }

  // Segunda barrera: el servidor también exige confirmación explícita
  if (confirmado !== true) {
    return res.status(400).json({ success: false, error: 'Se requiere confirmación explícita' });
  }

  try {
    const { data: eliminada, error: deleteError } = await supabase
      .from('series')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (deleteError || !eliminada) {
      throw new Error(deleteError ? deleteError.message : 'Serie no encontrada');
    }

    return res.status(200).json({ success: true, serie: eliminada });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}