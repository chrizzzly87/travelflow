# Trip OG video previews

Trip OG images still use the existing edge renderer. Video adds a small, silent map animation; clients which do not play Open Graph videos continue to use the image. No Twitter Player Card or platform autoplay is promised.

## Format and cost bounds

- MP4 / H.264 / yuv420p, 1200 × 630, 12 fps, six seconds, faststart, no audio.
- Hard output cap: 2 MiB. Oversized outputs fail closed and are never advertised.
- One Mapbox static basemap fetch per render using the existing OG viewport. Mapbox’s 512px zoom convention is accounted for so markers align. Route lines and city markers animate locally; no per-frame map requests, browser sessions, or AI generation. Mapbox provides the basemap (including satellite); its logo and attribution remain visible. Simple routes need no directions requests. Realistic routes use at most eight Mapbox directions requests with a three-second timeout each, once per render; train, boat, air, and unavailable routes retain straight lines.
- Text is shaped from the existing bundled fonts into reusable SVG outlines; server fonts and Fontconfig are not required.
- Encoder uses one thread and a 90-second deadline. Frame buffers are streamed sequentially, temporary files are removed, and only one video, poster, and state file are kept per trip.
- Atomic claims deduplicate simultaneous requests and background retries. Automatic generation attempts are limited to one per trip per hour. Authenticated explicit refreshes (including failures and settings changes) have a five-minute cooldown; at most 20 attempts per hour per context across all callers. Fixed quota slots avoid accumulating hourly records.
- Failed/stalled jobs require a later authenticated request after cooldown. There is no polling cron and no automatic paid retry loop.
- Public GET/HEAD/status and metadata reads never trigger rendering. Server trip generation and successful client saves enqueue best effort when mapped cities exist. Videos include map style, route style, color mode, transport, and activity coordinates in their content revision; they are content-revision keyed so unchanged autosaves do not rerender. Changes during cooldown may temporarily leave a trip image-only.

## Access and storage

`/api/og/trip-video` is a Node function. POST requires a validated trip owner/admin session, or the existing server-only `TF_ADMIN_API_KEY` for the generation worker. PATCH changes whether the generated poster is the attached OG image and requires the same access. Browser requests send only the trip ID and bounded style options, never arbitrary map URLs or render HTML.

The background function requires the internal key plus a matching atomic queued job claim. It reads the persisted trip on the server. Public video/poster requests recheck existing share access on every request; revocation, expiry, missing access, and stale revisions fail closed. Each successful render gets a distinct media URL even if its content revision is unchanged. Media responses are private/no-store and support HEAD and single byte ranges. Private-trip admins/owners load videos with authenticated requests and revocable in-memory object URLs. Stored-version links remain image-only.

Netlify Blobs stores are named `trip-og-video-production` or `trip-og-video-preview-<deploy-id>`, using Netlify’s runtime deploy context. Feature deploys cannot overwrite production media or quotas. Production media persist across redeploys. Preview media belong to one deploy; regenerate after deploying new code. Build-only environment variables are never used to choose the runtime store. They are cache-like objects, not the source of truth for trip data. Deleting a trip makes its media inaccessible immediately; cached bytes are retained for possible later administrative cleanup. No browser persistence keys or database migrations are added. Mapped activities at least 10 km from the active overnight city are animated as excursions with a return to that city; nearby activities are omitted to keep the small map readable. Stops, including return waypoints, are capped at 30. The playground forces Mapbox for its image preview, carries map/route settings into admin, and explicitly identifies a video/settings mismatch without generating a new clip.

## Deployment

Deploy the full repository through Netlify's build, including edge functions, Node functions, native Sharp, and the Linux x64 FFmpeg executable. Static-directory-only deploys omit required behavior. The background encoder is excluded from the edge bundle. Required existing variables must include the Functions scope: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TF_ADMIN_API_KEY`, and `VITE_MAPBOX_ACCESS_TOKEN` (video), and `VITE_GOOGLE_MAPS_API_KEY` (existing image fallback).

Verify remote `https://github.com/chrizzzly87/travelflow` and Netlify project `travelflowapp` (`1abc3d37-f6af-4810-9097-489b2a282ac6`) before deploying. Use the `codex/trip-og-video` feature branch, never production, for this feature's initial preview. The branch-specific `VITE_MAP_RUNTIME_PRESET=mapbox_visual_google_services` override aligns attached images with Mapbox; production configuration is unchanged.

## Testing Taiwan

1. Visit `/admin/og-tools?trip=4fee56dd-a79a-4130-bef0-cc7ffb552ea5` on the branch deploy while signed in as admin. The same panel is in the trip details drawer.
2. Generate the video and wait for ready. Confirm dimensions, duration, bytes, and marker order. Choose clean, minimal, standard, dark, or satellite and simple/realistic routes. Apply settings reuses an identical cached video; Re-render & refresh cache explicitly replaces it after the five-minute cooldown. Merely changing settings never starts work.
3. Optionally choose Video poster as the attached image; this changes attachment without encoding again.
4. Open `/api/og/playground?trip=4fee56dd-a79a-4130-bef0-cc7ffb552ea5` for the public video preview, or inspect the real trip URL in OG tools. Completed renders and attachment changes purge the trip’s tagged HTML on the current hostname only; if Netlify’s purge service fails, explicit trip/share HTML CDN cache lifetimes (120/300 seconds) remain the fallback, overriding inherited static-shell headers. The video metadata lookup allows five seconds for cold public access checks. Social platforms may retain their own scraped previews.
5. Check the trip HTML for `og:video`, `og:video:secure_url`, `video/mp4`, width/height and the existing image fallback. Validate a byte-range request and confirm unauthenticated POST is rejected.

References: [Open Graph structured video properties](https://ogp.me/#structured), [Netlify background functions](https://docs.netlify.com/build/functions/background-functions/), [Netlify Blobs conditional writes](https://docs.netlify.com/build/data-and-storage/netlify-blobs/).
