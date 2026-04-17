# Trip Budgeting and Expense Split

## Status
Open issue: [#345](https://github.com/chrizzzly87/travelflow/issues/345)

## Objective
Add lightweight budgeting, spend tracking, and group split flows so TravelFlow can support practical trip planning beyond itinerary shape alone.

## Why
- Wanderlog is stronger on budgeting today.
- Budgeting creates repeat-use value before and during the trip.
- Shared trip planning becomes much more useful when costs can be discussed alongside itinerary choices.

## Scope
1. Budget model
- Set trip-level target budget and category budgets.
- Support common categories:
  - transport
  - accommodation
  - food
  - activities
  - misc

2. Cost attachment
- Attach estimated or actual cost to planner items.
- Show per-day and per-trip totals.
- Distinguish estimate vs confirmed spend.

3. Shared expense split
- Add traveler list for shared trips.
- Split selected costs evenly or by custom participant selection.
- Track paid-by and owes state at a lightweight level.

4. Planner and summary surfaces
- Show budget burn and category totals in trip view and trip summaries.
- Add quick warnings when selected changes push the trip meaningfully above target budget.

5. Analytics
- Track budget creation, category updates, cost attachment, and split usage.

## Non-Goals
- Full accounting or reimbursement workflows.
- Currency exchange automation in V1.
- Invoice scanning in V1.

## Acceptance Criteria
- Users can set a trip budget and see totals update as costs are added.
- Costs can be attached to planner items without breaking current trip editing flows.
- Shared trips can record who paid and who shares a cost in a basic, durable format.
- Regression coverage exists for totals, split math, and trip-item cost attachment.

## Suggested Labels
- `enhancement`
- `priority:medium`
- `area:planner`
- `area:product`
- `type:feature`
- `effort:medium`
