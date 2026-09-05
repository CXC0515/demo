---
name: demo-responsive-product-design
description: Design, review, or refactor adaptive product interfaces that must work across desktop, tablet, and mobile, especially multi-pane workspaces, readers, data tables, graphs, drawers, and other information-dense UI. Use for responsive product behavior and UI acceptance criteria; do not use for visual restyling that has no layout or interaction impact.
---

# Responsive Product Design

Create an adaptive product experience, not a scaled-down desktop screen. Preserve the user's task, context, and control while changing information composition to match the available space.

## Start from evidence

1. Read the repository's design contract when one exists. In DEMO, read `docs/design.md` before proposing or implementing UI changes.
2. Inspect the current page, relevant components, data state, and real behavior at representative sizes.
3. Separate confirmed facts, assumptions, product decisions, and implementation choices.
4. Identify the primary user task and the smallest complete feedback loop before choosing a layout.

Do not infer that a requested CSS adjustment is the real product solution. If the current information architecture cannot support a compact viewport, propose the smaller structural change that preserves the task.

## Choose an adaptive composition

Treat breakpoints as interface capabilities:

- Compact: one persistent primary work surface; move secondary surfaces into drill-down pages, drawers, or bottom sheets.
- Medium: keep the primary surface stable and show contextual tools temporarily or in a limited second pane.
- Wide: allow persistent multi-pane comparison and batch work.
- Extra wide: add useful context without stretching reading content or increasing decorative emptiness.

When converting a desktop pattern:

- multi-pane workspace → primary surface plus contextual layers;
- data table → prioritized cards, segmented rows, or controlled horizontal comparison;
- right inspector → bottom sheet or full-screen detail;
- dense toolbar → stable primary action plus an explicit overflow menu;
- whole graph overview → focused node, semantic zoom, search/index fallback;
- hover action → visible control, selected state, or touch-safe alternative.

Never solve compact layout by shrinking all content, hiding essential actions, disabling zoom, or stacking every desktop pane into one long page.

## Preserve product state

Define which states must survive layout changes, navigation, and temporary overlays. Typical examples are the current object, page, mode, selection, filters, draft input, scroll position, parsing progress, and review status.

Every automated or asynchronous action needs observable progress, a stable result, and a recovery path. Do not make completed, archived, excluded, or failed items disappear without explaining their state.

## Set measurable constraints

Unless the product contract is stricter:

- use at least 44 × 44px touch targets;
- keep mobile form inputs at least 16px;
- keep ordinary body text at least 14px and auxiliary text at least 12px;
- support dynamic viewport height, safe areas, soft keyboards, landscape, 200% browser zoom, and reduced motion;
- avoid nested scrolling and fixed-height viewport arithmetic when flex/grid can allocate real remaining space;
- preserve existing content during refresh or page transitions instead of flashing a blank surface.

Treat these as acceptance floors, not a visual design system.

## Work within authorization

Design documentation, prototypes, and production code are separate mutation scopes. A request to assess or design does not authorize implementation. Before changing files, follow the repository's approval rules and state the files, scope, risks, alternatives, and validation plan.

When implementation is approved, prefer shared responsive primitives over isolated breakpoint patches, and preserve unrelated user changes.

## Validate behavior

For a detailed review, read [references/adaptive-review.md](references/adaptive-review.md). Select representative sizes around actual layout transitions; do not test only named devices.

At minimum verify:

- the primary task completes in compact, medium, and wide modes;
- text and controls remain readable and reachable;
- no accidental horizontal overflow or clipped primary surface exists;
- state survives resizing and opening/closing contextual layers;
- loading, empty, error, long-content, and keyboard states remain usable;
- desktop batch efficiency is not sacrificed merely to make the phone screenshot clean.

Report observed evidence separately from recommendations, and name any untested device or platform assumption.
