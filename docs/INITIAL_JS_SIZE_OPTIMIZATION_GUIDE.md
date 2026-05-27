# Initial JS Bundle Size Optimization Guide

This document analyzes options and strategies for reducing TravelFlow's initial JavaScript bundle size. Currently, the main entry bundle (`dist/assets/index-*.js`) is **~773 KB**, and the total JS footprint includes larger packages like `mapbox-gl` (1.69 MB).

---

## 🔍 1. Current Bundle Breakdown

Based on Vite build outputs, the initial page load fetches:
1.  `index-*.js` (~773 KB): Core vendor bundle containing React, React DOM, React Router v7, Framer Motion, Radix UI, i18next, and other design tokens.
2.  `Tracker-*.js` (~807 KB): Analytics / tracking system.
3.  `mapbox-gl-*.js` (1.69 MB): Mapbox rendering engine (successfully code-split so it only loads on pages rendering Mapbox).
4.  `aiService-*.js` (~329 KB): AI planning utilities.
5.  `releaseNotesService-*.js` (~348 KB): Release notes bundle.

To optimize the entry bundle size, we evaluate Preact and TanStack migrations alongside other high-impact, lower-effort quick wins.

---

## ⚖️ 2. Comparison: Preact vs. TanStack

### Option A: Migrating to Preact (`preact/compat`)
Preact is a 3 KB alternative to React with a compatible React ES6 API.

*   **Size Savings**: **~35 KB to 45 KB (Gzip)**. It replaces `react` (approx 6 KB gzip) and `react-dom` (approx 42 KB gzip) with Preact (approx 3 KB gzip).
*   **Implementation Effort**: **Low** (1–2 developer hours).
    *   Install `@preact/preset-vite`.
    *   Add aliases in `vite.config.ts` mapping `react` and `react-dom` to `preact/compat`.
*   **Risk & QA Effort**: **Very High** (20–30 QA hours).
    *   *Compat Library Errors*: Some advanced Radix UI primitives, Framer Motion animations, or `@vis.gl/react-google-maps` might hit edge-case compatibility issues under `preact/compat` (e.g. ref assignment behaviors or React 18 concurrent features).
    *   *Verification*: The entire application checkout flow, trip generator, and Mapbox integrations must undergo exhaustive manual and automated testing.

---

### Option B: Migrating to TanStack Stack (Router + Query)
Replacing React Router v7 (`react-router-dom`) with TanStack Router, and migrating state management to TanStack Query.

*   **Size Savings**: **~40 KB to 60 KB (Gzip)** directly from the core bundle, with much better granular code-splitting.
*   **Implementation Effort**: **Extremely High** (40–80 developer hours).
    *   *Routing Rewrite*: Require rewriting route definitions, path builders, navigation hooks (`useNavigate`, `useLocation`, `useParams`), and auth-route guards across 50+ pages.
    *   *State Rewrite*: Transitioning context-based fetches to TanStack Query (`useQuery`, `useMutation`) requires refactoring API clients and DB synchronization logic.
*   **Risk & QA Effort**: **Medium-High** (15–20 QA hours).
    *   TanStack Router is fully type-safe, which prevents runtime routing errors, but the transition involves touching almost every page in the application.

---

## ⚡ 3. Recommended Approach: Quick-Wins First

Before undertaking a framework rewrite (Preact) or a router overhaul (TanStack), we recommend harvesting low-hanging fruit which can yield **150 KB+** in bundle size reductions with virtually zero compatibility risk.

### Phase 1: Audit with Rollup Visualizer (1 hour)
Install `rollup-plugin-visualizer` to see a graphical chart of exactly what files and modules make up the `773 KB` bundle:
```typescript
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({ open: true, filename: 'bundle-analysis.html' })
  ]
});
```

### Phase 2: Tree-Shake Icon Libraries (2 hours)
Icon packages (like `@phosphor-icons/react` or `lucide-react`) are common sources of bundle bloat if imports are not configured correctly.
*   **Problem**: If you do `import { ArrowLeft, Clock } from '@phosphor-icons/react'`, Vite might compile in the entire icon library map (hundreds of icons).
*   **Fix**: Update imports to point directly to the individual icon source files:
    ```typescript
    import ArrowLeft from '@phosphor-icons/react/dist/icons/ArrowLeft';
    import Clock from '@phosphor-icons/react/dist/icons/Clock';
    ```
    Alternatively, configure Vite's resolver to optimize icon imports automatically.

### Phase 3: Code-Split Heavy Pages (3 hours)
Verify that pages loaded inside `DeferredAppRoutes.tsx` are fully code-split:
*   Ensure that no page-specific heavy library (like `tremor` or `@vis.gl/react-google-maps`) is imported in `index.tsx` or components used by the header.
*   Google Maps components should only load the maps library dynamically via `GoogleMapsLoader` rather than importing maps globals statically.
