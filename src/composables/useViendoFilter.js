import { ref } from 'vue'

// Estado global compartido: Viendo y Dashboard usan el mismo switch
const mostrarTodas = ref(false)

export function useViendoFilter() {
    const filtrar = (lista = []) =>
        mostrarTodas.value ? lista : lista.filter((s) => !s.viendo_con_alguien)

    const ocultas = (lista = []) =>
        mostrarTodas.value ? 0 : lista.filter((s) => s.viendo_con_alguien).length

    const hayConAlguien = (lista = []) => lista.some((s) => s.viendo_con_alguien)

    return { mostrarTodas, filtrar, ocultas, hayConAlguien }
}