# Markdown Custom Components

This project extends standard blog markdown with a small set of custom rendering features in [`pages/BlogPostPage.tsx`](/Users/chrizzzly/.codex/worktrees/567c/travelflow-codex/pages/BlogPostPage.tsx).

Use these patterns to keep formatting and behavior consistent across posts.

## Supported Custom Features

1. Internal example-trip link card
- Any markdown link that points to `/example/...` is rendered as a highlighted app card:
  - favicon
  - app name
  - link label
  - outbound icon
- Example:
```md
[Beispielreise öffnen: Husum Krokusblütenfest Wochenende 2026](/example/husum-krokus-weekend)
```

2. Optimized inline images with captions
- Normal markdown images render through `ProgressiveImage` with:
  - responsive source sets
  - lazy loading
  - blurhash placeholder support
  - fixed dimensions to avoid layout shift
- Captions are rendered below the card based on alt text.
- Always provide meaningful alt text:
```md
![Krokusblüten im Schloßpark Husum](/images/blog/husum-weekend/husum-weekend-krokus-schlosspark.webp)
```

3. Interactive map card block (`tf-map`)
- Embed a categorized map card from JSON:
````md
```tf-map
{
  "title": "Husum Wochenende Karte",
  "description": "Alle Hotspots für dein Husum-Wochenende.",
  "regionContext": "Husum, Nordfriesland, Schleswig-Holstein",
  "mapCenter": { "lat": 54.4765, "lng": 9.0513 },
  "mapZoom": 13,
  "defaultCategoryId": "krabbenbroetchen",
  "categories": [
    {
      "id": "krabbenbroetchen",
      "label": "Krabbenbrötchen",
      "icon": "🦐",
      "spots": [
        { "id": "fischhaus-loof", "name": "Fischhaus Loof", "query": "Fischhaus Loof Husum" }
      ]
    }
  ]
}
```
````

4. Add-to-calendar card block (`tf-calendar`)
- Embed a downloadable schedule card with a single `.ics` action:
````md
```tf-calendar
{
  "title": "Krokusblütenfest 2026 direkt in deinen Kalender",
  "description": "Alle Programmpunkte als .ics-Datei.",
  "filename": "husum-krokusbluetenfest-2026",
  "timezone": "Europe/Berlin",
  "events": [
    {
      "id": "market-saturday",
      "title": "Kunsthandwerkermarkt + kulinarische Meile",
      "start": "2026-03-14T10:00:00+01:00",
      "end": "2026-03-14T18:00:00+01:00",
      "location": "Schlosshof, Husum",
      "description": "Festivalprogramm"
    }
  ]
}
```
````

## Authoring Rules

1. Keep JSON valid in `tf-map` and `tf-calendar` blocks.
2. Use ISO datetime strings with timezone offsets (`+01:00`) in `tf-calendar`.
3. Keep map and calendar IDs stable to preserve analytics consistency.
4. Keep all user-facing copy in post language (for German posts: German).
5. For external links, use full `https://...` URLs.

## Validation Checklist

1. Run `pnpm blog:validate`.
2. If custom block parser logic changes, add/update unit tests under `tests/unit/`.
3. If renderer behavior changes, verify the post visually in blog detail view.
