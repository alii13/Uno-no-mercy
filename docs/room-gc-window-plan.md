# Room GC window - keep invite links alive longer
**TL;DR:** Rooms are deleted 10 minutes after they go empty, which is why a shared invite link clicked "after dinner" lands on "Room not found." The clean fix is to lengthen the GC window for **private** rooms (the invite-link case) while keeping **public** rooms short (so quick-match doesn't serve dead rooms). I recommend private = 2 hours, public stays 10 minutes. I'm explicitly rejecting the "revive a dead room on join" approach - it adds real semantic surprise and race conditions for a problem the client already recovers from gracefully. This is a server-side change and needs a manual `wrangler deploy` of the game server, which is yours to run.
## How GC works today (verified in `game-server/src/index.ts`)
- A room lives in one lottery-chosen candidate Durable Object, addressed by code.
  
- `touchGc()` sets `gcAt = now + ROOM_GC_MS` (10 min) on every activity (activate, auth/join, each intent).
  
- The alarm fires at `gcAt` and **only deletes if zero sockets are connected** - so live rooms never GC; an empty room dies ~10 min after its last activity.
  
- GC does `storage.deleteAll()` and, for public rooms, **unregisters from the quick-match directory**.
  
- After deletion, `locateRoom` finds no active candidate → `roomGoneSocket()` → the client's `Room not found` → the existing "THIS ROOM HAS ENDED" recovery card.
  

So public and private rooms have opposite needs: public rooms _should_ disappear from quick-match promptly; private rooms want to linger so their invite link keeps working.
## Options
**A - Bump the single constant** (10 min → longer for everyone). Trivial, but a longer window keeps abandoned **public** rooms listed in quick-match, sending new players into near-dead rooms. Rejected for that side effect.

**B - Revive a dead room on join** (re-activate a candidate under the code, joiner becomes host). Invite links would work forever, but: the joiner lands in a _new empty room_, not the game they were invited to; two simultaneous revivals race two candidates onto one code; and any random/typo'd code would spin up a room. Over-engineered for a modest, already-recovered problem. Rejected.

**C - Split the window by room type (recommended).** Private rooms: `PRIVATE_ROOM_GC_MS = 2h`. Public rooms: keep `ROOM_GC_MS = 10min`. Invite links survive a realistic "join later" window; quick-match stays fresh; no new semantics, no races. The existing recovery card still catches the truly-expired (>2h) case.
## Implementation (Option C)
- Add `PRIVATE_ROOM_GC_MS = 2 * 60 * 60 * 1000`.
  
- Cache `isPublic` on the DO instance (hydrated at `activate`, lazily from the `room` record otherwise) so `touchGc()` picks the window without an extra storage read on every intent.
  
- `touchGc()`: `gcAt = now + (isPublic ? ROOM_GC_MS : PRIVATE_ROOM_GC_MS)`.
  
- Nothing else changes - the empty-check guard, directory unregister, and recovery card all stay as-is.
  

Net effect: an abandoned private room's DO stays resident up to ~2h before `deleteAll`. On Cloudflare's model an idle DO with a pending alarm isn't billed for wall-clock (only active request/alarm processing), so the cost is a longer-lived tiny storage record and one delayed alarm - negligible.
## Verification
- Unit-test the window selection (public vs private → correct `gcAt` delta) against the DO's timer logic. If the game-server has no test harness yet, I'll add a focused one for this; I won't fake-deploy to verify.
  
- Can't exercise the real alarm end-to-end without deploying; I'll confirm the logic by test + code review and leave the live check to the post-deploy smoke.
  
## Deploy (yours to run - production infra)
Merging the PR does **not** deploy this - the game server is a standalone Worker (`uno-game-server`), not the auto-deployed Pages project. It goes live only when someone runs `cd game-server && npx wrangler deploy`. I'll prep the exact command and a one-line smoke check; I won't run the deploy myself.
## Decisions (settled 2026-07-25)
1. **Private-room GC window: 1 hour** (`PRIVATE_ROOM_GC_MS = 60 * 60 * 1000`).
2. **Approach C (split window)** confirmed; revive-on-join rejected.
3. **Public rooms stay at 10 minutes.**
