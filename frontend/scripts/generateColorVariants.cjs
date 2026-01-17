/**
 * Generate SVG color variants for UNO cards
 * PRESERVES white (number fills) and very dark colors (outlines/borders)
 * Converts all card colors to target color
 */

const fs = require('fs');
const path = require('path');

const TARGET_COLORS = {
  red: '#F20403',
  blue: '#047AF2',
  green: '#428835',
  yellow: '#F1CF03',
};

function isCardColor(hexColor) {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  const lightness = (r + g + b) / 3;
  
  // KEEP very dark colors (black outlines) - lightness < 60
  if (lightness < 60) return false;
  
  // KEEP white/cream (lightness > 230)
  if (lightness > 230) return false;
  
  // KEEP grays (low saturation AND medium lightness)
  if (saturation < 0.15 && lightness < 180) return false;
  
  return true;
}

function transformColor(hexColor, targetColorName) {
  if (!hexColor.match(/^#[0-9A-Fa-f]{6}$/)) return hexColor;
  if (!isCardColor(hexColor)) return hexColor;
  return TARGET_COLORS[targetColorName];
}

function ensureViewBox(svgContent) {
  let result = svgContent;
  
  // Remove XML declaration if present
  result = result.replace(/<\?xml[^>]*\?>\s*/gi, '');
  
  // Ensure viewBox is set correctly
  if (!result.match(/viewBox="[^"]*"/i)) {
    result = result.replace(/<svg([^>]*)>/i, `<svg$1 viewBox="0 0 1696 2528">`);
  }
  
  return result;
}

function transformSVG(svgContent, targetColor) {
  // Ensure viewBox is set
  let result = ensureViewBox(svgContent);
  
  // Transform colors
  result = result.replace(/fill="#([0-9A-Fa-f]{6})"/gi, (match, hex) => {
    return `fill="${transformColor('#' + hex, targetColor)}"`;
  });
  
  return result;
}

async function generateVariants() {
  const originalDir = path.join(__dirname, '../../cards-svgs');
  const outputDir = path.join(__dirname, '../src/assets/cards-svgs');
  
  const cardSources = {
    'zero': 'zero-green.svg',
    'one': 'one-green.svg',
    'two': 'two-green.svg',
    'three': 'three-green.svg',
    'four': 'four-green.svg',
    'five': 'five-green.svg',
    'six': 'six-green.svg',
    'seven-swap': 'seven-swap-yellow.svg',
    'eight': 'eight-green.svg',
    'nine': 'nine-green.svg',
    'skip': 'skip-yellow.svg',
    'reverse': 'reverse-blue.svg',
    'two-draw': 'two-draw-green.svg',
    'four-draw': 'four-draw-red.svg',
    'skip-everyone': 'skip-everyone-red.svg',
    'discard-all': 'discard-all-green.svg',
  };
  
  const colors = ['red', 'blue', 'green', 'yellow'];
  
  console.log('Generating SVG variants');
  console.log('');
  
  for (const [cardName, sourceFileName] of Object.entries(cardSources)) {
    const sourcePath = path.join(originalDir, sourceFileName);
    
    if (!fs.existsSync(sourcePath)) {
      console.log(`⚠️  Source not found: ${sourceFileName}`);
      continue;
    }
    
    console.log(`Processing ${cardName} (from ${sourceFileName})`);
    const svgContent = fs.readFileSync(sourcePath, 'utf8');
    
    for (const targetColor of colors) {
      const outputPath = path.join(outputDir, `${cardName}-${targetColor}.svg`);
      const transformedSVG = transformSVG(svgContent, targetColor);
      fs.writeFileSync(outputPath, transformedSVG);
      console.log(`  ✓ ${targetColor}`);
    }
  }
  
  // Copy wild cards
  const wildCards = ['wild-ten-draw.svg', 'wild-reverse-four-draw.svg', 'wild-roulette.svg', 'wild-draw-six.svg'];
  for (const wildCard of wildCards) {
    const src = path.join(originalDir, wildCard);
    const dest = path.join(outputDir, wildCard);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`Copied: ${wildCard}`);
    }
  }
  
  console.log('\n✅ Done!');
}

generateVariants().catch(console.error);
