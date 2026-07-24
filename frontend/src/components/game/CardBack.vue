<template>
  <div
    class="card-back"
    :style="{
      width: `${size.width}px`,
      height: `${size.height}px`,
      // Per-instance skin override (someone else's seat). Undefined values
      // are dropped by Vue, so the root-level equipped skin still applies.
      '--card-back-accent': accent,
      '--card-back-stripe': stripe,
    }"
  >
    <svg 
      :width="size.width" 
      :height="size.height" 
      viewBox="0 0 250 350" 
      xmlns="http://www.w3.org/2000/svg"
      class="card-back-svg"
    >
      <!-- Base Card Shape -->
      <rect 
        x="0" y="0" 
        width="250" height="350" 
        rx="16" ry="16"
        fill="#111"
      />

      <!-- Industrial Plate Texture -->
      <rect 
        x="6" y="6" 
        width="238" height="338" 
        rx="12" ry="12"
        fill="url(#plateGradient)"
        stroke="#333"
        stroke-width="2"
      />
      
      <!-- Hazard Stripes Top/Bottom -->
      <path d="M 6 40 L 244 40" stroke="url(#hazardStripe)" stroke-width="12" />
      <path d="M 6 310 L 244 310" stroke="url(#hazardStripe)" stroke-width="12" />

      <!-- Center Warning Circle -->
      <circle 
        cx="125" cy="175" 
        r="90" 
        fill="none" 
        stroke="rgba(255,255,255,0.1)" 
        stroke-width="2" 
        stroke-dasharray="10 5"
      />
      
      <circle 
        cx="125" cy="175" 
        r="75" 
        fill="#000" 
        style="stroke: var(--card-back-accent, #ff3333)" 
        stroke-width="4"
      />

      <!-- NO MERCY Text -->
      <text 
        x="125" y="165" 
        font-family="Black Ops One, cursive" 
        font-size="42" 
        style="fill: var(--card-back-accent, #ff3333)"
        text-anchor="middle"
        dominant-baseline="middle"
      >NO</text>
      <text 
        x="125" y="205" 
        font-family="Black Ops One, cursive" 
        font-size="32" 
        fill="#e6e6e6"
        text-anchor="middle"
        dominant-baseline="middle"
      >MERCY</text>
      
      <!-- Definitions -->
      <defs>
        <linearGradient id="plateGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#2a2a2a" />
          <stop offset="100%" style="stop-color:#1a1a1a" />
        </linearGradient>

        <pattern id="hazardStripe" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect x="0" y="0" width="10" height="20" style="fill: var(--card-back-stripe, #ffcc00)" />
          <rect x="10" y="0" width="10" height="20" fill="#000" />
        </pattern>
      </defs>
    </svg>
    
    <!-- Scratches Overlay -->
    <div class="scratches"></div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  size?: { width: number; height: number }
  /** Skin override for rendering someone else's card back. */
  accent?: string
  stripe?: string
}

withDefaults(defineProps<Props>(), {
  size: () => ({ width: 100, height: 140 }),
  accent: undefined,
  stripe: undefined,
})
</script>

<style scoped>
.card-back {
  display: inline-block;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  box-shadow: 
    0 10px 20px rgba(0,0,0,0.5),
    inset 0 0 0 1px rgba(255,255,255,0.1);
}

.scratches {
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    135deg,
    rgba(255,255,255,0.03) 0px,
    rgba(255,255,255,0.03) 1px,
    transparent 1px,
    transparent 10px
  );
  pointer-events: none;
  opacity: 0.5;
}
</style>
