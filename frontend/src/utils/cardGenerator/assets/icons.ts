/**
 * SVG icon paths for action cards
 */

export const ACTION_ICONS: Record<string, string> = {
  skip: 'M 8 20 L 20 12 L 20 16 L 32 16 L 32 24 L 20 24 L 20 28 Z',
  reverse: 'M 12 16 L 8 20 L 12 24 M 28 16 L 32 20 L 28 24 M 20 12 L 20 28',
  draw2: 'M 16 16 L 24 16 M 20 12 L 20 20 M 12 24 L 28 24',
  skipEveryone: 'M 8 16 L 16 12 L 16 20 M 24 16 L 32 12 L 32 20 M 12 24 L 28 24',
  discardAll: 'M 8 12 L 32 12 M 8 20 L 32 20 M 8 28 L 32 28',
}

export const WILD_ICONS: Record<string, string> = {
  wild: 'M 20 12 L 24 20 L 16 20 Z M 20 28 L 16 20 L 24 20 Z',
  draw4: 'M 12 16 L 28 16 M 20 8 L 20 24',
  draw6: 'M 10 16 L 30 16 M 20 6 L 20 26',
  draw10: 'M 8 16 L 32 16 M 20 4 L 20 28',
  wildReverseDraw4: 'M 12 16 L 8 20 L 12 24 M 28 16 L 32 20 L 28 24 M 20 12 L 20 28',
  wildColorRoulette: 'M 20 8 L 20 32 M 8 20 L 32 20 M 12 12 L 28 28 M 28 12 L 12 28',
}

export function getActionIcon(actionType: string): string {
  return ACTION_ICONS[actionType] || ACTION_ICONS.skip || ''
}

export function getWildIcon(wildType: string): string {
  return WILD_ICONS[wildType] || WILD_ICONS.wild || ''
}

export function getActionLabel(actionType: string): string {
  const labels: Record<string, string> = {
    skip: 'SKIP',
    reverse: 'REVERSE',
    draw2: 'DRAW 2',
    skipEveryone: 'SKIP ALL',
    discardAll: 'DISCARD ALL',
  }
  return labels[actionType] || actionType.toUpperCase()
}

