# UNO No Mercy - Card Generator

A beautiful, programmatic SVG card generator for UNO No Mercy game cards.

## Features

- 🎨 **Beautiful Visual Design**: Gradient backgrounds, layered shadows, and 3D effects
- ⚡ **High Performance**: SVG-based, cached generation, GPU-accelerated animations
- 🎯 **Fully Customizable**: Easy to theme and modify
- 📱 **Responsive**: Scales perfectly on all screen sizes
- 🎭 **Rich Animations**: Hover effects, glow pulses, shimmer effects

## Card Generator Architecture

### Structure

```
src/utils/cardGenerator/
├── index.ts              # Main CardGenerator class
├── generators/
│   ├── gradients.ts      # Gradient generators
│   ├── shadows.ts        # Shadow/filter generators
│   ├── content.ts        # Content generators (numbers, icons, text)
│   └── effects.ts        # Visual effects generators
├── helpers/
│   └── colorUtils.ts     # Color manipulation utilities
└── assets/
    └── icons.ts          # SVG icon paths
```

### Usage

```typescript
import { cardGenerator } from '@/utils/cardGenerator'
import type { Card } from '@/types/card'

// Generate a card SVG
const card: Card = {
  id: '1',
  color: 'red',
  type: 'number',
  value: 7,
  isPlayable: true
}

const svg = cardGenerator.generate(card, { width: 250, height: 350 })
```

### Vue Component

```vue
<template>
  <Card 
    :card="card"
    :is-playable="true"
    :size="{ width: 200, height: 280 }"
    @click="handleCardClick"
  />
</template>

<script setup>
import Card from '@/components/game/Card.vue'
</script>
```

## Card Types Supported

### Number Cards (0-9)
- All 4 colors (red, blue, green, yellow)
- Large, bold numbers with corner indicators
- Gradient backgrounds with depth

### Action Cards
- Skip
- Reverse
- Draw 2
- Skip Everyone (No Mercy)
- Discard All (No Mercy)

### Wild Cards
- Wild
- Wild Draw 4
- Wild Draw 6 (No Mercy)
- Wild Draw 10 (No Mercy)
- Wild Reverse Draw 4 (No Mercy)
- Wild Color Roulette (No Mercy)

## Visual Features

### Gradients
- Radial gradients for depth
- Multi-color gradients for wild cards
- Highlight overlays for 3D effect

### Shadows
- Multiple shadow layers
- Inner shadows for depth
- Text shadows for readability

### Effects
- Playable card glow (animated pulse)
- Wild card shimmer (animated sweep)
- Hover effects (lift, scale, rotate)
- Selection effects

## Styling

Cards are styled via CSS classes:
- `.uno-card` - Base card class
- `.playable` - Playable card (glow effect)
- `.selected` - Selected card (enhanced glow)
- `.wild-shimmer` - Wild card shimmer animation
- `.playable-glow` - Glow pulse animation

## Performance

- **Caching**: Generated SVGs are cached by card ID
- **Pre-generation**: Can pre-generate common cards on startup
- **GPU Acceleration**: CSS transforms for smooth animations
- **Optimized SVGs**: Minimal path complexity

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Next Steps

- [ ] Add more card variations
- [ ] Enhance animations
- [ ] Add card back design
- [ ] Implement card flip animation
- [ ] Add particle effects
- [ ] Optimize for mobile performance
