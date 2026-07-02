import { createApp, ref, computed, onMounted } from 'vue';

const COLLECTIONS = ['viendo', 'en_cola', 'dropeadas', 'completadas'];
const COLLECTION_LABELS = {
    viendo: 'Viendo',
    en_cola: 'En cola',
    dropeadas: 'Dropeadas',
    completadas: 'Completadas',
};

const EMPTY_SERIE = {
    titulo: '',
    temporada: 1,
    capitulo: 1,
    pendiente: false,
    nota: '',
    vistoEn: '',
    tvdb_id: '',
    imdb_id: '',
    rewatch: false,
    slow_mode: false,
    proximaFecha: '',
    estado_final: '',
};

function cloneItem(item) {
    return { ...item };
}

function normalizeCollections(payload) {
    const next = {};
    for (const key of COLLECTIONS) {
        const value = payload?.[key];
        next[key] = Array.isArray(value) ? value : [];
    }
    return next;
}

createApp({
    setup() {
        const collections = ref({});
        const activeCollection = ref('viendo');
        const selectedIndex = ref(null);
        const draft = ref(null);
        const targetCollection = ref('en_cola');
        const loading = ref(true);
        const saving = ref(false);
        const message = ref('');
        const messageType = ref('');

        const activeList = computed(() => collections.value[activeCollection.value] || []);

        async function loadData() {
            loading.value = true;
            message.value = '';
            messageType.value = '';

            try {
                const response = await fetch('/api/collections');
                if (!response.ok) {
                    throw new Error('No se pudo cargar la información');
                }

                const payload = await response.json();
                collections.value = normalizeCollections(payload);
                if (!collections.value[activeCollection.value]) {
                    activeCollection.value = 'viendo';
                }
                selectedIndex.value = null;
                draft.value = null;
            } catch (error) {
                message.value = error.message || 'No se pudo cargar la información';
                messageType.value = 'error';
            } finally {
                loading.value = false;
            }
        }

        async function saveData() {
            saving.value = true;
            try {
                const response = await fetch('/api/collections', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ collections: collections.value }),
                });
                const payload = await response.json();
                if (!response.ok || !payload.ok) {
                    throw new Error(payload.error || 'No se pudo guardar');
                }
                collections.value = normalizeCollections(payload.collections || collections.value);
                message.value = 'Cambios guardados correctamente';
                messageType.value = 'success';
            } catch (error) {
                message.value = error.message || 'No se pudo guardar';
                messageType.value = 'error';
            } finally {
                saving.value = false;
            }
        }

        function selectItem(index) {
            selectedIndex.value = index;
            draft.value = cloneItem(activeList.value[index]);
        }

        function startNew() {
            selectedIndex.value = null;
            draft.value = { ...EMPTY_SERIE };
        }

        async function saveDraft() {
            if (!draft.value?.titulo?.trim()) {
                message.value = 'Añade un título antes de guardar';
                messageType.value = 'error';
                return;
            }

            const normalized = { ...draft.value };
            normalized.titulo = normalized.titulo.trim();
            normalized.temporada = normalized.temporada ?? 1;
            normalized.capitulo = normalized.capitulo ?? 1;
            normalized.vistoEn = normalized.vistoEn || '';
            normalized.nota = normalized.nota || '';
            normalized.tvdb_id = normalized.tvdb_id || '';
            normalized.imdb_id = normalized.imdb_id || '';
            normalized.proximaFecha = normalized.proximaFecha || '';
            normalized.estado_final = normalized.estado_final || '';

            if (selectedIndex.value === null) {
                collections.value[activeCollection.value].unshift(normalized);
            } else {
                collections.value[activeCollection.value][selectedIndex.value] = normalized;
            }

            selectedIndex.value = null;
            draft.value = null;
            await saveData();
        }

        async function deleteSelected() {
            if (selectedIndex.value === null) {
                return;
            }

            collections.value[activeCollection.value].splice(selectedIndex.value, 1);
            selectedIndex.value = null;
            draft.value = null;
            await saveData();
        }

        async function moveSelected() {
            if (selectedIndex.value === null) {
                return;
            }

            const sourceCollection = activeCollection.value;
            const destinationCollection = targetCollection.value || sourceCollection;
            if (sourceCollection === destinationCollection) {
                message.value = 'Ya estás en esa colección';
                messageType.value = 'error';
                return;
            }

            const [item] = collections.value[sourceCollection].splice(selectedIndex.value, 1);
            collections.value[destinationCollection].push(cloneItem(item));
            selectedIndex.value = null;
            draft.value = null;
            activeCollection.value = destinationCollection;
            await saveData();
        }

        function setCollection(value) {
            activeCollection.value = value;
            selectedIndex.value = null;
            draft.value = null;
            targetCollection.value = value;
        }

        function formatProgress(item) {
            if (item.temporada || item.capitulo) {
                return `S${item.temporada || 1} · E${item.capitulo || 1}`;
            }
            return item.pendiente ? 'Pendiente' : 'Sin progreso';
        }

        onMounted(() => {
            loadData();
        });

        return {
            collections,
            activeCollection,
            activeList,
            selectedIndex,
            draft,
            targetCollection,
            loading,
            saving,
            message,
            messageType,
            COLLECTIONS,
            COLLECTION_LABELS,
            loadData,
            selectItem,
            startNew,
            saveDraft,
            deleteSelected,
            moveSelected,
            setCollection,
            formatProgress,
        };
    },
    template: `
        <div class="admin-card">
            <header class="admin-header">
                <div>
                    <p class="eyebrow">Administración local</p>
                    <h1>Gestiona tus series y colecciones</h1>
                    <p>Los cambios se guardan de forma persistente en los JSON del proyecto.</p>
                </div>
                <button class="secondary-btn" @click="loadData" :disabled="loading">{{ loading ? 'Cargando…' : 'Recargar' }}</button>
            </header>

            <div v-if="message" class="status-banner" :class="{ error: messageType === 'error' }">{{ message }}</div>

            <div class="admin-toolbar">
                <label>
                    Colección
                    <select :value="activeCollection" @change="(event) => setCollection(event.target.value)">
                        <option v-for="key in COLLECTIONS" :key="key" :value="key">{{ COLLECTION_LABELS[key] }}</option>
                    </select>
                </label>
                <button class="primary-btn" @click="startNew">+ Nueva serie</button>
            </div>

            <div class="admin-grid">
                <aside class="admin-list-card">
                    <div class="list-header">
                        <h2>{{ COLLECTION_LABELS[activeCollection] }}</h2>
                        <span>{{ activeList.length }} series</span>
                    </div>
                    <div v-if="!activeList.length" class="empty-state">No hay series todavía en esta colección.</div>
                    <button
                        v-for="(item, index) in activeList"
                        :key="activeCollection + '-' + index"
                        class="series-item"
                        :class="{ active: selectedIndex === index }"
                        @click="selectItem(index)"
                    >
                        <strong>{{ item.titulo || 'Sin título' }}</strong>
                        <span>{{ formatProgress(item) }}</span>
                    </button>
                </aside>

                <section class="admin-form-card">
                    <div v-if="draft" class="form-body">
                        <div class="form-grid">
                            <label class="form-field full-width">
                                Título
                                <input v-model="draft.titulo" placeholder="Título de la serie">
                            </label>
                            <label class="form-field">
                                Temporada
                                <input v-model.number="draft.temporada" type="number" min="0">
                            </label>
                            <label class="form-field">
                                Capítulo
                                <input v-model.number="draft.capitulo" type="number" min="0">
                            </label>
                            <label class="form-field">
                                Pendiente
                                <select v-model="draft.pendiente">
                                    <option :value="false">No</option>
                                    <option :value="true">Sí</option>
                                </select>
                            </label>
                            <label class="form-field">
                                Visto en
                                <input v-model="draft.vistoEn" type="number" placeholder="Año">
                            </label>
                            <label class="form-field">
                                Nota
                                <input v-model="draft.nota" placeholder="8/10">
                            </label>
                            <label class="form-field">
                                TVDB ID
                                <input v-model="draft.tvdb_id" placeholder="12345">
                            </label>
                            <label class="form-field">
                                IMDb ID
                                <input v-model="draft.imdb_id" placeholder="tt1234567">
                            </label>
                            <label class="form-field">
                                Rewatch
                                <select v-model="draft.rewatch">
                                    <option :value="false">No</option>
                                    <option :value="true">Sí</option>
                                </select>
                            </label>
                            <label class="form-field">
                                Slow mode
                                <select v-model="draft.slow_mode">
                                    <option :value="false">No</option>
                                    <option :value="true">Sí</option>
                                </select>
                            </label>
                            <label class="form-field">
                                Próxima fecha
                                <input v-model="draft.proximaFecha" placeholder="2026-07-03">
                            </label>
                            <label class="form-field">
                                Estado final
                                <input v-model="draft.estado_final" placeholder="Ended">
                            </label>
                            <label class="form-field full-width">
                                Notas adicionales
                                <textarea v-model="draft.notas" placeholder="Observaciones"></textarea>
                            </label>
                        </div>

                        <div class="form-actions">
                            <button class="primary-btn" @click="saveDraft" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar' }}</button>
                            <button class="secondary-btn" @click="startNew">Nueva</button>
                            <button class="danger-btn" @click="deleteSelected" v-if="selectedIndex !== null">Eliminar</button>
                        </div>

                        <div class="move-box">
                            <label>
                                Mover a
                                <select v-model="targetCollection">
                                    <option v-for="key in COLLECTIONS" :key="key + '-move'" :value="key">{{ COLLECTION_LABELS[key] }}</option>
                                </select>
                            </label>
                            <button class="secondary-btn" @click="moveSelected">Mover serie</button>
                        </div>
                    </div>
                    <div v-else class="empty-state">Selecciona una serie existente o crea una nueva para editarla.</div>
                </section>
            </div>
        </div>
    `,
}).mount('#app');
