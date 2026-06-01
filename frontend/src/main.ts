import { createApp } from 'vue'
import { createPinia } from 'pinia'
import gsap from 'gsap'
import { CSSPlugin } from 'gsap/CSSPlugin'
import { Flip } from 'gsap/Flip'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import './style.css'
import App from './App.vue'

// CSSPlugin must be explicitly registered under Vite tree-shaking — without it
// every x/y/opacity/scale tween logs "Missing plugin?" warnings and no-ops.
gsap.registerPlugin(CSSPlugin, Flip, MotionPathPlugin)

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
