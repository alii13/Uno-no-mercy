# Guest account claiming - keep your stats when you sign up
**TL;DR:** Every "create account" path today signs the guest out and mints a fresh user, orphaning all their server-side stats. Supabase anonymous-user conversion (`updateUser({ email, password })` on the live anon session) keeps the same user id - profile row, username, share code, and every game_results row survive with zero data migration. The work is one store action, a claim mode in AuthView, rewiring three CTAs that currently call `signOut()`, and a pending-email-confirmation state.
## Why now / what's broken
- Three surfaces route guests to account creation: the lobby CREATE ACCOUNT button, GameOverModal's "Save your stats →" (both game views), and the profile page hint. All of them end in `signOut()` + fresh signup.
  
- The lobby confirm dialog even says "Stats earned as a guest stay on this device" - wrong; guest stats live server-side keyed to the anon user id and are orphaned on sign-out.
  
- The two game-view handlers are worse: they sign out silently with no warning at all, dumping the player on the landing page.
  
## What conversion preserves for free
Same user id, no new `auth.users` row, so the profiles trigger never re-fires:

- profiles row: username (their RecklessShark-style handle or rename), skin, country
  
- share_code - their public profile URL keeps working
  
- every game_results row: wins, streaks, records, badges, leaderboard history
  
## The flow
1. Guest taps any claim CTA → AuthView opens in a new **claim** mode: "Keep your stats - add an email and password to your guest account." Email + password fields; username is kept (shown as "playing as {name}", rename exists elsewhere).
  
2. Store action `claimAccount(email, password)`:
  
  - guard `isAnonymous`
    
  - `supabase.auth.updateUser({ email, password }, { emailRedirectTo: window.location.origin })`
    
  - password applies immediately; the email needs a confirmation click
    
3. **Pending state**: until the link is clicked, `is_anonymous` stays true and `user.new_email` is set. UI shows "check your inbox" with a resend button (`supabase.auth.resend({ type: 'email_change' })`). Derived, not latched: `claimPending = isAnonymous && !!user.new_email`.
  
4. User clicks the link → lands on the app root → `detectSessionInUrl` (already default-on) consumes it → `SIGNED_IN` fires → `isAnonymous` flips false → all guest CTAs disappear reactively; one-time "account claimed - your stats are safe" toast.
  
5. From then on: normal email+password sign-in to the same account.
  
## Implementation (single PR, frontend-only)
### Store (`authStore.ts`)
- `claimAccount(email, password)` returning `{ success, needsConfirmation }` or a mapped error; `email_exists` gets its own error code for the collision UX.
  
- Extend the `onAuthStateChange` switch: handle `USER_UPDATED` (sync user + deferred `fetchProfile()`) - today the event is ignored, so an in-place update wouldn't refresh anything.
  
- `claimPending` computed as above.
  
- Analytics: `guest_claim_started`, `guest_claim_email_sent`, `guest_claim_email_exists`, `guest_claim_completed` (fired on the isAnonymous false transition while a claim was pending).
  
### AuthView
- New mode `claim` (alongside login/signup/forgot): email + password, submit → `claimAccount`, success → inline "check your email" state with resend.
  
- Collision path: "That email already has an account." with a SIGN IN INSTEAD switch - plus an explicit line that signing in to another account will not carry this guest profile's stats over.
  
### App.vue
- AuthView currently renders only in the unauthenticated branch - a signed-in guest can never see it (which is why every path signs out first). Add: render AuthView when `showAuthView && authStore.isAnonymous`, defaulting to claim mode.
  
### CTA rewiring (the three signOut call sites)
- Lobby `upgradeAccount`/`confirmUpgrade`: drop the sign-out confirm dialog entirely → open claim view. Delete the misleading copy.
  
- `MultiplayerGameView.handleUpgrade`: `leaveGame()` then open claim view (no signOut).
  
- `GameView.handleUpgrade`: `returnToLobby()` then open claim view (no signOut).
  
- ProfilePage guest hint: copy becomes "claim your account to keep this profile" (still routes via lobby).
  
- Lobby CTA label while `claimPending`: "CONFIRM YOUR EMAIL" instead of "CREATE ACCOUNT".
  
### Guest sign-out guard
The plain SIGN OUT button, for guests only, gets a confirm: "Signing out abandons this guest profile and its stats. Claim it first?" with CLAIM ACCOUNT / SIGN OUT ANYWAY. This is the last remaining stat-loss trapdoor.
## Supabase project prerequisites (dashboard, not repo - please verify)
- Email provider with confirmations enabled - already true (signUp uses needsConfirmation today).
  
- Redirect allowlist includes the site origin - already true for password reset (`redirectTo: origin`).
  
- "Secure email change" setting: fine either way for anonymous users (no old email to double-confirm), but worth knowing which is set.
  
- Note: the profiles auto-create trigger lives in the dashboard, not repo SQL - conversion never re-fires it (same user id), which is exactly what we want.
  
## Testing
- Store tests (existing mock pattern extends cleanly - `updateUser` is already stubbed): claim calls the right API and preserves `user.id`; `needsConfirmation` returned; collision error mapped; `USER_UPDATED` triggers profile refetch; `claimPending` derivation.
  
- Component: claim mode renders for anonymous users, pending state after submit.
  
- Manual e2e: the confirmation click needs a real inbox - I can verify everything up to "email sent" plus the return-flow with simulated sessions; one real pass with your email on the preview/prod closes the loop.
  
## Edge cases
- Claim submitted, never confirmed: session stays anonymous and fully functional; pending state persists across refreshes (derived from `user.new_email`). Resend available. If they change their mind, submitting a different email replaces the pending change.
  
- Claim while in a multiplayer room: claim view only opens from lobby/game-over paths; the game socket is untouched by `updateUser` (same session, token refresh unaffected).
  
- Email typo: resend + "use a different email" both available from the pending state.
  
- Existing-account collision: no merge - explicit non-goal for this PR (server-side merge of two user ids' rows is possible later if analytics show demand).
  
## Explicit non-goals
- OAuth/Google linking (`linkIdentity`) - zero OAuth scaffolding exists today; separate effort if ever.
  
- Merging a guest profile into an existing registered account.
  
- Changing the username at claim time - rename already exists in the lobby.
  
## Decisions (settled 2026-07-25)
1. **Claim form: email + password together** - one step, matches the app's only auth method.
  
2. **Guest sign-out guard: add the confirm.**
  
3. **Collision UX: "sign in instead" with an explicit stats warning.**
