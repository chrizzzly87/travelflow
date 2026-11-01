---
id: rel-2026-11-01-public-profile-previews
version: v0.215.0
title: "Public profiles load faster and preview properly"
date: 2026-11-01
published_at: 2026-11-01T12:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "Shared profile links now show the traveler's name and bio in link previews, and profiles appear right away instead of after a loading pause."
---

## Changes
- [x] [Improved] 🪪 Shared profile links now show the traveler's name, bio and a preview image in chats and social posts, and the profile with its public trips appears right away instead of after a blank loading pause.
- [ ] [Internal] 🖥️ `/u/$username` moved from the client-only `_client` area into the server-rendered `_public` area; a route loader calls the validated `getPublicProfilePageData` server function, which reads anonymously (fresh Supabase client, no session, cookies or headers) and returns only public fields plus the first page of publicly visible trips.
- [ ] [Internal] 🔒 Private profiles are masked on the server to first name, last initial and handle; owner and admin views (own private profile, private-profile access, edit button, visibility badge) load only in the browser after hydration.
- [ ] [Internal] 🏷️ Per-profile `head`: title, description (bio or a new `publicProfile.metaDescription` key in all locales), Open Graph title/description/image via the existing `/api/og/site` image, and `noindex` on every profile state; profiles stay out of the sitemap.
- [ ] [Internal] ⏱️ Profiles get their own CDN policy (`s-maxage=60, stale-while-revalidate=300`) so edits show within minutes; backend failures are sent `no-store`. Mixed-case and renamed handles redirect in the loader.
- [ ] [Internal] 🕰️ Trip cards read "today" and expiry from the render clock so server-rendered dates match the first browser render.
