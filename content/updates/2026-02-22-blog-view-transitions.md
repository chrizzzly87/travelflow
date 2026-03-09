---
id: rel-2026-02-22-blog-view-transitions
version: v0.56.0
title: "Blog list/detail shared view transitions"
date: 2026-02-22
published_at: 2026-02-22T09:30:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Adds smooth shared-element transitions between the blog list and article pages with graceful fallback on unsupported browsers."
---

## Changes
- [x] [Improved] 🎞️ Opening a blog article now smoothly morphs the card image, headline, and preview text into the full article header.
- [x] [Improved] ↩️ Returning to the blog list now preserves the same visual continuity, including browser back navigation on supported browsers.
- [x] [Improved] ✨ Transition choreography now keeps headline sizing more consistent, fades metadata quickly, and dissolves the temporary card layer faster.
- [x] [Improved] 🖼️ Shared blog images now stay fully opaque during movement so reverse transitions no longer flash through a gray blend.
- [x] [Improved] 🧭 Shared-element names are now scoped to the active target article, so non-selected cards no longer leak into the transition.
- [x] [Improved] 🧼 Blog transitions now ignore stale card hints when no active transition is running, preventing wrong article images from appearing mid-animation.
- [x] [Improved] 🖼️ Shared image motion now animates only the real photo layer (not decorative blur/fade overlays) and prioritizes loading for the active target card.
- [x] [Improved] ⚡ Transition timing is now tuned to a faster, production-like speed for normal browsing.
- [x] [Improved] 🖼️ Blog list cards and article headers now use the same underlying photo source for each post.
- [x] [Improved] 🧩 Blog transitions now use nested shared-element grouping so the card, image, and headline stack and clip more reliably between overview and article.
- [x] [Improved] ⚡ Blog article transitions now start immediately again instead of pausing while the next page finishes loading.
- [x] [Improved] ↔️ Browser back and forward now reuse the same shared-element transition flow as direct blog clicks, so history navigation stays visually consistent.
- [x] [Improved] 🖼️ The article hero image now spans the full blog detail content width again while keeping the shared image crop more stable at the end of the transition.
- [x] [Improved] 📐 Blog overview cards now use a wider image ratio that better matches the article hero crop, reducing the last-moment shared-image jump when the transition settles.
- [x] [Improved] 🪟 Shared blog cards now keep a solid surface during expansion, which prevents neighboring article thumbnails from flashing through at the start of the transition.
- [x] [Improved] 🌫️ Returning from an article to the overview now reveals the card blur band more softly instead of popping it in at the very end.
- [x] [Improved] 🧠 The first blog transition in either direction now gets a short cold-start stabilization pass, so shared image motion is more reliable even before the other blog route has been visited.
- [ ] [Internal] 🧩 Added feature-detected transition wiring, tuned shared-element animation rules, and regression coverage for transition helpers and media mapping.
- [ ] [Internal] 🧭 Switched blog history transitions onto a shared history router wrapper and committed POP route updates inside the transition callback so browser back/forward animates reliably.
- [ ] [Internal] ❄️ Added route-kind warm tracking plus a bounded target-ready wait so first-load blog transitions can stabilize without reintroducing the old multi-second pause.
- [ ] [Internal] 📝 Added a detailed Issue #109 postmortem in docs with timeline, root causes, regressions, and a handoff checklist for follow-up AI debugging.
