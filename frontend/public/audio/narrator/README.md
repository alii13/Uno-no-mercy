# Narrator clips

Drop the following `.mp3` files into this folder. Each clip is short (1-3s),
mono, ~64 kbps. Total payload target: < 200 KB combined.

Source recommendation: ElevenLabs (free tier, 10k chars/month covers all of
this 25x over). Pick a deep, menacing male voice for "no mercy" personality —
e.g. **Antoni** or **Adam** with lower stability and higher style exaggeration.

If you sign up for the free tier, you can also point an ElevenLabs API key at
a one-shot generation script — open an issue if you want me to add that.

## Required files

| Filename             | Spoken text          | Triggered by                        |
| -------------------- | -------------------- | ----------------------------------- |
| `game-start.mp3`     | "Game Start! Your turn." | Round opens and it's the human's turn |
| `uno.mp3`            | "Uno!"               | Player has 1 card left              |
| `caught.mp3`         | "Caught! Draw 2!"    | UNO not called, penalty applied     |
| `safe.mp3`           | "Safe!"              | Survived a roulette                 |
| `your-turn.mp3`      | "Your turn."         | Human player's turn begins          |
| `stack.mp3`          | "Stack!"             | A +N card lands while drawStack > 0 |
| `skip-everyone.mp3`  | "Skip everyone!"     | Skip-all card lands                 |
| `rotate.mp3`         | "Rotate!"            | 0 card rotates all hands            |
| `swap.mp3`           | "Swap!"              | 7 card swap completes               |
| `mercy.mp3`          | "Mercy!"             | Player hits 25 cards, eliminated    |
| `no-mercy.mp3`       | "No mercy!"          | Reserved — wire to a future taunt   |
| `winner.mp3`         | "Winner!"            | Round ends                          |

## Behaviour

- The narrator (`src/composables/useNarrator.ts`) matches the **exact strings**
  passed to `announceTurn()` from the stores (case-insensitive, trimmed).
- Unmapped strings fall through to `window.speechSynthesis` so nothing breaks
  while clips are still being recorded.
- In dev mode, unmapped strings are logged once to the console — that's the
  signal that a new clip needs adding to `CLIP_MAP` in `useNarrator.ts`.
- Clips are preloaded eagerly on first import. Adding a missing file at
  runtime requires a page reload to repopulate the pool.

## After adding a new clip

1. Drop the `.mp3` here.
2. If the spoken text is new (not in the table above), add an entry to
   `CLIP_MAP` in `src/composables/useNarrator.ts` keyed on the lowercased
   trimmed string.
3. Reload the dev server.
