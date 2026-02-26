---
id: rel-2026-02-25-profile-hub-and-quick-trip-access
version: v0.66.0
title: "Profile hub with highlights and quick trip access"
date: 2026-02-26
published_at: 2026-02-26T12:20:38Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Profile now ships as a full hub with animated greeting hero, public handles, social-style stats, passport stamps, and public trip visibility controls."
---

## Changes
- [x] [Improved] 🎨 Rebuilt the profile page into the same base content grid as navigation and removed the old boxed-shell layout.
- [x] [Improved] 👋 Refined the greeting hero to a cleaner centered style with accent-only greeting text, IPA pronunciation, and a simpler inspiration link with country flag.
- [x] [Improved] 🔗 Updated the hero subline so only “Inspirations for {country}” is linked while the lead-in text stays plain.
- [x] [New feature] 🧾 Added social-style owner and visitor profile summaries with travel stats, bio/location metadata, and a travel footprint block.
- [x] [Improved] 🖼️ Updated profile identity blocks with centered avatar-overlap styling, cleaner spacing, and reduced repetitive copy.
- [x] [Improved] 🪐 Replaced static role labels with dynamic traveler status rings around profile avatars.
- [x] [Improved] 🎯 Corrected avatar-orbit alignment so rotating status text wraps the avatar ring cleanly.
- [x] [Improved] 🧼 Removed redundant public-profile top heading and unified owner/public summary spacing for a cleaner, less clustered layout.
- [x] [Improved] 🔧 Kept orbit text as a reusable component for later, but removed it from active profile avatar rendering.
- [x] [New feature] 🔗 Added public profile handles at `/u/:username` with canonical redirect handling for renamed usernames.
- [x] [Fixed] 🧭 Hardened public-profile handle resolution so valid profiles no longer fall into false “profile not found” states in mixed-schema environments.
- [x] [Fixed] 🔎 Fixed public handle resolution for canonical usernames (including underscore handles) by correcting fallback profile lookup chaining so `/u/{username}` no longer drops into false “Profile not found”.
- [x] [Improved] 🧼 Reduced noisy background profile-access failures on public profile pages by removing unnecessary fallback lookups and guest-only admin probes.
- [x] [Fixed] 🏷️ Corrected public-profile trip source labels so visitor views no longer show “Created by you” and instead use creator-appropriate copy.
- [x] [Fixed] 🧭 Scoped local dev admin bypass auth to admin routes only, preventing unintended login-state flips and page blinking when guests interact with public profile trip cards.
- [x] [Improved] 🧱 Increased profile/public top content spacing so avatar-overlap sections no longer collide with the sticky navigation bar.
- [x] [Improved] 🧭 Reworked public-profile not-found into a cleaner full-bleed empty state (no boxed card) with “Plan your trip” and “Get inspired” calls to action.
- [x] [Improved] 🧭 Aligned public-profile unavailable states with the 404 visual language and restored standard rectangular CTA/button styling.
- [x] [Fixed] 📱 Restored the normal “Create trip” mobile navigation entry on public-profile unavailable states by removing accidental header CTA suppression.
- [x] [Fixed] ↩️ Restored expected browser Back behavior from trip pages opened via profile/public-profile cards by removing an over-aggressive popstate trap in trip history handling.
- [x] [Fixed] 🧭 Decoupled public-profile identity loading from public-trip loading so profile pages still render even if trip queries fail temporarily.
- [x] [Improved] 🚀 Added a guest-first public-profile fallback CTA so signed-out visitors can register for free directly from unavailable/private profile states.
- [x] [Improved] 🛡️ Allowed admins to open user public profiles even when profile visibility is disabled, so moderation/review workflows are never blocked.
- [x] [Improved] 🔎 Added a direct “Open public profile” action in the admin users drawer next to “Open in Trips” for faster cross-surface navigation.
- [x] [Improved] ⚙️ Expanded profile settings with username availability/cooldown guidance, public URL preview, bio, and profile visibility defaults.
- [x] [Improved] 🔐 Updated username editing to be opt-in by default: users now unlock the field via “Change username” and validation runs on save instead of every keystroke.
- [x] [Fixed] 🛡️ Restored 90-day username cooldown enforcement in profile settings for environments using legacy profile-column fallbacks.
- [x] [Fixed] 🔗 Added canonical `@handle` normalization so public profile links and username saves resolve correctly even when users paste handles with `@`.
- [x] [Fixed] 🧯 Stopped profile-page request thrashing and flashing by hardening profile-column fallbacks and preventing repeated auto-refresh loops after failed profile fetches.
- [x] [Improved] 🧠 Added save-time username suggestions when a handle is unavailable, proposing nearby available alternatives based on profile/name patterns.
- [x] [Improved] 🌍 Replaced free-text country with a searchable Country/Region picker and now store canonical ISO country codes for cleaner cross-feature matching.
- [x] [Improved] 🧭 Refined Country/Region picker behavior to close immediately after single selection and keep the control scoped to one selected country.
- [x] [Improved] 🛡️ Updated the admin user editor to use the same Country/Region ISO picker so admin profile edits stay consistent with app profile rules.
- [x] [Improved] 🌎 Updated empty profile-location fallback copy to “Probably Planet Earth” for a friendlier profile touch.
- [x] [Improved] 🗣️ Expanded the international greeting catalog with more regional/local greetings (including Northern Germany’s “Moin”) and richer usage/fun-fact context lines.
- [x] [Improved] 🇹🇭 Refined the Thai greeting note to include both wai etiquette and speaker-based polite endings (`khrap`/`kha`).
- [x] [Improved] 🧩 Added settings breadcrumb navigation, grouped gender + name fields into one row, and introduced a lock-and-edit username flow with cooldown-aware guidance.
- [x] [Improved] 🧠 Cached current-profile data in app session state so profile surfaces avoid fallback-name flicker after login.
- [x] [Improved] 🧭 Added “View public profile” shortcuts to account and mobile menus plus kept recent-trip quick access.
- [x] [New feature] 🛂 Added a passport-inspired stamp system with achievement milestones and a dedicated stamp collection page.
- [x] [Improved] ✨ Added interactive stamp cards with cleaner density: core achievement label stays visible while rarity/progress metadata appears on hover/focus.
- [x] [Improved] 📅 Added clearer “unlocked on” timing visibility for stamps in the collection view.
- [x] [Improved] 🛂 Upgraded profile and public-profile stamp entry to a reusable passport-cover module with country-based color themes, holographic/grain detailing, and hover-lift feedback.
- [x] [Improved] 📓 Reworked stamp browsing into dedicated passport pages with opening-book + page-turn transitions, left/right hit-zones, and reduced-motion fallbacks.
- [x] [Improved] 🏛️ Replaced the ambiguous “TF” passport seal text with a neutral emblem treatment.
- [x] [Improved] 📖 Added stateful stamp-book URLs for public handles so visitor stamp collections can be opened directly and shared.
- [x] [Improved] 🌐 Applied country-based passport cover color themes from profile country/region data for a more personalized booklet look.
- [x] [Improved] 👀 Removed owner-facing passport helper copy from public profiles to keep visitor views focused on the profile owner’s achievements.
- [x] [Improved] 🧷 Simplified stamp card density by moving achievement meta details into hover/focus reveal states instead of always showing them inline.
- [x] [Improved] 🧷 Added quick access to stamp collection from profile actions and account navigation.
- [x] [Improved] 🛂 Refined the passport cover visual style with tighter corners, centered emblem layout, subtle texture grain, and a cleaner hover “book cover” lift/open motion.
- [x] [Improved] 📖 Changed passport opening to an in-page modal flow with URL state (`?passport=open`) so the profile context stays intact while still supporting shareable state.
- [x] [Improved] 📚 Added stacked inner “paper” layers to the passport cover with subtle staggered 3D hover motion and restored shimmer/noise detailing.
- [x] [Improved] 🧾 Reworked passport modal entry to a center-origin book-opening animation where the cover and first page flip open into the spread.
- [x] [Improved] 🗂️ Resized stamp layouts to compact 2×3 grids per themed page for clearer category grouping and lower visual density.
- [x] [Improved] 🛂 Refined passport-cover layering so rounded cover edges stay intact while hover-lift and page stagger remain visible.
- [x] [Improved] 🪶 Improved stamp-card hover detail readability in compact passport modal pages.
- [x] [Fixed] 🧭 Fixed passport page-turn vertical jump by stabilizing spread height during flip transitions.
- [x] [Improved] 🗺️ Added per-trip public visibility controls and enforced read-only public trip access mode where needed.
- [x] [Improved] 🏳️ Added country flags to visited-country chips and improved profile metadata readability.
- [x] [Improved] 📤 Added a one-click action to share your public profile URL directly from your profile summary.
- [x] [Improved] ✅ Added immediate share feedback with tactile press-state styling and copy/open confirmation toasts.
- [x] [Improved] ✅ Added Sonner success toast feedback for profile settings saves so users get clear confirmation without a hard reload.
- [x] [Improved] 🧩 Simplified trip-card controls to reduce visual clutter while keeping open/favorite/pin/visibility actions.
- [x] [Improved] 📱 Updated profile/public trip-card grids to a 2-column mobile layout for better small-screen scanability.
- [x] [Improved] 🔢 Added right-aligned, tabular-number stat counters with animated count-up transitions for profile summary metrics.
- [x] [Improved] ⏳ Added clearer expired-trip treatment in profile/public cards with an explicit status badge and cleaner fallback title for expired generation drafts.
- [x] [Improved] ⚡ Added lazy chunk rendering + skeleton placeholders for profile trip grids and paged loading for public-profile trips to reduce first-load work.
- [x] [Fixed] 🧭 Eliminated interaction-triggered request bursts on public profiles by hardening guest auth/session handling and avoiding anonymous profile refresh probes.
- [x] [Fixed] 🚦 Capped “My Plans” reverse-geocoding enrichment work per open cycle to prevent large request floods on guest devices.
- [x] [Improved] 🧼 Removed the always-on soft marketing background gradient layer to prevent first-paint mismatch flashes.
- [x] [Improved] ♿ Ensured profile/stamps motion effects respect reduced-motion preferences and removed loading-text flicker in profile settings.
- [x] [Fixed] 🛠️ Fixed the profile settings crash caused by an invalid empty-value gender select option.
- [ ] [Internal] 🗄️ Fixed Supabase SQL function defaults ordering for the trip upsert RPC signature.
- [ ] [Internal] 🧱 Added DB-side ISO-2 validation and constraints for profile country storage, and defaulted existing non-ISO/empty values to `DE`.
- [ ] [Internal] 🧾 Added profile schema/service support for explicit passport sticker selection persistence in addition to sticker-position persistence.
- [ ] [Internal] 🧪 Added and updated regression coverage for greeting/name formatting, country-flag derivation, profile sharing action, and public profile behavior.
- [ ] [Internal] 🛡️ Updated user-settings DB sync to skip anonymous-session auto-provisioning so public/marketing routes no longer create unexpected guest auth sessions.
- [ ] [Internal] 🧪 Added regression coverage for username cooldown fallback loading and `@`-prefixed username normalization on save.
- [ ] [Internal] 🧪 Added regression coverage for public-profile resolver fallback paths after Supabase query-chain hardening.
- [ ] [Internal] 📘 Documented public-profile handle resolver guardrails in the Supabase runbook (query-chain order, exact username matching, and verification checklist).
- [ ] [Internal] 📌 Tracked deferred backend work in issue #181 for DB-backed pins, reactions, bookmarks, follows, and anti-abuse/RLS contracts.
