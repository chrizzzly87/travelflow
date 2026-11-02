# Admin screens

What each admin screen is for, what it shows first, and why it is laid out the way it is.
Read this before changing a screen: if a change does not serve the screen's **job**, it
probably belongs somewhere else.

- Visual and interaction contract: [`DESIGN.md`](./DESIGN.md)
- Shared components and the rules for admin screens: [`DESIGN_SYSTEM_COMPONENTS.md`](./DESIGN_SYSTEM_COMPONENTS.md)
- Open items: [`ADMIN_WORKSPACE_FOLLOWUPS.md`](./ADMIN_WORKSPACE_FOLLOWUPS.md)

## The workspace

Every screen renders inside `AdminShell`: a sidebar grouped into **Workspace**,
**Operations**, **Content** and **Tools** (`components/admin/adminNavConfig.ts`), a top bar with
breadcrumbs and the theme toggle, a `⌘K` command palette that reaches every screen by name or
keyword, and one page header (title, one-line purpose, filters, actions).

The same pieces repeat across screens on purpose, so an admin learns them once:

| Need | Component |
| --- | --- |
| A few numbers that drive a decision | `AdminStatCard` (3–4 per screen) |
| A list of records | `Table` with identity first, status as a badge, actions in a trailing `…` menu |
| Filters | one toolbar row directly above the table; "Reset" appears only when a filter is active |
| Acting on many rows | `AdminSelectionBar` — appears only while rows are selected |
| Paging | `AdminPagination` |
| One record in depth | `AdminDetailSheet` — right sheet, actions in the footer, destructive last |
| Something failed | `AdminErrorAlert` with an authored sentence (`toAdminErrorMessage`) |
| Nothing to show | `AdminEmptyState` naming the next action |

Admin copy is English only and sentence case.

## Screens

### Overview — `/admin/dashboard`
**Job:** see at a glance whether the product is growing and whether anything needs attention.
**Answers:** how many users and trips arrived in the range; how many trip generations failed;
which trips expire this week; how users split across plans.
**Primary action:** none — every attention tile links to the filtered list that fixes it.
**Layout:** 4 tiles (Users with suspended count in the hint, Trips with active share, Failed
generations → Trips filtered to failed, Expiring in 7 days → Trips filtered to expiring) ·
"New users and trips" chart beside "User mix" · users-by-level and trips-by-status charts ·
recent users table (opens the Users sheet).
**Changed (2026-10-24):** "Expired trips" and "Suspended users" tiles, which were nearly always
zero and led nowhere, became the two attention tiles; they count exactly what the Trips
screen's own tiles count (`summarizeAdminTrips`) and link with the same date range.
**Follow-ups:** aggregates up to 500 users/trips client-side; active-user metrics need event
aggregation (`ADMIN_DASHBOARD_PLAN.md`).

### Users — `/admin/users`
**Job:** find an account, check its state, then fix its profile, plan or access — or clean it up.
**Answers:** which accounts need me (never activated, subscription at risk, empty); who this
person is; what changed on the account and who changed it; whether it is safe to delete.
**Primary action:** Create user (header); Save changes (sheet).
**Layout:** 3 work-queue tiles (Awaiting activation, Subscriptions at risk, Empty accounts — each
applies its filter) · filter toolbar (Status, Activation, Plan, Sign-in method, Trips, More
filters) · table · pagination · selection bar · details sheet with tabs Overview, Profile &
access, Billing, Trips, Activity.
**Columns:** User (name, email, Admin badge) · Status (one badge: Deleted > Suspended > Pending
activation > Invited > Guest > Active) · Sign-in · Plan (+ subscription state) · Trips · Last
sign-in · Created · `…`. Behind the column picker: Subscription, Activation, Role, Terms, Last
updated.
**Changed:** count tiles became work queues; ~10 forced-width columns became 7 that fit at
1440px; the seven-box drawer became a tabbed sheet; bulk bar only with a selection; errors show
inside the sheet and dialog; unchanged trip-expiry blurs no longer write audit rows; deleted users
no longer reopen from a stale `?user=` link.
**Unchanged on purpose:** select-all still spans every matching eligible user (needed for
cleanup), with the count in the label and the confirm.
**Follow-ups:** server-side paging past 500; resend-invite endpoint; queue counts are scoped to the
date range.

### Trips — `/admin/trips`
**Job:** find a trip, fix failed generations, and manage its status, expiry and ownership.
**Answers:** which trips failed and why (and can I retry); what is generating now; what expires
this week; who owns a trip.
**Primary action:** none at page level; Retry generation in the sheet when it failed.
**Layout:** 4 tiles (Failed generation, Generating now, Expiring in 7 days, Active trips — each
with a "Show …" filter) · filter toolbar (Status, Generation, Expiration, Source, Columns) ·
table · pagination · selection bar · trip sheet (Overview, Generation, Status and expiry, sharing
previews; footer: Duplicate, Transfer owner, Download JSON, Archive/Restore, Delete permanently).
**Columns:** Trip · Owner (links to the Users sheet) · Status · Generation · Expires · Updated ·
`…`. Behind the picker: Source, Created, Archived.
**Changed:** Total/Expired/Archived tiles dropped; the owner drawer was removed in favour of the
Users sheet (old `?user=…&drawer=user` links forward there); raw generation JSON sits behind
"Technical details"; header select-all selects the page, "Select all N matching" is an explicit
second step; "Soft-delete"/"Hard delete" read "Archive trip"/"Delete permanently".
**Follow-ups:** server-side paging past 600 rows; a batch RPC for bulk archive/delete.

### Plans — `/admin/tiers`
**Job:** change what each plan includes, save it, and only then decide on purpose whether
existing customers' trips follow the change.
**Primary action:** Save per plan; "Reapply to N customers…" is secondary and confirmed with the
preview counts.
**Layout:** info note · one card per plan: step 1 limits and permissions (form, "Edit as JSON"),
step 2 existing customers (preview, reapply).
**Changed:** removed the per-tier user tiles (Overview's "User mix" covers it), the date range
and search; reapply needs a confirmation and is blocked while edits are unsaved. Renamed in the
navigation from "Tiers" to "Plans" to match the word every other screen uses.
**Follow-ups:** the form starts from catalog defaults because no RPC reads the stored template —
needs an `admin_get_plan_entitlements`-style read.

### Billing — `/admin/billing`
**Job:** keep Paddle subscriptions in sync with TravelFlow — find and repair failed or unlinked
webhooks — and check recurring-revenue health.
**Primary action:** Reconcile Paddle (also per subscription and per event).
**Layout:** health tiles (Sync issues with Review failed/unlinked, Current MRR, Active paid,
Cancelling) · one records card with tabs Subscriptions | Webhook events (`?view=events`) ·
revenue (MRR by plan, at-risk revenue) · subscription mix · detail sheets.
**Changed:** things to fix come first; the webhook list is a filterable table; four per-currency
MRR tiles became one; detail moved into sheets; KPIs no longer change with table filters.
**Follow-ups:** range-aware server count for sync issues; a "replay one webhook" RPC.

### Audit log — `/admin/audit`
**Job:** find out who changed what and when, across admin actions and user/trip changes —
then export evidence or revert a change.
**Primary action:** none (read-mostly); Export replay in the header.
**Layout:** filter toolbar (time range, Action, Target, Actor, Columns) · table · pagination ·
selection bar (export selected) · entry sheet, user sheet, trip sheet, full diff modal.
**Columns:** When (relative) · Actor (with "Admin action"/"User action") · Action · Target ·
Changes (two-line summary; opens the entry sheet) · `…`.
**Changed:** legend strip removed (badges carry their code in a tooltip); the 620px inline diff
became a summary plus an entry sheet listing every field; row buttons collapsed into a `…`
menu; the action filter no longer silently pins the actions seen on first load.
**Follow-ups:** `?entry=` deep link; server-side paging (stops at 500 rows per source).

### Airports — `/admin/airports`
**Job:** keep the commercial airport catalog behind nearby-airport lookups correct, and check what
those lookups return.
**Primary action:** New airport; editing opens a row.
**Layout:** tabs Catalog | Nearby tester | Ticket lab (`?tab=`) · Catalog: 3 tiles (size, last
sync, data version), snapshot warning, filters, table, pagination, selection bar (Bulk edit,
Delete selected) · editor sheet (`?airport=`).
**Columns:** Airport (name + IATA · ICAO) · Location · Tier · Type · Timezone · `…`.
**Changed:** four jobs on one scroll became tabs (the tester and Google Maps load only when
opened); the editor and the bulk editor moved into a sheet and the selection bar; Sync from
upstream moved into a `…` menu; loading toasts stay until the work finishes.
**Follow-ups:** whether the ticket lab belongs in the design playground instead.

### Destinations — `/admin/destinations`
**Job:** write, publish or remove editorial overrides on imported destination guides and country
profiles. The public data is served from Supabase — see `DESTINATION_INGESTION_RUNBOOK.md`.
**Primary action:** Save draft / Publish override.
**Layout:** 3 tiles (Unpublished drafts, Published overrides, Latest import) · list (Guides |
Country profiles tabs, status and type filters) beside the editor (patch with live validation,
preview, pinned footer).
**Changed:** the first guide no longer opens with an empty patch that would wipe its override on
save; unsaved edits are guarded; the patch validates as you type.

### Recommendations — `/admin/recommendations`
**Job:** curate the per-country library of place ideas behind the trip Ideas deck and publish
what travellers should see (`RECOMMENDATIONS_CONTENT_RUNBOOK.md`).
**Primary action:** New recommendation; Save in the editor.
**Layout:** 3 tiles (Published, Needs review, Without a photo) · list (country, status filter)
beside the editor (Basics, Card copy, Classification, Location, Photo; pinned footer).
**Changed:** "Publish now" no longer throws away unsaved edits; import moved into a `…` menu and
the empty state; stale responses after a country switch are ignored.
**Follow-ups:** bulk publish/retire and a review queue.

### Legal terms — `/admin/legal`
**Job:** publish the next version of the terms (German binding, English helper) and decide whether
users must re-accept it.
**Primary action:** Publish version (confirmed; danger tone when re-acceptance is required).
**Layout:** "Live now" strip · next version in three steps (edit DE/EN with live preview,
describe the version, choose rollout and publish) · version history table with a `…` menu.
**Changed:** preview merged into the editor; force/inform became two explained radio cards; the
version shown is always the one that gets published; drafts are not discarded without asking.
**Follow-ups:** drafts are not persisted (no draft state in the service).

### Settings — `/admin/settings`
**Job:** change app-wide switches — Trip Agent access, the planner beta, the AI model and the map.
**Primary action:** Save changes (enabled only when something changed), with Discard.
**Changed:** a failed load offers Reload in place; leaving with unsaved changes warns.

### AI benchmark — `/admin/ai-benchmark`
**Job:** run one trip request against several models, then judge and compare the results to
choose the models the planner uses.
**Primary action:** Run N models (header, reachable from every tab); Stop runs while runs are
active.
**Layout:** tabs Runs (default when a session exists) | Compare | Setup · Runs: 4 tiles,
filters, run table with inline rating, run inspector sheet · Compare: per-model comparison plus a
7-day leaders snapshot · Setup: template, models, execution.
**Changed:** returns land on results instead of Setup; one run inspector replaced two modals and
the inline comment editor; "Start a new session" exists (the session name field did nothing
once a session was loaded); creating a custom template is reachable again.
**Follow-ups:** a session switcher; `?run=` deep link; whether the 7-day leaders should live only
on AI telemetry.

### AI telemetry — `/admin/ai-benchmark/telemetry`
**Job:** check whether AI generation is healthy and what it costs, and pick which models and
providers to prefer.
**Primary action:** none — read-only; the filters are the main control.
**Layout:** filter toolbar (Window, Source, Provider) · 4 tiles (Calls, Success rate, Avg duration,
Cost) · tabbed trend chart beside top failure codes · spend this month · Compare (Models |
Providers tables; leader chips re-sort) · recent calls · benchmark comments.
**Changed:** four leaderboards, a donut and three provider charts became one sortable comparison
table; "Failure rate" (100 − success) dropped.
**Follow-ups:** totals are approximate past the 2,000-row cap; failure codes cover the latest 120
rows.

### Worker health — `/admin/ai-benchmark/worker-health`
**Job:** know at a glance whether async trip generation is draining its queue, and if not, why.
**Layout:** one status header (Healthy / Degraded / Failing, the reason, four signals:
Heartbeat, Queue, Canary, Self-heal) · recent checks table with filters and pagination.
**Changed:** six tiles and an explainer card became the single status header.

### OG tools — `/admin/og-tools`
**Job:** see what a link looks like when shared, and manage trip sharing videos.
**Primary action:** Inspect (default tab).
**Layout:** tabs Inspect a URL | Trip video | Playground | Build commands (`?tab=`, `?trip=`).

### Design system — `/admin/design-system-playground`
**Job:** one place to see every shared component and state, including the admin pieces (Admin
workspace tab: stat cards, section header, status badges, empty/error states, charts, bar list,
detail sheet, selection bar, pagination).

### Component playground — `/admin/component-playground` (unlisted)
**Job:** tune replicas of public-site sections and cards and turn a state into a code snippet.
Kept separate from the design system on purpose: it is a lab for public pages, not the
catalogue of shared primitives. Noindex and out of the navigation.

### Access denied — `/admin/access-denied`
**Job:** tell a signed-in non-admin they have no access and send them somewhere useful.
