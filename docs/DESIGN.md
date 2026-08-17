# Internal Dashboard Design

This is the design contract for TravelFlow admin and operations interfaces. Internal tools should feel calm, precise, and task-oriented: compact enough for regular use, but never visually cramped.

## Product principles

1. **Lead with the task.** Put the page title, current state, and one primary action in the first visual group.
2. **Keep context in view.** Prefer inline summaries and contextual modals or sheets over sending admins to separate pages for supporting detail.
3. **Design for scanning.** Use aligned columns, stable labels, tabular numbers, and tables for repeated records.
4. **Use progressive disclosure.** Keep JSON, diagnostics, advanced controls, and destructive actions available without making them compete with the main workflow.
5. **Make system state explicit.** Loading, queued, running, saved, disabled, and error states need plain labels; color is supporting information, not the only signal.

## Page structure

Use this hierarchy for configuration and data-heavy pages:

1. Page header: title, concise purpose, and optional page-level status.
2. Navigation or tabs: only when they separate distinct jobs.
3. Primary workspace: one surface containing the task flow and primary action.
4. Supporting data: tables, charts, or logs below or in a dedicated tab.
5. Contextual detail: modal, sheet, or inspector for JSON and diagnostics.

Avoid card grids when the controls form one workflow. Nested cards should be rare; use dividers, section headings, and subtle inset backgrounds inside one surface instead.

## Geometry and density

- Use a 4 px spacing base. Prefer 8, 12, 16, 24, and 32 px gaps.
- Standard controls are 36–40 px high; dense table actions may be 28–32 px.
- Inputs and buttons use `rounded-md` (about 6 px).
- Panels and data containers use `rounded-lg` (about 8 px).
- Dialogs may use up to 12 px on desktop. Avoid large, soft 16–24 px radii in admin UI.
- Pills are reserved for status, tags, filters, and compact counts—not general buttons or containers.
- Use one-pixel neutral borders. Reserve shadows for true elevation such as menus and dialogs.

## Typography and copy

- Use sentence case for headings, labels, buttons, and table headers.
- Page titles establish hierarchy; section titles should usually be 14–16 px semibold.
- Helper copy should answer a decision-relevant question, not restate the label.
- Keep technical identifiers secondary and selectable. Do not let them overpower human-readable names.
- Use `tabular-nums` for elapsed time, money, percentages, counts that update, and aligned metrics.

## Controls and actions

- Use the existing shadcn-based components and semantic design tokens.
- Each surface gets one visually dominant action. Secondary actions use outline or ghost treatment.
- Align related controls to the same height and label baseline.
- Use a compact horizontal control strip on wide screens and a single-column stack on small screens.
- Group destructive actions away from common actions and require the shared confirmation dialog for destructive bulk changes.
- Do not use native `select`, prompt, confirm, or alert UI.

## Tables and repeated records

- Use tables when records share three or more comparable fields or actions.
- Keep the primary identity in the first column and row actions at the inline end.
- Put switches, per-row configuration, and status in dedicated columns instead of encoding them in crowded chips.
- Use a sticky header or bounded scroll area for long operational lists when it preserves page context.
- Empty states should explain the next available action in one sentence.

## Progressive disclosure and technical data

- Show the selected template or configuration as a concise summary in the main flow.
- Put editable JSON, schema detail, provider errors, and prompt previews in a modal, sheet, or inspector.
- Syntax-highlight read-only structured data and use a monospace editor treatment for editable data.
- Keep overview metadata above technical detail so admins can confirm context before inspecting payloads.

## Live data and performance

- Isolate frequently updating values so a timer or progress indicator does not re-render the whole page.
- Update human-readable elapsed timers once per second unless sub-second precision affects a decision.
- Keep server polling separate from local elapsed-time display.
- Preserve control state during refreshes and show when data was last synchronized.

## Responsive and direction-aware behavior

- Collapse control strips into a logical reading order on narrow screens.
- Keep primary actions reachable without horizontal scrolling.
- Prefer logical properties and utilities such as padding-inline/start/end where direction may change.
- Verify overflow, focus order, dialog sizing, and table actions at desktop and mobile widths.

## Review checklist

- Is there one obvious primary task and action?
- Can an admin scan the current state without opening every detail?
- Are repeated items aligned in a table or consistent list?
- Are advanced and destructive actions visually subordinate?
- Are radii, borders, spacing, and control heights consistent?
- Do loading, empty, error, queued, and disabled states remain understandable without color?
- Does live updating avoid unnecessary page-wide rendering?
- Does the layout work with keyboard navigation, narrow screens, and logical direction?
