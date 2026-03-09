# Issue #109 Postmortem: Blog List/Detail View Transitions

## Summary
- **Issue:** Shared-element transitions between `/blog` and `/blog/:slug` were inconsistent, occasionally showed wrong-card artifacts, and repeatedly regressed into "URL changes, then the old page sits there, then the new page appears".
- **Branch:** `codex/issue-109-blog-view-transitions`
- **Current implementation shape:** active-target-only shared names, nested card/image/title groups for normal runs, sync SPA transitions via `document.startViewTransition(...)`, transition-aware browser history wrapping, targeted responsive-image warming for the active blog post, and a cold-start title-only fallback when the destination blog route kind has not been mounted yet.
- **Current status:** list -> detail, detail -> list, and browser back/forward animate through the same pipeline. Warm runs keep the richer shared card/image/title motion; the very first cold transition intentionally degrades to a cleaner title-led animation instead of attempting an unreliable hero-image morph.

## What Actually Helped
- Same-document (SPA) transitions using `document.startViewTransition(...)`.
- Per-post shared names for only the elements that need to morph:
  - `card`
  - `image`
  - `title`
- Nested shared-element grouping so the card shell and image clip/mask stay aligned.
- Active-target-only participation so unrelated cards never join the transition.
- A dedicated browser-history wrapper for POP navigation instead of ad-hoc `popstate` monkeypatching.
- Using the same underlying landscape image asset for blog card and article hero.
- Allowing the very first unseen route-kind transition to fall back to title-only shared motion.

## What Did Not Help
- Waiting for the destination route to become "fully ready" inside the `startViewTransition(...).update` callback.
- Global history monkeypatching (`pushState` / `replaceState` / `popstate`) outside the router.
- Cross-fading decorative layers like blur bands or dark overlays as shared elements.
- Broad shared names that allowed multiple cards to participate at once.
- Relying on the browser to always pair the cold first-run image snapshot correctly on detail -> overview.
- Replacing the image with a measured overlay animation. It fixed the pinned-image miss, but introduced white flash states and looked less stable overall than the native path.

## Main Root Causes

### 1) Illegal invocation of `document.startViewTransition`
- **Symptom:** `TypeError: Illegal invocation`.
- **Cause:** calling the method without a guaranteed `document` binding.
- **Fix:** invoke via `startTransition.call(viewTransitionDocument, ...)` in `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/shared/blogViewTransitions.ts`.

### 2) Wrong-card / ghost-image artifacts
- **Symptom:** other blog cards briefly appeared during the transition.
- **Cause:** stale hints and over-broad shared names let multiple cards qualify for the same transition.
- **Fix:** scope transition names to the active pending target only, and ignore stale hints when no active target is in progress.

### 3) Blur/fade layers caused muddy crossfades
- **Symptom:** gray or dirty-looking reverse transitions, especially around the hero image.
- **Cause:** the browser was blending decorative overlays, not just the actual photo content.
- **Fix:** keep the shared transition on the real image wrapper only; let decorative fade/blur layers remain normal page chrome.

### 4) Card/image clipping was unstable without nested grouping
- **Symptom:** image masks, rounded corners, and card shells did not stay visually locked together.
- **Cause:** the browser had to animate pieces with different clipping contexts.
- **Fix:** move the shared transition onto the real card and image wrappers, then use nested groups with clipped children. This is where the Chrome nested-group guidance helped.

### 5) The biggest recurring regression: async update callbacks
- **Symptom:** URL changes, then nothing animates for a noticeable delay, then the new page appears.
- **Cause:** for SPA view transitions, the browser does not start the animation until the `update` callback resolves. Every time we awaited extra route/image/font readiness inside that callback, we reintroduced a dead pause.
- **Fix:** keep the actual route update synchronous again. Warm resources earlier, but do not await them inside the transition callback.

### 6) Cold-start image captures were racing the responsive image load
- **Symptom:** on a fresh article load, returning to the overview could show the large hero lingering while the list already appeared underneath.
- **Cause:** the target card existed, but its card-sized responsive image candidate was not warm yet when the browser captured the new transition state.
- **Fix:** preload the opposite-side responsive image early:
  - detail page warms the overview card image on mount and on back-link intent
  - overview cards warm the detail hero image on hover/focus/click intent

### 7) The old card snapshot could visually overpower the nested image transition
- **Symptom:** even when the shared image pairing was correct, the big detail card snapshot could sit over the list long enough to make it look like the image itself was not transforming.
- **Cause:** the card shared element includes the hero area, so the old card snapshot carries a copy of the large image pixels.
- **Fix:** fade the temporary `blog-card-transition` snapshot out quickly so the nested `blog-image-transition` is the dominant visible motion layer.

### 8) Cold first-run image pairing was still unreliable even after preload/warmup
- **Symptom:** on a fresh direct article load, returning to the overview still left the large hero image pinned in place for the first visible part of the transition.
- **Cause:** the browser was still failing to morph the shared image snapshot consistently on the cold `detail -> overview` path, even when the target DOM, image preload, and route timing were correct.
- **Fix:** do not force the image on that first unseen-route transition. Instead, the first cold run falls back to a title-only shared transition. Once both the list and post routes have mounted once, the richer native card/image/title transition path resumes automatically.

## Did Nested View Transitions Help?
Yes, but only for the right class of problems.

They **did help** with:
- clipping the card and image correctly
- keeping rounded corners stable
- making image motion feel like one coherent object instead of stacked layers fighting each other
- reducing bleed-through from neighboring cards

They **did not help** with:
- route-chunk timing
- router update sequencing
- first-load startup delays
- async readiness waits inside `startViewTransition`
- the browser’s cold first-run shared-image pairing miss on detail -> overview

So the nested-group work was worth keeping, but it was never enough on its own for the first cold image run. The final stable solution keeps the richer nested native transition for normal runs, then degrades only the first unseen-route transition to title-only instead of trying to outsmart the browser.

## Final Working Direction
The stable pattern is:
1. Preload the destination route module as early as possible.
2. Keep the view-transition `update` callback synchronous.
3. Use `flushSync(...)` for the route commit inside the transition.
4. Keep browser back/forward on the same path via a shared history wrapper.
5. Limit shared participants to the active target card/image/title on warm runs.
6. Keep card and hero using the same image source.
7. Warm the opposite-side responsive image candidate before the transition starts when the next route is already knowable.
8. Fade the larger card snapshot quickly enough that it does not mask the image motion.
9. If the destination blog route kind has not been seen yet, reduce that one transition to title-only instead of forcing a broken shared image/card morph.

In the current branch that means:
- `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/pages/BlogPage.tsx`
  - preloads `BlogPostPage` early
  - also preloads on card intent (`focus` / `pointerenter`)
  - warms the article hero image on click intent
  - marks the list route kind as seen after mount
- `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/pages/BlogPostPage.tsx`
  - preloads `BlogPage` early
  - also preloads on back-link intent
  - warms the overview-card image on mount
  - marks the post route kind as seen after mount
- `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/shared/blogViewTransitions.ts`
  - transition start is binding-safe
  - prepared transitions await route preload before starting, but do **not** await extra readiness inside the update callback
  - caches and warms the responsive image request that the opposite side will need
  - tracks which blog route kinds have mounted and switches first unseen-route transitions into title-only mode
- `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/shared/appHistory.ts`
  - POP navigation uses the same synchronous transition commit path

## Why The Latest Cold-Start Attempt Was Wrong
A bounded `waitForBlogTransitionTarget(...)` looked attractive because it improved first-run geometry in some cases. But it was placed in the wrong phase: inside the transition update callback.

That traded one bug for another:
- **good:** first-run target could be a bit more stable
- **bad:** the browser delayed the animation start until the wait finished

That is not an acceptable tradeoff here. A transition that starts late feels broken even if its geometry is cleaner.

## Verified Behavior From Browser Probing
Local probe after the latest change showed:
- detail -> list
  - route update finished inside the transition callback in about `99ms`
  - total transition finished in about `535ms`
  - callback result was **not** a promise
- list -> detail
  - route update finished inside the transition callback in about `67ms`
  - total transition finished in about `523ms`
  - callback result was **not** a promise

That is the right shape. The browser is animating immediately again.

## Current Known Risks
- First uncached transitions are still intentionally less ambitious than warm ones. The first unseen-route transition is title-led by design.
- The CSS toolchain still warns about `::view-transition-group-children(...)`, even though the selector is preserved in the final CSS.
- If this feature is extended elsewhere, the same rule applies: do not solve readiness issues by making the update callback async.

## Recommended Pattern For Other Parts Of The App
If another feature wants the same effect:
1. choose the minimum shared elements that truly need to morph
2. keep shared names unique to the active target
3. use nested groups for clipping/masking problems
4. preload the destination route/component before the click path when possible
5. keep the transition update callback synchronous
6. handle browser POP navigation with router-aware history wrapping, not ad-hoc global listeners
7. if the browser still misses the cold shared-image pair, prefer a scoped reduced transition for that first run over a full custom overlay unless there is a strong reason to own the entire image animation yourself

## Test/Build Commands Used
- `pnpm test:core`
- `pnpm exec vite build`
- `pnpm dlx react-doctor@latest . --verbose --diff`
- browser probes via Playwright against a local preview server

## File Map
- `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/shared/blogViewTransitions.ts`
- `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/shared/appHistory.ts`
- `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/pages/BlogPage.tsx`
- `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/pages/BlogPostPage.tsx`
- `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/index.css`
- `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/data/blogImageMedia.ts`
- `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/tests/unit/blogViewTransitions.test.ts`
- `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/tests/unit/appHistory.test.ts`
