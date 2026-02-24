This PR completes a comprehensive overhaul of the Admin Dashboard and Telemetry pages, introducing Shadcn admin styling, advanced data visualization, and quality-of-life UI improvements.

### 🎨 Design & Layout
*   **Persistent Sidebar**: Adjusted `AdminShell` to ensure a sticky, full-height (`h-dvh`) layout. Fixed z-index layering issues for the collapse/expand caret.
*   **Table Restyling**: Completely refactored `AdminUsersPage` and `AdminTripsPage` to use Shadcn/UI `Table` components. Removed heavy black borders and implemented subtle row highlighting (`hover:bg-slate-50/50`) for a cleaner look.
*   **Filter Menus**: Replaced generic selects with Shadcn-style faceted filter menus (dashed borders, compact styling) for Tier and Login type filtering.

### 📊 Dashboard & Telemetry
*   **Engaging Metrics**: Redesigned the main Admin Dashboard overview to feature modern, card-based metric presentation with count-up animations for Total Users and Total Trips.
*   **Deep Linking**: Added navigable links from the recent users list directly into their associated drawer profiles.
*   **Cost Tracking**: Introduced a new 'Total Cost per Day' metric and interactive `BarChart` on the AI Telemetry page, utilizing Tremor components for visualizing Edge Function aggregation data.

### 🗂️ Drawers & Data Visualization
*   **JSON Eradication**: Replaced raw JSON textareas with native visual editor cards on the `AdminTiersPage`. Toggles and numeric inputs are now used to construct and update the configuration object visually.
*   **Admin Drawers**: Overhauled the Trip and User details right-side drawers to use structured cards, badge statuses, and copyable UUIDs.
*   **Trip Previews**: Added a visual trip preview to the Admin Trip Drawer consisting of an interactive map and a timeline itinerary. In cases where the mocked full trip data lacks location coordinates, the UI gracefully falls back to an example template (Thailand) to guarantee the preview renders for admins to review.

### 🤖 LLM & Benchmark Focus
*   **Structured Output**: The `AdminAiBenchmarkPage` was significantly simplified. Scenario details and LLM evaluation runs are now neatly organized into manageable collapsible sections (Accordions/Tabs) instead of dumping massive unformatted JSON objects onto the screen. This drastically improves the readability of LLM evaluation results and allows for easier manual verification.
