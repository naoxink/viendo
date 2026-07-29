import crypto from 'crypto';

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

  try {
    const { username, password } = req.body;

    // Validación básica de entrada
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Faltan usuario o contraseña' });
    }

    // ==========================================
    // 4. CONSULTA A TU BASE DE DATOS
    // ==========================================
    const { data: user, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('username', username)
      .single();

    // Simulación provisional hasta que crees la tabla:
    // (Puedes compararlo temporalmente con variables de entorno o un mock)
    const usuarioValido = username === user.username
    const passwordValida = crypto.timingSafeEqual(
      Buffer.from(password),
      Buffer.from(user.password)
    );

    if (!usuarioValido || !passwordValida) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    // ==========================================
    // 5. RESPUESTA EXITOSA
    // ==========================================
    // Si todo es correcto, devolvemos el token y los permisos de administrador
    return res.status(200).json({
      success: true,
      admin_token: user.admin_token,
      is_admin: !!user.admin_token
    });

  } catch (error) {
    console.error('Error en el login:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}