# Required SVG Files for Open Mercy Card Generation

## Status: ✅ COMPLETE

All required SVG files are now available! The card generation system can display all 168 cards correctly.

## Number Cards (0-9)

All number cards are available. Colors are handled via CSS filters.

- ✅ `zero-green.svg` - **AVAILABLE**
- ✅ `one-green.svg` - **AVAILABLE**
- ✅ `two-green.svg` - **AVAILABLE**
- ✅ `three-green.svg` - **AVAILABLE**
- ✅ `four-green.svg` - **AVAILABLE**
- ✅ `five-green.svg` - **AVAILABLE**
- ✅ `six-green.svg` - **AVAILABLE**
- ✅ `seven-swap-yellow.svg` - **AVAILABLE** (special 7 swap card)
- ✅ `eight-green.svg` - **AVAILABLE**
- ✅ `nine-green.svg` - **AVAILABLE**

## Action Cards

All action cards are available. Colors are handled via CSS filters.

- ✅ `skip-yellow.svg` - **AVAILABLE** (will be filtered to red/blue/green)
- ✅ `reverse-blue.svg` - **AVAILABLE** (will be filtered to red/green/yellow)
- ✅ `two-draw-green.svg` - **AVAILABLE** (will be filtered to red/blue/yellow)
- ✅ `four-draw-red.svg` - **AVAILABLE** (will be filtered to blue/green/yellow)
- ✅ `skip-everyone-red.svg` - **AVAILABLE** (will be filtered to blue/green/yellow)
- ✅ `discard-all-green.svg` - **AVAILABLE** (will be filtered to red/blue/yellow)

## Wild Cards

All wild cards are available.

- ✅ `wild-reverse-four-draw.svg` - **AVAILABLE**
- ✅ `wild-draw-six.svg` - **AVAILABLE**
- ✅ `wild-ten-draw.svg` - **AVAILABLE**
- ✅ `wild-roulette.svg` - **AVAILABLE**

## Notes

1. **Color Handling**: The system uses CSS filters to change colors dynamically. For example, `skip-yellow.svg` can be tinted to red, blue, or green.

2. **Number Cards**: Each number (0-9) has its own SVG file, ensuring accurate display of all number values.

3. **Action Cards**: Action cards use a single SVG per type and are color-filtered to display in all four colors (red, blue, green, yellow).

4. **Card Generation**: The system now correctly maps all 168 cards to their corresponding SVG files:
   - 80 number cards (2 of each 0-9 per color)
   - 52 action cards (Skip, Reverse, Draw Two, Draw Four, Skip Everyone, Discard All)
   - 24 wild cards (Wild Reverse Draw Four, Wild Draw Six, Wild Draw Ten, Wild Color Roulette)

## Total Files

- **Number cards**: 10 files (0-9, including special 7)
- **Action cards**: 6 files
- **Wild cards**: 4 files
- **Total**: 20 SVG files ✅ **ALL AVAILABLE**
