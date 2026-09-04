# Guardrails for AI and agent features

Written after the Trip Agent review of 2026-09-04, which found two stop-ship
privacy defects and eight further significant findings in a feature that had
passed its own checklists. Every rule below exists because something here went
wrong; the failure is named so the rule is arguable rather than ceremonial.

Applies to anything that calls a model, streams to the browser, or writes what a
model produced: `netlify/edge-lib/*`, `services/*Service.ts`, planner AI UI.

## 1. Model output is not automatically safe to show or store

- **Never stream or persist hidden reasoning.** `sendReasoning` stays `false`,
  reasoning parts are stripped before persistence *and* on read, and the
  renderer ignores them. The public plan a model writes as normal text is the
  only account of its thinking a user or administrator sees.
- A transcript is read later by collaborators, administrators and support. Treat
  every stored part as published.

> *What happened:* the PoC set `sendReasoning: true`, then a request for "the
> reasoning list in the chat" was implemented as-is. The spec that forbade it
> (`docs/trip-agent/issues/02-runtime.md`) was never re-read, and one production
> message ended up carrying 17 reasoning parts.
>
> *The rule that would have caught it:* when a request touches a documented
> privacy or security constraint, re-read that document **before** implementing,
> and put the conflict to the user instead of resolving it silently.

## 2. Diagnostics need a redaction boundary, decided when the field is added

- Provider and database messages quote URLs, keys, tokens and prompt fragments.
  Route every diagnostic through `netlify/edge-lib/trip-agent-redaction.ts`
  (or an equivalent) before it reaches a log line, a stored record, or a
  response body.
- The browser gets a **code plus an authored sentence**. Never the exception.
- Correlate with a request id instead: the redacted detail belongs in the server
  log next to it.

> *What happened:* a `detail` field was added to error responses to make
> debugging easier, and shipped raw exception text to the client for days.

## 3. Changing an integration path means porting its guarantees

Before swapping a provider, model or transport, list what the old path
guaranteed — approved-model enforcement, zero data retention, no-training, no
provider fallback, region — and either port each one or state plainly that it
is now off.

> *What happened:* switching to the app-wide OpenRouter default silently dropped
> Gateway ZDR, registry models and approved-provider discovery. The active path
> now enforces the approved list and denies provider data collection, but that
> was retrofitted after review, not carried across.

## 4. A client credential on the server is a decision, not a default

A `VITE_`-prefixed key ships to browsers and is normally referrer-restricted.
Reaching for it server-side because a second key is inconvenient is a shortcut;
answer "why do we need another key?" with the reason first.

The reason: for a server call to work, the key must be unrestricted by referrer
— and that same key sits in the client bundle, where anyone can lift it and
spend the project's quota.

**Recorded decision (2026-09-04):** the owner accepted that trade-off for Maps
grounding. `GOOGLE_MAPS_GROUNDING_API_KEY` is used when set;
`VITE_GOOGLE_MAPS_API_KEY` is the fallback, and the run logs which source it
used. The mitigation lives in Google Cloud, not in this code: cap the key's
daily quota and restrict it to the APIs it needs. Take the same route for any
future case — state the exposure, get the decision, record it, and log which
credential is in play.

## 5. Budget every run against the platform's hard limit

Netlify terminates a synchronous function at 60 seconds, outside the
application's error handling
([docs](https://docs.netlify.com/build/functions/configuration/)). An
interactive run is budgeted at 45 seconds so it always closes its own records;
anything longer belongs in an asynchronous workflow.

Check the host limit whenever a timeout, token budget or step ceiling changes —
a larger budget is worthless if the platform kills the process first, and it
leaves rows stuck `running` that nothing cleans up.

**Every long-lived record needs a sweeper.** If a process can be killed between
"start" and "finish", something must close the row later; bootstrap is a good
place.

## 6. Lifecycle state belongs to the record, not the transcript

A chat transcript is a rendering of history. Anything with a lifecycle —
proposal applied/rejected/stale, run finished, quota consumed — is read back
from its own table on load. Rebuilding an interactive card from stored message
parts re-offers work that is already done.

## 7. Model-facing schemas are forgiving; internal schemas stay strict

The SDK rejects a tool call that fails the tool's input schema *before* the tool
can answer, which surfaces as an unexplained failed step and often a model that
narrates success anyway. So:

- the **wire** schema drops unknown keys, coerces numeric strings, and maps
  unsupported enum values to a safe default;
- the **internal** schema stays strict, and conversion happens server-side with
  per-field feedback the model can act on;
- a failed tool call is rendered as its own visible failure, never collapsed
  into an activity row that the prose can contradict.

Function-calling models cannot reliably emit a large discriminated union. Give
them one flat object with an enum discriminator.

## 8. Approval flows: replay, then verify, then report

- Compute what will happen, show it, and only then write.
- One unusable operation must not sink a whole review: skip it, count it, and
  say so. Only structural faults (duplicate ids, unknown selection, a result
  that fails validation) may throw.
- Report a partial apply. "Applied 4 of 6" is the difference between a bug the
  user reports and a change that silently disappears.
- Grouping is a reading aid, not a substitute for per-item selection.

## 9. Postgres has no autonomous transactions

`UPDATE` followed by `RAISE` in the same function rolls the update back. To
record a state change *and* fail the call, **return** the status and let the
caller raise.

Permission functions must prove what they claim: an editable share grants access
to the holder of the token, not to everyone while a share exists. Include
expiry (`trip_expires_at`) in every access check.

## 10. This app renders through preact/compat

`vite.config.ts` aliases `react` to `preact/compat`. Consequences that have each
cost a debugging round:

- **A plain function component never receives `ref`.** React 19's ref-as-prop
  does not exist here. Any component used with Radix `asChild`, or that a
  library focuses or measures, must be a real `forwardRef`. Symptoms:
  `e.getBoundingClientRect is not a function`, `e.focus is not a function`,
  popovers anchored at the origin.
- Libraries that assume React 19 (`@shadcn/react`, for example) do not belong
  here. Vendor the markup and rebuild it on the repo's own primitives.
- Keyboard-owning libraries that wire themselves through refs (cmdk) may not
  work; owning the key handling is often simpler than fighting it.

## 11. `i18next-icu` is installed but never registered

`i18n.ts` does not `.use(ICU)`. ICU **placeholders** (`{name}`) work through
plain interpolation; ICU **plural/select syntax**
(`{count, plural, one {...} other {...}}`) renders as raw text. Use suffix-free
plain strings, or register the plugin first. See
`tests/unit/festivalLocaleKeys.test.ts`.

## 12. Verification discipline

- **Build a harness before a third round of "try it and tell me".** The
  read-only dry run (`pnpm trip-agent:dry-run <tripId> "<prompt>"`) replays one
  real turn against a real trip with persistence stubbed. It found the
  conflicting `reasoning_effort` that had failed *every* deployed request, in
  one command. It should have existed on day one.
- **Claim exactly what was verified.** "The plugins are no longer bundled" is
  not "the packages were removed" — both were said, only one was true.
- **Run the repo's own gate after each UI batch**, not once at the end:
  `pnpm dlx react-doctor@latest <changed dirs> --verbose`. It flags render-time
  state updates, ref mutation during render and fresh effect dependencies —
  all three were reintroduced in this feature after an earlier commit fixed the
  same class of bug.
- **A new overlay is a dialog**: `role="dialog"`, `aria-modal`, focus capture
  and trap, Escape, a backdrop on mobile, and focus restored to the trigger.

## 13. Progress bookkeeping is a claim, and claims get audited

- Tick a checklist box against the **issue's own wording**, not against your
  memory of the session. If a box says "per-operation review" and the UI groups
  operations, the box stays open.
- Audit inherited PR text. A `Closes #123` line you did not write is still your
  claim once you push to that branch.
- One release note per feature, curated: a dozen user-facing lines describing
  the release, not one line per iteration. Contradictory entries (a shortcut
  documented twice, differently) mean nobody re-read it.

## Checklist before handing an AI feature over

- [ ] No hidden reasoning streamed, stored or rendered.
- [ ] Every diagnostic that leaves the process is redacted; no raw exception in a response.
- [ ] Provider guarantees (approved models, data collection, retention) explicitly stated as on or off.
- [ ] No `VITE_` credential used server-side.
- [ ] Run budget verified against the platform limit, with a sweeper for abandoned records.
- [ ] Interactive state rebuilt from its record, not from the transcript.
- [ ] Model-facing schema forgiving, internal schema strict, tool failures visible.
- [ ] Partial application reported; grouping does not remove per-item choice.
- [ ] `pnpm dlx react-doctor@latest` clean of errors; new overlays behave as dialogs.
- [ ] Checklists and PR claims match what the code actually does.
