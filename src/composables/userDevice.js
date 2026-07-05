import { ref, onMounted, onUnmounted } from 'vue';

export function userDevice() {
  const isMobile = ref(window.innerWidth <= 768);

  const updateDevice = () => {
    isMobile.value = window.innerWidth <= 768;
  };

  onMounted(() => window.addEventListener('resize', updateDevice));
  onUnmounted(() => window.removeEventListener('resize', updateDevice));

  return { isMobile };
}