# Post-mortem: homepage performance work → cascading landing-page breakage (2026-07)

**Status:** resolved (landing pages functional across Chrome + Safari); one cosmetic issue documented as a tracked follow-up (active-nav underline).
**Scope:** public marketing/landing pages (`/`, `/blog`, `/features`, `/inspirations`, `/pricing`) — prerendered static HTML hydrated by a Vite + **preact/compat** SPA, deployed on Netlify.
**Releases involved:** v0.141.0 – v0.151.0 (+ footer fix).

> Read this before touching the boot/prerender/hydration path. Most of the pain
> below came from treating `preact/compat` like React 18. It is not. See
> `LIGHTHOUSE.md` → "Prerender + hydration invariants" for the enforced rules.

---

## 1. What happened (summary)

A homepage performance pass (make it load faster, fix a blank-flash) turned into
a multi-day series of production regressions where landing pages loaded in a
broken/partial state: missing images, missing footer, missing nav highlight,
occasional fully blank page — intermittently, and worse in Safari than Chrome.

Each "fix" resolved one layer and exposed (or introduced) the next. The through
-line: **the app prerenders HTML and hydrates it with preact/compat, whose
hydration semantics differ from React 18 in ways the code did not account for.**

## 2. Timeline of failures → fixes

| # | Symptom (user-visible) | Root cause | Fix | Release |
|---|---|---|---|---|
| 1 | Blank/white flash until JS booted; "buggy until I navigate" | A "warm critical chunks before mount" gate **deferred hydration by up to ~5s**; everything React-driven was dead until it elapsed | Hydrate immediately; warm chunks in the background | v0.141 (PR #411) |
| 2 | Deep links flashed wrong content / broke | SPA fallback served the prerendered **homepage** HTML for every non-prerendered URL | Emit a clean `spa.html`; point the catch-all at it | v0.142 (#410) |
| 3 | Homepage waited on Supabase | `/` route suspended on `supabase.auth.getSession()` | Render immediately; redirect authed users in an effect | v0.143 (#409) |
| 4 | Hero repaint / LCP element churn | rough-notation underline injected an SVG post-hydration, invalidating the prerendered LCP | Static inline SVG underline; shimmer gated to first interaction | v0.144 (#412) |
| 5 | White flash on **client-side navigation** | Prerender stripped the boot-shell `<style>`, but the runtime nav-loading shell reuses those `tf-boot-*` classes | Keep the boot-shell `<style>` in prerendered pages | v0.145 (#413) |
| 6 | Whole site loads in a broken state until you click | **Stale modulepreload hints**: the prerender attached to a leftover `vite preview` on the port and baked chunk hashes that no longer existed → every chunk fell to the SPA-fallback HTML (MIME error) → hydration died | Prerender aborts if the port is busy + `--strictPort`; hint existence filter; **build-time gate that fails on any dangling asset ref** | v0.147 (#415) |
| 7 | Footer / below-hero sections missing (Safari) | Below-fold content was gated on `IntersectionObserver`, whose callbacks **did not fire in WebKit** | Mount below-fold on a post-hydration timer, not IO | v0.148 (#416) |
| 8 | Intermittent blank; footer sometimes absent | preact/compat blanks the tree when it **suspends during hydration** (async i18n above the route boundary → root `fallback={null}`); and `requestIdleCallback` is throttled unreliably in WebKit | Await app-shell i18n before hydrate (bounded); non-blank root fallback; guaranteed `setTimeout` reveal | v0.149–v0.150 (#417, #418) |
| 9 | Footer/sections *still* intermittently missing (Safari) | On ~1/4 cold WebKit loads the client never completed mounting (the footer chunk was never even requested) — so **anything mounted by client JS can be missing** | Render below-fold + footer as **static prerendered markup** (eager on prerendered pages) so they exist without client JS | v0.151 (#419) |
| 10 | Footer not flush at the bottom (empty band) | The footer wrapper forced `min-h-[200px]`, taller than the footer → reserved empty space showed as a band | Remove the wrapper min-height | footer fix |

## 3. Root causes (the deep ones)

1. **preact/compat hydration ≠ React 18 hydration.** React 18 keeps the
   server DOM when a subtree suspends during hydration and reconciles
   attribute/prop mismatches. preact/compat does neither reliably: a suspend
   swaps in the Suspense fallback (blank if `null`), and a className/attribute
   mismatch is often **not** patched (the server value sticks). Almost every bug
   above is a corollary of this.
2. **First render must equal the prerender capture AND must not suspend.** Any
   divergence (empty spacer vs full footer; missing i18n) breaks under
   preact/compat. We now enforce: identical first render, i18n ready before
   hydrate, non-blank root fallback.
3. **Client JS is not guaranteed to run/complete.** Production WebKit
   intermittently failed to mount (chunk never requested). Content that must be
   visible has to be **in the static HTML**, not mounted by an effect.
4. **The prerender is a second, hidden build surface.** A stray dev server, a
   variable only defined in one function, an unhandled MIME fallback — all shipped
   broken HTML that looked fine locally. It now has a **build-time safety gate**.

## 4. What worked vs what didn't

**Worked:**
- Reproducing in the *actual failing browser* (WebKit/Playwright) — see §5.
- A build-time gate that fails on dangling asset references (turns a silent
  production breakage into a red build).
- Preferring **static markup** over client-mounted content for must-see UI.

**Didn't work / wasted time:**
- Verifying only in headless **Chromium** while users were on **Safari** — the
  single biggest process failure. Multiple "verified, fixed" claims were wrong.
- Trusting local `vite preview` results: the image CDN and SPA-fallback behave
  differently than production Netlify, masking/altering bugs.
- Leaving `vite preview` servers running between builds — caused the stale-hint
  production breakage (#6).
- Theorizing about root cause instead of instrumenting to read real values.

## 5. Prevention rules (do these — enforced where possible)

1. **Test prerendered pages in WebKit, not just Chromium.** `preact/compat` +
   prerender bugs routinely reproduce only in Safari's engine. Add a WebKit pass
   to any boot/hydration change. (`npx playwright` `webkit`.)
2. **Never let the first client render suspend at/above the root**, and **never
   use `fallback={null}` at the root.** Await shell i18n before `hydrateRoot`.
3. **Deferred/lazy content must render identically on the prerender capture and
   the client's first render.** Use `isPrerenderCapture()` / `isPrerenderedDocument()`
   (`services/prerenderHydrationState.ts`) — don't gate must-see content on
   `IntersectionObserver` (fails in WebKit) or `requestIdleCallback` (throttled
   in WebKit); a plain `setTimeout` is the reliable trigger, or render eagerly.
4. **Must-see UI (footer, key sections) belongs in the static prerendered HTML**,
   not mounted by a client effect — client JS may never run.
5. **The prerender is part of the build. Guard it.** Keep the dangling-asset-ref
   gate (`scripts/prerender-routes.mjs`) and the port-in-use abort. Never rely on
   a manually-started preview server.
6. **Kill stray `vite preview`/`vite` processes before building/deploying.**
7. **Verify on production, in a cold/incognito session, in the real browser** —
   not only local preview, which diverges (CDN, redirects, timing).
8. **Instrument before theorizing.** When behavior is browser/timing-specific,
   write the value to the DOM / console and read it, rather than guessing.
9. **Rotate the exposed Gemini key** (separate security incident, already fixed
   in code) — noted here so it isn't forgotten.

## 6. Known remaining issue (tracked follow-up)

**Active-nav underline missing on a direct/prerendered load until the user
navigates.** Fully diagnosed, not yet fixed (fixing it safely needs care around
the custom history):
- On the first render (during prerender capture **and** client hydration) the
  router's location is `"/"` even on `/blog` — so `NavLink.isActive` is `false`
  and the active underline is not rendered/captured. It only becomes correct
  after a real navigation fires a history event.
- Suspected cause: the `unstable_HistoryRouter` + custom `appHistory` **Proxy**
  (`shared/appHistory.ts`) does not seed the Router's initial location from
  `window.location` on the first render under preact/compat. Compounded by
  preact/compat **not reconciling the className on hydration**, so a later
  client correction doesn't repaint the underline.
- Attempted and rejected (documented so we don't repeat): seeding `useState`
  from `isPrerenderedDocument()`; a `RouterLocationSync` that replaces to the
  real URL on mount; computing active from `window.location.pathname`; a
  forced post-mount re-render. None applied the class, because the prerender
  captured the inactive markup and preact keeps it.
- **Recommended fix:** make the Router receive the correct initial location at
  first render — verify/repair the `appHistory` Proxy's `location`/`action`
  getters, or drop the Proxy and seed `unstable_HistoryRouter` with an explicit
  initial location, so the prerender captures the active nav (which preact then
  keeps). Verify in WebKit + prerendered HTML that `after:scale-x-100` is present
  on the active link for `/blog`, `/features`, etc.

## 7. Follow-ups (perf debt from the reliability-first choices)

- Reviving the critical-CSS inliner (`TF_INLINE_CRITICAL_CSS=1` currently
  crashes) to recover the LCP lost by rendering below-fold content statically.
- Consider whether `preact/compat` is the right long-term choice for a
  prerender+hydrate marketing site, given how many bugs stem from its hydration
  divergence from React 18.

---

## Addendum (2026-07-05): resolved structurally by the Next.js migration

The failure class documented here — prerendered HTML diverging from the
client's first render under preact/compat hydration — was eliminated at the
root by migrating to the Next.js App Router (React 19) in #423:

- Server/SSG HTML is rendered from the exact component tree the client
  hydrates; there is no separate Playwright capture to drift from.
- i18next is initialized per-locale on the server and the resources are
  injected before the first client render, removing the suspend-on-i18n and
  translated-text-mismatch classes.
- The boot shell, modulepreload hint injection, `spa.html` fallback,
  two-pass `hydrated` flags, and deferred-mount workarounds were deleted.
- Active-nav state derives from the server-known pathname, so it is correct
  in the prerendered HTML itself.
