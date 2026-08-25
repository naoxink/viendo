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
                @click="$emit('change-view', 'viendo')"
                title="Series que estoy viendo"
            >
                <span class="nav-icon">📺</span>
                <span class="nav-label">Viendo</span>
            </button>
            <button 
                class="nav-item" 
                :class="{ active: activeView === 'en-cola' }"
                @click="$emit('change-view', 'en-cola')"
                title="Series en cola de espera"
            >
                <span class="nav-icon">📅</span>
                <span class="nav-label">En cola</span>
            </button>
            <button 
                class="nav-item" 
                :class="{ active: activeView === 'completadas' }"
                @click="$emit('change-view', 'completadas')"
                title="Series completadas y dropeadas"
            >
                <span class="nav-icon">✅</span>
                <span class="nav-label">Completadas</span>
            </button>
            <button 
                class="nav-item" 
                :class="{ active: activeView === 'stats' }"
                @click="$emit('change-view', 'stats')"
                title="Estadísticas y dashboard"
                @show-login="currentView = 'login'"
            >
                <span class="nav-icon">📊</span>
                <span class="nav-label">Stats</span>
            </button>
            <button 
                class="nav-item" 
                :class="{ active: activeView === 'discover' }"
                @click="$emit('change-view', 'discover')"
                title="Descubrir series nuevas"
            >
                <span class="nav-icon">🔍</span>
                <span class="nav-label">Descubrir</span>
            </button>
        </nav>
    `
}