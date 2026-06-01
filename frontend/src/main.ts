import { createApp } from 'vue'
import { createPinia } from 'pinia'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import './style.css'
import App from './App.vue'

gsap.registerPlugin(Flip, MotionPathPlugin)

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
