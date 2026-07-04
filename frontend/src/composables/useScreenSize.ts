import { ref, computed, onMounted, onUnmounted } from 'vue'

const hasWindow = typeof window !== 'undefined'

const screenWidth = ref(hasWindow ? window.innerWidth : 1920)
const screenHeight = ref(hasWindow ? window.innerHeight : 1080)

// Pointer type is a device trait, not a size — resolved once via matchMedia and
// kept in a module singleton so every caller shares it (and any hybrid-device
// switch updates them all).
const isCoarsePointer = ref(
  hasWindow && typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false
)
let pointerMql: MediaQueryList | null = null
function setupPointer() {
  if (pointerMql || !hasWindow || typeof window.matchMedia !== 'function') return
  pointerMql = window.matchMedia('(pointer: coarse)')
  pointerMql.addEventListener('change', (e) => {
    isCoarsePointer.value = e.matches
  })
}

let listenerCount = 0
let resizeTimeout: ReturnType<typeof setTimeout> | null = null

function handleResize() {
  if (resizeTimeout) clearTimeout(resizeTimeout)
  resizeTimeout = setTimeout(() => {
    screenWidth.value = window.innerWidth
    screenHeight.value = window.innerHeight
  }, 100)
}

export function useScreenSize() {
  const isMobile = computed(() => screenWidth.value <= 480)
  const isTablet = computed(() => screenWidth.value <= 768 && screenWidth.value > 480)
  const isDesktop = computed(() => screenWidth.value > 768)

  // A short landscape phone (or split-screen) — the arena drops to its compact
  // landscape layout here rather than the portrait height budget.
  const isShortLandscape = computed(
    () => screenWidth.value > screenHeight.value && screenHeight.value <= 600
  )

  onMounted(() => {
    if (listenerCount === 0) {
      window.addEventListener('resize', handleResize)
    }
    listenerCount++
    screenWidth.value = window.innerWidth
    screenHeight.value = window.innerHeight
    setupPointer()
  })

  onUnmounted(() => {
    listenerCount--
    if (listenerCount === 0) {
      window.removeEventListener('resize', handleResize)
      if (resizeTimeout) clearTimeout(resizeTimeout)
    }
  })

  return { screenWidth, screenHeight, isMobile, isTablet, isDesktop, isShortLandscape, isCoarsePointer }
}
