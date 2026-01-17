/**
 * Generate SVG color variants for UNO cards
 * Creates Red, Blue, Green, Yellow versions of each card
 */

const fs = require('fs');
const path = require('path');

// Color palettes extracted from original SVGs
const COLOR_PALETTES = {
  green: {
    primary: ['#4B7442', '#4B7A43', '#497641', '#4D7D44', '#4F7F44', '#4C7643', '#4A7442', '#4A7342'],
    secondary: ['#528B4B', '#477040', '#4D7844', '#4D7545', '#4B7444', '#46703F', '#4C7A43', '#4A7943'],
    accent: ['#438839', '#4A7544', '#4A7742'],
  },
  red: {
    primary: ['#DC2424', '#E42323', '#E32323', '#E42223', '#E32223', '#E32424', '#E32324', '#E22122'],
    secondary: ['#DC2424', '#E42323', '#E32323', '#E42223', '#E32223', '#E32424', '#E32324', '#E22122'],
    accent: ['#E62726', '#DC2424', '#E42323'],
  },
  blue: {
    primary: ['#165D90', '#0F6199', '#12639A', '#016FB6', '#152B3F', '#143144', '#182B39', '#192733'],
    secondary: ['#165D90', '#0F6199', '#12639A', '#016FB6', '#143144', '#182B39', '#192733', '#152B3F'],
    accent: ['#016FB6', '#0F6199', '#165D90'],
  },
  yellow: {
    primary: ['#DEC43C', '#DBC241', '#D8BF3C', '#D9C037', '#DEC43F', '#D7BE3F', '#E0C53D', '#DEC540'],
    secondary: ['#DEC338', '#DBC036', '#E7CF4A', '#E3C941', '#E0C533', '#C2AC38', '#F2CD03', '#DEC43C'],
    accent: ['#F2CD03', '#E7CF4A', '#DEC43C'],
  },
};

// Map of source color ranges to their category
function getColorCategory(hexColor) {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  // Check if it's a gray/white/black (neutral)
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  
  if (saturation < 0.15) {
    return 'neutral'; // Gray/white/black - don't change
  }
  
  // Determine dominant color
  if (g > r && g > b && g > 50) return 'green';
  if (r > g && r > b && r > 100) return 'red';
  if (b > r && b > g && b > 50) return 'blue';
  if (r > 150 && g > 150 && b < 100) return 'yellow';
  if (g > 60 && g < 140 && r < 100 && b < 100) return 'green'; // Dark greens
  
  return 'neutral';
}

// Convert hex to HSL
function hexToHSL(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

// Convert HSL to hex
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

// Target hue values for each color
const TARGET_HUES = {
  red: 0,
  yellow: 50,
  green: 120,
  blue: 210,
};

// Transform a color to target color while preserving saturation and lightness
function transformColor(hexColor, targetColor) {
  if (targetColor === 'neutral' || !hexColor.match(/^#[0-9A-Fa-f]{6}$/)) {
    return hexColor;
  }
  
  const category = getColorCategory(hexColor);
  if (category === 'neutral') {
    return hexColor; // Don't change neutral colors
  }
  
  const hsl = hexToHSL(hexColor);
  const targetHue = TARGET_HUES[targetColor];
  
  // Shift the hue to target color
  return hslToHex(targetHue, hsl.s, hsl.l);
}

// Process SVG content and replace colors
function transformSVG(svgContent, targetColor) {
  // Find all fill colors and replace them
  return svgContent.replace(/fill="#([0-9A-Fa-f]{6})"/gi, (match, hex) => {
    const originalColor = `#${hex}`;
    const newColor = transformColor(originalColor, targetColor);
    return `fill="${newColor}"`;
  });
}

// Main function to generate all variants
async function generateVariants() {
  const svgDir = path.join(__dirname, '../src/assets/cards-svgs');
  const outputDir = svgDir; // Output to same directory
  
  // Cards to generate variants for (base files that exist)
  const numberCards = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven-swap', 'eight', 'nine'];
  const actionCards = ['skip', 'reverse', 'two-draw', 'four-draw', 'skip-everyone', 'discard-all'];
  const colors = ['red', 'blue', 'green', 'yellow'];
  
  console.log('Generating SVG color variants...\n');
  
  // Process number cards
  for (const card of numberCards) {
    // Find source file (could be any color)
    let sourceFile = null;
    let sourceColor = null;
    
    for (const color of colors) {
      const testPath = path.join(svgDir, `${card}-${color}.svg`);
      if (fs.existsSync(testPath)) {
        sourceFile = testPath;
        sourceColor = color;
        break;
      }
    }
    
    if (!sourceFile) {
      console.log(`⚠️  No source found for ${card}`);
      continue;
    }
    
    console.log(`Processing ${card} (source: ${sourceColor})`);
    const svgContent = fs.readFileSync(sourceFile, 'utf8');
    
    // Generate variants for each color
    for (const targetColor of colors) {
      const outputPath = path.join(outputDir, `${card}-${targetColor}.svg`);
      
      if (targetColor === sourceColor) {
        console.log(`  ✓ ${targetColor} (original)`);
        continue;
      }
      
      const transformedSVG = transformSVG(svgContent, targetColor);
      fs.writeFileSync(outputPath, transformedSVG);
      console.log(`  ✓ ${targetColor} generated`);
    }
  }
  
  // Process action cards
  for (const card of actionCards) {
    let sourceFile = null;
    let sourceColor = null;
    
    for (const color of colors) {
      const testPath = path.join(svgDir, `${card}-${color}.svg`);
      if (fs.existsSync(testPath)) {
        sourceFile = testPath;
        sourceColor = color;
        break;
      }
    }
    
    if (!sourceFile) {
      console.log(`⚠️  No source found for ${card}`);
      continue;
    }
    
    console.log(`Processing ${card} (source: ${sourceColor})`);
    const svgContent = fs.readFileSync(sourceFile, 'utf8');
    
    for (const targetColor of colors) {
      const outputPath = path.join(outputDir, `${card}-${targetColor}.svg`);
      
      if (targetColor === sourceColor) {
        console.log(`  ✓ ${targetColor} (original)`);
        continue;
      }
      
      const transformedSVG = transformSVG(svgContent, targetColor);
      fs.writeFileSync(outputPath, transformedSVG);
      console.log(`  ✓ ${targetColor} generated`);
    }
  }
  
  console.log('\n✅ All SVG variants generated!');
}

generateVariants().catch(console.error);

