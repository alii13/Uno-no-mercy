# CLAUDE.md

Guidance for working in this repo. Hard-won - read before changing CSS, raising PRs, or touching Supabase.

## UI conventions

- Icons come from `lucide-vue-next` (already a dependency) - never emoji glyphs in UI chrome. Country flag emoji on leaderboards/profiles are the one exception.
- Concerns are color-zoned with the UNO palette: hazard yellow = daily/streak loop, alert red = primary create action, neon cyan = multiplayer, neutral = practice/meta.

## CSS tokens

- The spacing scale in `frontend/src/style.css` is `--spacing-0..4`, then jumps to `6, 8, 12, 16, 24`. **There is no `--spacing-5`** (or 7, 9-11, etc.).
- An undefined CSS var is silently invalid: `gap: var(--spacing-5)` collapses to 0, and in a shorthand (`padding: var(--spacing-4) var(--spacing-5)`) the whole declaration dies - zero padding.
- The source looking right proves nothing. After using any token you haven't confirmed exists, verify the computed style in a browser (`getComputedStyle` or devtools), not the stylesheet.

## PR workflow

- Feature work goes on a branch with a PR into `main`. Cloudflare Pages auto-deploys `main`.
- **Stacked-PR merge trap**: GitHub only retargets a stacked PR to `main` when its base branch is deleted after the base PR merges. Merging a stack quickly without deleting branches makes each PR merge into its original base branch - `main` gets only the bottom of the stack and the rest strands on feature branches, silently.
  - Prefer PRs based directly on `main`.
  - If you must stack: delete each branch as its PR merges, and verify `git log origin/main` actually contains the work afterward.
- Run `npm run build` (from `frontend/`) and `npx vitest run` before pushing. Build = `vue-tsc -b && vite build`, not just typecheck.

## Cloudflare Pages

- **Do not add `/* /index.html 200` to `_redirects`** - Pages flags it as an infinite loop and ignores it. Deep links (`/leaderboard`, `/p/<code>`) work via Pages' automatic SPA fallback, which applies because the build output has no `404.html`.
- **The Pages project's root directory is the REPO ROOT**, not `frontend/` (the project config has `pages_build_output_dir = "frontend/dist"`). Pages Functions therefore live at repo-root `functions/` - a `frontend/functions/` directory is silently ignored (no build error; the routes just serve the SPA shell instead). Verify with `npx wrangler pages download config uno-no-mercy` if in doubt, and delete the downloaded `wrangler.toml` afterward - committing it would switch the project to file-managed config.
- Functions deploy with the normal Pages build - no separate wrangler deploy.
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are available to Pages Functions as env bindings.
- Verify function behavior locally with `npx wrangler pages dev frontend/dist` from the repo root; env can be overridden per-run with `--binding KEY=VALUE`.
- A function that fails to deploy is indistinguishable from a working page at the HTTP level (200 + HTML via SPA fallback). When consuming a function from the client, check the response content-type, and after deploying a new function, curl its route on the deployment URL and confirm you get its actual output.

## Supabase

- `game_results` RLS is owner-select-only. Any public read (leaderboards, profiles, opponent stats) goes through a `SECURITY DEFINER` function granted to `anon, authenticated` - never widen RLS.
- Schema changes ship as SQL files in `supabase/` for manual runs in the SQL Editor, additive only. Run order matters when files depend on each other's columns (e.g. `leaderboards-v2.sql` before `profile-pages.sql`).
- Changing a function's return columns requires `drop function` + recreate - `create or replace` can't do it. The drop triggers the SQL Editor's destructive-operation warning; that's expected.
- The frontend feature-detects every definer function (probe once, hide the surface on error), so merging frontend and running SQL can happen in either order without breaking prod.

## Data quality

- Multiplayer walkover wins (every opponent left) record near-zero cards played and seconds-long durations. Speed/efficiency records and achievements gate on `cards_played_total >= 5` - keep that filter consistent between SQL (`public_profile`, `weekly_spotlights`) and `frontend/src/utils/achievements.ts`, which has an agreement test suite for exactly this.
