# Audio assets

Drop CC0 / CC-BY audio files here. The code in
`src/composables/useSoundEffects.ts` and `src/composables/useMusic.ts`
automatically picks them up — no code change required.

If a file is missing, SFX silently fall back to the original Web Audio
synthesis (oscillators / noise buffers). The music composable just stays
silent.

## SFX — drop into `sfx/`

| Filename            | Triggers                                     | What it should sound like                |
| ------------------- | -------------------------------------------- | ---------------------------------------- |
| `card-throw.mp3`    | Player clicks a card to play                 | Quick whoosh / cardboard flick           |
| `card-pick.mp3`     | Player clicks the deck to draw               | Light paper rustle / soft pluck          |
| `card-land.mp3`     | Card lands on the discard pile               | Plastic / cardboard "thwap"              |
| `card-shuffle.mp3`  | Deck is reshuffled mid-game                  | Multi-card riffle, ~1s                   |
| `special-card.mp3`  | Wild / +N / skip-everyone lands              | Short tonal sting, ominous               |

Target: each file < 80 KB, mono, 64-128 kbps mp3. Total payload < 400 KB.

## Music — drop into `music/`

| Filename       | What                                |
| -------------- | ----------------------------------- |
| `loop.mp3`     | Seamlessly-looping background track |

Target: 60-120 second loop, < 1 MB. Mono is fine.

## Sourcing

### SFX — recommended sources

All CC0 (public domain, no attribution required):

- **freesound.org** — search `card snap`, `card flick`, `card slip`, `shuffle deck`. Filter to CC0 license.
- **pixabay.com/sound-effects/** — CC0, direct mp3 downloads, no signup. Search same terms.
- **soundbible.com** — many CC0 entries.

### Music — recommended sources

- **incompetech.com** (Kevin MacLeod) — CC-BY. Footer attribution required.
  Candidates for "no mercy" vibe:
  - **Decisions** — tense electronic, fits well
  - **Mesmerize** — dark synth ambient
  - **The Builder** — mysterious electronic
- **freemusicarchive.org** — filter to CC-BY or CC0.
- **pixabay.com/music/** — many CC0 tracks, no attribution required.

## After dropping a file

No code change. Hard-refresh `localhost:5173` and play a game; the new
audio should fire. The cache uses content-hashed URLs so updates don't
require deploys.

## Attribution

If you ship a CC-BY track, add a credit line to the footer of the landing
page. CC0 / public-domain assets don't require attribution.
