# Issue #109 Postmortem: Blog List/Detail View Transitions

## Summary
- **Issue:** Shared-element transitions between `/blog` and `/blog/:slug` were inconsistent, sometimes delayed, and sometimes showed wrong/ghost elements.
- **Branch:** `codex/issue-109-blog-view-transitions`
- **Current baseline commit:** `f3a4348` (`Scope blog shared elements back to active target card`)
- **Current status:** Animations are working in both directions, but the **first cold-start transition** can still be misaligned.

## What This Implementation Uses
- Same-document (SPA) transitions using `document.startViewTransition(...)`.
- Per-post shared element names for `card`, `image`, `title`, `summary`, `meta`, and `pills`.
- Dynamic, target-scoped transition CSS injected only while a transition is active (`#blog-view-transition-active`).
- Bidirectional interception:
  - List -> detail click interception in `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/pages/BlogPage.tsx`
  - Detail -> list link interception in `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/pages/BlogPostPage.tsx`
  - Browser back/forward popstate hook in `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/index.tsx`

## Timeline Of Key Iterations

1. `1b56708` - Initial shared list/detail transition implementation.
2. `39bb4b3` - Added stable target hints to improve mapping between pages.
3. `3f69b75` - Fixed stale hint reuse that caused wrong-card image artifacts.
4. `0c5cc27` - Attempted cold-start stabilization; later caused regressions.
5. `14106a6` - Reverted `0c5cc27` due degraded behavior (delay/no visible transition).
6. `e0cf168` - Refined image shared-element handling for cold starts.
7. `b144773` - Additional first-run stabilization and faster timing; mixed results.
8. `f3a4348` - Scoped shared elements back to active target card; user confirmed this as better baseline.

## Confirmed Root Causes

### 1) Illegal invocation during transition start
- Symptom: `TypeError: Illegal invocation` from `startBlogViewTransition`.
- Cause: Calling `document.startViewTransition` without guaranteed `document` binding can fail in some invocation patterns.
- Fix: Explicitly invoke via `startTransition.call(viewTransitionDocument, ...)` in `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/shared/blogViewTransitions.ts`.
- Regression test: `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/tests/unit/blogViewTransitions.test.ts` (`invokes document.startViewTransition with document binding`).

### 2) Wrong card/image artifacts during transition
- Symptom: Non-selected blog cards or mismatched images appeared during motion.
- Cause: Over-broad/shared naming and stale transition hints allowed unintended elements to participate.
- Fixes:
  - Scoped transition participation to the active target post only.
  - Cleared stale hint behavior and tied transition state to explicit pending target.
  - Limited readiness checks to key elements (`image`, `title`) and route markers.

### 3) Gray/flashy image behavior
- Symptom: Reverse transition could appear gray or visually muddy.
- Cause: Cross-fading decorative overlays (fade/blur layers) as shared elements instead of only the photo layer.
- Fix: Apply shared transition to the real photo layer only; keep decorative overlays out of shared-element mapping.

### 4) Font-size mismatch/ghost text during morph
- Symptom: Headline looked too small/incorrect in one direction and ghosted during swap.
- Cause: Different typography contexts and fallback-font timing across list/detail snapshots.
- Fixes made:
  - Keep heading font family explicit in both contexts.
  - Use consistent title shared-element naming.
  - Add `font-synthesis: none` in transition pseudo-elements to reduce synthetic font distortion.
- Remaining issue: first cold transition can still mis-estimate typography bounds.

## Important External Constraints (Web Platform)
- `view-transition-name` must be unique among simultaneously rendered participants; duplicates can cause the transition to be skipped.
  - Source: [MDN `view-transition-name`](https://developer.mozilla.org/en-US/docs/Web/CSS/view-transition-name)
- For SPA transitions, `document.startViewTransition()` wraps the DOM update callback; this repo intentionally uses this flow.
  - Source: [MDN `Document.startViewTransition()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition)
- `@view-transition { navigation: auto; }` is for cross-document (MPA) transitions, not required for this SPA implementation path.
  - Source: [MDN `@view-transition`](https://developer.mozilla.org/en-US/docs/Web/CSS/@view-transition)

## Why The First Cold Transition Is Still The Weak Spot
- In cold starts, layout-critical resources (fonts/images/component chunks) and route structure can settle across initial frames.
- Shared-element transitions capture geometry at snapshot time; if destination geometry is still settling, first animation can misalign.
- After one successful transition, caches and warmed modules reduce variance, so subsequent transitions are typically correct.

## Current Mitigations Already In Code
- Prefetch opposite route modules:
  - `ensureBlogPostRouteModule()` in list page.
  - `ensureBlogListRouteModule()` in detail page.
- Prime snapshots with forced layout reads before/around transition capture.
- Wait for target readiness via route marker + required transition elements.
- Keep shared image source identical between card and detail header:
  - In `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/data/blogImageMedia.ts`, `header` and `card` both use `sharedLandscapeSources`.

## Remaining Known Gaps
- First transition from a fresh session can still show slight position/scale mismatch.
- Title/text morph is improved but not pixel-perfect on first cold pass.
- Popstate transition path remains more timing-sensitive than direct click path.

## Recommended Next Steps (For Next AI)

1. Add one-time diagnostics for first transition only:
   - Log active target, presence of each shared element name, and bounding boxes at capture start/end.
   - Capture `document.fonts.status`, image decode status, and route marker presence.
2. Gate first transition more strictly:
   - Before starting first transition after load, wait for:
     - target image decode completion
     - `document.fonts.ready` (with short timeout)
     - target route marker and required shared elements
3. Reduce first-run complexity:
   - Temporarily disable `card` shell shared element for the first transition only; keep `image` + `title` shared.
4. Re-check popstate flow:
   - Ensure snapshot/update ordering for browser back uses the same readiness guarantees as click-driven navigation.
5. Once stable, retune duration/easing from current debugging-friendly timing to final production timing.

## Repro Checklist
1. Start dev server.
2. Hard-refresh on a blog detail URL (cold load).
3. Navigate detail -> list, then list -> detail once.
4. Observe first transition geometry.
5. Repeat same flow without hard refresh; compare warm behavior.

## Test/Build Commands Used
- `pnpm test:core`
- `pnpm exec vite build`
- `pnpm dlx react-doctor@latest . --verbose --diff`

## File Map For Handoff
- `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/shared/blogViewTransitions.ts`
- `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/pages/BlogPage.tsx`
- `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/pages/BlogPostPage.tsx`
- `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/index.tsx`
- `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/index.css`
- `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/data/blogImageMedia.ts`
- `/Users/chrizzzly/.codex/worktrees/8337/travelflow-codex/tests/unit/blogViewTransitions.test.ts`

## Copy/Paste Prompt For Another AI
Use this baseline: branch `codex/issue-109-blog-view-transitions`, commit `f3a4348`.  
Goal: fix first-transition cold-start misalignment in blog list/detail shared-element transitions without regressing performance or reintroducing wrong-card artifacts.  
Constraints: keep active-target-only shared names, keep image/photo layer mapping, keep illegal-invocation-safe start call, and preserve bidirectional transitions (click + browser back).  
Please instrument first-run geometry/readiness and propose minimal, performant fixes.
