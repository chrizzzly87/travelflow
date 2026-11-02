/**
 * Builds `public/llms.txt` and `public/llms-full.txt` (https://llmstxt.org).
 *
 * Generated from the trip-draft contract so the instructions an assistant
 * reads can never drift from what the API accepts. Regenerate with
 * `pnpm llms:generate`; a unit test fails when the committed files are stale.
 */
import { TRIP_ITINERARY_SCHEMA_NAME } from "./aiTripItinerarySchema.ts";
import {
  TRIP_DRAFT_EXAMPLE_REQUEST,
  TRIP_DRAFT_LIMITS,
  TRIP_DRAFT_REQUEST_JSON_SCHEMA,
  TRIP_DRAFT_RULES,
} from "./tripDrafts.ts";

export const LLMS_SITE_ORIGIN = "https://travelflowapp.netlify.app";

const page = (path: string, title: string, note: string) => `- [${title}](${LLMS_SITE_ORIGIN}${path}): ${note}`;

const SUMMARY = "> TravelFlow is a visual travel planner. A trip is a timeline of stays, travel legs, activities and day trips, shown next to a map. Travellers plan multi-city trips, share them, and keep them in their account.";

const ABOUT = [
  "Pages are in English at the root. Other languages use a path prefix: /es, /de, /fr, /pt, /ru, /it, /pl, /ko, /fa, /ur (for example /de/features).",
  "Trip pages, account pages and the admin area are private and not indexed.",
].join("\n");

const HANDOFF_SUMMARY = [
  "Assistants can plan a trip for a traveller and hand it to TravelFlow. TravelFlow checks the plan, stores it as a draft and returns a link. The traveller opens the link to see the trip on a timeline and map, then saves it to their TravelFlow account to edit, share or export it.",
  "",
  "TravelFlow does not run any AI for this. Plan the full itinerary yourself, then send it. Please do not use TravelFlow's own trip generator (/create-trip) on a traveller's behalf.",
  "",
  "Ways to hand over a trip, best first:",
  `1. MCP server (Streamable HTTP, no auth): ${LLMS_SITE_ORIGIN}/api/mcp. Tools: get_trip_draft_schema, validate_trip_draft, create_trip_draft, get_trip_draft.`,
  `2. HTTP API: POST ${LLMS_SITE_ORIGIN}/api/trip-drafts with a JSON body. Dry run: POST ${LLMS_SITE_ORIGIN}/api/trip-drafts/validate. OpenAPI: ${LLMS_SITE_ORIGIN}/api/trip-drafts/openapi.json.`,
  "3. WebMCP: on any TravelFlow page, browsers with WebMCP expose get_trip_draft_schema, validate_trip_draft and create_trip_draft.",
  `4. No tool access? Print the JSON in a code block and ask the traveller to paste it at ${LLMS_SITE_ORIGIN}/import-trip.`,
  "",
  `Format, rules and a complete example: ${LLMS_SITE_ORIGIN}/api/trip-drafts/schema (JSON) or ${LLMS_SITE_ORIGIN}/llms-full.txt (text).`,
].join("\n");

export const buildLlmsTxt = (): string => [
  "# TravelFlow",
  "",
  SUMMARY,
  "",
  ABOUT,
  "",
  "## Plan a trip for a traveller",
  "",
  HANDOFF_SUMMARY,
  "",
  "## Docs",
  "",
  page("/llms-full.txt", "Trip format for assistants", "every field, rules and a complete example"),
  page("/api/trip-drafts/schema", "Trip draft JSON Schema", "machine-readable schema, rules and example"),
  page("/api/trip-drafts/openapi.json", "OpenAPI", "for GPT Actions and other tool runners"),
  page("/faq", "FAQ", "how TravelFlow works, accounts, sharing, pricing"),
  page("/features", "Features", "what the planner can do"),
  page("/pricing", "Pricing", "free and paid plans"),
  "",
  "## Inspiration",
  "",
  page("/inspirations", "Inspirations", "trip ideas by theme, season, festival and country"),
  page("/inspirations/countries", "Countries", "destination guides by country"),
  page("/inspirations/best-time-to-travel", "Best time to travel", "seasonal suggestions"),
  page("/inspirations/events-and-festivals", "Events and festivals", "trips around events"),
  page("/inspirations/weekend-getaways", "Weekend getaways", "short trips"),
  page("/blog", "Blog", "planning guides"),
  "",
  "## Optional",
  "",
  page("/updates", "Release notes", "what changed recently"),
  page("/privacy", "Privacy", "privacy policy"),
  page("/terms", "Terms", "terms of service"),
  "",
].join("\n");

const fence = (language: string, body: string) => ["```" + language, body, "```"].join("\n");

export const buildLlmsFullTxt = (): string => [
  "# TravelFlow: trip format for assistants",
  "",
  SUMMARY,
  "",
  "## How to hand over a trip",
  "",
  HANDOFF_SUMMARY,
  "",
  "## Request",
  "",
  `The body is a JSON object. \`trip\` is the itinerary in TravelFlow's ${TRIP_ITINERARY_SCHEMA_NAME} format. \`startDate\` (YYYY-MM-DD), \`roundTrip\` and \`client\` are optional.`,
  "",
  "Successful create response (HTTP 201):",
  "",
  fence("json", JSON.stringify({ ok: true, draftId: "drf_…", url: `${LLMS_SITE_ORIGIN}/draft/drf_…`, expiresAt: "…", title: "…", startDate: "…" }, null, 2)),
  "",
  "Give `url` to the traveller. Unsaved drafts expire after " + TRIP_DRAFT_LIMITS.expiryDays + " days. Errors come back as HTTP 422 with an `errors` list; fix each one and send again.",
  "",
  "## Rules",
  "",
  ...TRIP_DRAFT_RULES.map((rule) => `- ${rule}`),
  `- Limits: at most ${TRIP_DRAFT_LIMITS.maxCities} stops, ${TRIP_DRAFT_LIMITS.maxActivities} activities, ${TRIP_DRAFT_LIMITS.maxDayTrips} day trips and ${Math.round(TRIP_DRAFT_LIMITS.maxBodyBytes / 1024)} KB per request.`,
  "",
  "## Complete example",
  "",
  fence("json", JSON.stringify(TRIP_DRAFT_EXAMPLE_REQUEST, null, 2)),
  "",
  "Send it with curl:",
  "",
  fence("bash", `curl -X POST ${LLMS_SITE_ORIGIN}/api/trip-drafts -H 'Content-Type: application/json' -d @trip.json`),
  "",
  "## JSON Schema",
  "",
  fence("json", JSON.stringify(TRIP_DRAFT_REQUEST_JSON_SCHEMA, null, 2)),
  "",
].join("\n");
