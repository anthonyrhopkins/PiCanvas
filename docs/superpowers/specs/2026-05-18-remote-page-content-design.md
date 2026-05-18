# Remote Page Content — Design Spec

**Date:** 2026-05-18
**Status:** Approved for implementation planning
**Author:** Anthony Hopkins (with Claude)

## Goal

Let a PiCanvas tab surface live content from *another* SharePoint page — a whole page, one or more sections, or one or more webparts — with the same fidelity as today's local `webpart` and `section` content types. Driving use case: cross-site portal aggregation, pulling dashboards and webparts from specialized pages into a unified portal view.

## Background

PiCanvas's existing `webpart` and `section` content types relocate elements that already exist in the *current* page's DOM. SharePoint's runtime renders those webparts; PiCanvas just moves them. That approach can't extend to a remote page directly, because remote webparts haven't been instantiated anywhere — and SharePoint webparts can't be rendered without the SharePoint runtime.

The only path to "render a remote SharePoint page" is to load it in a browser context — an iframe. Same-origin policy (same SharePoint tenant) lets us reach into the iframe's DOM and either clip the view or clone elements out.

## Scope

**In scope (v1):**
- New tab content type: `'remote'`
- Two render modes per tab: **Live** (iframe with CSS clipping) and **Snapshot** (DOM clone, optional auto-refresh)
- One source URL per tab, with one or more selections (sections, webparts, or "whole page") from that URL
- Picker UX: paste URL → load in hidden iframe → list detected sections/webparts → user checks selections
- Same-tenant sources only

**Out of scope (v1, may revisit):**
- Cross-tenant sources
- Drag-to-reorder of stacked selections (defaults to source DOM order)
- Visual thumbnails in picker (text labels only)
- Pre-render snapshot caching across page loads
- Mixing multiple source URLs in a single tab

## Architecture

### New content type

Add `'remote'` to `TabContentType` in `src/webparts/piCanvas/models/TemplateModels.ts`. Existing `'webpart'` and `'section'` types continue to operate on the local page unchanged.

### Tab properties

Stored per-tab using the existing `tab{N}*` property-pane pattern:

| Property | Type | Notes |
|---|---|---|
| `tab{N}RemoteUrl` | string | Source SharePoint page URL |
| `tab{N}RemoteMode` | `'live' \| 'snapshot'` | Render strategy |
| `tab{N}RemoteSelections` | JSON string | Array of `{ kind: 'section' \| 'webpart' \| 'page', id: string, label: string }` |
| `tab{N}RemoteRefreshSec` | number | Snapshot mode only; `0` = no auto-refresh; minimum non-zero value is 30 |

### Component breakdown

- **`services/RemoteContentService.ts`** — owns iframe lifecycle, DOM probing, CSS injection, clone logic.
  - Public surface: `mount(host: HTMLElement, config: RemoteConfig): { destroy(): void }`
  - Single entry point keeps the new code isolated and testable independent of `PiCanvasWebPart.ts`.
- **`configPanel/RemotePagePicker.ts`** — picker dialog (URL input, Load button, selection checklist, mode toggle, refresh-interval dropdown).
- **`configPanel/sections/TabBuilderSection.ts`** — small new sub-section in the tab config when `contentType === 'remote'`: shows current URL, mode, selection count, "Configure source" button that opens the picker.
- **`PiCanvasWebPart.ts`** — dispatches `contentType === 'remote'` to `RemoteContentService.mount` in the render path; calls `destroy()` on tab removal and unmount.

### Same-tenant constraint

Both modes need same-origin DOM access (live mode injects CSS into the iframe; snapshot mode clones elements out). Cross-tenant pages are rejected in the picker with a clear error. Detection: compare iframe origin to host origin after the page loads; if `iframe.contentDocument` access throws, treat as cross-origin.

## Config UX

### Picker flow

Launched from the tab's content-type settings when `'remote'` is selected.

1. User pastes a SharePoint page URL, clicks **Load page**.
2. Picker spawns a hidden iframe (`display: none`, 1200×2000) pointing at the URL.
3. **Same-tenant validation** — origin check. Cross-tenant → "Cross-tenant pages aren't supported yet." Abort.
4. **Wait for render** — poll for `document.readyState === 'complete'` plus the appearance of at least one `[data-section-id]` element. 15s timeout.
5. **Probe DOM:**
   - Synthetic top option: **Whole page**.
   - Sections: `.CanvasSection[data-section-id]` → label `Section 1`, `Section 2`, … with column count hint.
   - Webparts: `[data-sp-feature-instance-id]` or `[data-automation-id="webpart"]` → label from `aria-label` or detected title; fallback to webpart type.
6. **Selection list** — checkboxes grouped by section. User checks one or more.
7. **Mode toggle** — radio: **Live (iframe)** / **Snapshot (clone)**. Snapshot mode reveals refresh-interval dropdown (Never / 30s / 1m / 5m / 15m).
8. **Save** — selections written to `tab{N}RemoteSelections` (JSON), URL + mode + refresh interval to their respective properties.

### Re-editing

Re-opening the picker on a configured tab re-loads the source page and pre-checks saved selections. Selections whose IDs no longer exist on the source page show as "(missing)" so the user knows to re-pick.

### Error / empty states (in picker)

| Condition | Message |
|---|---|
| Page failed to load | "Page didn't load — check the URL and your permissions." |
| Cross-tenant | "Cross-tenant sources aren't supported yet." |
| No selectable elements | "This page has no detectable sections or webparts." |

## Live mode rendering

When a tab with `contentType: 'remote'` and `mode: 'live'` becomes active:

1. **Mount iframe** into the tab body — `width: 100%`, dynamic height, no border, `loading="eager"` for the active tab and `"lazy"` for inactive ones (lazy mount: don't create the iframe at all until first activation).
2. **Wait for ready signal** — same heuristic as picker. Show a skeleton/spinner during load.
3. **Inject stylesheet** into the iframe's `<head>` (same-origin allows it). Three jobs:
   - **Hide SharePoint chrome:** `#SuiteNavWrapper, [data-automation-id="pageHeader"], .spSiteHeader, #spLeftNav, #spCommandBar { display: none !important; }` — full selector list lives in a `CHROME_SELECTORS` constant in the service.
   - **Hide non-selected sections** — compute the "keep" set = all sections explicitly selected ∪ all sections containing a selected webpart. Generated rule:
     ```css
     .CanvasSection:not([data-section-id="A"]):not([data-section-id="B"]) { display: none !important; }
     ```
   - **Hide non-selected webparts within kept sections** — only sections that were kept *because of a webpart selection* get webpart-level filtering applied. Sections kept because they were explicitly selected show all their webparts. Rule applied per-section using a class scope.
   - **"Whole page" precedence** — if a "Whole page" selection is present, section/webpart filtering is skipped entirely and only chrome is hidden. Mixing "Whole page" with other selections is allowed but the others have no effect.
4. **Auto-size iframe to content** — after CSS injection, set iframe height to `iframe.contentDocument.documentElement.scrollHeight`. Attach a `ResizeObserver` to the iframe body to re-measure when content reflows (data loads, accordions expand, etc.).
5. **Selection order** — follows source page's natural DOM order (we're hiding, not reordering). v1 ships without reorder UI.
6. **Tab switching** — keep iframe mounted across tab switches (hide via `display: none` on the tab panel). Preserves React state and avoids re-renders.

**Why one iframe with CSS hiding** (vs. one iframe per selection): one network load, one runtime, all selected webparts stay live and interactive, and cross-section interactions on the source page continue to work.

## Snapshot mode rendering

When a tab with `contentType: 'remote'` and `mode: 'snapshot'` becomes active:

1. **Hidden iframe** mounted off-screen (`position: absolute; left: -99999px;`) at the source URL. Width matches the tab's expected width so layout matches.
2. **Wait for ready signal** — same heuristic (readyState + sections present + 15s timeout).
3. **Clone targets** — for each saved selection, locate the element by ID, `cloneNode(true)`, append into the tab body in source-page order. For "Whole page", clone the main canvas container.
4. **Style fidelity** — cloned elements lose their stylesheet context. Approach:
   - Append the iframe's `<style>` and `<link rel="stylesheet">` nodes into a scoped wrapper around the clones (scoped via a unique class prefix on the wrapper to prevent bleed into the host page).
   - Fall back to `getComputedStyle` inlining only if scoped stylesheet injection produces poor results. Decision deferred to implementation; start with scoped stylesheets.
5. **Destroy iframe** after clone completes — snapshot doesn't need it alive. Frees memory.
6. **Auto-refresh** — if `tab{N}RemoteRefreshSec > 0`, `setInterval` re-runs steps 1–5. Atomic swap: build the new clone tree, swap into the DOM, dispose old, to avoid flicker. Interval cleared on tab unmount. Minimum non-zero interval: 30s.
7. **Manual refresh button** — small refresh icon in the tab header. Forces immediate re-clone. (v1: always visible in edit mode; viewer visibility deferred to config option in a later iteration.)

### Static-content caveat

Dynamic webparts in a snapshot are static HTML — charts, list views, nested PiCanvas instances, etc. won't update or respond to clicks. The picker warns when a selected webpart matches a known dynamic-webpart heuristic and suggests live mode.

## Constraints, errors, lifecycle

### Same-tenant enforcement

- Picker validates URL origin matches host origin before loading.
- `RemoteContentService` re-validates at render time — if the iframe redirects cross-origin, `iframe.contentDocument` access throws; the service catches and surfaces an error state.

### Permission boundaries

- The source page loads under the current user's SP identity. If the user lacks access, the iframe loads SP's "Access denied" page.
- Detect by checking for known SP error elements in the iframe DOM after load; replace with a clean "You don't have access to this page" message.

### Selection drift

- Section / webpart IDs can change if the source page is edited heavily.
- At render time, missing selection IDs are logged and skipped.
- If *all* selections are missing: "Selected content no longer exists on the source page — re-pick in tab settings."

### Lifecycle

- `RemoteContentService.mount(host, config)` returns `{ destroy }`.
- PiCanvas calls `destroy()` on tab removal, page unload, or re-config.
- Live iframes persist across tab switches (hidden via `display: none`); destroyed on tab removal.
- Snapshot refresh intervals cleared on destroy.

### Performance guardrails

- Only the active tab loads eagerly; inactive remote tabs lazy-mount (no iframe created until first activation).
- One iframe per tab maximum (multiple selections handled by CSS hiding inside the single iframe).
- Snapshot refresh minimum interval: 30s.

### Tab-body error states

Clean inline messages — never raw errors:

| Condition | Message |
|---|---|
| Load timeout (15s) | "Source page didn't finish loading. [Retry]" |
| Access denied | "You don't have access to this page." |
| Cross-tenant detected | "Cross-tenant sources aren't supported yet." |
| All selections missing | "Selected content no longer exists. [Open tab settings]" |

### Edit-mode UX

In SharePoint edit mode, an outline appears around the remote-content area with a label like *"Remote: /sites/Foo/SitePages/Bar.aspx · 3 selections · Live"* — so editors see what's wired up without opening the config panel.

## Testing approach

- Manual: in the dev workbench, configure a remote tab pointing at another page on the dev site (`https://sap.sharepoint.com/sites/213644/SitePages/UnderTheHood.aspx`). Verify each combination of: section selection, webpart selection, whole-page selection, live mode, snapshot mode, manual refresh, auto-refresh, missing-selection drift, cross-tenant rejection, access-denied source.
- The existing PiCanvas codebase doesn't carry automated tests for content-type rendering; remote content matches that pattern in v1.

## Files touched

- **Modified:**
  - `src/webparts/piCanvas/models/TemplateModels.ts` (add `'remote'` to `TabContentType`)
  - `src/webparts/piCanvas/PiCanvasWebPart.ts` (dispatch `remote` content type; lifecycle hooks)
  - `src/webparts/piCanvas/configPanel/sections/TabBuilderSection.ts` (remote-config sub-section)
- **New:**
  - `src/webparts/piCanvas/services/RemoteContentService.ts`
  - `src/webparts/piCanvas/configPanel/RemotePagePicker.ts`
