---
name: ds-create-guide
description: Create interactive, action-driven hands-on guides for FDShowStudio using InteractiveSpotlight, pure state machines, globalEventBus hooks, GuideHubModal registration, strict tag governance, 4-language i18n, and Vitest coverage.
---

# Interactive Hands-On Guide Builder (`ds-create-guide`)

Use this skill whenever adding or updating a user guide in FDShowStudio so every guide follows the **"hand-holding" (action-driven)** standard instead of passive slide-by-slide reading.

---

## 1. Core Principles

1. **Action-Driven Over Passive**:
   - Guides MUST teach by making the user perform each real action in the workspace (clicking buttons, selecting blocks, opening context menus, importing files, pressing Space/Play).
   - Advance steps automatically via domain events on `globalEventBus` (`../../../src/core/EventBus.js`).
   - Do NOT rely on generic `Next` -> `Next` -> `Finish` buttons unless waiting on an unobservable external step (such as downloading a folder in an external browser, which must provide a waiting confirmation button plus a skip/already-have path).
2. **Prevent Deadlocks With Preconditions**:
   - Check workspace state before starting. If the timeline lacks required elements (for example, fewer than 2 blocks for a multi-select guide), seed sample blocks automatically on start.
   - Never advance past a file dialog or OS prompt unless the action actually succeeded (if the user clicks Cancel on Save/Open, keep the current step active).
3. **Strict Tag Reuse Governance**:
   - Always check `GUIDE_TAGS` in [GuideHubModal.js](../../../src/ui/GuideHubModal.js) before creating a tag.
   - Reuse existing tags whenever possible:
     - `important`: Essential core workflows (pinned to the top of the list).
     - `basic`: Foundational hands-on operations every user should learn.
     - `intro`: Passive UI overview walkthroughs.
   - **Only add a new tag when truly necessary and meaningfully distinct** (for example, a new functional domain such as `audio`, `drone`, or `effects` that existing tags cannot represent). Never create redundant synonym tags.

---

## 2. Standard Architecture

Every interactive guide consists of three decoupled parts:

1. **Pure State Machine** (`src/ui/<GuideName>StateMachine.js`):
   - Zero DOM dependencies; accepts `eventBus` (and optional `storage`) via constructor injection.
   - Tracks `currentStep`, live progress metrics (e.g., `selectedCount`), and transient UI states (e.g., `activeContextMenuType`, `activeContextMenuElement`).
   - Subscribes via `bindEvents()` and cleans up every listener via `unbindEvents()` on `complete()`, `dismiss()`, and `destroy()`.
2. **Flow Controller** (`src/ui/<GuideName>Flow.js`):
   - Instantiates the state machine and the shared [InteractiveSpotlight.js](../../../src/ui/InteractiveSpotlight.js) presenter (never duplicate spotlight `highlightBox` or `tooltipCard` DOM logic).
   - Ensures target containers are visible (for example, calling `timelineEditor.toggle()` if hidden) and enforces preconditions before starting the state machine.
   - Provides live progress strings (`progressText`) and dynamic sub-targets (for example, shifting spotlight onto `[data-action-id="..."]` when a context menu opens).
3. **Hub Registration** ([GuideHubModal.js](../../../src/ui/GuideHubModal.js)):
   - Add the entry in `getDefaultGuides()` (or via `registerGuide()`).
   - `GuideHubModal` closes itself before invoking `guide.execute()` so modal overlays and `Escape` listeners never collide with spotlight overlays.

---

## 3. DOM, Layering, and Event Pitfalls (Lessons Learned)

- **Stacking Context Safety**: `TimelineEditor` sits inside `zIndex: 1000`. Never block pointer events with a full-screen `pointer-events: auto` backdrop expecting child elements to punch above it via `zIndex`. `InteractiveSpotlight` keeps `highlightBox` at `pointer-events: none` (`zIndex: 100015`) with a `9999px` box-shadow backdrop and `tooltipCard` at `zIndex: 100020`.
- **Context Menu Z-Index & Click Handling**: [TimelineContextMenu.js](../../../src/ui/TimelineContextMenu.js) uses `zIndex: 100018` so open menus render brightly above `highlightBox`, ignores `pointerdown` inside `.interactive-spotlight-tooltip`, and attaches `data-action-id` to every menu item so guides target items by ID rather than localized label text.
- **Keep Search Input Focus Intact**: In `GuideHubModal`, controls (`searchInput`, `tagsContainer`) are mounted separately from `listContainer`. Filtering only re-renders `listContainer`.
- **Vietnamese Search Normalization**: `GuideHubModal` uses `normalizeSearchText` (mapping `đ`/`Đ` to `d`/`D` before NFD accent stripping) across title, description, and tag labels. Keep guide titles, descriptions, and tags clear and keyword-accurate.

---

## 4. Step-by-Step Implementation Checklist

1. **Verify or Emit Domain Events**:
   - Reuse existing `globalEventBus` events where available (`timeline:selection-changed`, `timeline:context-menu-shown`, `timeline:context-menu-hidden`, `timeline:blocks-exported`, `timeline:json-imported`, `timeline:show-loaded`, `timeline:playback-started`, `scripts:folder-scanned`).
   - If a new event is needed in [TimelineEditor.js](../../../src/ui/TimelineEditor.js) or another module, emit it only after the user action completes (not on cancel/error).
2. **Implement State Machine & Flow**:
   - Create `src/ui/<GuideName>StateMachine.js` and `src/ui/<GuideName>Flow.js` using [ReuseBlocksStateMachine.js](../../../src/ui/ReuseBlocksStateMachine.js) and [ReuseBlocksGuideFlow.js](../../../src/ui/ReuseBlocksGuideFlow.js) as the reference pattern.
   - Follow single-property-per-line formatting for multiline calls, arrays, and objects.
3. **Wire Into Timeline & GuideHubModal**:
   - Instantiate the flow on `TimelineEditor` and register the guide card in [GuideHubModal.js](../../../src/ui/GuideHubModal.js).
   - Assign tags from `GUIDE_TAGS`. If adding a truly distinct new tag, add its metadata entry (`id`, `label`, `order`, `bg`, `color`, `border`) in `GUIDE_TAGS`.
4. **Localize Across All 4 Languages**:
   - Add keys in [en.js](../../../src/config/lang/en.js), [vi.js](../../../src/config/lang/vi.js), [zh.js](../../../src/config/lang/zh.js), and [ja.js](../../../src/config/lang/ja.js).
   - Keep English as the canonical fallback in code (`t('...') || 'English text'`).
   - Do NOT use parentheses `(...)` or icons/emojis in any UI text or translation string.
5. **Write Unit Tests & Verify**:
   - Create `tests/ui/<GuideName>.test.js` covering:
     - Full step-by-step state transitions and listener cleanup on completion.
     - Guard conditions (insufficient selection, canceled dialogs, step revert when preconditions break).
     - Clean `dismiss()` unsubscribing all `globalEventBus` listeners.
     - Flow precondition setup (for example, seeding sample blocks when timeline is sparse).
   - Update [GuideHubModal.test.js](../../../tests/ui/GuideHubModal.test.js) if default guide count/tags changed (ensure mock elements clear `children` when `innerHTML = ''` is set).
   - Run `npx vitest run` on affected UI tests (or `npm test`) and `npm run build` to confirm zero regressions.
