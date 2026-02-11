const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const trimParam = (value: string | null, max: number): string => {
  if (!value) return "";
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
};

const isValidVersionId = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const isMapStyle = (value: string): boolean =>
  value === "minimal" || value === "standard" || value === "dark" || value === "satellite" || value === "clean";

const isRouteMode = (value: string): boolean =>
  value === "simple" || value === "realistic";

const DEFAULT_BLOG_TINT_COLOR = "#6366f1";
const DEFAULT_BLOG_TINT_INTENSITY = 60;

export default async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const modeRaw = trimParam(url.searchParams.get("mode"), 16).toLowerCase();
  const mode = modeRaw === "site" ? "site" : "trip";

  const state = {
    mode,
    shareToken: trimParam(url.searchParams.get("s"), 120),
    tripId: trimParam(url.searchParams.get("trip"), 120),
    versionId: trimParam(url.searchParams.get("v"), 80),
    title: trimParam(url.searchParams.get("title"), 120),
    description: trimParam(url.searchParams.get("description"), 180),
    pill: trimParam(url.searchParams.get("pill"), 40),
    blogImage: trimParam(url.searchParams.get("blog_image"), 200),
    blogTint: trimParam(url.searchParams.get("blog_tint"), 12),
    blogTintIntensity: trimParam(url.searchParams.get("blog_tint_intensity"), 8),
    blogRev: trimParam(url.searchParams.get("blog_rev"), 40),
    weeks: trimParam(url.searchParams.get("weeks"), 40),
    months: trimParam(url.searchParams.get("months"), 60),
    distance: trimParam(url.searchParams.get("distance"), 40),
    routePath: trimParam(url.searchParams.get("path"), 120),
    updatedAt: trimParam(url.searchParams.get("u"), 24),
    mapUrl: trimParam(url.searchParams.get("map"), 400),
    mapStyle: trimParam(url.searchParams.get("mapStyle"), 24),
    routeMode: trimParam(url.searchParams.get("routeMode"), 24),
    showStops: trimParam(url.searchParams.get("showStops"), 8),
    showCities: trimParam(url.searchParams.get("showCities") ?? url.searchParams.get("cityNames"), 8),
  };

  const canUseVersion = state.versionId && isValidVersionId(state.versionId);
  const canUseMapStyle = isMapStyle(state.mapStyle);
  const canUseRouteMode = isRouteMode(state.routeMode);
  const canUseShowStops = state.showStops === "1" || state.showStops === "0";
  const canUseShowCities = state.showCities === "1" || state.showCities === "0";
  const parsedTintIntensity = Number(state.blogTintIntensity);
  const blogTintIntensityPercent = Number.isFinite(parsedTintIntensity)
    ? Math.max(0, Math.min(100, Math.round(parsedTintIntensity)))
    : DEFAULT_BLOG_TINT_INTENSITY;
  const blogTintEnabled = Boolean(state.blogTint) || (state.mode === "site" && Boolean(state.blogImage));
  const blogTintColor = state.blogTint || DEFAULT_BLOG_TINT_COLOR;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TravelFlow OG Playground</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Space Grotesk", "Avenir Next", "Segoe UI", sans-serif;
      }
      body {
        margin: 0;
        background: radial-gradient(circle at 12% 10%, #e0e7ff 0%, #f8fafc 55%, #f1f5f9 100%);
        color: #0f172a;
      }
      .wrap {
        display: grid;
        grid-template-columns: 420px minmax(0, 1fr);
        gap: 20px;
        min-height: 100vh;
        padding: 20px;
        box-sizing: border-box;
      }
      .panel {
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid rgba(148, 163, 184, 0.35);
        border-radius: 16px;
        padding: 18px;
        backdrop-filter: blur(6px);
      }
      .panel h1 {
        margin: 0 0 6px;
        font-size: 22px;
      }
      .sub {
        margin: 0 0 14px;
        color: #475569;
        font-size: 13px;
        line-height: 1.45;
      }
      form {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      [hidden] {
        display: none !important;
      }
      .group {
        grid-column: 1 / -1;
        border: 1px solid #dbe4ef;
        border-radius: 12px;
        background: #f8fafc;
        padding: 12px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .group-head {
        grid-column: 1 / -1;
      }
      .group-title {
        margin: 0;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.01em;
        color: #1e293b;
      }
      .group-sub {
        margin: 4px 0 0;
        color: #64748b;
        font-size: 12px;
        line-height: 1.35;
      }
      .full {
        grid-column: 1 / -1;
      }
      label {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.02em;
        color: #334155;
        display: block;
        margin: 0 0 4px;
      }
      input, select {
        width: 100%;
        border-radius: 10px;
        border: 1px solid #cbd5e1;
        padding: 9px 10px;
        font-size: 13px;
        box-sizing: border-box;
        background: #fff;
      }
      .actions {
        grid-column: 1 / -1;
        display: flex;
        gap: 8px;
        margin-top: 2px;
      }
      button, .link-btn {
        border-radius: 10px;
        border: 1px solid #4338ca;
        background: #4f46e5;
        color: white;
        font-size: 13px;
        font-weight: 700;
        padding: 9px 12px;
        cursor: pointer;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      button.secondary {
        background: white;
        color: #334155;
        border-color: #cbd5e1;
      }
      .preview {
        display: grid;
        grid-template-rows: auto auto 1fr;
        gap: 10px;
      }
      .preview .bar {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }
      .preview code {
        display: block;
        border-radius: 10px;
        border: 1px solid #cbd5e1;
        background: #f8fafc;
        color: #0f172a;
        padding: 9px 10px;
        font-size: 12px;
        overflow: auto;
      }
      .tint-controls {
        display: grid;
        grid-template-columns: 1fr 58px;
        gap: 8px;
        align-items: center;
      }
      .checkline {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 12px;
        color: #334155;
        cursor: pointer;
      }
      .checkline input {
        width: auto;
        margin: 0;
      }
      input[type="color"] {
        width: 58px;
        height: 38px;
        border-radius: 10px;
        border: 1px solid #cbd5e1;
        padding: 4px;
        background: #fff;
      }
      .range-row {
        margin-top: 8px;
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: 8px;
      }
      .intensity-value {
        font-size: 12px;
        color: #475569;
        font-weight: 600;
      }
      .img-wrap {
        border-radius: 16px;
        border: 1px solid #cbd5e1;
        background: #fff;
        overflow: auto;
        padding: 14px;
      }
      img {
        display: block;
        width: min(100%, 1200px);
        height: auto;
        border-radius: 12px;
        border: 1px solid #cbd5e1;
        background: #e2e8f0;
      }
      @media (max-width: 1080px) {
        .wrap {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <section class="panel">
        <h1>OG Playground</h1>
        <p class="sub">Preview <code>/api/og/trip</code> and <code>/api/og/site</code>. For blog OG previews, switch to <strong>Site OG</strong> and set <code>blog_image</code> (jpg path). Use tint controls to optionally pass <code>blog_tint</code> + <code>blog_tint_intensity</code>.</p>
        <form id="og-form">
          <section class="group">
            <div class="group-head">
              <p class="group-title">Endpoint</p>
              <p class="group-sub">Only controls relevant to the selected endpoint are shown below.</p>
            </div>
            <div class="full">
              <label for="mode">Endpoint</label>
              <select id="mode" name="mode">
                <option value="trip"${state.mode === "trip" ? " selected" : ""}>Trip OG (/api/og/trip)</option>
                <option value="site"${state.mode === "site" ? " selected" : ""}>Site OG (/api/og/site)</option>
              </select>
            </div>
          </section>

          <section class="group">
            <div class="group-head">
              <p class="group-title">Shared Overrides</p>
              <p class="group-sub">Cross-endpoint fields plus site-only metadata (hidden in Trip mode).</p>
            </div>
            <div class="full" data-mode="site"${state.mode === "site" ? "" : " hidden"}>
              <label for="pill">Pill label (site OG)</label>
              <input id="pill" name="pill" value="${escapeHtml(state.pill)}" placeholder="BLOG" />
            </div>
            <div class="full">
              <label for="title">Title override</label>
              <input id="title" name="title" value="${escapeHtml(state.title)}" placeholder="Title shown in OG image" />
            </div>
            <div class="full" data-mode="site"${state.mode === "site" ? "" : " hidden"}>
              <label for="description">Description/subline (site OG)</label>
              <input id="description" name="description" value="${escapeHtml(state.description)}" placeholder="Subline for /api/og/site" />
            </div>
            <div class="full">
              <label for="path">Footer URL path override</label>
              <input id="path" name="path" value="${escapeHtml(state.routePath)}" placeholder="/blog/your-slug or /s/your-token" />
            </div>
          </section>

          <section class="group" data-mode="trip"${state.mode === "trip" ? "" : " hidden"}>
            <div class="group-head">
              <p class="group-title">Trip Source & Stats</p>
              <p class="group-sub">Use a share token for real data, then optionally override details and map rendering.</p>
            </div>
            <div class="full">
              <label for="s">Share token (real data)</label>
              <input id="s" name="s" placeholder="e.g. 5f7a9b..." value="${escapeHtml(state.shareToken)}" />
            </div>
            <div>
              <label for="trip">Trip ID (fallback)</label>
              <input id="trip" name="trip" value="${escapeHtml(state.tripId)}" />
            </div>
            <div>
              <label for="v">Version UUID (optional)</label>
              <input id="v" name="v" value="${escapeHtml(canUseVersion ? state.versionId : "")}" />
            </div>
            <div>
              <label for="weeks">Weeks override</label>
              <input id="weeks" name="weeks" value="${escapeHtml(state.weeks)}" placeholder="e.g. 2.5 weeks" />
            </div>
            <div>
              <label for="months">Months override</label>
              <input id="months" name="months" value="${escapeHtml(state.months)}" placeholder="e.g. May-Jun" />
            </div>
            <div>
              <label for="distance">Distance override</label>
              <input id="distance" name="distance" value="${escapeHtml(state.distance)}" placeholder="e.g. 2,430 km" />
            </div>
            <div>
              <label for="u">Update stamp (u)</label>
              <input id="u" name="u" value="${escapeHtml(state.updatedAt)}" placeholder="cache bust id" />
            </div>
            <div class="full">
              <label for="map">Map image URL override (https only)</label>
              <input id="map" name="map" value="${escapeHtml(state.mapUrl)}" placeholder="https://.../staticmap" />
            </div>
            <div>
              <label for="mapStyle">Map style override</label>
              <select id="mapStyle" name="mapStyle">
                <option value="">Share/default</option>
                <option value="clean"${canUseMapStyle && state.mapStyle === "clean" ? " selected" : ""}>Clean</option>
                <option value="minimal"${canUseMapStyle && state.mapStyle === "minimal" ? " selected" : ""}>Minimal</option>
                <option value="standard"${canUseMapStyle && state.mapStyle === "standard" ? " selected" : ""}>Standard</option>
                <option value="dark"${canUseMapStyle && state.mapStyle === "dark" ? " selected" : ""}>Dark</option>
                <option value="satellite"${canUseMapStyle && state.mapStyle === "satellite" ? " selected" : ""}>Satellite</option>
              </select>
            </div>
            <div>
              <label for="routeMode">Route style override</label>
              <select id="routeMode" name="routeMode">
                <option value="">Share/default</option>
                <option value="simple"${canUseRouteMode && state.routeMode === "simple" ? " selected" : ""}>Simple</option>
                <option value="realistic"${canUseRouteMode && state.routeMode === "realistic" ? " selected" : ""}>Realistic</option>
              </select>
            </div>
            <div class="full">
              <label for="showStops">Show stops override</label>
              <select id="showStops" name="showStops">
                <option value="">Share/default</option>
                <option value="1"${canUseShowStops && state.showStops === "1" ? " selected" : ""}>On</option>
                <option value="0"${canUseShowStops && state.showStops === "0" ? " selected" : ""}>Off</option>
              </select>
            </div>
            <div class="full">
              <label for="showCities">Show city labels override</label>
              <select id="showCities" name="showCities">
                <option value="">Share/default</option>
                <option value="1"${canUseShowCities && state.showCities === "1" ? " selected" : ""}>On</option>
                <option value="0"${canUseShowCities && state.showCities === "0" ? " selected" : ""}>Off</option>
              </select>
            </div>
          </section>

          <section class="group" data-mode="site"${state.mode === "site" ? "" : " hidden"}>
            <div class="group-head">
              <p class="group-title">Blog Image Controls</p>
              <p class="group-sub">Preview blog image variants, cache revisions, and tint overlays for <code>/api/og/site</code>.</p>
            </div>
            <div class="full">
              <label for="blog_image">Blog image path (site OG)</label>
              <input id="blog_image" name="blog_image" value="${escapeHtml(state.blogImage)}" placeholder="/images/blog/slug-og-vertical.jpg" />
            </div>
            <div class="full">
              <label for="blog_rev">Blog image revision (cache bust)</label>
              <input id="blog_rev" name="blog_rev" value="${escapeHtml(state.blogRev)}" placeholder="2026-02-10-01" />
            </div>
            <div class="full">
              <label for="blog_tint_enabled">Blog tint controls</label>
              <div class="tint-controls">
                <label class="checkline" for="blog_tint_enabled">
                  <input id="blog_tint_enabled" type="checkbox"${blogTintEnabled ? " checked" : ""} />
                  Enable tint overlay
                </label>
                <input id="blog_tint_color" type="color" value="${escapeHtml(blogTintColor)}" />
              </div>
              <div class="range-row">
                <label for="blog_tint_intensity">Tint intensity</label>
                <span id="blog_tint_intensity_label" class="intensity-value"></span>
              </div>
              <input id="blog_tint_intensity" type="range" min="0" max="100" step="1" value="${blogTintIntensityPercent}" />
            </div>
          </section>

          <div class="actions">
            <button type="submit">Render</button>
            <button type="button" id="reset-btn" class="secondary">Reset</button>
            <button type="button" id="load-blog-example-btn" class="secondary">Load Blog Example</button>
          </div>
        </form>
      </section>

      <section class="panel preview">
        <div class="bar">
          <a class="link-btn" id="open-link" href="#" target="_blank" rel="noopener">Open Image</a>
          <button class="secondary" id="reload-btn" type="button">Reload</button>
        </div>
        <code id="query-url"></code>
        <div class="img-wrap">
          <img id="og-image" src="" alt="Open Graph preview" />
        </div>
      </section>
    </div>

    <script>
      const form = document.getElementById('og-form');
      const ogImage = document.getElementById('og-image');
      const openLink = document.getElementById('open-link');
      const queryUrl = document.getElementById('query-url');
      const reloadBtn = document.getElementById('reload-btn');
      const resetBtn = document.getElementById('reset-btn');
      const loadBlogExampleBtn = document.getElementById('load-blog-example-btn');
      const modeInput = document.getElementById('mode');
      const blogTintEnabledInput = document.getElementById('blog_tint_enabled');
      const blogTintColorInput = document.getElementById('blog_tint_color');
      const blogTintIntensityInput = document.getElementById('blog_tint_intensity');
      const blogTintIntensityLabel = document.getElementById('blog_tint_intensity_label');

      const DEFAULT_BLOG_TINT_COLOR = '${DEFAULT_BLOG_TINT_COLOR}';
      const DEFAULT_BLOG_TINT_INTENSITY = ${DEFAULT_BLOG_TINT_INTENSITY};
      const HAS_INITIAL_TINT_PARAMS = ${Boolean(state.blogTint || state.blogTintIntensity) ? "true" : "false"};
      const TRIP_KEYS = ['s', 'trip', 'v', 'title', 'weeks', 'months', 'distance', 'path', 'u', 'map', 'mapStyle', 'routeMode', 'showStops', 'showCities'];
      const SITE_KEYS = ['title', 'description', 'pill', 'path', 'blog_image', 'blog_rev'];
      const BLOG_SAMPLE = {
        title: 'How to Plan the Perfect Multi-City Trip',
        description: 'Plan a smooth multi-stop itinerary with smart routing, realistic timing, and less stress.',
        pill: 'BLOG',
        path: '/blog/how-to-plan-multi-city-trip',
        blog_image: '/images/blog/how-to-plan-multi-city-trip-og-vertical.jpg',
        blog_tint: DEFAULT_BLOG_TINT_COLOR,
        blog_tint_intensity: String(DEFAULT_BLOG_TINT_INTENSITY),
        blog_rev: '2026-02-10-01',
      };

      function getMode() {
        return modeInput && modeInput.value === 'site' ? 'site' : 'trip';
      }

      let didApplySiteTintDefault = HAS_INITIAL_TINT_PARAMS;

      function clampTintIntensity(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return DEFAULT_BLOG_TINT_INTENSITY;
        return Math.max(0, Math.min(100, Math.round(parsed)));
      }

      function updateTintControls() {
        const tintEnabled = blogTintEnabledInput instanceof HTMLInputElement && blogTintEnabledInput.checked;
        const tintColor = blogTintColorInput instanceof HTMLInputElement && /^#[0-9a-fA-F]{6}$/.test(blogTintColorInput.value)
          ? blogTintColorInput.value
          : DEFAULT_BLOG_TINT_COLOR;
        const tintIntensity = clampTintIntensity(blogTintIntensityInput instanceof HTMLInputElement ? blogTintIntensityInput.value : DEFAULT_BLOG_TINT_INTENSITY);

        if (blogTintColorInput instanceof HTMLInputElement) {
          blogTintColorInput.value = tintColor;
          blogTintColorInput.disabled = !tintEnabled;
        }
        if (blogTintIntensityInput instanceof HTMLInputElement) {
          blogTintIntensityInput.value = String(tintIntensity);
          blogTintIntensityInput.disabled = !tintEnabled;
        }
        if (blogTintIntensityLabel) {
          blogTintIntensityLabel.textContent = String(tintIntensity) + '%';
        }
      }

      function applySiteTintDefaultIfNeeded() {
        if (getMode() !== 'site' || didApplySiteTintDefault) return;
        if (blogTintEnabledInput instanceof HTMLInputElement) {
          blogTintEnabledInput.checked = true;
        }
        if (blogTintColorInput instanceof HTMLInputElement && !/^#[0-9a-fA-F]{6}$/.test(blogTintColorInput.value)) {
          blogTintColorInput.value = DEFAULT_BLOG_TINT_COLOR;
        }
        if (blogTintIntensityInput instanceof HTMLInputElement) {
          blogTintIntensityInput.value = String(DEFAULT_BLOG_TINT_INTENSITY);
        }
        didApplySiteTintDefault = true;
      }

      function applyModeVisibility() {
        const mode = getMode();
        const sections = form.querySelectorAll('[data-mode]');
        sections.forEach((el) => {
          if (!(el instanceof HTMLElement)) return;
          const targetMode = el.dataset.mode;
          const visible = targetMode === mode;
          el.hidden = !visible;
          el.style.display = visible ? '' : 'none';
        });
      }

      function buildParamsFromForm(mode) {
        const params = new URLSearchParams();
        const allowed = mode === 'site' ? SITE_KEYS : TRIP_KEYS;
        const data = new FormData(form);

        for (const key of allowed) {
          const raw = data.get(key);
          const text = String(raw || '').trim();
          if (!text) continue;
          params.set(key, text);
        }

        if (mode === 'site') {
          const tintEnabled = blogTintEnabledInput instanceof HTMLInputElement && blogTintEnabledInput.checked;
          if (tintEnabled) {
            const tintColor = blogTintColorInput instanceof HTMLInputElement ? blogTintColorInput.value.trim() : '';
            const tintIntensity = clampTintIntensity(blogTintIntensityInput instanceof HTMLInputElement ? blogTintIntensityInput.value : DEFAULT_BLOG_TINT_INTENSITY);
            if (/^#[0-9a-fA-F]{6}$/.test(tintColor)) {
              params.set('blog_tint', tintColor);
              params.set('blog_tint_intensity', String(tintIntensity));
            }
          }
        }

        return params;
      }

      function buildImageUrl() {
        const mode = getMode();
        const params = buildParamsFromForm(mode);
        const endpoint = mode === 'site' ? '/api/og/site' : '/api/og/trip';
        const imageUrl = endpoint + (params.toString() ? ('?' + params.toString()) : '');
        return { imageUrl, mode, params };
      }

      function setInputValue(name, value) {
        const input = form.elements.namedItem(name);
        if (!input) return;
        input.value = value;
      }

      function loadBlogExamplePreset() {
        modeInput.value = 'site';
        setInputValue('title', BLOG_SAMPLE.title);
        setInputValue('description', BLOG_SAMPLE.description);
        setInputValue('pill', BLOG_SAMPLE.pill);
        setInputValue('path', BLOG_SAMPLE.path);
        setInputValue('blog_image', BLOG_SAMPLE.blog_image);
        setInputValue('blog_rev', BLOG_SAMPLE.blog_rev);
        if (blogTintEnabledInput instanceof HTMLInputElement) {
          blogTintEnabledInput.checked = true;
        }
        if (blogTintColorInput instanceof HTMLInputElement) {
          blogTintColorInput.value = DEFAULT_BLOG_TINT_COLOR;
        }
        if (blogTintIntensityInput instanceof HTMLInputElement) {
          blogTintIntensityInput.value = String(DEFAULT_BLOG_TINT_INTENSITY);
        }
      }

      function sync() {
        applySiteTintDefaultIfNeeded();
        applyModeVisibility();
        updateTintControls();
        const { imageUrl, mode, params } = buildImageUrl();
        const busted = imageUrl + (imageUrl.includes('?') ? '&' : '?') + '__t=' + Date.now();
        ogImage.src = busted;
        openLink.href = imageUrl;
        queryUrl.textContent = imageUrl;

        const full = new URL(window.location.href);
        const playgroundSearch = new URLSearchParams(params);
        playgroundSearch.delete('blog_tint');
        playgroundSearch.delete('blog_tint_intensity');
        playgroundSearch.set('mode', mode);
        full.search = playgroundSearch.toString() ? ('?' + playgroundSearch.toString()) : '';
        history.replaceState(null, '', full.toString());
      }

      form.addEventListener('submit', function(event) {
        event.preventDefault();
        sync();
      });

      reloadBtn.addEventListener('click', sync);

      resetBtn.addEventListener('click', function() {
        form.reset();
        if (blogTintEnabledInput instanceof HTMLInputElement) {
          blogTintEnabledInput.checked = ${blogTintEnabled ? "true" : "false"};
        }
        if (blogTintColorInput instanceof HTMLInputElement) {
          blogTintColorInput.value = '${blogTintColor}';
        }
        if (blogTintIntensityInput instanceof HTMLInputElement) {
          blogTintIntensityInput.value = '${blogTintIntensityPercent}';
        }
        sync();
      });

      loadBlogExampleBtn.addEventListener('click', function() {
        loadBlogExamplePreset();
        sync();
      });

      if (blogTintEnabledInput instanceof HTMLInputElement) {
        blogTintEnabledInput.addEventListener('change', sync);
      }
      if (blogTintColorInput instanceof HTMLInputElement) {
        blogTintColorInput.addEventListener('input', sync);
      }
      if (blogTintIntensityInput instanceof HTMLInputElement) {
        blogTintIntensityInput.addEventListener('input', sync);
      }

      modeInput.addEventListener('change', function() {
        applySiteTintDefaultIfNeeded();
        sync();
      });
      sync();
    </script>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
};
