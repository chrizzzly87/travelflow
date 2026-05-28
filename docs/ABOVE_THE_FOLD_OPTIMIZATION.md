# Above-the-Fold & Progressive Hydration Guidelines

This document outlines architectural patterns and developer guidelines for maintaining optimal web performance (First Contentful Paint, Largest Contentful Paint, Cumulative Layout Shift) across public and product pages.

---

## 🚀 1. The Core Performance Model

Fast pages depend on three complementary techniques:
1.  **Static Pre-rendering (SSG)**: Build-time HTML should contain the initial route shell and the content needed for the first viewport.
2.  **Measured CSS Delivery**: CSS delivery changes must be tested against real Lighthouse output before becoming defaults. Critical CSS inlining can help in narrow cases, but it can also inflate HTML, delay parsing, and worsen CLS.
3.  **Progressive Hydration**: Above-the-fold interactive components hydrate immediately. Below-the-fold JavaScript loads only when the user is close to needing it.

---

## 🧱 2. Above-the-Fold Performance Rules

To prevent LCP degradation and layout shifts, follow these guidelines for any content that renders in the initial viewport (typically top `700px` on desktop, `600px` on mobile):

*   **No Heavy Elements in Critical Path**: Avoid placing heavy third-party maps, charts, calendar grids, or raw text editors in the initial viewport. Load these lazily on interaction or near-viewport scroll.
*   **Initial UI Must Not Wait for Interaction**: UI that is expected to be visible in the first viewport must render and hydrate immediately. Do not gate first-viewport notices, headers, navigation, calls to action, or alerts behind first-click, first-scroll, or first-keyboard listeners.
*   **No Late Document-Flow Insertion Above Content**: Anything that can appear after initial paint above the page content must either reserve stable space from the start or be positioned outside normal document flow. Fixed or absolute overlays should sit below persistent navigation, use a predictable z-index, and avoid covering essential controls.
*   **Font Optimization**: Critical font families are preloaded via `link rel="preload"` where appropriate to prevent FOIT (Flash of Invisible Text).
*   **Zero Layout Shimmer Flickering**: If pre-rendered HTML matches the initial client layout, the bootstrap overlay loading shell (`#app-bootstrap-shell`) is bypassed immediately to prevent a layout shift.
*   **Image Dimensions**: Any above-the-fold image must have explicit dimensions or aspect-ratio styles and should use high fetch priority (`fetchPriority="high"`) when it is likely to be the LCP element.

---

## 💤 3. Implementing Progressive Hydration

To prevent hydration blockages and initial JS bundle bloat, below-the-fold components should be loaded lazily when they are expensive or not needed for initial comprehension.

### Code Pattern
When introducing a below-the-fold component:
1.  Use `lazyWithRecovery` to dynamically import the module (this ensures automatic page reloads if chunk retrieval fails during deployments).
2.  Wrap the component in `<Suspense>` with a fallback container.
3.  Use an `IntersectionObserver` to defer rendering the `<Suspense>` tree until the placeholder is near the viewport (e.g., using `rootMargin: '200px'` to start loading the chunk before it scroll-enters).

#### Example:
```typescript
import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { loadLazyComponentWithRecovery } from '../services/lazyImportRecovery';

const lazyWithRecovery = <TModule extends { default: React.ComponentType<any> }>(
    moduleKey: string,
    importer: () => Promise<TModule>
) => lazy(() => loadLazyComponentWithRecovery(moduleKey, importer));

// 1. Lazy load the component
const BelowFoldComponent = lazyWithRecovery(
    'BelowFoldComponent',
    () => import('./BelowFoldComponent').then((module) => ({ default: module.BelowFoldComponent }))
);

export const MyPage: React.FC = () => {
    const [shouldLoad, setShouldLoad] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // 2. Load chunk when intersection is close
    useEffect(() => {
        if (shouldLoad) return;
        const node = containerRef.current;
        if (!node || typeof IntersectionObserver === 'undefined') {
            setShouldLoad(true);
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            setShouldLoad(true);
            observer.disconnect();
        }, { rootMargin: '200px' });

        observer.observe(node);
        return () => observer.disconnect();
    }, [shouldLoad]);

    return (
        <div>
            <div className="hero-above-the-fold">Instant Content</div>
            
            {/* 3. Render with matching min-height placeholder to prevent CLS */}
            <div ref={containerRef} className="min-h-[400px]">
                {shouldLoad ? (
                    <Suspense fallback={<div className="h-[400px] w-full" />}>
                        <BelowFoldComponent />
                    </Suspense>
                ) : (
                    <div className="h-[400px] w-full" />
                )}
            </div>
        </div>
    );
};
```

---

## ⚡ 4. Hydration Compatibility (Avoiding Mismatches)

React 18 hydration expects the pre-rendered HTML on disk to match the initial render tree on the client. Mismatches trigger rendering corrections that slow down page load and can introduce visible jumps.

*   **Client-Only Code**: Never use client-only globals (like `window.innerWidth`, `localStorage`, or `navigator.language`) directly in the render path.
*   **Stable Fallback Pattern**: If component output depends on client-only state, render an equivalent-size fallback until the component is mounted:
    ```typescript
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    return (
        <div>
            {isMounted ? <ClientOnlyWidget /> : <StaticPlaceholder />}
        </div>
    );
    ```
*   **Client-Only Visibility State**: If client-only state determines whether an initially visible element should appear, prefer an immediate deterministic default plus dismissal state over interaction-triggered rendering. If the element may appear after mount, reserve space or position it outside document flow.

---

## ⚙️ 5. Pre-rendering & Critical CSS Build Pipeline

### How the build pipeline works:
1.  **Vite Build**: Compiles TypeScript assets, outputs `dist/index.html` and bundled files under `dist/assets/`.
2.  **Optional critical CSS extraction**:
    *   Critical CSS inlining is an evaluation tool, not a default optimization.
    *   Only enable it behind an explicit environment flag and compare Lighthouse scores, HTML size, LCP, and CLS before shipping.
    *   Do not ship CSS delivery changes that increase HTML weight substantially or defer layout-critical styles in a way that changes the initial client layout.
3.  **Route crawler pre-rendering**:
    *   Spawns a local Vite preview server on port `4173`.
    *   Playwright opens pages with a realistic viewport height so near-viewport loading behaves like a real user session.
    *   Avoid oversized pre-render viewports. They can force every lazy section to load at build time, generate misleading static HTML, and cause the client to replace large chunks of content with placeholders during hydration.
    *   The crawler waits for the `data-tf-handoff-ready="true"` attribute (placed on root layouts) to ensure React has fully loaded.
    *   The page source is extracted and written to clean route outputs. When a hosting platform may normalize trailing slashes, write both the canonical clean route file and any required directory fallback.

### Adding New Pages to Pre-rendering:
To ensure new public pages are pre-rendered, add them to the `ROUTES` array in `scripts/prerender-routes.mjs`:
```javascript
const ROUTES = [
  { path: '/', dest: 'index.html' },
  { path: '/new-page', dest: 'new-page/index.html' },
  // ...
];
```

### Environment Requirements:
*   Local and CI builds need a browser runtime available for the pre-render step.
*   If a browser is missing in a restricted environment, the build should fail clearly or use an explicitly documented fallback. Silent partial pre-rendering makes performance regressions harder to diagnose.

---

## 📊 6. Performance Validation Rules

Performance changes must be validated with the same scenario before and after the change:

*   Test both mobile and desktop. Mobile results are usually more sensitive to LCP and main-thread work.
*   Compare the same routes, viewport, throttling profile, and deployment class.
*   Record performance score, LCP, TBT, and CLS. A higher FCP is acceptable only if user-visible completeness, LCP, or CLS improves.
*   Treat CLS regressions above `0.1` as fix-before-merge for initial-route changes.
*   After changing hydration or pre-rendering behavior, verify navigation manually or with browser automation. A page can pass Lighthouse and still show late UI insertion after a click.
