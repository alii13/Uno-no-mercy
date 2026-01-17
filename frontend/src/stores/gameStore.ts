import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Card, Player, GameState, TurnState, CardColor } from '../types/card'
import { generateFullDeck, shuffleDeck } from '../utils/deckGenerator'
import { canPlayCard, getDrawValue } from '../utils/gameRules'

export const useGameStore = defineStore('game', () => {
    // Bot AI settings
    const BOT_DELAY_MS = 2000

    // --- State ---
    const gameState = ref<GameState>('LOBBY')
    const turnState = ref<TurnState>('WAITING_FOR_ACTION')

    const deck = ref<Card[]>([])
    const discardPile = ref<Card[]>([])

    const players = ref<Player[]>([])
    const currentPlayerIndex = ref(0)
    const direction = ref<1 | -1>(1)

    const drawStack = ref(0)
    const currentColor = ref<CardColor>('red')

    // For Roulette logic
    const rouletteTargetColor = ref<CardColor | null>(null)

    const winnerId = ref<string | null>(null)
    const swapInitiatorId = ref<string | null>(null)

    // --- Getters ---
    const currentPlayer = computed(() => players.value[currentPlayerIndex.value])
    const topCard = computed(() => discardPile.value[discardPile.value.length - 1])
    const nextPlayerIndex = computed(() => {
        let next = currentPlayerIndex.value + direction.value
        if (next >= players.value.length) next = 0
        if (next < 0) next = players.value.length - 1
        return next
    })

    // --- Actions ---

    function initializeGame(playerNames: string[]) {
        players.value = playerNames.map((name, index) => ({
            id: `p-${index}`,
            name,
            hand: [],
            isEliminated: false,
            isBot: index > 0
        }))

        const rawDeck = generateFullDeck()
        deck.value = shuffleDeck(rawDeck)
        discardPile.value = []

        players.value.forEach(player => {
            for (let i = 0; i < 7; i++) {
                drawCardToHand(player)
            }
        })

        let firstCard = drawCardFromDeck()
        while (firstCard?.type === 'wild' || firstCard?.color === 'wild') {
            deck.value.push(firstCard)
            deck.value = shuffleDeck(deck.value)
            firstCard = drawCardFromDeck()
        }

        if (firstCard) {
            discardPile.value.push(firstCard)
            currentColor.value = firstCard.color
        }

        currentPlayerIndex.value = 0
        direction.value = 1
        drawStack.value = 0
        gameState.value = 'PLAYING'
        winnerId.value = null
        turnState.value = 'WAITING_FOR_ACTION'
        rouletteTargetColor.value = null

        // Announce start
        setTimeout(() => {
            import('../composables/useSoundEffects').then(({ soundEffects }) => {
                soundEffects.announceTurn("Game Start! Your turn")
            })
        }, 500)
    }

    function drawCardFromDeck(): Card | undefined {
        if (deck.value.length === 0) {
            if (discardPile.value.length <= 1) return undefined

            const top = discardPile.value.pop()!
            const rest = discardPile.value
            deck.value = shuffleDeck(rest)
            discardPile.value = [top]

            import('../composables/useSoundEffects').then(({ soundEffects }) => {
                soundEffects.playCardShuffle()
            })
        }
        return deck.value.pop()
    }

    function drawCardToHand(player: Player): Card | undefined {
        const card = drawCardFromDeck()
        if (card) {
            player.hand.push(card)

            import('../composables/useSoundEffects').then(({ soundEffects }) => {
                soundEffects.playCardPick()
            })
        }
        checkMercyRule(player)
        return card
    }

    function checkMercyRule(player: Player): boolean {
        if (player.hand.length >= 25) {
            player.isEliminated = true
            discardPile.value.push(...player.hand)
            player.hand = []

            const activePlayers = players.value.filter(p => !p.isEliminated)
            if (activePlayers.length === 1 && activePlayers[0]) {
                winnerId.value = activePlayers[0].id
                gameState.value = 'GAME_OVER'
            }
            return true
        }
        return false
    }

    function advanceTurn() {
        currentPlayerIndex.value = nextPlayerIndex.value

        // If coming from Roulette, reset state default
        if (turnState.value !== 'ROULETTE_DRAWING') {
            turnState.value = 'WAITING_FOR_ACTION'
        }

        // Skip eliminated players
        let sanity = 0
        while (players.value[currentPlayerIndex.value]?.isEliminated && sanity < 20) {
            currentPlayerIndex.value = nextPlayerIndex.value
            sanity++
        }

        // Announce turn
        import('../composables/useSoundEffects').then(({ soundEffects }) => {
            const p = currentPlayer.value
            if (p) {
                const text = p.isBot ? `${p.name}'s turn` : "Your turn"
                soundEffects.announceTurn(text)
            }
        })
    }

    function playCard(playerId: string, card: Card, selectedColor?: CardColor) {
        const player = players.value.find(p => p.id === playerId)
        if (!player) return

        if (!topCard.value) return
        if (!canPlayCard(card, topCard.value, currentColor.value, drawStack.value)) return

        const cardIndex = player.hand.findIndex(c => c.id === card.id)
        if (cardIndex === -1) return
        player.hand.splice(cardIndex, 1)

        discardPile.value.push(card)

        // Handle Color Selection (Wilds)
        if (card.color === 'wild') {
            if (selectedColor) {
                currentColor.value = selectedColor
            } else {
                // Fallback (shouldn't happen with UI)
                console.warn("Wild card played without color selection!")
                currentColor.value = 'red'
            }
        } else {
            currentColor.value = card.color
        }

        // Sounds
        import('../composables/useSoundEffects').then(({ soundEffects }) => {
            soundEffects.playCardLand()
            if (card.color === 'wild' || card.type.includes('draw') || card.type === 'skip' || card.type === 'reverse') {
                soundEffects.playSpecialCard()
            }
        })

        applyCardEffect(card)

        if (player.hand.length === 0) {
            winnerId.value = player.id
            gameState.value = 'GAME_OVER'
            return
        }

        // Advance only if not blocked by special states
        // If applied effect was Roulette, state is now ROULETTE_DRAWING, so we advance to victim
        // FIX: Do not advance if card is 'skipEveryone' (Play Again)
        if (card.type !== 'skipEveryone') {
            if (turnState.value === 'WAITING_FOR_ACTION' || turnState.value === 'ROULETTE_DRAWING' || turnState.value === 'CHOOSING_ROULETTE_COLOR') {
                // Note: CHOOSING_ROULETTE_COLOR means we advance to victim to pick color. 
                // If wildColorRoulette played, state is CHOOSING_ROULETTE_COLOR (set in applyCardEffect).
                // We MUST advance so it becomes victim's turn to choose.
                advanceTurn()
            }
        }
    }

    function applyCardEffect(card: Card) {
        // Stacking
        const drawVal = getDrawValue(card)
        if (drawVal > 0 && card.type !== 'wildColorRoulette') {
            drawStack.value += drawVal
        }

        if (card.type === 'reverse' || card.type === 'wildReverseDraw4') {
            direction.value = direction.value === 1 ? -1 : 1
            if (players.value.length === 2) {
                // In 2 player, Reverse acts as Skip.
                // For Wild Reverse Draw 4, the official rule is ambiguous on "Skip" vs "Draw". 
                // But typically Reverse=Skip. The Draw stack triggers on the "Next" player.
                // If P1 plays it, P2 is skipped. P1 plays again.
                // BUT P2 must draw 4? Or does P1 draw 4 because they are "next"?
                // Official: "Player who played it draws 4" (if 2 players? No, usually next player).
                // Actually commonly: P1 plays, P2 draws 4 and loses turn. P1 plays again.
                // So we Advance Turn to P2 (they draw), then Advance Turn back to P1?
                // Let's rely on standard flow:
                // 1. Reverse direction.
                // 2. Advance Turn -> Next player is P2.
                // 3. P2 must draw stack.
                advanceTurn()
            }
        }

        if (card.type === 'skip') {
            advanceTurn()
        }

        if (card.type === 'skipEveryone') {
            return // Play again
        }

        if (card.type === 'wildColorRoulette') {
            // Initiate Roulette Sequence
            // Official Rule: **Next Player** chooses the color, then draws until they get it.
            // So we move state to 'CHOOSING_ROULETTE_COLOR' and Advance Turn to that victim.
            turnState.value = 'CHOOSING_ROULETTE_COLOR'
            // The turn advances to the victim below in `playCard` check.
        }

        if (card.type === 'discardAll') {
            const player = currentPlayer.value
            if (!player) return
            const color = card.color
            const toDiscard = player.hand.filter(c => c.color === color && c.type !== 'discardAll')
            toDiscard.forEach(c => {
                const idx = player.hand.findIndex(h => h.id === c.id)
                if (idx > -1) {
                    player.hand.splice(idx, 1)
                    discardPile.value.push(c)
                }
            })
        }

        if (card.type === 'number' && card.value === 0) {
            rotateHands()
        }

        if (card.type === 'number' && card.value === 7) {
            turnState.value = 'CHOOSING_PLAYER_TO_SWAP'
            if (currentPlayer.value) {
                swapInitiatorId.value = currentPlayer.value.id
            }
            return
        }
    }

    function rotateHands() {
        if (players.value.length < 2) return
        const hands = players.value.map(p => [...p.hand])
        players.value.forEach((p, i) => {
            let sourceIndex = i - direction.value
            if (sourceIndex < 0) sourceIndex = players.value.length - 1
            if (sourceIndex >= players.value.length) sourceIndex = 0
            p.hand = hands[sourceIndex] || []
        })
    }

    function drawCardsForCurrentPlayer() {
        const p = currentPlayer.value
        if (!p) return

        if (drawStack.value > 0) {
            // Stacking Penalty Draw
            const cardsToDraw = drawStack.value
            drawStack.value = 0
            let drawnCount = 0
            function drawNext() {
                if (drawnCount < cardsToDraw) {
                    if (p) drawCardToHand(p)
                    drawnCount++
                    setTimeout(drawNext, 250)
                } else {
                    advanceTurn()
                }
            }
            drawNext()
        } else {
            // Standard Draw: Draw Until Playable
            // Creating a loop with delay for visual effect

            function drawUntilPlayable() {
                if (!p || !topCard.value) return
                // Draw 1
                const card = drawCardToHand(p)
                if (!card) return // Deck empty processing handled in drawCardToHand internal logic if needed? 
                // Actually deck reshuffles.

                // Check if playable
                if (canPlayCard(card, topCard.value, currentColor.value, 0)) {
                    // Playable! Stop drawing.
                    // User doesn't auto-play (unless we want them to?). 
                    // Official rules: "You must play it". 
                    // Let's stop and let user play it to keep agency/animations clear.
                    // Or better: Auto play it? most digital Unos do auto-play if you drew it specifically.
                    // Let's stick to "Stop drawing, let user play".
                    // BUT turn does not end either.
                    return
                } else {
                    // Not playable, check mercy rule (handled inc drawCardToHand).
                    if (p.isEliminated) {
                        advanceTurn()
                        return
                    }
                    // Draw again
                    setTimeout(drawUntilPlayable, 400)
                }
            }
            drawUntilPlayable()
        }
    }

    // NEW: Execute Roulette Draw Logic
    function executeRouletteDraw() {
        if (turnState.value !== 'ROULETTE_DRAWING') return
        const p = currentPlayer.value
        if (!p) return

        // Draw card
        const card = drawCardToHand(p)

        if (card && (card.color === currentColor.value || card.color === 'wild')) {
            // Found matching color (wild counts as match usually, or strictly chosen color? 
            // Rules say "until they get a card of your chosen color". Wild implies user can choose color, so maybe wild counts?)
            // Let's assume strict color match for now to be safe, but typically Wild matches everything.
            // Actually, in Uno, "Wild" has no color until played. But physically it triggers.
            // Let's be generous: Wild matches.

            // Turn ends (Victim loses turn)
            turnState.value = 'WAITING_FOR_ACTION'
            advanceTurn()

            // Sound/Speech
            import('../composables/useSoundEffects').then(({ soundEffects }) => {
                soundEffects.announceTurn("Safe!")
            })

        } else if (p.isEliminated) {
            // Mercy rule trigger
            turnState.value = 'WAITING_FOR_ACTION'
            advanceTurn()
        } else {
            // Keep drawing
            setTimeout(executeRouletteDraw, 300)
        }
    }

    function swapHands(targetPlayerId: string) {
        if (turnState.value !== 'CHOOSING_PLAYER_TO_SWAP') return
        const initiator = players.value.find(p => p.id === swapInitiatorId.value)
        const target = players.value.find(p => p.id === targetPlayerId)
        if (initiator && target) {
            const temp = [...initiator.hand]
            initiator.hand = [...target.hand]
            target.hand = temp
        }
        turnState.value = 'WAITING_FOR_ACTION'
        advanceTurn()
    }

    function playerActionPlayCard(card: Card, selectedColor?: CardColor) {
        if (!currentPlayer.value) return
        const isSkipEveryone = card.type === 'skipEveryone'
        playCard(currentPlayer.value.id, card, selectedColor)
        if (!isSkipEveryone && turnState.value === 'WAITING_FOR_ACTION') {
            advanceTurn()
        }
    }

    // --- Bot AI Logic ---

    function executeBotTurn() {
        const bot = currentPlayer.value
        if (!bot || !bot.isBot || gameState.value !== 'PLAYING') return

        // Handle special states for Bot
        if (turnState.value === 'ROULETTE_DRAWING') {
            // Bot is victim of roulette
            executeRouletteDraw()
            return
        }

        if (turnState.value !== 'WAITING_FOR_ACTION') return

        const top = topCard.value
        if (!top) return

        const playableCards = bot.hand.filter(c =>
            canPlayCard(c, top, currentColor.value, drawStack.value)
        )

        if (playableCards.length > 0) {
            let cardToPlay: Card | undefined

            if (drawStack.value > 0) {
                cardToPlay = playableCards[0]
            } else {
                const specialCards = playableCards.filter(c =>
                    c.type !== 'number' && c.type !== 'discardAll'
                )
                if (specialCards.length > 0) {
                    cardToPlay = specialCards[Math.floor(Math.random() * specialCards.length)]
                } else {
                    cardToPlay = playableCards[Math.floor(Math.random() * playableCards.length)]
                }
            }

            if (cardToPlay) {
                let colorToPick: CardColor | undefined
                if (cardToPlay.color === 'wild') {
                    // Bot logical color choice: pick color they have most of
                    const counts = bot.hand.reduce((acc, c) => {
                        if (c.color !== 'wild') acc[c.color] = (acc[c.color] || 0) + 1
                        return acc
                    }, {} as Record<string, number>)

                    const bestColor = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as CardColor
                    colorToPick = bestColor || 'red'
                }
                playerActionPlayCard(cardToPlay, colorToPick)
            }
        } else {
            drawCardsForCurrentPlayer()
        }
    }

    function executeBotSwap() {
        if (!currentPlayer.value?.isBot || turnState.value !== 'CHOOSING_PLAYER_TO_SWAP') return
        const otherPlayers = players.value.filter(p =>
            p.id !== currentPlayer.value?.id && !p.isEliminated
        )
        if (otherPlayers.length > 0) {
            const target = otherPlayers[Math.floor(Math.random() * otherPlayers.length)]
            if (target) {
                swapHands(target.id)
            }
        }
    }

    watch([currentPlayerIndex, gameState, turnState, topCard], () => {
        if (gameState.value !== 'PLAYING') return

        const player = currentPlayer.value
        // If it's a bot's turn OR bot is forced to act (Roulette)
        if (player?.isBot) {
            // Debounce slightly to prevent rapid-fire on same turn
            setTimeout(() => {
                // Re-check conditions after delay (game might have ended or state changed)
                if (gameState.value !== 'PLAYING') return
                if (currentPlayerIndex.value !== players.value.indexOf(player) && turnState.value !== 'ROULETTE_DRAWING') return

                if (turnState.value === 'CHOOSING_PLAYER_TO_SWAP') {
                    executeBotSwap()
                } else if (turnState.value === 'ROULETTE_DRAWING') {
                    executeRouletteDraw()
                } else {
                    executeBotTurn()
                }
            }, turnState.value === 'ROULETTE_DRAWING' ? 500 : BOT_DELAY_MS)
        } else {
            // If human player is victim of Roulette, auto-start drawing
            // If human player is victim of Roulette, they need to choose color first!
            // 'CHOOSING_ROULETTE_COLOR' logic is handled by UI (color picker).
            // Once they pick, it goes to 'ROULETTE_DRAWING', then we auto-draw:
            if (turnState.value === 'ROULETTE_DRAWING') {
                setTimeout(executeRouletteDraw, 1000)
            }
        }
    }, { immediate: true })

    return {
        gameState,
        turnState,
        deck,
        discardPile,
        players,
        currentPlayerIndex,
        direction,
        drawStack,
        currentColor,
        winnerId,
        currentPlayer,
        topCard,
        rouletteTargetColor,
        initializeGame,
        drawCardFromDeck,
        drawCardToHand,
        playCard,
        applyCardEffect,
        rotateHands,
        drawCardsForCurrentPlayer,
        swapHands,
        playerActionPlayCard,
        executeRouletteDraw,
        setRouletteColor(color: CardColor) {
            if (turnState.value !== 'CHOOSING_ROULETTE_COLOR') return
            rouletteTargetColor.value = color
            turnState.value = 'ROULETTE_DRAWING'
            executeRouletteDraw()
        }
    }
})
