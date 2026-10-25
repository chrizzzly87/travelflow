# Above-the-Fold & Progressive Hydration Guidelines

This document outlines architectural patterns and developer guidelines for maintaining optimal web performance (First Contentful Paint, Largest Contentful Paint, Cumulative Layout Shift) across public and product pages.

---

## 🚀 1. The Core Performance Model

Fast pages depend on three complementary techniques:
1.  **Server rendering / prerendering**: The server-rendered HTML must contain the content needed for the first viewport.
2.  **Measured CSS Delivery**: CSS delivery changes must be tested against real Lighthouse output before becoming defaults. Critical CSS inlining can help in narrow cases, but it can also inflate HTML, delay parsing, and worsen CLS.
3.  **Progressive Hydration**: Above-the-fold interactive components hydrate immediately. Below-the-fold JavaScript loads only when the user is close to needing it.

---

## 🧱 2. Above-the-Fold Performance Rules

To prevent LCP degradation and layout shifts, follow these guidelines for any content that renders in the initial viewport (typically top `700px` on desktop, `600px` on mobile):

*   **No Heavy Elements in Critical Path**: Avoid placing heavy third-party maps, charts, calendar grids, or raw text editors in the initial viewport. Load these lazily on interaction or near-viewport scroll.
*   **Initial UI Must Not Wait for Interaction**: UI that is expected to be visible in the first viewport must render and hydrate immediately. Do not gate first-viewport notices, headers, navigation, calls to action, or alerts behind first-click, first-scroll, or first-keyboard listeners.
*   **No Late Document-Flow Insertion Above Content**: Anything that can appear after initial paint above the page content must either reserve stable space from the start or be positioned outside normal document flow. Fixed or absolute overlays should sit below persistent navigation, use a predictable z-index, and avoid covering essential controls.
*   **Font Optimization**: Critical font families are preloaded via `link rel="preload"` where appropriate to prevent FOIT (Flash of Invisible Text).
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

Public pages are server-rendered by TanStack Start on React 19, and React expects the
first client render to match that HTML. See `docs/TANSTACK_START_ARCHITECTURE.md`
("Landing pages and first interaction") for the full contract.

*   **Client-Only Code**: Never use client-only globals (like `window.innerWidth`, `localStorage`, or `navigator.language`) directly in the render path.
*   **Dates**: Never call `new Date()` during render on a server-rendered page; read "today" from `useRenderNow()` (`hooks/useRenderNow.tsx`).
*   **Browser-dependent widgets**: Use `useHydrated` or a scoped client-only boundary and render an equivalent-size placeholder until hydrated. Do not hide whole marketing sections behind a mount effect to mask a mismatch.
*   **Client-Only Visibility State**: If client-only state determines whether an initially visible element should appear, prefer an immediate deterministic default plus dismissal state over interaction-triggered rendering.

---

## ⚙️ 5. Prerendering

Seven public entry pages in every active locale are prerendered natively by Start from the
allowlist in `app/routing/publicPrerender.ts`; every other public route renders on demand
through SSR. `pnpm prerender:validate` checks the emitted documents. Ownership and output
details: `docs/NETLIFY_TANSTACK_START.md`. Critical-CSS inlining is not part of the build;
treat it as an experiment that must beat the current Lighthouse numbers before shipping.

---

## 📊 6. Performance Validation Rules

Performance changes must be validated with the same scenario before and after the change:

*   Test both mobile and desktop. Mobile results are usually more sensitive to LCP and main-thread work.
*   Compare the same routes, viewport, throttling profile, and deployment class.
*   Record performance score, LCP, TBT, and CLS. A higher FCP is acceptable only if user-visible completeness, LCP, or CLS improves.
*   Treat CLS regressions above `0.1` as fix-before-merge for initial-route changes.
*   After changing hydration or pre-rendering behavior, verify navigation manually or with browser automation. A page can pass Lighthouse and still show late UI insertion after a click.
