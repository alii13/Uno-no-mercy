/**
 * Persistent WebGL FX layer. One transparent three.js canvas, mounted once per
 * game, fixed over the viewport and pointer-transparent. Every particle-, glow-,
 * or shockwave-driven effect draws into it; flat single-element transforms stay
 * in CSS/GSAP where WebGL would be wasted battery.
 *
 * Coordinates are CSS pixels: an orthographic camera maps (0,0)=top-left to
 * (width,height)=bottom-right, so callers pass getBoundingClientRect centers
 * straight through — the same convention useGameFeel already uses.
 *
 * The render loop is idle-cheap: requestAnimationFrame only runs while live
 * particles, rings, or ambient heat exist, and stops the moment the pool drains.
 * An idle table costs nothing.
 */

import * as THREE from 'three'
import { fxKnobs } from './quality'
import type { FxColor } from './useGameFx'

const PALETTE: Record<FxColor, number> = {
  red: 0xff2a2a,
  blue: 0x00bfff,
  green: 0x00ff66,
  yellow: 0xffcc00,
  wild: 0xff66dd,
}

const PARTICLE_VERT = `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize;
  }
`

const PARTICLE_FRAG = `
  precision mediump float;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    // Soft round sprite with a hot core, generated in-shader (no texture).
    float d = length(gl_PointCoord - vec2(0.5));
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    float core = smoothstep(0.18, 0.0, d) * vAlpha;
    gl_FragColor = vec4(vColor + core * 0.6, a);
  }
`

const RING_FRAG = `
  precision mediump float;
  uniform float uProgress;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float d = distance(vUv, vec2(0.5));
    float radius = uProgress * 0.5;
    float width = 0.06 * (1.0 - uProgress) + 0.012;
    float ring = smoothstep(width, 0.0, abs(d - radius));
    float fade = 1.0 - uProgress;
    gl_FragColor = vec4(uColor, ring * fade * uOpacity);
  }
`

const RING_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const RING_POOL = 6

interface RingState {
  mesh: THREE.Mesh
  material: THREE.ShaderMaterial
  uProgress: THREE.IUniform<number>
  uColor: THREE.IUniform<THREE.Color>
  uOpacity: THREE.IUniform<number>
  active: boolean
  progress: number
  speed: number // progress units per second
}

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.OrthographicCamera | null = null
let canvas: HTMLCanvasElement | null = null

let points: THREE.Points | null = null
let posAttr: THREE.BufferAttribute | null = null
let sizeAttr: THREE.BufferAttribute | null = null
let alphaAttr: THREE.BufferAttribute | null = null
let colorAttr: THREE.BufferAttribute | null = null

// CPU-side particle state (parallel arrays, indexed by slot)
let max = 0
let cursor = 0
let alive = 0
let vx: Float32Array = new Float32Array(0)
let vy: Float32Array = new Float32Array(0)
let life: Float32Array = new Float32Array(0)
let maxLife: Float32Array = new Float32Array(0)
let grav: Float32Array = new Float32Array(0)
let size0: Float32Array = new Float32Array(0)

let rings: RingState[] = []

// Ambient heat: 0..1. While > 0 the loop keeps spawning embers.
let heatLevel = 0
let heatOrigin: { x: number; y: number } | null = null
let heatCarry = 0 // fractional embers-per-frame accumulator

let running = false
let lastTs = 0
let available = false

// Stats for the debug panel
let fps = 0

const _color = new THREE.Color()

function viewport() {
  return { w: window.innerWidth, h: window.innerHeight }
}

export function isFxCanvasAvailable(): boolean {
  return available
}

export function mountFxCanvas(): void {
  if (renderer || typeof window === 'undefined') return
  const knobs = fxKnobs()
  if (knobs.tier === 'reduced') return // no WebGL under reduced motion

  const { w, h } = viewport()

  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, premultipliedAlpha: false })
  } catch {
    renderer = null
    available = false
    return
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, knobs.dprCap))
  renderer.setSize(w, h)
  renderer.setClearColor(0x000000, 0)

  canvas = renderer.domElement
  canvas.setAttribute('data-fx-canvas', '')
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '2110', // above flying/thrown card clones (z 1000-2100) so particles read
  })
  document.body.appendChild(canvas)

  canvas.addEventListener('webglcontextlost', onContextLost, false)

  scene = new THREE.Scene()
  camera = new THREE.OrthographicCamera(0, w, 0, h, -1000, 1000)
  camera.position.z = 10

  max = knobs.maxParticles
  buildParticles()
  buildRings()

  available = true
}

export function unmountFxCanvas(): void {
  running = false
  heatLevel = 0
  alive = 0
  available = false
  if (canvas) {
    canvas.removeEventListener('webglcontextlost', onContextLost, false)
    canvas.remove()
  }
  points?.geometry.dispose()
  ;(points?.material as THREE.Material | undefined)?.dispose()
  rings.forEach((r) => {
    r.mesh.geometry.dispose()
    r.material.dispose()
  })
  rings = []
  renderer?.dispose()
  renderer = null
  scene = null
  camera = null
  canvas = null
  points = null
  posAttr = sizeAttr = alphaAttr = colorAttr = null
}

function onContextLost(e: Event): void {
  e.preventDefault()
  running = false
  available = false // callers fall back to the DOM path
}

function buildParticles(): void {
  const geo = new THREE.BufferGeometry()
  const positions = new Float32Array(max * 3)
  const colors = new Float32Array(max * 3)
  const sizes = new Float32Array(max)
  const alphas = new Float32Array(max)

  posAttr = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage)
  colorAttr = new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage)
  sizeAttr = new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage)
  alphaAttr = new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage)

  geo.setAttribute('position', posAttr)
  geo.setAttribute('aColor', colorAttr)
  geo.setAttribute('aSize', sizeAttr)
  geo.setAttribute('aAlpha', alphaAttr)

  const mat = new THREE.ShaderMaterial({
    vertexShader: PARTICLE_VERT,
    fragmentShader: PARTICLE_FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  scene!.add(points)

  vx = new Float32Array(max)
  vy = new Float32Array(max)
  life = new Float32Array(max)
  maxLife = new Float32Array(max)
  grav = new Float32Array(max)
  size0 = new Float32Array(max)
}

function buildRings(): void {
  const geo = new THREE.PlaneGeometry(1, 1)
  for (let i = 0; i < RING_POOL; i++) {
    const uProgress: THREE.IUniform<number> = { value: 0 }
    const uColor: THREE.IUniform<THREE.Color> = { value: new THREE.Color(0xffffff) }
    const uOpacity: THREE.IUniform<number> = { value: 1 }
    const material = new THREE.ShaderMaterial({
      vertexShader: RING_VERT,
      fragmentShader: RING_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uProgress, uColor, uOpacity },
    })
    const mesh = new THREE.Mesh(geo, material)
    mesh.visible = false
    mesh.frustumCulled = false
    scene!.add(mesh)
    rings.push({ mesh, material, uProgress, uColor, uOpacity, active: false, progress: 0, speed: 1 })
  }
}

function rgbFor(color: FxColor): [number, number, number] {
  _color.set(PALETTE[color] ?? PALETTE.wild)
  return [_color.r, _color.g, _color.b]
}

function spawn(
  x: number,
  y: number,
  velX: number,
  velY: number,
  size: number,
  ttl: number,
  gravity: number,
  rgb: [number, number, number],
): void {
  if (!posAttr) return
  const i = cursor
  cursor = (cursor + 1) % max
  if (life[i]! <= 0) alive++ // reusing a dead slot adds one live particle

  const p = i * 3
  ;(posAttr.array as Float32Array)[p] = x
  ;(posAttr.array as Float32Array)[p + 1] = y
  ;(posAttr.array as Float32Array)[p + 2] = 0
  ;(colorAttr!.array as Float32Array)[p] = rgb[0]
  ;(colorAttr!.array as Float32Array)[p + 1] = rgb[1]
  ;(colorAttr!.array as Float32Array)[p + 2] = rgb[2]

  vx[i] = velX
  vy[i] = velY
  life[i] = ttl
  maxLife[i] = ttl
  grav[i] = gravity
  size0[i] = size
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

// ---- Public emit API ------------------------------------------------------

/** Omnidirectional shard/spark burst — card impact, UNO flare, KO pop. */
export function burst(x: number, y: number, color: FxColor, count = 14): void {
  if (!available) return
  const rgb = rgbFor(color)
  const n = Math.round(count * fxKnobs().particleScale)
  for (let i = 0; i < n; i++) {
    const ang = rand(0, Math.PI * 2)
    const speed = rand(120, 380)
    spawn(x, y, Math.cos(ang) * speed, Math.sin(ang) * speed - rand(20, 90), rand(6, 14), rand(0.45, 0.75), 900, rgb)
  }
  requestFrame()
}

/** Expanding shader ring — power-card slam, skip payoff. */
export function shockwave(x: number, y: number, color: FxColor, radius = 260, duration = 0.6): void {
  if (!available) return
  const ring = rings.find((r) => !r.active)
  if (!ring) return
  const [r, g, b] = rgbFor(color)
  ring.uColor.value.setRGB(r, g, b)
  ring.uProgress.value = 0
  ring.uOpacity.value = 1
  ring.mesh.position.set(x, y, 0)
  ring.mesh.scale.set(radius * 2, radius * 2, 1)
  ring.mesh.visible = true
  ring.active = true
  ring.progress = 0
  ring.speed = 1 / duration
  requestFrame()
}

/** Directional trail from A to B — draw-stack eat spray toward the victim. */
export function spray(x0: number, y0: number, x1: number, y1: number, color: FxColor, count = 24): void {
  if (!available) return
  const rgb = rgbFor(color)
  const n = Math.round(count * fxKnobs().particleScale)
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  const nx = dx / len
  const ny = dy / len
  for (let i = 0; i < n; i++) {
    const speed = rand(260, 520)
    const spread = rand(-0.5, 0.5)
    const vxi = (nx * Math.cos(spread) - ny * Math.sin(spread)) * speed
    const vyi = (nx * Math.sin(spread) + ny * Math.cos(spread)) * speed
    spawn(x0, y0, vxi, vyi, rand(5, 11), rand(0.35, 0.6), 300, rgb)
  }
  requestFrame()
}

/** Multi-colour celebratory burst — fans upward, then falls under gravity. */
export function confetti(x: number, y: number, count = 90): void {
  if (!available) return
  const cols: FxColor[] = ['red', 'blue', 'green', 'yellow', 'wild']
  const n = Math.round(count * fxKnobs().particleScale)
  for (let i = 0; i < n; i++) {
    const rgb = rgbFor(cols[i % cols.length]!)
    const ang = -Math.PI / 2 + rand(-0.95, 0.95) // upward fan
    const speed = rand(300, 660)
    spawn(x, y, Math.cos(ang) * speed, Math.sin(ang) * speed, rand(6, 12), rand(1.1, 1.9), 720, rgb)
  }
  requestFrame()
}

/** Ambient table heat, 0..1 — embers keep rising while level > 0. */
export function setHeat(level: number, origin?: { x: number; y: number }): void {
  heatLevel = Math.max(0, Math.min(1, level))
  if (origin) heatOrigin = origin
  if (available && heatLevel > 0) requestFrame()
}

// ---- Loop -----------------------------------------------------------------

function requestFrame(): void {
  if (running || !available) return
  running = true
  lastTs = 0
  requestAnimationFrame(tick)
}

function tick(ts: number): void {
  if (!running || !renderer || !scene || !camera) return
  const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0.016
  lastTs = ts
  fps = fps ? fps * 0.9 + (1 / Math.max(dt, 0.001)) * 0.1 : 1 / Math.max(dt, 0.001)

  emitHeat(dt)
  const liveParticles = integrateParticles(dt)
  const liveRings = integrateRings(dt)

  renderer.render(scene, camera)

  if (liveParticles || liveRings || heatLevel > 0) {
    requestAnimationFrame(tick)
  } else {
    running = false
  }
}

function emitHeat(dt: number): void {
  if (heatLevel <= 0 || !fxKnobs().atmospherics) return
  const { w, h } = viewport()
  const ox = heatOrigin?.x ?? w / 2
  const oy = heatOrigin?.y ?? h * 0.58
  heatCarry += heatLevel * 22 * dt
  const emit = Math.floor(heatCarry)
  heatCarry -= emit
  for (let i = 0; i < emit; i++) {
    // warm ember: orange-red, rises (negative y velocity), slight drift
    _color.setRGB(1, rand(0.25, 0.55), 0.08)
    spawn(ox + rand(-70, 70), oy + rand(-10, 20), rand(-20, 20), rand(-70, -130), rand(4, 9), rand(0.7, 1.2), -60, [_color.r, _color.g, _color.b])
  }
}

function integrateParticles(dt: number): boolean {
  if (!posAttr || !alphaAttr || !sizeAttr || !colorAttr || alive <= 0) return false
  const pos = posAttr.array as Float32Array
  const alphas = alphaAttr.array as Float32Array
  const sizes = sizeAttr.array as Float32Array
  let anyLive = false

  for (let i = 0; i < max; i++) {
    let l = life[i]!
    if (l <= 0) {
      alphas[i] = 0
      continue
    }
    l -= dt
    if (l <= 0) {
      life[i] = 0
      alphas[i] = 0
      alive = Math.max(0, alive - 1)
      continue
    }
    life[i] = l
    const nvy = vy[i]! + grav[i]! * dt
    vy[i] = nvy
    const p = i * 3
    pos[p] = pos[p]! + vx[i]! * dt
    pos[p + 1] = pos[p + 1]! + nvy * dt
    const t = l / maxLife[i]!
    alphas[i] = t
    sizes[i] = size0[i]! * (0.4 + t * 0.6)
    anyLive = true
  }

  posAttr.needsUpdate = true
  alphaAttr.needsUpdate = true
  sizeAttr.needsUpdate = true
  colorAttr.needsUpdate = true
  return anyLive
}

function integrateRings(dt: number): boolean {
  let any = false
  for (const r of rings) {
    if (!r.active) continue
    r.progress += r.speed * dt
    if (r.progress >= 1) {
      r.active = false
      r.mesh.visible = false
      continue
    }
    r.uProgress.value = r.progress
    any = true
  }
  return any
}

// ---- Resize + stats -------------------------------------------------------

export function resizeFxCanvas(): void {
  if (!renderer || !camera) return
  const { w, h } = viewport()
  renderer.setSize(w, h)
  camera.right = w
  camera.bottom = h
  camera.updateProjectionMatrix()
}

export function getFxStats(): { fps: number; particles: number; drawCalls: number; tier: string } {
  return {
    fps: Math.round(fps),
    particles: alive,
    drawCalls: renderer?.info.render.calls ?? 0,
    tier: fxKnobs().tier,
  }
}
