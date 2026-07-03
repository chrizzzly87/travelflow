# Decision options: frontend runtime for TravelFlow

Companion to issue #422 and `docs/POSTMORTEM_2026-07_HOMEPAGE_PERFORMANCE_AND_HYDRATION.md`.

## Decision drivers (in priority order for this decision)

1. **Interactivity.** The product is genuinely interactive — the trip planner
   (timeline, map, drag/resize, autosave), forms, admin. Whatever we pick must
   keep full client interactivity; static-only frameworks are out for the app.
2. **LLM-driven design iteration must stay easy.** We want to keep updating and
   redesigning the UI quickly with an AI assistant. That favors: plain,
   idiomatic React (which LLMs know best), a conventional component model, a
   real design system, and NO exotic runtime gotchas an LLM has to remember on
   every change (the whole 2026-07 incident was preact/compat hydration gotchas
   biting exactly this).
3. **Reliability of the prerendered marketing surface** (the thing that broke).
4. **Performance** (LCP/bundle) and **migration effort**.

## Scoring legend: ✅ strong · 🟡 acceptable · ❌ weak

---

## Option 1 — React 18 everywhere (drop preact/compat)  ⭐ recommended near-term

Remove the `preact/compat` aliases in `vite.config.ts`; run real `react-dom` 18.
Keep the current Vite + prerender + hydrate setup otherwise.

- Interactivity: ✅ full React 18.
- **LLM design ease: ✅ best.** One runtime, standard React — every example,
  doc, and LLM's training data applies directly. No "careful, preact hydration
  won't reconcile className / blanks on suspend" caveats. The invariants we had
  to hand-enforce mostly disappear (React 18 keeps server DOM on suspend and
  reconciles mismatches).
- Reliability: ✅ the specific bugs we hit are handled by React 18 hydration.
- Performance: 🟡 bundle grows (~+60–120KB raw per the migration snapshot in
  `PERFORMANCE_EXECUTION_TODO.md`). Recoverable in part via code-splitting +
  the critical-CSS work already queued.
- Effort: 🟡 low–medium: flip the aliases, re-point vitest to react-dom, run the
  full WebKit + prerender verification, measure bundle. No routing/data rewrite.
- Ecosystem: ✅ radix, vaul, tremor, framer-motion, react-router v7 all target
  React first — fewer compat surprises.

**Best if:** we want to stop fighting the runtime and keep the codebase maximally
LLM-friendly with the least churn. Bundle size is the thing to measure/accept.

---

## Option 2 — Split runtimes: React 18 for marketing, preact for the app

Real React 18 on the prerendered marketing routes (where every bug occurred);
keep preact/compat for the heavy app (trip tool/admin) to preserve its size win.

- Interactivity: ✅ full on both.
- **LLM design ease: 🟡→❌.** Two runtimes to reason about; an LLM (or human) has
  to know which surface uses which and not mix patterns. More build complexity.
  Works against driver #2.
- Reliability: ✅ marketing gets the runtime designed for prerender+hydrate.
- Performance: ✅ keeps preact size win where the JS is heaviest (the app).
- Effort: 🟡 medium, plus ongoing complexity tax.

**Best if:** the app bundle size is critical AND we accept a more complex mental
model. Given driver #2, only choose this if a measurement shows Option 1's size
hit is unacceptable.

---

## Option 3 — Stay on preact/compat, enforce the invariants (status quo)

Keep everything; rely on the documented invariants, two-pass patterns, the
prerender safety gate, and WebKit-in-CI.

- Interactivity: ✅ full.
- **LLM design ease: ❌ worst.** Every prerender/hydration-touching design change
  must remember the preact gotchas; LLMs will re-hit them (they did, repeatedly).
  This directly fights driver #2.
- Reliability: 🟡 only as good as our vigilance; new code can silently reintroduce
  the failure class.
- Performance: ✅ smallest bundle. Effort: ✅ none.

**Best if:** bundle size dominates all else and design iteration slows down. Not
recommended given the stated priorities.

---

## Option 4 — Astro islands for the marketing site, keep the React SPA for the app

Marketing/landing pages → Astro (static-by-default, interactive "islands" only
where needed). The trip tool/admin stay a React SPA (mounted under a route).

- Interactivity: ✅ islands for marketing widgets; the app stays a full SPA.
- **LLM design ease: ✅ for marketing, 🟡 overall.** Astro's component model +
  Tailwind is very clean and LLM-friendly for *design/marketing* work, and
  static-by-default **structurally removes** the "client must mount below-fold
  content" bug class we hand-fixed. But it's a second framework; the LLM must
  context-switch between Astro (marketing) and React (app).
- Reliability: ✅ best for the marketing surface (no hydration-of-everything).
- Performance: ✅ near-zero JS on static sections; best LCP ceiling.
- Effort: ❌ high — real migration of marketing routes, build/deploy changes.

**Best if:** we want the strongest marketing perf + reliability long-term and are
willing to invest. Good long-horizon target even if we do Option 1 first.

---

## Option 5 — Next.js (React) for everything (RSC + streaming)

Migrate to Next.js App Router: Server Components for static/marketing, Client
Components for the interactive app; streaming SSR instead of prerender+hydrate.

- Interactivity: ✅ full (client components).
- **LLM design ease: ✅ very high.** Next.js is one of the most heavily
  represented stacks in LLM training data; conventions LLMs reliably know.
- Reliability: ✅ RSC/streaming solve the prerender/hydration issues natively.
- Performance: ✅ strong (streaming, per-route JS, RSC ships less client JS).
- Effort: ❌ highest — routing, data-loading, auth, and deploy model all change
  (Netlify Next adapter or Vercel). A quarter-scale project, not a flip.

**Best if:** we're ready for a strategic re-platform and want the highest ceiling
for both perf and LLM-assisted development. Overkill if Option 1 suffices.

---

## Recommendation

- **Now:** run the Option 1 measurement (build the marketing entry on real
  react-dom 18 behind a flag; compare bundle/transfer, whether the hydration
  invariants relax, and Lighthouse). If the size delta is acceptable → **adopt
  Option 1**: it maximizes driver #2 (LLM design ease) and driver #1
  (interactivity) with the least churn, and neutralizes the incident's root
  cause. Fall back to **Option 2** only if the app bundle truly can't absorb it.
- **Keep improving LLM-driven design regardless of runtime:** the current
  Tailwind + radix + shadcn + component-playground setup is already very
  LLM-friendly. Reinforce it — design tokens, a documented component catalog,
  and the existing `AdminComponentPlaygroundPage` — so design changes are
  "edit a well-named component" rather than "reverse-engineer bespoke markup".
- **Long-term (separate track):** evaluate **Option 4 (Astro islands)** for the
  marketing surface for the best perf/reliability ceiling, once Option 1 stops
  the bleeding.

## Definition of done for the decision
- Measured react-dom-18-vs-preact/compat comparison on the marketing entry
  (bundle + Lighthouse + which invariants can be dropped).
- A recorded decision (1/2/3/4/5) with the numbers.
- If we stay on preact/compat: the enforcement (lint/checklist/WebKit smoke)
  is landed so the incident class can't silently return.
