# Growth features plan
Four features, built one at a time. Each phase ships as its own PR and is independently useful - nothing here depends on a later phase landing.
## Read this first: three of the four already exist in part
I pitched these as new builds. After reading the code, most of the infrastructure is already there. The work is smaller than I said, and in two cases it is finishing something rather than starting it.

| Feature | What I claimed | What is actually true |
| --- | --- | --- |
| Kill card | Build from scratch | `utils/shareImage.ts` already renders a 1080x1920 canvas share image. Missing piece is a **URL**, not an image. |
| Mercy Daily | Build from scratch | **Already shipped.** `utils/seededRng.ts`, `utils/dailyChallenge.ts`, `daily_leaderboard` RPC, deterministic bots. Missing: share grid + one-attempt enforcement. |
| Live tables | Needs a public/private flag | `isPublic` flag, directory DO (`dir-register` / `dir-list` / `dir-unregister`), and `quickMatch` all exist. Missing: room metadata + a homepage surface. |
| Bot ladder | Cheap | Confirmed. Bot AI is ~70 inline lines in `gameStore.ts` with no difficulty concept at all. |

One thing I got wrong and corrected before it reached this doc: the daily's local-timezone day key is **not** a bug. Everyone who plays "their local Aug 9" gets the identical `uno-daily-2026-08-09` seed and writes to the same `daily-2026-08-09` bucket, so the leaderboard compares like with like. The day is just a rolling ~50-hour window in absolute time. Wordle has the same property. Leave it alone.

* * *
## Phase 1: Kill card
**Goal:** turn the end of a game into a link somebody pastes into a group chat, where it unfurls as a preview card in front of people who do not play yet.
### Why this and not more share images
`shareImage.ts` already produces a good PNG. But a PNG in WhatsApp is a dead end: no click target, no unfurl, no attribution beyond footer text. The artifact needs to be a **URL** whose OG image is the picture. Same art, one extra hop, completely different acquisition behaviour.

Second gap: the current image is **win-only**. In a game whose entire identity is cruelty, "I got hit with +26" is at least as shareable as "I won", and right now it is uncapturable.
### Build
1. **Capture the moment.** `playerStats[id].biggestStackSurvived` already tracks the amount but not who dealt it. Add dealer and victim to the stat the engine already computes at `gameStore.ts:467`.
  
2. **Render at kill time on the client.** Reuse the existing canvas in `shareImage.ts`, add a "kill" layout alongside the win layout, upload the Blob to Supabase Storage under a short code.
  
  - _Skipped: Worker-side satori/resvg rendering. Add when we need images for kills the client did not witness._ This avoids a new dependency entirely.
    
3. **Persist the row.** New table `kill_cards`: `code` (short, URL-safe), `dealer`, `victim`, `amount`, `image_path`, `created_at`. Anonymous insert via RLS, rate-limited by IP.
  
4. **Serve the unfurl.** `functions/k/[code].js` - a Pages Function returning static HTML with OG tags pointing at the Storage image, plus a visible card and a Play CTA. It must be a Function, not the SPA: crawlers do not run the Vue app, so OG tags injected client-side never unfurl.
  
5. **Wire the CTA** back to `/` with a `?ref=k` param so GA can measure the loop.
  
### Files
- `frontend/src/utils/shareImage.ts` - kill layout
  
- `frontend/src/stores/gameStore.ts` - dealer/victim on the stat
  
- `functions/k/[code].js` - new
  
- `supabase/kill-cards.sql` - new, additive only
  
- `frontend/src/components/` - post-game share button copy
  
### Verification
- Paste a `/k/:code` link into WhatsApp Web and confirm the unfurl renders.
  
- `curl` the route and assert `og:image` is present in the initial HTML.
  
- Confirm the SPA still owns every other path (the Function must not swallow `/`).
  
### Cost and risk
~1.5 days. Main risk is Storage RLS: an anonymous-writable bucket is an abuse surface, so cap object size and rate-limit inserts.

* * *
## Phase 2: Finish Mercy Daily
**Goal:** give the existing daily the viral output and the integrity it is missing.
### Build
1. **Share grid.** The reason Wordle spread was a compact spoiler-free result you could paste anywhere. Encode the human player's run one glyph per turn:
  
  ```
  Open Mercy Daily 2026-08-09
  Won in 23
  
  🟩🟩🟥🟩🟨
  🟩💀🟥🟩🟩
  🟩🟩🟩🟨🟩
  ...
  open-mercy.com/daily
  ```
  
  Green = played, red = drew, yellow = skipped, skull = ate a stack.
  
2. **Record the turn log.** `gameStore` does not keep one today. Push a single char per human turn into an array - cheap, and it is also the substrate for replays later.
  
3. **One attempt per day, enforced server-side.** Today `getDailyRecord()` is localStorage-only and the score insert is a plain client-side `insert`, so clearing storage lets a player farm attempts and submit the best one. All attempts then appear as separate leaderboard rows. Fix with a unique index on `(game_id, user_id)` plus an upsert that only improves on a better result.
  
4. **Add** `/daily` **as a real route** so the share text has somewhere to land.
  
### Blocker to resolve first
`game_results` is **not defined in any repo SQL file** - it was created directly in the Supabase dashboard. Before writing the migration I need the live schema (existing indexes, constraints, RLS) so the unique index does not collide with something already there. I will pull it and confirm before touching anything.
### Files
- `frontend/src/utils/dailyChallenge.ts` - grid builder
  
- `frontend/src/stores/gameStore.ts` - turn log
  
- `frontend/src/utils/routes.ts` - `/daily`
  
- `supabase/migrations/<date>_daily_one_attempt.sql` - new, additive
  
### Verification
- Unit test the grid builder against a fixed turn log.
  
- Confirm a second submission for the same day updates rather than duplicates.
  
- Confirm two devices on the same local date get identical hands.
  
### Cost and risk
~1 day once the schema question is answered. Low risk; the deal logic itself is untouched.

* * *
## Phase 3: Live tables on the homepage
**Goal:** exploit the 78% spectate-to-play conversion by putting a live game on the landing page instead of behind a lobby.
### What already works
`activate` carries `isPublic`, the directory DO registers and lists public room codes, and `quickMatch` already consumes `/public-rooms`.
### The actual gap
`dir-list` returns **bare room codes with no metadata**. A homepage strip cannot render anything meaningful without one round-trip per room.
### Build
1. **Enrich the directory entry** to `{ code, players, seatsFree, inProgress, updatedAt }`. The room DO heartbeats to the directory on roster change.
  
2. **Version** `/public-rooms`**.** `quickMatch` consumes the current bare-array shape; do not break it. Either add `/public-rooms?v=2` or return an object and update both callers together.
  
3. **Landing strip.** Two or three live tables, polled every ~10s, click through to spectate.
  
4. **Seat takeover.** When a seated player drops mid-game, offer the seat to spectators. This fixes a real defect - right now a rage-quit after eating a +20 degrades the room for everyone left - and converts a spectator in the same motion.
  
### Open question I need to check before building
What the room DO currently does on disconnect (`game.ts`, `seats.ts`). Seat takeover's design depends entirely on whether the seat is freed, held, or bot-substituted today.
### Privacy note
A public strip puts usernames on the homepage. `isPublic` must be an explicit host opt-in with a clear label, not a default. I will verify it is opt-in before this ships.
### Cost and risk
~2-3 days. Highest-risk phase: it touches live multiplayer state, and seat takeover races with reconnect.

* * *
## Phase 4: Named bots with a difficulty ladder
**Goal:** give solo play a progression. Weakest return-driver of the four, but the cheapest and it improves the mode most first-time visitors touch.
### Current state
Bot AI is inline in `gameStore.ts` (~lines 620-700): pick randomly among playable cards with a mild bias toward specials, catch a missed MERCY call 70% of the time. No difficulty, no personality, no memory.
### Build
1. Extract the decision into `shared/engine/bot.ts` behind a `BotProfile` (aggression, stack awareness, MERCY catch rate, color memory).
  
2. Eight named profiles with genuinely different play, not just tuned randomness.
  
3. Ladder progression: beat bot N to unlock N+1.
  
### The constraint that matters
**The daily must pin its bot roster.** Bot decisions run off `hostRng`, which is what makes the daily deterministic. If bots become player-selectable and the daily uses whatever the player unlocked, two players get different opponents on the same seed and the leaderboard stops comparing like with like. The daily has to name its bots explicitly as part of the seed.
### Cost and risk
~2 days. Risk is entirely in that determinism constraint; a regression test that plays a fixed seed twice and asserts identical event logs covers it.

* * *
## Sequencing
Keeping the order you listed. Phase 1 is the only one that attacks acquisition rather than retention, and acquisition is still the bottleneck at ~3.5k sessions/month.

1. **Kill card** - 1.5 days, acquisition
  
2. **Finish the daily** - 1 day, retention, blocked on the `game_results` schema pull
  
3. **Live tables** - 2-3 days, conversion, riskiest
  
4. **Bot ladder** - 2 days, solo depth
  

Phases 1 and 2 share the share-text and encoding surface, so doing them back-to-back avoids touching it twice.
## Not building
Tournaments, seasons, brackets. At current traffic there is not enough liquidity to fill them, and an empty bracket reads worse than no bracket.
