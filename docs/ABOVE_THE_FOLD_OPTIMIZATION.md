# Above-the-Fold & Progressive Hydration Guidelines

This document outlines the architectural patterns and developer guidelines for maintaining optimal web performance (First Contentful Paint, Largest Contentful Paint, Cumulative Layout Shift) across TravelFlow's marketing and product pages.

---

## 🚀 1. The Core Performance Model

TravelFlow achieves sub-second visual loading by combining three complementary techniques:
1.  **Static Pre-rendering (SSG)**: Pages are compiled at build time into static HTML files containing the full initial DOM tree.
2.  **Critical CSS Inlining**: Above-the-fold styles are extracted and injected directly into `<style>` blocks in the document `<head>`, while the main CSS bundle is loaded asynchronously.
3.  **Progressive (Lazy) Hydration**: React hydrates above-the-fold interactive components immediately, while below-the-fold component JavaScript loads and hydrates dynamically as the user scrolls near them.

---

## 🧱 2. Above-the-Fold Performance Rules

To prevent LCP degradation and layout shifts, follow these guidelines for any content that renders in the initial viewport (typically top `700px` on desktop, `600px` on mobile):

*   **No Heavy Elements in Critical Path**: Avoid placing heavy third-party maps, charts, calendar grids, or raw text editors in the initial viewport. These should be loaded lazily on interaction or scroll.
*   **Font Optimization**: Critical font families (like *Bricolage Grotesque* and *Space Grotesk*) are preloaded via `link rel="preload"` inline script injections based on page locale to prevent FOIT (Flash of Invisible Text).
*   **Zero Layout Shimmer Flickering**: If pre-rendered HTML matches the initial client layout, the bootstrap overlay loading shell (`#app-bootstrap-shell`) is bypassed immediately to prevent a layout shift.
*   **Image Dimensions**: Any above-the-fold image (e.g. hero banner, blog header) must have explicit `width` and `height` aspect-ratio styles and use high fetch priority (`fetchPriority="high"`).

---

## 💤 3. Implementing Progressive Hydration

To prevent hydration blockages and initial JS bundle bloat, all below-the-fold components must be loaded lazily.

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

React 18 hydration expects the pre-rendered HTML on disk to match the initial render tree on the client. Mismatches trigger rendering corrections that slow down page load.

*   **Client-Only Code**: Never use client-only globals (like `window.innerWidth`, `localStorage`, or `navigator.language`) directly in the render path.
*   **Double-Rendering Pattern**: If component output depends on client-only state, delay the rendering of that state until the component is mounted:
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

---

## ⚙️ 5. Pre-rendering & Critical CSS Build Pipeline

### How the build pipeline works:
1.  **Vite Build**: Compiles TypeScript assets, outputs `dist/index.html` and bundled files under `dist/assets/`.
2.  **Critical CSS extraction (`scripts/prerender-routes.mjs`)**:
    *   Temporarily transforms absolute asset paths (`/assets/`) in `dist/index.html` to relative paths (`assets/`) so the `critical` node module can locate assets on the local filesystem.
    *   Runs a headless browser via Puppeteer to extract above-the-fold styles.
    *   Inlines these styles inside a `<style>` block in `<head>`, and converts the main stylesheet `<link>` to load asynchronously (`media="print" onload="this.media='all'"`).
    *   Saves the inlined version back to `dist/index.html` and restores absolute paths (`/assets/`).
3.  **Route Crawler Pre-rendering**:
    *   Spawns a local Vite preview server on port `4173`.
    *   Playwright opens a browser page with a viewport size of `1280x9999`.
    *   *Note: The 9999px height viewport is crucial because it forces all progressive hydration IntersectionObservers to intersect immediately, rendering the complete page content.*
    *   The crawler waits for the `data-tf-handoff-ready="true"` attribute (placed on root layouts) to ensure React has fully loaded.
    *   The page source is extracted and written into `dist/<route>/index.html`.

### Adding New Pages to Pre-rendering:
To ensure new marketing or public pages are pre-rendered, add them to the `ROUTES` array in [prerender-routes.mjs](file:///Users/chrizzzly/.gemini/antigravity/worktrees/travelflow-codex/implement-react-hydration-optimization/scripts/prerender-routes.mjs):
```javascript
const ROUTES = [
  { path: '/', dest: 'index.html' },
  { path: '/new-page', dest: 'new-page/index.html' },
  // ...
];
```

### Environment Requirements:
*   Local builds require `PUPPETEER_EXECUTABLE_PATH` pointing to a local Chrome browser binary on macOS (e.g. `PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`).
*   If Chrome is missing (such as in restricted cloud build machines), the script catches the error and falls back gracefully to standard pre-rendering using the standard Vite HTML template.
