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

export default async (request: Request): Promise<Response> => {
  const url = new URL(request.url);

  const state = {
    shareToken: trimParam(url.searchParams.get("s"), 120),
    tripId: trimParam(url.searchParams.get("trip"), 120),
    versionId: trimParam(url.searchParams.get("v"), 80),
    title: trimParam(url.searchParams.get("title"), 120),
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
        <p class="sub">Edit values and render <code>/api/og/trip</code> instantly. Use <strong>s</strong> to load real shared-trip data, or override layout and map preferences for tuning.</p>
        <form id="og-form">
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

          <div class="full">
            <label for="title">Title override</label>
            <input id="title" name="title" value="${escapeHtml(state.title)}" placeholder="Trip title shown in OG image" />
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
            <label for="path">Footer URL path override</label>
            <input id="path" name="path" value="${escapeHtml(state.routePath)}" placeholder="/s/my-token or /trip/my-trip?v=..." />
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

          <div class="actions">
            <button type="submit">Render</button>
            <button type="button" id="reset-btn" class="secondary">Reset</button>
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

      function buildImageUrl() {
        const params = new URLSearchParams();
        const data = new FormData(form);
        for (const [key, value] of data.entries()) {
          const text = String(value || '').trim();
          if (!text) continue;
          params.set(key, text);
        }
        const url = '/api/og/trip' + (params.toString() ? ('?' + params.toString()) : '');
        return url;
      }

      function sync() {
        const imageUrl = buildImageUrl();
        const busted = imageUrl + (imageUrl.includes('?') ? '&' : '?') + '__t=' + Date.now();
        ogImage.src = busted;
        openLink.href = imageUrl;
        queryUrl.textContent = imageUrl;

        const full = new URL(window.location.href);
        full.search = imageUrl.split('?')[1] || '';
        history.replaceState(null, '', full.toString());
      }

      form.addEventListener('submit', function(event) {
        event.preventDefault();
        sync();
      });

      reloadBtn.addEventListener('click', sync);

      resetBtn.addEventListener('click', function() {
        form.reset();
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
