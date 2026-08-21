---
name: pr-review
description: Repo-specific PR review for Open Mercy. Run after raising any PR, before merge. Reviews the diff against this repo's known failure modes, posts findings as inline PR comments, fixes them, pushes the fixes to the same branch, and resolves the addressed threads. Triggers - "review this PR", "pr review", "review PR N", "run the review skill".
---

# PR review - Open Mercy

Review the PR, then close the loop: every finding gets an inline comment, a fix, a push, and a resolved thread. A review that only produces comments is half done.

## 1. Read the diff

```bash
gh pr diff <N>                      # or: git diff main...<branch>
gh pr view <N> --json title,body    # the claim the diff must match
```

Check scope first: every changed line must trace to the PR's stated purpose. Call out drive-by changes.

## 2. The checklist (each item is an incident this repo already had)

- **Derived auth state.** For any change touching the Supabase URL, auth config, or storage: what does supabase-js derive from the changed input? The session storage key comes from the URL's first hostname label - changing it signed every guest out (#162). The key is pinned via `auth.storageKey` in `lib/supabase.ts`; never remove the pin, never change its value without a `migrateLegacySession()`-style migration.
- **Identity continuity.** Anything that can mint a new anonymous user for an existing player (domain, origin, storage changes) orphans their profile, share code, and history. Demand a migration path.
- **Pages env parity.** Every `import.meta.env.VITE_*` the diff reads must exist in the Pages Production env. Verify with `npx wrangler pages download config uno-no-mercy` - and delete the downloaded `wrangler.toml`; committing it flips the project to file-managed config.
- **CI env trap.** `src/lib/supabase.ts` throws at import time when env vars are unset, and CI passes none. Any new spec whose import graph reaches it needs `vi.mock('../../lib/supabase', ...)`. Local runs pass either way (`frontend/.env` exists) - red CI on green local is this.
- **RLS conventions.** Never widen RLS. Public reads go through `SECURITY DEFINER` functions granted to `anon, authenticated`. Schema changes are additive SQL files in `supabase/`, run manually.
- **Walkover filter parity.** Any stats/achievements change keeps `cards_played_total >= 5` consistent between the SQL definer functions and `frontend/src/utils/achievements.ts`.
- **Analytics discipline.** New events are documented in the `utils/analytics.ts` header. New event params only accrue in GA after registration as custom definitions - undocumented params silently vanish.
- **CSS tokens.** Only spacing tokens that exist (`--spacing-0..4, 6, 8, 12, 16, 24` - there is no `--spacing-5`). An undefined var silently kills the whole shorthand declaration.
- **Pages routing.** No `/* /index.html 200` in `_redirects`; host-level redirects live in `functions/_middleware.js`; Pages Functions live at repo-root `functions/`, never `frontend/functions/`.
- **Stacked PRs.** Base every PR on `main`. If stacked anyway: delete each branch as its PR merges, then verify `git log origin/main` contains the work.
- **UI changes.** Verified in a real browser (dev server or preview deploy), every state the diff introduces - the source looking right proves nothing.
- **Gates.** `npx vitest run` and `npm run build` (vue-tsc + vite) from `frontend/`, both green, output pristine.

## 3. Post findings as inline comments

One comment per finding, on the exact line, with severity:

```bash
COMMIT=$(gh pr view <N> --json headRefOid -q .headRefOid)
gh api repos/alii13/open-mercy/pulls/<N>/comments \
  -f body="[blocker|should-fix|nit] <finding - what breaks and when>" \
  -f commit_id="$COMMIT" -f path="<file>" -F line=<line> -f side=RIGHT
```

Severities: `blocker` (wrong output, data loss, security), `should-fix` (real defect, survivable), `nit` (do not block on these). No finding survived the checklist? Post one summary review comment saying what was checked, and stop here.

## 4. Fix, push, resolve

1. Fix every blocker and should-fix on the PR branch. Nits are fixed only when trivial.
2. Re-run the gates (`npx vitest run`, `npm run build`), then push to the same branch.
3. Resolve each addressed thread - reply first with what changed, then resolve:

```bash
# list threads
gh api graphql -f query='query { repository(owner:"alii13", name:"open-mercy") {
  pullRequest(number: <N>) { reviewThreads(first: 50) {
    nodes { id isResolved path line comments(first: 1) { nodes { body } } } } } } }'

# reply into a thread, then resolve it
gh api repos/alii13/open-mercy/pulls/<N>/comments/<comment_id>/replies -f body="Fixed in <sha>: <one line>"
gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "<thread_id>"}) { thread { isResolved } } }'
```

Never resolve a thread that was not actually addressed - a deliberately-skipped nit gets a reply saying so and stays open or is resolved by a human.

## 5. Verdict

End with one line on the PR: what was found, what was fixed, what was skipped and why, and whether the PR is merge-ready.
