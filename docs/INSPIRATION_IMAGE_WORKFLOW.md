# Inspiration Card Image Workflow

This project stores image and prompt metadata for inspirations cards in:

- `data/inspirationCardMedia.ts`

Each card entry includes:

- `title`
- `description`
- `countries`
- `keyLocation`
- `scene`
- `subject`
- image output paths (`small` and `large`)

## Visual style baseline

Use the same shared style profile from `inspirationImageGenerationProfile`:

- Use case: `photorealistic-natural`
- Style: realistic travel documentary photography
- Composition: human-scale viewpoint, no map-like framing
- Lighting: natural ambient light, soft contrast
- Constraints: real locations only, no text/logo/watermark/UI
- Avoid: maps, CGI look, oversaturated HDR, fantasy architecture

## One-command local build

Use this command to rebuild all inspiration card images locally:

```bash
pnpm build:images
```

What it does:

- loads `OPENAI_API_KEY` from your shell or `.env.local`
- builds JSONL jobs from card metadata
- calls the image generation CLI
- outputs large + `-768` WebP assets to `public/images/inspirations`

Optional flags:

- `pnpm build:images -- --concurrency=3`
- `pnpm build:images -- --keep-jobs`
- `pnpm build:images -- --dry-run`

## Manual generation steps

1. Build the JSONL jobs file from card metadata:

```bash
pnpm inspirations:images:jobs
```

This writes:

- `tmp/imagegen/inspiration-cards.jsonl`

2. Run OpenAI image generation via the imagegen skill CLI:

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export IMAGE_GEN="$CODEX_HOME/skills/imagegen/scripts/image_gen.py"

uv run --with openai --with pillow python "$IMAGE_GEN" generate-batch \
  --input tmp/imagegen/inspiration-cards.jsonl \
  --out-dir public/images/inspirations \
  --no-augment \
  --concurrency 3 \
  --downscale-max-dim 768 \
  --downscale-suffix -768 \
  --force
```

3. Cleanup temporary JSONL:

```bash
rm -f tmp/imagegen/inspiration-cards.jsonl
```

## Add new card image metadata

When adding a new inspiration card:

1. Add a new entry to `destinationCardMedia` or `festivalCardMedia`.
2. Set a realistic `keyLocation` and scene grounded in the actual country/city context.
3. Re-run `pnpm inspirations:images:jobs` and generate the new assets.
