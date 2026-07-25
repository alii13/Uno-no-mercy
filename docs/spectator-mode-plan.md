# Spectator mode plan - watch the game when you're out
**TL;DR:** Eliminated players already keep watching today - the DO server keeps their socket subscribed and there's a basic "YOU'RE OUT" banner, so the core plumbing exists. What's missing is a deliberate spectator experience (the KO moment, spectator chrome, game-over handling, rematch flow) and, optionally, a first-class spectator role so friends can join mid-game by room code and watch. I propose shipping Phase A (polish eliminated spectating, client-only, no protocol change) first, then Phase B (spectator role in the protocol) as a separate PR.
## What exists today (verified in code)
Multiplayer is now a WebSocket client of the Cloudflare Durable Object server (`game-server/`), not Supabase broadcast. That decides most of the architecture for us:

- **Eliminated players stay subscribed.** The DO broadcasts events + a fresh personalized snapshot to every authed socket in the room, not just live seats (`game-server/src/index.ts:344`). Nothing tears down the eliminated player's connection.
  
- **Elimination is engine-authoritative.** At 25+ cards the engine sets `isEliminated`, dumps the hand to the discard pile, keeps the player object seated, and skips them in turn order (`shared/engine/engine.ts:43-55`, `:122-127`). All-but-one eliminated ends the game immediately with the survivor as winner.
  
- **A minimal spectate UI already shipped** (commit `e99a8be`): a non-blocking "YOU'RE OUT - spectating / LEAVE" banner over the live table, OUT state on the seat chip, action-feed shout.
  
- **Privacy is structural.** Snapshots carry other players' `handCount` only - the server never sends anyone else's cards to any viewer, so a spectator can't peek by design (`game-server/src/game.ts:521`).
  
- **Snapshot-on-join is a ready spectator bootstrap.** Any socket that auths gets a full personalized snapshot; reconnect and page-refresh resume already work this way.
  
- **Late joiners silently half-work.** Someone who connects to a room mid-game gets snapshots and can watch, but has no seat, no "you're watching" affordance, and `PersonalView.you` is `null` - the client has no branch for that. They also get seated by the next `start`, wanted or not.
  

So the honest framing: this feature is ~80% plumbing-done for eliminated players, ~0% designed as an experience.
## Goals
1. An eliminated player's session converts into a deliberate, watchable spectator experience instead of a banner slapped over a UI that half-ignores them.
  
2. Spectators flow naturally into the next game (rematch) without reconnecting.
  
3. (Phase B) Anyone with the room code can watch a game in progress and get seated for the next one - turns every game into a shareable live event.
  
## Non-goals (this effort)
- Public spectating of strangers' games / a "watch live games" browser. Rooms stay private-by-code.
  
- Spectator chat. Voice already exists; reactions are a maybe (see decisions).
  
- Replays / VODs.
  

* * *
## Phase A - make eliminated spectating first-class (client-only)
No protocol or server changes. Everything below reads existing snapshot state.
### A1. The KO moment
Today elimination just... happens; the banner appears. Give it a beat:

- Full-screen KO stinger on the `ELIMINATED` event for the local player: red flash + "ELIMINATED" in display type + the mercy-rule count ("26 CARDS - NO MERCY"), ~1.5s, GSAP via `useMotion` presets, honors reduced motion, then settles into spectator chrome.
  
- Play the existing heavy SFX hook if one fits (Kenney set), else skip - no new assets.
  
### A2. Spectator chrome
Replace the banner with a persistent, compact spectator HUD:

- Slim top strip: "SPECTATING · {n} players left" + LEAVE button. The current `.eliminated-banner` is close; restyle to be less alert-like once the KO moment has passed (it's a state, not an alarm).
  
- Your seat chip stays visible as OUT (already works).
  
- Everything interactive stays inert (already true: `isMyTurn` never fires for eliminated seats, guards hold). Audit the modals (`ColorPickerModal`, swap, discard-all) for any path that could open post-elimination mid-animation - close them all on the `ELIMINATED` event for the local player.
  
- Small polish: action feed and turn ticker become the spectator's main content - verify they're readable when you have no hand (dead space where HandFan was). Consider centering the table vertically when `visibleHand` is empty.
  
### A3. Game over as a spectator
`GameOverModal` currently assumes winner-or-loser framing. Add the spectator case: "{winner} took the table" + your placement ("OUT 3RD OF 5"), then host rematch / back-to-lobby as today. Placement is derivable client-side from elimination order (track order of `ELIMINATED` events per game locally; no protocol change).
### A4. Rematch continuity
`start` re-seats all connected roster members, and eliminated players remain roster members - so rematch already includes them. Verify end-to-end and add a "NEXT GAME STARTING" transition for spectators; reset any local spectator state. The `actionInProgress`/`pendingIntent` invariant must reset across spectator-to-player transitions - `resetState()` and snapshot handling already do this, but the new spectator state must not introduce its own stuck flag (known soft-lock class in this codebase).
### A5. Edge cases to handle/verify
- 2-player game: your elimination immediately ends the game (all-but-one) - the KO stinger must not fight the GAME_OVER modal. Sequence them (KO beat, then game over).
  
- Refresh while spectating: `restoreActiveGame()` reconnects and the snapshot restores `isEliminated` - verify chrome resumes as spectator, not player.
  
- Turn grace / auto-resolve: absent players drift toward elimination via auto-draws - spectator sees these as normal events; verify the feed narrates auto-resolved turns comprehensibly.
  
- Room GC: if all sockets close, the room dies after 10 min - unchanged, fine.
  
- Analytics: `mp_spectate_start` (on elimination), `mp_spectate_end` (leave/game-over, with duration), `mp_spectate_rematch_joined`. Tells us if people actually stay - the number that justifies Phase B.
  
### A6. Verification
- Engine tests already cover elimination; add client store tests for the spectator adapter state (eliminated snapshot in, `amEliminated`/inert guards out).
  
- Manual: 3 browsers (host + 2), force one to 25+ cards, walk elimination → spectate → game over → rematch → plays again. Mobile viewport pass.
  

**Size: small-medium. Frontend-only, one PR, no deploy beyond Pages.**

* * *
## Phase B - first-class spectator role (protocol + DO + client)
For "friend watches by room code" and correct late-join semantics. Separate PR; needs `wrangler deploy` of the game server.
### B1. Protocol
- Roster entry gains `role: 'player' | 'spectator'`. Rule: connect while `status === 'playing'` ⇒ spectator; connect in lobby ⇒ player. No new messages needed for the base flow.
  
- `presence` broadcast includes role, so clients can render "{n} watching".
  
- `PersonalView.you` stays `null` for spectators (already the server behavior) - the client finally gets a real branch for it.
  
- New client intent `{t: 'sit'}` (or reuse rename semantics): a spectator opts into being seated at the next start. Default: spectators are NOT auto-seated by `start` (today they silently would be - that's a bug once watchers exist).
  
### B2. DO changes
- `start` seats `role === 'player'` + connected only.
  
- Spectator cap (say 10) to bound fan-out; reject over cap with a friendly error.
  
- Voice: spectators excluded from voice token issuance (default; see decisions).
  
- GC/timers unchanged - spectator sockets count as activity, which is correct (someone's watching, keep the room alive).
  
### B3. Client
- `multiplayerStore`: represent "me = spectator" distinctly from "me = eliminated player" (both render spectator chrome; only the latter has a seat/placement). `App.vue` routing already sends mid-game connectors to the game view - now with correct chrome instead of silent half-state.
  
- Lobby: "WATCHING: n" row; spectators see a "JOIN NEXT GAME" CTA that sends `sit`.
  
- Share loop: the existing room-code share now doubles as "come watch" - copy tweak in the lobby share text.
  
### B4. Verification
- DO unit tests for role assignment, start-seating, cap; protocol type tests.
  
- Manual: join mid-game from a fresh browser with the code, watch, `sit`, get dealt into the rematch.
  

**Size: medium. Touches shared protocol + server + client; needs staged deploy (server first - old clients ignore the extra roster field; then frontend).**

* * *
## Phase C - maybe-later engagement layer (explicitly deferred)
- Spectator emote reactions (server-relayed, rate-limited).
  
- "{n} watching" shown prominently to active players as social proof.
  
- OG-card "watch live" links.
  

Not planned now; listed so we consciously defer.

* * *
## Decisions (settled 2026-07-25)
1. **Scope: Phase A only.** Phase B decided later, informed by `mp_spectate_*` analytics.
  
2. **Rematch: auto-seat eliminated spectators** (keep current behavior, verify it).
  
3. **Voice for spectators (Phase B, recorded for later): no voice token for watchers.**
  
4. **Spectator visibility (Phase B, recorded for later): show "{n} watching" to active players.**
  
## Risks
- **Soft-lock class:** any new spectator flag must clear on snapshot like `actionInProgress` does, and reset across role transitions. Mitigation: derive spectator state purely from the snapshot (`isEliminated` / `you === null`), never from client-side latches.
  
- **Protocol drift (B):** old clients meeting a new roster shape - additive fields only, server deployed before frontend.
  
- **2-player rooms** make elimination-spectating nearly moot (game ends when you're out) - most value is 3+ player rooms; worth remembering when judging analytics.
