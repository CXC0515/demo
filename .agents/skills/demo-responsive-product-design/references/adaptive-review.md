# Adaptive UI Review

Read this checklist when auditing an existing interface, preparing a responsive design specification, or validating an implementation. Use only the sections relevant to the task.

## 1. Task and state inventory

- What is the user's primary task on this page?
- Which object supplies the current context?
- Which actions are frequent, high-risk, or reversible?
- Which states must survive navigation and resizing?
- What is the complete input → execution → observation → correction loop?

If these answers are unclear, do not begin by moving components.

## 2. Layout audit

Search for likely structural constraints:

- fixed widths and desktop-only grid templates;
- `100vh` arithmetic and large minimum heights;
- nested `overflow: auto` containers;
- absolute positioning used as the primary layout system;
- permanent inspectors or sidebars on compact screens;
- controls that exist only on hover;
- text below the project's readable minimum;
- tables without a compact representation;
- canvas or graph `fitView` behavior that produces unreadable labels.

Determine whether each issue is local or evidence of a missing shared primitive.

## 3. Composition matrix

For each major region, record its behavior:

| Region | Compact | Medium | Wide | Persistent state |
| --- | --- | --- | --- | --- |
| Primary work surface |  |  |  |  |
| Context selector |  |  |  |  |
| Navigation |  |  |  |  |
| Inspector/details |  |  |  |  |
| Filters and search |  |  |  |  |
| Primary action |  |  |  |  |

An empty cell is an unresolved product decision, not an implementation detail.

## 4. Interaction audit

- Touch targets meet the design contract.
- The primary action stays findable and does not move unpredictably between states.
- Destructive actions are separated from common actions and receive proportional confirmation.
- Opening a drawer, sheet, or dialog moves focus appropriately; closing returns focus.
- Soft keyboards do not cover the active field or submission controls.
- Browser back and explicit back actions have understandable, consistent results.
- Gestures have visible alternatives.

## 5. Content and accessibility audit

- Labels remain meaningful without nearby desktop context.
- Status is conveyed with text or icons as well as color.
- Truncation has a way to reveal the full value.
- Dynamic type and 200% zoom do not remove functionality.
- Reading order matches visual order.
- Graphs, charts, and maps have a searchable or structured alternative when they contain actionable objects.

## 6. Async and transition audit

- Existing content remains visible during background refresh when safe.
- Skeletons reserve stable space and do not produce layout jumps.
- Multi-stage work shows the current stage and meaningful elapsed time.
- A local failure does not block unrelated usable regions.
- Retry does not duplicate a mutation.
- Completion, deletion, archiving, and exclusion remain distinguishable.

## 7. Size and environment matrix

Choose a matrix that covers actual capability changes. A useful baseline is:

- 375 × 812 and 390 × 844: compact portrait;
- 430 × 932: large compact portrait;
- 844 × 390: compact landscape and low height;
- 768 × 1024: medium portrait;
- 1024 × 768: medium landscape or narrow desktop;
- 1440 × 900: wide desktop;
- 200% browser zoom;
- iOS Safari and Android Chrome when the product targets mobile browsers.

For every tested size, record the task, result, defect, and evidence. A screenshot alone does not prove the workflow completes.

## 8. Reporting format

Keep the report decision-ready:

1. Outcome and primary contradiction.
2. Confirmed evidence from code and behavior.
3. Assumptions and untested conditions.
4. Recommended adaptive composition.
5. Smallest implementation path and alternative.
6. Files or primitives affected.
7. Risks and validation results.

Do not present aesthetic preference as a correctness defect. Tie every required change to task completion, readability, accessibility, state continuity, or operational stability.
