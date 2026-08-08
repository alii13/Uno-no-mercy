/**
 * Generate a 1080x1920 share image for a winning game. Pure canvas, no
 * dependencies — the result is a Blob the caller can hand to the Web Share
 * API or download as a PNG.
 *
 * Format is vertical (story aspect) since most casual shares end up on
 * Instagram / WhatsApp Status / X cards which all favor 9:16.
 */

interface ShareImagePayload {
    isWinner: boolean
    opponentName: string  // For "I beat {opponent}"
    cardsPlayed: number
    biggestStack: number
    unosCalled: number
    peakHand: number
    siteUrl: string  // Footer URL
}

const W = 1080
const H = 1920

function drawBackground(ctx: CanvasRenderingContext2D) {
    // Radial dark gradient — same as the game bg pattern.
    const g = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W)
    g.addColorStop(0, '#18191b')
    g.addColorStop(1, '#0a0a0b')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    // Subtle 45deg stripe overlay
    ctx.save()
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'
    ctx.translate(W / 2, H / 2)
    ctx.rotate(Math.PI / 4)
    for (let i = -W; i < W; i += 8) {
        ctx.fillRect(i, -H, 2, H * 2)
    }
    ctx.restore()

    // Danger tape strips at top and bottom — brand recognition
    drawDangerTape(ctx, 0, 0, W, 24)
    drawDangerTape(ctx, 0, H - 24, W, 24)
}

function drawDangerTape(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.save()
    ctx.fillStyle = '#ffcc00'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = '#0a0a0b'
    const stripeW = 36
    for (let i = -h; i < w + h; i += stripeW * 2) {
        ctx.beginPath()
        ctx.moveTo(x + i, y)
        ctx.lineTo(x + i + stripeW, y)
        ctx.lineTo(x + i + stripeW + h, y + h)
        ctx.lineTo(x + i + h, y + h)
        ctx.closePath()
        ctx.fill()
    }
    ctx.restore()
}

function drawTitle(ctx: CanvasRenderingContext2D) {
    // OPEN MERCY logo, large
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    // OPEN — huge red glow
    ctx.font = 'bold 240px "Black Ops One", Impact, sans-serif'
    ctx.fillStyle = '#ff2a2a'
    ctx.shadowColor = 'rgba(255, 42, 42, 0.7)'
    ctx.shadowBlur = 40
    ctx.fillText('OPEN', W / 2, 140)

    // MERCY — smaller, gold
    ctx.shadowColor = 'rgba(255, 204, 0, 0.55)'
    ctx.shadowBlur = 25
    ctx.font = 'bold 96px "Black Ops One", Impact, sans-serif'
    ctx.fillStyle = '#ffcc00'
    ctx.fillText('MERCY', W / 2, 400)
    ctx.restore()
}

function drawVerdict(ctx: CanvasRenderingContext2D, payload: ShareImagePayload) {
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    // Verdict stamp
    ctx.translate(W / 2, 620)
    ctx.rotate(-0.05)
    ctx.font = 'bold 180px "Black Ops One", Impact, sans-serif'
    if (payload.isWinner) {
        ctx.fillStyle = '#ffcc00'
        ctx.shadowColor = 'rgba(255, 204, 0, 0.5)'
        ctx.shadowBlur = 35
        ctx.fillText('VICTORY', 0, 0)
    } else {
        ctx.fillStyle = '#ff2a2a'
        ctx.shadowColor = 'rgba(255, 42, 42, 0.5)'
        ctx.shadowBlur = 35
        ctx.fillText('DEFEATED', 0, 0)
    }
    ctx.restore()

    // Sub-line
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.font = '32px "Chakra Petch", sans-serif'
    ctx.fillStyle = '#a1a1aa'
    const subline = payload.isWinner
        ? `I broke ${payload.opponentName}.`
        : `${payload.opponentName} broke me.`
    ctx.fillText(subline, W / 2, 840)
    ctx.restore()
}

function drawStats(ctx: CanvasRenderingContext2D, payload: ShareImagePayload) {
    // 2x2 grid of stats
    ctx.save()
    const cells = [
        { value: String(payload.cardsPlayed), label: 'CARDS PLAYED' },
        { value: String(payload.biggestStack), label: 'BIGGEST STACK' },
        { value: String(payload.unosCalled), label: 'MERCY CALLS' },
        { value: String(payload.peakHand), label: 'PEAK HAND' },
    ]

    const gridLeft = 120
    const gridTop = 1020
    const cellW = 420
    const cellH = 220
    const gapX = 60
    const gapY = 60

    cells.forEach((cell, i) => {
        const col = i % 2
        const row = Math.floor(i / 2)
        const x = gridLeft + col * (cellW + gapX)
        const y = gridTop + row * (cellH + gapY)

        // Cell border
        ctx.strokeStyle = 'rgba(255, 204, 0, 0.18)'
        ctx.lineWidth = 2
        ctx.strokeRect(x, y, cellW, cellH)

        // Value
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.font = 'bold 140px "Black Ops One", Impact, sans-serif'
        ctx.fillStyle = payload.isWinner ? '#ffcc00' : '#e6e6e6'
        ctx.fillText(cell.value, x + cellW / 2, y + 24)

        // Label
        ctx.font = '24px "Chakra Petch", sans-serif'
        ctx.fillStyle = '#52525b'
        ctx.fillText(cell.label, x + cellW / 2, y + cellH - 50)
    })
    ctx.restore()
}

function drawFooter(ctx: CanvasRenderingContext2D, payload: ShareImagePayload) {
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'

    ctx.font = '28px "Chakra Petch", sans-serif'
    ctx.fillStyle = '#a1a1aa'
    ctx.fillText('PLAY FREE', W / 2, H - 100)

    ctx.font = 'bold 34px "Chakra Petch", sans-serif'
    ctx.fillStyle = '#00f3ff'
    ctx.fillText(payload.siteUrl, W / 2, H - 60)
    ctx.restore()
}

/**
 * Render and return a PNG Blob.
 */
export async function generateShareImage(payload: ShareImagePayload): Promise<Blob | null> {
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    drawBackground(ctx)
    drawTitle(ctx)
    drawVerdict(ctx, payload)
    drawStats(ctx, payload)
    drawFooter(ctx, payload)

    return await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png')
    })
}

/**
 * Trigger native share if supported, otherwise download. Returns true on
 * either successful share or download.
 */
export async function shareOrDownload(blob: Blob, filename = 'open-mercy-win.png'): Promise<boolean> {
    const file = new File([blob], filename, { type: 'image/png' })

    // Native share with file (mobile mainly)
    const navAny: any = navigator
    if (navAny.canShare && navAny.canShare({ files: [file] })) {
        try {
            await navAny.share({
                files: [file],
                title: 'Open Mercy',
                text: 'I just won at Open Mercy.',
            })
            return true
        } catch {
            // User cancelled — fall through to download
        }
    }

    // Desktop fallback: trigger download
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return true
}
