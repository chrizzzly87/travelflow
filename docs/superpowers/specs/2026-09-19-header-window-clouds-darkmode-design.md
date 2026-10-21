# Header plane window, cloud loop, and dark mode

Date: 2026-09-19
Branch: `claude/header-clouds-darkmode-52b774`

## Problem

Three connected problems, in the order they were raised:

1. The homepage plane window's cloud animation loops visibly. `PlaneWindowAnimation`
   renders two copies of a cloud image in a `flex h-full` container and
   `@keyframes clouds-scroll` animates `translateX(0) → translateX(-50%)`. The flex
   container is `width: 100%` of the **mask box**, not of the two-image strip, so
   `-50%` is half the window rather than half the content. The strip jumps on every
   cycle.
2. There is no transition that brings the window into the frame.
3. There is no dark mode. `.dark` tokens exist in `index.css` but nothing ever sets
   `.dark` on the document, so the block has never rendered. There is no toggle.

## Reference analysis: mikes.cv

Findings recorded here because they drive the design and are not obvious from the
rendered page.

The clouds are **not** a looping image and **not** Vanta. A lazily-loaded
`three.js r167` + react-three-fiber chunk renders **two stacked canvases** inside a
200×300 px window:

| Layer | Camera | Content |
|---|---|---|
| Back | `[0,0,2]` fov 60 | One ocean plane raked ~75°, custom GLSL scrolling `waternormals.jpg` at two speeds/directions, deep→mid→light blue, `smoothstep` horizon haze fading the top to near-white |
| Front | `[0,0,3]` fov 70 | `CirrusCloud.png` on 6 planes at z=-24/-40, plus drei `<Clouds>` instanced billboards of `cloud.png` in three depth bands: z=-16 (speed .03–.04), z=-9 (.07–.09), z=-2.5 (.44–.52) |

**The loop never loops.** There is no keyframe and no seam. Each cloud group runs
`position.x -= dt * speed` in `useFrame` and wraps to `+resetX` when it passes
`-resetX`. Because every puff cluster has its own depth, speed and seed, there is no
repeating strip for the eye to lock onto. Each billboard also breathes via
`volume + (1 + sin(t * density * speed)) / 2 * growth`.

**The mechanism to copy is: parallax + per-object wrap + desynchronised seeds,
instead of one translating texture.**

Frame: three webp layers (`window-back` → clipped shutter → `window-front`), each
with `filter: brightness(1 - shade * k)`, `k` ≈ 0.86/0.82/0.80, so the cabin dims as
the shade descends. The shutter is `translate3d(0, -(1-shade)*63%, 0)`.

Shade control: a full-bleed transparent `<button>` clipped to the glass shape,
`touch-action: none`, pointer capture, velocity-tracked — a flick past a threshold
snaps, otherwise it settles to the nearer end. Click toggles. `aria-pressed` plus a
visually-hidden label.

Drag → theme: during the drag a fixed full-viewport veil's opacity follows the shade
continuously. Only at `shade >= 0.999` / `<= 0.001` does it commit
`documentElement.dataset.theme` and persist. On commit it adds `.is-recolouring` for
~520 ms, transitioning **only `color, fill, stroke`** app-wide, with
`transition: none` on the window itself so the frame does not smear. A separate
`/theme.js` applies the theme before first paint (separate file only because their
CSP is `script-src 'self'`; we have no such restriction and can inline).

Reveal: `@keyframes itemReveal` (opacity + blur + translateY + scale) with a
per-element `--reveal-delay`, paused while a `.booting` class is on the parent,
replaced by a 0.2 s opacity-only variant under `prefers-reduced-motion`.

### Why not Vanta

Vanta `clouds2` is heavier, not lighter: a full-screen fragment shader raymarching
noise every frame, and it needs `three` anyway. The reference renders into
394×591 device px (~0.23 MP) and sets `frameloop: "demand"` to stop entirely when the
shade is down. Vanta offers less control at higher cost. Rejected.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Dark mode scope | Infra + marketing surfaces only | 163 of 245 component files hardcode light-only backgrounds. The planner shell is a separate milestone. |
| Cloud tech | three.js + R3F, lazy chunk | Closest to the reference; cost contained by desktop-only gating. |
| Drag → dark | Yes, plus an independent menu toggle | Drag is discovery; the toggle is the real control. |
| Window placement | Desktop-only, unchanged | Keeps the mobile bundle and GPU budget untouched. |
| Dark palette | C (warm), authored alongside B | More contrast headroom; the cool window art reading as a different temperature to the cabin is correct for a window. |
| Palette architecture | Both under `[data-dark-tone]` | Changing the default later is one line, not a repaint. |

### Cost corrections found during analysis

- `three@^0.182.0` is in `package.json` but **nothing imports it**. It is a dead
  dependency, not an existing cost. The R3F route genuinely adds ~160 KB gz
  (three + fiber + drei) as a new lazy chunk.
- `HeroWebGLBackground` carries the comment "WebGL background is deactivated for
  performance" (commit `858fa4e67`). That was a full-bleed background; this is a
  320 px box, desktop-only, with `frameloop: "demand"`. The gating below exists
  specifically to honour that precedent.

## Palette

Both tones pass WCAG AA on every pair. Measured, not assumed:

| Pair | B slate | C warm | Requirement |
|---|---|---|---|
| Body text | 15.38 | 15.45 | ≥ 4.5 |
| Muted text on page | 7.09 | 8.95 | ≥ 4.5 |
| Muted text on card | 6.33 | 7.92 | ≥ 4.5 |
| Link, indigo-400 | 5.83 | 5.94 | ≥ 4.5 |
| Primary button label | 5.83 | 5.94 | ≥ 4.5 |
| Primary button fill vs page | 5.83 | 5.94 | ≥ 3 |

**The accent inverts direction between themes, deliberately.** In light mode the
primary button is indigo-500/600 with white text. In dark mode it is
**indigo-400 `#818cf8` fill with dark ink**. The alternatives both fail:

- indigo-500 + white — label 4.47, fails AA.
- indigo-600 + white — label 6.29 passes, but the fill is 2.77 against the page,
  failing the 3:1 non-text requirement.

Do not "fix" this by making the dark button darker.

Links in dark mode are **indigo-400**, not indigo-500 (3.89, fails).

The `--border` token resolves to roughly 1.33 against the page. That is fine for
decorative separators but **focus rings and input outlines need their own stronger
token** rather than inheriting `--border`.

Token values:

```
C warm (default)          B slate
--background  #191817     #161a24
--card        #242322     #1e2432
--foreground  #f2efe9     #eef1f8
--muted-fg    #b9b8b6     #9aa6bd
--border      rgba(255,255,255,.13)   rgba(150,170,210,.16)
--primary     #818cf8     #818cf8     (shared)
--primary-fg  #191817     #161a24
```

## Architecture

### 1. Theme store — `contexts/theme/`

A module-level store read through `useSyncExternalStore`. Not a `useEffect` class
toggle: the project guidance is to avoid effects that are not synchronising with an
external system, and this store *is* the external system.

- Preference: `'light' | 'dark' | 'system'`. `system` follows
  `matchMedia('(prefers-color-scheme: dark)')`.
- Applies `.dark` to `documentElement`, and `data-dark-tone` for the tone.
- Persists to `localStorage` under `tf_theme_preference_v1`.

**Two repo-specific traps this must respect:**

- The key **must** be registered in `COOKIE_REGISTRY` in
  `lib/legal/cookies.config.ts`, with the `tf_` prefix. Unregistered writes are
  silently refused at runtime, and `pnpm storage:validate` still passes — so the
  failure is invisible without the registry entry.
- Marketing routes are prerendered by `scripts/prerender-routes.mjs`. An inline
  pre-paint script in `index.html` is **mandatory** or every prerendered page flashes
  light before hydration.

### 2. Toggle — `components/ui/ThemeToggle.tsx`

Real `forwardRef`. The app renders through `preact/compat`, where a plain function
component never receives a ref; anything used with Radix `asChild` or focused by a
library must forward.

Placed in the desktop nav (`SiteHeader.tsx:205`) and beside `LanguageSelect` in
`MobileMenu.tsx:235`. **On phones this is the only theme control**, since the window
is desktop-only — so it gets the same care as the language switcher, not a smaller
one.

New `nav.theme*` keys in all nine active locales (`en, es, de, fr, pt, ru, it, pl,
ko`). `trackEvent` + `getAnalyticsDebugAttributes` per `docs/ANALYTICS_CONVENTION.md`.

### 3. Window — `components/marketing/PlaneWindow/`

Layer stack, bottom to top: gradient sky → cloud scene → back frame → clipped shutter
(+ inset shadow masked to the shutter) → front frame → shade tint → drag button.

The **static CSS cloud layer is the `<Suspense>` fallback**. It is therefore what
renders at first paint, under reduced motion, and when WebGL is unavailable — so the
current behaviour is preserved and the WebGL scene is pure enhancement.

Gating, honouring the perf precedent — the scene mounts only when **all** hold:

- viewport ≥ 1024 px (unchanged from today's `hidden lg:block`)
- the window is in the viewport (IntersectionObserver)
- `prefers-reduced-motion` is not set
- `navigator.connection.saveData` is not set
- the WebGL renderer string does not match
  `/swiftshader|llvmpipe|softwarepipe|basic render|generic renderer/i`

`frameloop` switches to `"demand"` when the shade is down.

### 4. Drag → theme

`useWindowShade` hook owning a small state machine: idle → dragging → settling. Pointer
capture, velocity sampled per move, flick threshold snaps, otherwise settle to the
nearer end. Click toggles. The veil opacity follows shade continuously; the theme
commits **only** at the extremes.

`.is-recolouring` transitions only `color, fill, stroke` for ~520 ms, with
`transition: none` on the window subtree.

### 5. Reveal

`itemReveal` keyframes with per-element `--reveal-delay`, paused under a `.booting`
parent, replaced by a 0.2 s opacity-only variant under `prefers-reduced-motion`.

## Testing

Per the repo completion gate — behavioural changes need Vitest coverage in the same PR.

- Theme store: resolution of `system`, persistence round-trip, `.dark` and
  `data-dark-tone` application, and that an unregistered key would fail.
- Shade state machine: flick-up commits open, flick-down commits closed, release
  below threshold settles back, and the theme commits **only** at the extremes —
  a mid-drag release must not change the theme. This is the regression test for the
  interaction being subtle enough to get wrong.
- Cloud loop: assert the fallback layer's tiling arithmetic, as the regression test
  for the `translateX(-50%)` bug.
- `pnpm i18n:validate` for the new locale keys.

## Out of scope

- Planner/app shell dark mode (TripView, panels, app chrome) — separate milestone.
- Exposing the two dark tones as a user-facing choice — the architecture allows it;
  the picker UI does not ship here.
- The reference's ocean layer. The cloud bands carry the effect; the ocean is a
  second canvas and a second shader for a view that is mostly occluded at 320 px.

## Release note

One draft note in `content/updates/`, `status: draft` while the PR is open, per the
mandatory release note rule in `CLAUDE.md`.
