# Trip Agent: collaborative AI chat and approved trip changes

This is the repository mirror of the GitHub epic checklist. The GitHub epic is authoritative; update both when a delivery slice changes state.

How the chat runs, which functions the agents may call, and which trip changes they can propose: [ARCHITECTURE.md](./ARCHITECTURE.md).

## Testable PoC

- [x] Add versioned context references and allowlisted trip-change operations.
- [x] Add persistent shared chats, messages, runs, tools, proposals, usage counters, prompt versions, and agent definitions.
- [x] Apply the live Supabase migrations with RLS and service-only mutation policies.
- [x] Enforce three free requests per UTC day before model access.
- [x] Add the floating desktop panel and mobile sheet with selection context, examples, history, authors, and proposal review.
- [x] Apply selected changes atomically as one remote version and adopt that version once in local undo/redo history.
- [x] Keep the global rollout disabled while allowing administrator preview.
- [x] Deploy and smoke-test the named Netlify feature preview.

Preview: [trip-agent-collaborative-ai--travelflowapp.netlify.app](https://trip-agent-collaborative-ai--travelflowapp.netlify.app)

## PoC stabilization

- [x] Accept empty successful Supabase write responses and refund quota when pre-stream persistence fails.
- [x] Render request failures inside the conversation with a named error code and a one-click retry of the same message.
- [x] Stream assistant reasoning into the conversation as a collapsible step list.
- [x] Match the planning animation typography to normal assistant text.
- [x] Add a shadcn command menu for `/` presets and `@` trip, city, activity, stay, and travel context.
- [x] Log bounded request/run identifiers and failure summaries without prompts, credentials, or raw provider payloads.
- [x] Raise the Netlify build to Node 22 with `--max-old-space-size=4096`; `vite build` was aborting at the default ~2 GB heap (exit 134, reported by Netlify as exit code 2), which broke every deploy preview on this branch.
- [x] Describe attached `@` context inside the run instructions instead of relying on the trip-context tool call.
- [x] Group consecutive thinking and tool events into one collapsed activity block with tool chips.
- [x] Accept loosely shaped proposal payloads and answer schema failures with fixable issues instead of an opaque tool error.
- [x] Review proposals in a pick-then-preview flow that never writes before the preview is confirmed.
- [x] Group the `@` menu by trip, cities, stays, activities and transfers.
- [x] Name chats after their first prompt and group the history menu by recency with per-section caps.
- [x] Show relative message timestamps and drop the redundant author label on your own messages.
- [x] Forward refs from the shared button so preact/compat popovers keep a real anchor element.
- [x] Drop the math, mermaid and syntax-highlighting markdown plugins from the chat renderer.
- [x] Emit trip changes through a flat wire schema so function-calling models can produce them, and convert to the typed union server-side.
- [x] Run the planner on the app-wide default model (`ai_default_model_id`) with a controllable reasoning effort and a 12k output budget.
- [x] Show the running step, elapsed time and a slow-request note while a run is in flight.
- [x] Explain every tool chip, and list the agent's capabilities and possible trip changes in the panel.
- [x] Move attached context chips into the message box with kind icons.
- [x] Verify one real trip end to end with `pnpm trip-agent:dry-run` (Taiwan reorder: 32 operations, 21 items, no no-ops).
- [x] Send one reasoning control to OpenRouter: `reasoning_effort` plus `reasoning.effort` was rejected as a conflict, which failed every deployed run with TRIP_AGENT_REQUEST_FAILED.
- [x] Drive the `@` and `/` menus from the prompt textarea so arrow keys, filter-as-you-type and Enter work under preact/compat.
- [x] Render attached context as chips inside the input surface (block-start addon), not beside it.
- [x] Close out streaming messages and runs left behind by a reload, and offer to ask again.
- [x] Fall back to the existing Maps key when no dedicated grounding key is set.
- [x] Preview a proposal in the planner itself (calendar, timeline, map), with editing paused while it shows.
- [x] Group cascading day shifts under the change that caused them, so a shortened stop reads as one decision.
- [x] Vendor a shadcn-shaped questionnaire (multi-pick and single-pick) instead of `@shadcn/react`, which needs React 19.
- [x] Compact an applied proposal to one line and offer Revert.
- [x] Keep `@` mentions inline in the prompt text, highlighted while typing and in the sent bubble.
- [x] Ask which stop is meant when a city name occurs more than once.
- [x] Render the review card below the answer, add a proposal skeleton with a thinking orb, and drop the chat-history menu.
- [x] Skip an operation whose target is missing instead of failing the whole review, and report the count.
- [x] Reject a proposal that points at ids the trip does not have, so the model corrects itself in the same run.
- [x] Break the preview feedback loop: the panel reasons about the saved trip, the preview only changes what is rendered.
- [x] Group changes per stop, so a removed city and everything in it is one entry.
- [x] Cover every operation kind and its failure modes with unit tests.
- [x] Animate the panel opening, restyle the launcher as a white card button, and remember the open state across a refresh.
- [x] Bring back chat history as an in-panel list grouped by recency.
- [x] Show a thinking orb and the agent label from the moment a request leaves, and the proposal skeleton while a change set is being built.
- [x] Stop the mention backdrop from doubling the text or catching a page selection.
- [x] Keep the saved timestamp on a preview so leaving it restores the plan exactly.
- [x] Toggle the preview with P.
- [x] Give the review card an eyebrow and a one-line title, and make Discard close it with a next step.
- [x] Add `ask_traveler`, so the agent can ask what to do with days a change frees up and the answer continues the chat.
- [x] Keep a preview out of every path that can persist, so an applied change cannot be written over by the pre-preview state.
- [x] Report a partial apply instead of letting a previewed change disappear silently.
- [x] Allow one open proposal per trip: creating a new one closes the previous, and older cards read as replaced.
- [x] Move the preview toggle to Cmd/Ctrl+Shift+P, shown on the button, so it works from the message box too.
- [x] Never show a raised database code as the error detail; the localized title carries the meaning.
- [x] Accept the shapes models actually emit (unknown keys, numeric strings, unsupported transport modes) so the SDK stops rejecting calls before the tool runs.
- [x] Show a failed proposal attempt as its own notice with a retry, and hide an attempt a later call replaced.
- [ ] Verify the deploy preview end to end with an administrator account (transcript reload, retry, apply, quota refund).
- [ ] Decide whether transfers should group under their destination stop rather than the stop whose days they occupy.
- [x] Resolve the specialist model the same way as the orchestrator; a bare model id only worked with the AI Gateway.
- [ ] Normalize specialist result cards for stays and routes (#485).

## Delivery tracks

- [x] #486 Persistence, entitlements, quota, and agent configuration — PoC foundation implemented.
- [x] #481 Streaming orchestrator and atomic change-set application — PoC foundation implemented.
- [x] #484 Planner chat UI and timeline context — PoC foundation implemented.
- [ ] #485 Hotel and route specialists — grounded adapter exists; normalized visual result cards and production credentials remain.
- [ ] #482 Admin transcripts, prompt management, telemetry, and rollout — schema/records exist; admin workspace and rollout dashboards remain.
- [ ] #483 JourneySpec interoperability — blocked on PR #444.

## Production gates

- [ ] Configure `AI_GATEWAY_API_KEY` on Netlify and validate approved model discovery/routing.
- [ ] Configure a server-restricted `GOOGLE_MAPS_GROUNDING_API_KEY` and run grounded specialist smoke tests.
- [ ] Add deterministic fake Gateway/MCP browser E2E coverage.
- [ ] Verify authenticated transcript reload, cancellation, quota refund, and stale-proposal paths in the deployed environment (unauthenticated endpoint guard is verified).
- [ ] Build the English-only admin transcript and prompt-management workspace.
- [ ] Enable for all eligible accounts only after persistence, quota, atomic apply, telemetry, and rollback gates pass.
