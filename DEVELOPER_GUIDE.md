# PiCanvas Developer Guide

This guide covers the internal architecture for developers who want to extend PiCanvas or understand how its rendering pipeline works. For end-user API docs (graphFetch, render(), etc.), see the [JavaScript Sandbox API](README.md#javascript-sandbox-api) section in the README.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Content Type Rendering Pipeline](#content-type-rendering-pipeline)
3. [JavaScript Sandbox (Content Type)](#javascript-sandbox-content-type)
4. [HTML File Assets (Content Type)](#html-file-assets-content-type)
5. [Adding a Bundled Library](#adding-a-bundled-library)
6. [Sharing Link Support](#sharing-link-support)
7. [Security Model](#security-model)

---

## Architecture Overview

PiCanvas is a single SPFx web part that renders multiple content types inside a tabbed layout. The key files:

```
src/webparts/piCanvas/
  PiCanvasWebPart.ts              # Main web part — tab management, postRender, Graph API
  services/
    ContentRenderer.ts            # Static rendering methods for all content types
    ProfileReportService.ts       # SharePoint file fetching and report rendering
  models/
    JavaScriptTemplates.ts        # Built-in JS template definitions
  configPanel/
    sections/TabBuilderSection.ts # Config UI for tab content type + settings
  assets/
    m365-archive-calculator.html  # Example: HTML asset using bundled Chart.js
  data/
    ReportTypeRegistry.ts         # Report type definitions for Profile Reports
```

### Rendering Phases

Every content type goes through two phases:

1. **Pre-render** — `ContentRenderer` returns an `IRenderResult` containing:
   - `html` — the markup to inject into the DOM
   - `requiresPostRender` — whether phase 2 is needed
   - `postRenderType` — which post-render handler to call

2. **Post-render** — after the HTML is in the DOM, `PiCanvasWebPart` runs the appropriate handler:
   - **mermaid** — calls `ContentRenderer.renderMermaidElement()` to render SVG
   - **javascript** — calls `ContentRenderer.executeJavaScriptElement()` to run sandboxed code
   - **landing** — calls `ContentRenderer.initLandingAnimations()` for scroll/observer setup
   - **toc** — scans headings and builds interactive table of contents
   - **rss** — async fetch + render of RSS feeds

Post-render handlers are triggered in `PiCanvasWebPart.initializeMermaidElements()` which scans the active tab panel for elements with specific CSS classes (`.picanvas-mermaid-container`, `.picanvas-js-container`, `.picanvas-toc-wrapper`, etc.).

---

## Content Type Rendering Pipeline

### How a tab's content reaches the DOM

1. User configures a tab with a content type (e.g., `file`, `javascript`, `markdown`)
2. In `PiCanvasWebPart._renderInternal()`, the tab builder block (~line 5388) branches on `contentType`
3. The appropriate `ContentRenderer` method is called to produce HTML
4. HTML is injected into a `$contentHost` jQuery element
5. If `requiresPostRender`, the post-render handler runs after DOM insertion

### Adding a New Content Type

1. Add the type to the `ContentType` union in `ContentRenderer.ts`:
   ```typescript
   export type ContentType = 'webpart' | 'section' | 'markdown' | ... | 'yournewtype';
   ```

2. Add a rendering method in `ContentRenderer.ts`:
   ```typescript
   public static renderYourType(content: string): IRenderResult {
     // Return { html, requiresPostRender?, postRenderType? }
   }
   ```

3. Add the branch in `PiCanvasWebPart._renderInternal()` alongside the other `contentType` checks

4. If your type needs post-render, add a handler and wire it into `initializeMermaidElements()`

5. Add the content type option to `TabBuilderSection.ts` (the config panel UI)

6. Add localization strings to `loc/en-us.js` and type definitions to `loc/mystrings.d.ts`

---

## JavaScript Sandbox (Content Type)

When a tab is set to **JavaScript**, the user writes code that PiCanvas executes in a sandboxed `new Function()` scope.

### Execution Flow

1. **Prepare** — `ContentRenderer.prepareJavaScript(code, elementId, displayMode, height)`:
   - Encodes the user's code into a `data-js-code` attribute (HTML-entity encoded)
   - Returns a placeholder `<div class="picanvas-js-container">` with the encoded code
   - Sets `requiresPostRender: true`

2. **Execute** — `ContentRenderer.executeJavaScriptElement(element, graphFetch?, graphScopes?, editButtonConfig?)`:
   - Decodes the code from the data attribute
   - Creates helper functions (`render`, `create`, scoped `document` proxy)
   - Runs the code via `new Function('container', 'render', 'create', 'echarts', 'document', 'graphFetch', 'graphScopes', userCode)`
   - The code runs with these variables in scope — no globals needed

### Available Sandbox Variables

| Variable | Type | Source |
|----------|------|--------|
| `container` | `HTMLElement` | The `.picanvas-js-output` div for this tab |
| `render(html)` | `function` | Sets `container.innerHTML` directly (no sanitization — trusted context) |
| `create(tag, attrs?, children?)` | `function` | DOM element factory with style/event support |
| `echarts` | `module` | Full Apache ECharts library (bundled) |
| `document` | `Proxy<Document>` | Scoped proxy — `querySelector` searches this tab's container first |
| `graphFetch(endpoint, options?)` | `async function` | Authenticated MS Graph calls via MSGraphClientV3 |
| `graphScopes()` | `async function` | Returns array of granted Graph API scopes |

### Display Modes

- **contained** — renders inside the tab's content area (default)
- **fullSection** — `position:fixed` below the SP header (top:146px), navigation stays visible
- **fullScreen** — `position:fixed` covering entire viewport (z-index:999999)

Both fullSection and fullScreen move the element to `document.body` to escape SharePoint's CSS containment. In edit mode, this is disabled to keep the editing UI accessible.

### Adding a New Sandbox Variable

To expose a new variable to JavaScript sandbox code:

1. Add it to the `new Function()` parameter list in `executeJavaScriptElement()`:
   ```typescript
   const sandboxedFunction = new Function(
     'container', 'render', 'create', 'echarts', 'document',
     'graphFetch', 'graphScopes',
     'yourNewVariable',  // <-- add here
     decodedCode
   );
   
   sandboxedFunction(container, render, create, echarts, scopedDocument,
     graphFetch, graphScopes,
     yourNewValue  // <-- pass here
   );
   ```

2. If the variable comes from a package, import it in `ContentRenderer.ts` and pass it through

3. Update the README's sandbox API table

---

## HTML File Assets (Content Type)

When a tab is set to **File** and points to an `.html` file (either a server-relative path or a sharing link), PiCanvas loads the raw HTML and injects it directly — bypassing DOMPurify.

### Execution Flow

1. **Fetch** — `PiCanvasWebPart.fetchAndRenderFileContent()`:
   - **Server-relative path**: fetches via SP REST API (`GetFileByServerRelativeUrl`)
   - **Sharing link**: activates the link via hidden iframe, then resolves via `_api/v2.0/shares/`

2. **Inject** — HTML is injected via `$contentHost.html(content)` (jQuery), not DOMPurify

3. **Script execution** — inline `<script>` blocks are extracted and executed via `new Function(code)()`:
   ```typescript
   const scripts = hostEl.querySelectorAll('script');
   scripts.forEach((orig) => {
     if (orig.src) return;  // External <script src="..."> are SKIPPED
     const code = orig.textContent || '';
     if (code.trim()) {
       new Function(code)();  // Runs in global scope
     }
   });
   ```

4. **Bundled libraries** are exposed on `window` before script execution:
   ```typescript
   (window as any).__picanvasEcharts = ContentRenderer.getEcharts();
   (window as any).Chart = ContentRenderer.getChartJs();
   ```

### Key Differences from JavaScript Sandbox

| | JavaScript Sandbox | HTML File Assets |
|---|---|---|
| **Code entry** | Written in config panel | Loaded from .html file |
| **Execution context** | Sandboxed `new Function` with named params | Global scope via `new Function(code)()` |
| **Library access** | `echarts` as a function param | `window.Chart`, `window.__picanvasEcharts` |
| **HTML sanitization** | `render()` is unsanitized (trusted) | Entire file injected raw (no DOMPurify) |
| **External scripts** | N/A | `<script src="...">` are skipped — bundle instead |
| **CSS** | Injected via `render()` or `container.innerHTML` | `<style>` blocks preserved by jQuery `.html()` |

### Why External Scripts Are Skipped

SharePoint's CSP blocks dynamically created `<script>` elements. PiCanvas works around this by using `new Function()` for inline code. But `<script src="...">` (CDN loads) cannot be replicated this way. Instead, **bundle the library** in the sppkg — see the next section.

---

## Adding a Bundled Library

When an HTML file asset needs a library (e.g., Chart.js, D3, Three.js), bundle it in the sppkg instead of loading from a CDN. This is CSP-compliant and works offline.

### Step-by-Step (Chart.js Example)

**1. Install the package:**
```bash
npm install chart.js --save
```

**2. Import and register in `ContentRenderer.ts`:**
```typescript
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);
```

**3. Add a static getter in `ContentRenderer.ts`:**
```typescript
public static getChartJs(): typeof Chart {
  return Chart;
}
```

**4. Expose to inline scripts in `PiCanvasWebPart.ts`:**

Find the script execution block inside `fetchAndRenderFileContent()` (the `if (fileType === 'html')` branch) and add:
```typescript
(window as any).Chart = ContentRenderer.getChartJs();
```

This must be set **before** the `scripts.forEach(...)` loop that executes inline `<script>` blocks.

**5. Use it in your HTML asset:**
```html
<canvas id="myChart"></canvas>
<script>
// Chart is available on window — no CDN needed
var ctx = document.getElementById('myChart').getContext('2d');
var chart = new Chart(ctx, { type: 'bar', data: { ... } });
</script>
```

**6. (Optional) Also expose to JavaScript sandbox:**

If you want the library available in the JavaScript content type too, add it to the `new Function()` parameter list in `executeJavaScriptElement()` — see [Adding a New Sandbox Variable](#adding-a-new-sandbox-variable).

### Currently Bundled Libraries

| Library | Global name | Sandbox param | Used by |
|---------|-------------|---------------|---------|
| Apache ECharts | `window.__picanvasEcharts` | `echarts` | JS sandbox + HTML assets |
| Chart.js | `window.Chart` | — | HTML assets only |
| Mermaid | — | — | Mermaid content type (internal) |
| marked | — | — | Markdown rendering (internal) |
| DOMPurify | — | — | HTML sanitization (internal) |

---

## Sharing Link Support

PiCanvas can load HTML/Markdown file content via SharePoint sharing links instead of server-relative paths. This allows access control without granting site-level permissions.

### How It Works

1. **Detection** — `PiCanvasWebPart.isSharingLink(url)` checks for the `sharepoint.com/:x:/` pattern

2. **Activation** — SharePoint sharing links require the user to "visit" the link before API access is granted. PiCanvas loads the sharing link in a hidden iframe:
   ```typescript
   const iframe = document.createElement('iframe');
   iframe.style.display = 'none';
   iframe.src = sharingLinkUrl;
   document.body.appendChild(iframe);
   // Wait for load or 5s timeout, then remove
   ```

3. **Resolution** — After activation, the file is resolved via SharePoint's v2.0 shares API:
   ```
   GET {tenantRoot}/_api/v2.0/shares/{encodedToken}/driveItem          → metadata (name, downloadUrl)
   GET {tenantRoot}/_api/v2.0/shares/{encodedToken}/driveItem/content   → file content
   ```

4. **Token encoding** — The sharing URL is base64url-encoded with a `u!` prefix:
   ```typescript
   const base64 = btoa(url).replace(/\//g, '_').replace(/\+/g, '-').replace(/=+$/, '');
   return 'u!' + base64;
   ```

### Sharing Link Format

SharePoint sharing links follow this pattern:
```
https://{tenant}.sharepoint.com/:x:/s/{site}/{token}
```

Where `:x:` is the file type indicator (`:u:` = generic, `:w:` = Word, `:x:` = Excel, etc.).

### Limitations

- The hidden iframe activation adds ~1-5 seconds to the first load for users who haven't visited the sharing link before
- The `_api/v2.0/shares/` endpoint uses `spHttpClient` (SharePoint auth) — no Graph API permissions needed
- File type is detected from the resolved `driveItem.name`, not the sharing link URL

---

## Security Model

### DOMPurify Boundaries

| Content path | Sanitized? | Why |
|---|---|---|
| Markdown rendering | Yes — `FORBID_TAGS: ['style', 'script']` | User-provided content (untrusted) |
| HTML content type (inline) | Yes — `FORBID_TAGS: ['script']`, allows `<style>` | User-provided content |
| HTML file assets | **No** — injected raw via `$contentHost.html()` | Editor-authored files (trusted context) |
| JavaScript sandbox | **No** — `render()` sets innerHTML directly | Editor-authored code (trusted context) |
| Lock templates | Yes — `FORBID_TAGS: ['script']` | Potentially user-visible |

### Script Execution

- **Inline `<script>` in HTML files**: executed via `new Function(code)()` — runs in global scope
- **JavaScript sandbox**: executed via `new Function(...params, code)` — runs in a scoped closure
- **External `<script src>`**: skipped entirely — bundle libraries instead
- **CSP compliance**: no `eval()`, no dynamic `<script>` element creation, no CDN loads

### Post-Sanitization Hooks

DOMPurify runs global hooks (registered in `ContentRenderer.ts`) on every `sanitize()` call:

1. `target="_blank"` links get `rel="noopener noreferrer"` automatically
2. `http://` hrefs are upgraded to `https://` (except localhost)
3. Iframes without `sandbox` get `sandbox="allow-scripts allow-same-origin allow-popups allow-forms"`

---

## Packaging Variants

PiCanvas ships in two sppkg variants from the same source tree:

| Variant | Command | Output | Components |
|---|---|---|---|
| Full | `npm run package` | `sharepoint/solution/pi-canvas.sppkg` | PiCanvas + AA Hub + PiRadar Command + Loader extension |
| Lite | `npm run package:lite` | `sharepoint/solution/pi-canvas-lite.sppkg` | PiCanvas + Loader extension only |

### How the lite build works

`scripts/package-lite.js` temporarily swaps `config/config.json` and `config/package-solution.json` with their `*-lite.json` counterparts, patches the PiCanvas webpart and loader-extension manifest IDs to lite-specific GUIDs, runs the normal `npm run package`, then restores the originals (even on Ctrl-C). The lite outputs preserve the originals untouched in git.

### Why distinct component IDs

When a sppkg is deployed via a site collection or tenant app catalog with `skipFeatureDeployment: true`, its component IDs are registered tenant-wide. If you reused the same component IDs in lite and full, only one variant could be deployed anywhere in the tenant. Lite uses its own GUIDs so it can coexist with the full deployment in the same tenant.

The trade-off: a page authored with full's PiCanvas (componentId `6bcd9bfc-…`) won't render under lite (componentId `a2f32703-…`). The PiCanvas web part will appear as a missing component. To migrate a page across variants, rewrite the componentId in the page's `CanvasContent1` field — `scripts/migrate-picanvas-componentid.js` does this for a list of pages on a given site.
