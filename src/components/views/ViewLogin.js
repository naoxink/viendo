export default {
  name: 'ViewLogin',
  template: `
    <div class="view view-login">
      <div class="view-header">
        <h2>Acceso Administrador</h2>
        <p class="subtitle">Obtén tu token para gestionar series</p>
      </div>
      
      <div class="view-content">
        <form @submit.prevent="hacerLogin" class="login-form">
          <div class="form-group">
            <label for="username">Usuario</label>
            <input 
              type="text" 
              id="username" 
              v-model="credenciales.username" 
              required 
              class="admin-input" 
              placeholder="Tu usuario" 
              autocomplete="username"
            >
          </div>
          
          <div class="form-group">
            <label for="password">Contraseña</label>
            <input 
              type="password" 
              id="password" 
              v-model="credenciales.password" 
              required 
              class="admin-input" 
              placeholder="••••••••" 
              autocomplete="current-password"
            >
          </div>
          
          <div v-if="mensajeError" class="login-alert error">
            {{ mensajeError }}
          </div>
          <div v-if="mensajeExito" class="login-alert success">
            {{ mensajeExito }}
          </div>

          <button type="submit" class="btn-submit" :disabled="cargando">
            <span v-if="cargando">Conectando...</span>
            <span v-else>Iniciar Sesión</span>
          </button>
        </form>
      </div>
    </div>
  `,
  data() {
    return {
      credenciales: {
        username: '',
        password: ''
      },
      cargando: false,
      mensajeError: '',
      mensajeExito: ''
    }
  },
  methods: {
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },
    async hacerLogin() {
      this.cargando = true;
      this.mensajeError = '';
      this.mensajeExito = '';

      try {
        // Aquí atacaremos a tu futuro endpoint de Vercel/Supabase
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: this.credenciales.username,
            password: await this.hashPassword(this.credenciales.password)
          })
        });

        if (!response.ok) {
          throw new Error('Usuario o contraseña incorrectos');
        }

        const data = await response.json();
        
        // Guardamos el token de forma persistente en el navegador
        if (data.admin_token) {
          sessionStorage.setItem('adminToken', data.admin_token);
          sessionStorage.setItem('isAdmin', 'true')
          this.mensajeExito = '¡Sesión iniciada con éxito!';
          
          // Retraso sutil para que el usuario lea el mensaje de éxito 
          // antes de emitir el evento para redirigir a la portada
          setTimeout(() => {
            this.$emit('login-success', data.admin_token);
          }, 1200);
        } else {
          throw new Error('El servidor no devolvió un token válido');
        }

      } catch (error) {
        this.mensajeError = error.message || 'Error al conectar con el servidor';
      } finally {
        this.cargando = false;
      }
    }
  }
}