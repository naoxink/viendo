export default {
    name: 'BottomNav',
    props: {
        activeView: String
    },
    emits: ['change-view'],
    template: `
        <nav class="bottom-nav">
            <button 
                class="nav-item nav-item-desktop-only" 
                :class="{ active: activeView === 'dashboard' }"
                @click="$emit('change-view', 'dashboard')"
                title="Dashboard de escritorio"
            >
                <span class="nav-icon">🏠</span>
                <span class="nav-label">Dashboard</span>
            </button>
            <button 
                class="nav-item" 
                :class="{ active: activeView === 'viendo' }"
                :aria-current="activeView === 'viendo' ? 'page' : null"
                @click="$emit('change-view', 'viendo')"
                title="Series que estoy viendo"
            >
                <span class="nav-icon">📺</span>
                <span class="nav-label">Viendo</span>
            </button>
            <button 
                class="nav-item" 
                :class="{ active: activeView === 'en-cola' }"
                :aria-current="activeView === 'en-cola' ? 'page' : null"
                @click="$emit('change-view', 'en-cola')"
                title="Series en cola de espera"
            >
                <span class="nav-icon">📥</span>
                <span class="nav-label">En cola</span>
            </button>
            <button 
                class="nav-item" 
                :class="{ active: activeView === 'completadas' }"
                :aria-current="activeView === 'completadas' ? 'page' : null"
                @click="$emit('change-view', 'completadas')"
                title="Series completadas y dropeadas"
            >
                <span class="nav-icon">✅</span>
                <span class="nav-label">Completadas</span>
            </button>
            <button 
                class="nav-item" 
                aria-haspopup="dialog"
                @click="$emit('change-view', 'calendario')"
                title="Calendario de estrenos"
            >
                <span class="nav-icon">🗓️</span>
                <span class="nav-label">Calendario</span>
            </button>
        </nav>
    `
}