/**
 * Edge function that proxies Google Static Maps API requests.
 * Returns a 302 redirect to a styled map image.
 *
 * Query params:
 *   coords  — pipe-separated lat,lng pairs (e.g. "35.68,139.65|34.69,135.50")
 *   style   — "clean" (default) | "minimal" | "standard"
 *   w       — width in pixels (default 680)
 *   h       — height in pixels (default 288)
 *   scale   — 1 or 2 (default 2)
 */

import { getMapsApiKeyFromEnv } from "../edge-lib/trip-og-data.ts";

const CLEAN_STYLE = [
    "style=element:geometry|color:0xf9f9f9",
    "style=element:labels.icon|visibility:off",
    "style=element:labels.text.fill|color:0x757575",
    "style=element:labels.text.stroke|color:0xf9f9f9|weight:2",
    "style=feature:administrative|element:geometry|visibility:off",
    "style=feature:poi|visibility:off",
    "style=feature:road|element:geometry|color:0xe0e0e0",
    "style=feature:road|element:labels|visibility:off",
    "style=feature:transit|visibility:off",
    "style=feature:water|element:geometry|color:0xc9d6e5",
    "style=feature:water|element:labels|visibility:off",
].join("&");

export default async (request: Request) => {
    const url = new URL(request.url);
    const coordsParam = url.searchParams.get("coords");

    if (!coordsParam) {
        return new Response("Missing 'coords' query parameter", { status: 400 });
    }

    // Parse coords
    const coords = coordsParam.split("|").map(pair => {
        const [lat, lng] = pair.split(",").map(Number);
        return { lat, lng };
    });

    if (coords.length === 0 || coords.some(c => isNaN(c.lat) || isNaN(c.lng))) {
        return new Response("Invalid coordinates format", { status: 400 });
    }

    const w = parseInt(url.searchParams.get("w") || "680", 10);
    const h = parseInt(url.searchParams.get("h") || "288", 10);
    const scale = parseInt(url.searchParams.get("scale") || "2", 10);
    const style = url.searchParams.get("style") || "clean";

    const apiKey = getMapsApiKeyFromEnv();
    if (!apiKey) {
        return new Response("Maps API key not configured", { status: 500 });
    }

    // Build path
    const pathCoords = coords.map(c => `${c.lat},${c.lng}`).join("|");
    const pathParam = `path=color:0x4f46e5cc|weight:3|${pathCoords}`;

    // Markers
    const startMarker = `markers=color:green|label:S|${coords[0].lat},${coords[0].lng}`;
    const last = coords[coords.length - 1];
    const endMarker = `markers=color:red|label:E|${last.lat},${last.lng}`;

    // Style
    const styleParam = style === "clean" ? CLEAN_STYLE : "";

    const mapUrl = [
        `https://maps.googleapis.com/maps/api/staticmap?size=${w}x${h}`,
        `scale=${scale}`,
        "maptype=roadmap",
        styleParam,
        pathParam,
        startMarker,
        endMarker,
        `key=${apiKey}`,
    ].filter(Boolean).join("&");

    return new Response(null, {
        status: 302,
        headers: {
            Location: mapUrl,
            "Cache-Control": "public, max-age=86400",
        },
    });
};
