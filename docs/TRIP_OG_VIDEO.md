# Trip OG video previews

Trip OG images still use the existing edge renderer. Video adds a small, silent map animation; clients which do not play Open Graph videos continue to use the image. No Twitter Player Card or platform autoplay is promised.

## Format and cost bounds

- MP4 / H.264 / yuv420p, Wide 1200 × 630 or Classic 960 × 720, 12 fps, six seconds, faststart, no audio.
- Hard output cap: 2 MiB. Oversized outputs fail closed and are never advertised.
- One Mapbox static basemap fetch per render using the selected video pane’s native proportions. Mapbox’s 512px zoom convention is accounted for so markers align. Route lines use each departing stay’s color, with matching city markers, and animate locally; no per-frame map requests, browser sessions, or AI generation. Mapbox provides the basemap (including satellite); its logo and attribution remain visible. Simple routes need no directions requests. Realistic road geometry is cached independently of style in one bounded per-trip record (16 legs, at most 256 points each, success expiry 30 days, fallback expiry 15 minutes), keyed with the shared coordinate/mode route cache identity. Realistic routes use at most eight new Mapbox directions requests with a three-second timeout each, once per render; train, boat, air, and unavailable routes retain straight lines.
- Text is shaped from the existing bundled fonts into reusable SVG outlines; server fonts and Fontconfig are not required.
- Encoder uses one thread and a 90-second deadline. Frame buffers are streamed sequentially, temporary files are removed, and one ready video/poster pair and a state file are kept per trip. During a replacement, the old pair stays accessible; immutable job paths are published via one atomic manifest swap and the old pair is removed only afterward. Failed replacements retain the last valid attachment.
- Atomic claims deduplicate simultaneous requests and background retries. Automatic generation attempts are limited to one per trip per hour. Authenticated explicit refreshes (including failures and settings changes) have a five-minute cooldown; at most 20 attempts per hour per context across all callers. Fixed quota slots avoid accumulating hourly records.
- Failed/stalled jobs require a later authenticated request after cooldown. There is no polling cron and no automatic paid retry loop.
- Public GET/HEAD/status and metadata reads never trigger rendering. Server trip generation and successful client saves enqueue best effort when mapped cities exist. Videos include format, map style, route style, color mode, transport, and activity coordinates in their content revision; they are content-revision keyed so unchanged autosaves do not rerender. Changes during cooldown may temporarily leave a trip image-only.

## Access and storage

`/api/og/trip-video` is a Node function. POST requires a validated trip owner/admin session, or the existing server-only `TF_ADMIN_API_KEY` for the generation worker. PATCH changes whether the generated poster is the attached OG image and requires the same access. Browser requests send only the trip ID and bounded style options, never arbitrary map URLs or render HTML.

The background function requires the internal key plus a matching atomic queued job claim. It reads the persisted trip on the server. Public video/poster requests recheck existing share access on every request; revocation, expiry, missing access, and stale revisions fail closed. Each successful render gets a distinct media URL even if its content revision is unchanged. Media responses are private/no-store and support HEAD and single byte ranges. Private-trip admins/owners load videos with authenticated requests and revocable in-memory object URLs. Stored-version links remain image-only.

Netlify Blobs stores are named `trip-og-video-production` or `trip-og-video-preview-<deploy-id>`, using Netlify’s runtime deploy context. Feature deploys cannot overwrite production media or quotas. Production media persist across redeploys. Preview media belong to one deploy; regenerate after deploying new code. Build-only environment variables are never used to choose the runtime store. They are cache-like objects, not the source of truth for trip data. Deleting a trip makes its media inaccessible immediately; cached bytes are retained for possible later administrative cleanup. No browser persistence keys or database migrations are added. Day trips reuse the shared planner/preview ownership model, including explicit departure stays and custom return stays. They use dashed straight spokes without Directions calls. Nearby explicit day trips are included; ordinary activities are not promoted based on distance. Missing activity kinds retain ordinary-activity behavior, matching the planner. Standard is the default video basemap. Stops, including return waypoints, are capped at 30. The playground forces Mapbox for its image preview, carries map/route settings into admin, and explicitly identifies a video/settings mismatch without generating a new clip.

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

## Video framing and ratios

Wide (1200 × 630) remains the default. Admin can select Classic (960 × 720, 4:3) to test less panoramic link previews. Only the selected format is generated and attached; selecting a control does not render. Applying a different format uses the existing explicit refresh cooldown and atomically replaces the prior media once ready. Both formats contain at most 756,000 pixels and retain the same six-second, 2 MiB limits. Geometry is reused across formats.

The map card occupies 39% of the width, leaving more title space. Its static basemap uses the exact pane dimensions, with a fractional Mercator fit and modest marker padding rather than stretching. Open Graph dimensions match the attached video and, when selected, its poster. Existing attachments without a format remain Wide.

Apple controls the final Messages preview shape; there is no published ratio-negotiation contract for multiple MP4 variants. We serve one consistent attachment for all clients. Test Classic using a fresh shared link; the app may retain earlier previews. No particular crop is guaranteed. Apple guidance: https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages

## Image delivery

Poster attachments use `/api/og/trip-poster.jpg`, a GET/HEAD-only image route that always serves JPEG. The legacy `asset=poster` URL remains supported. Copied HTML-escaped query separators are redirected to their canonical URL before selecting media; malformed selectors never silently return MP4. HTML metadata still uses proper attribute escaping, and inspector parsing decodes those entities once.

Dynamic trip/site PNGs initialize the pinned Edge runtime inside the request and buffer its complete output before returning a successful response. A 15-second delivery deadline, 4 MiB limit, PNG signature check and explicit normalized cache headers prevent hanging success responses and inherited immutable cache policies. Playground image URLs use the selected settings as cache identity without timestamp cache-busting. No video regeneration is needed for these fixes.
