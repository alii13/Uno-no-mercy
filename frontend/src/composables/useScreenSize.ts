import { ref, computed, onMounted, onUnmounted } from 'vue'

const screenWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1920)

let listenerCount = 0
let resizeTimeout: ReturnType<typeof setTimeout> | null = null

function handleResize() {
  if (resizeTimeout) clearTimeout(resizeTimeout)
  resizeTimeout = setTimeout(() => {
    screenWidth.value = window.innerWidth
  }, 100)
}

export function useScreenSize() {
  const isMobile = computed(() => screenWidth.value <= 480)
  const isTablet = computed(() => screenWidth.value <= 768 && screenWidth.value > 480)
  const isDesktop = computed(() => screenWidth.value > 768)

  onMounted(() => {
    if (listenerCount === 0) {
      window.addEventListener('resize', handleResize)
    }
    listenerCount++
    screenWidth.value = window.innerWidth
  })

  onUnmounted(() => {
    listenerCount--
    if (listenerCount === 0) {
      window.removeEventListener('resize', handleResize)
      if (resizeTimeout) clearTimeout(resizeTimeout)
    }
  })

  return { screenWidth, isMobile, isTablet, isDesktop }
}
