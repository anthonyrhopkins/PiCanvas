# SCORM Player for PiCanvas — Design

**Status:** Draft for review
**Date:** 2026-05-19
**Author:** Anthony Hopkins (with Claude)
**Trigger:** Need to host SCORM 1.2 e-learning packages (e.g. the Articulate Storyline export `Secure Passwords Exercise SCORM`) inside PiCanvas with per-user progress tracking and tab-level completion gating.

---

## 1. Goals

- Let SharePoint authors play any SCORM 1.2 package inside their site, on a regular SP page or as a tab in PiCanvas.
- Persist per-user progress (completion, score, resume bookmark) so a learner can come back later.
- Let PiCanvas tabs react to completion — show a "Completed" badge, or lock a follow-up tab until the SCO finishes.
- Keep PiCanvas's bundle clean: SCORM logic ships separately and is optional.

## 2. Non-goals (v1)

- SCORM 2004, AICC, xAPI/Tin Can. SCORM 1.2 only.
- Tracking the full CMI tree (interactions, objectives, comments). v1 persists a documented subset.
- Server-side zip extraction. Authors unzip locally and upload the folder.
- Cross-site or cross-tenant package hosting. Picker is scoped to the current site.
- Sequencing across multiple SCOs in one package. v1 picks the first `<resource>` in the manifest and plays it.
- Anonymous/external-user persistence. SCO runs in memory only; no list write.
- Browser-automation tests of the runtime. Manual smoke once per release.

## 3. Architecture

Two SPFx solutions in two repos. They share one contract: a SharePoint list schema. Neither imports the other.

```
┌─────────────────────────────┐         ┌─────────────────────────────┐
│  PiCanvas (existing)        │         │  pi-scorm-player (new)      │
│  ─────────────────          │         │  ─────────────────          │
│  • Tab UX                   │         │  • Folder picker            │
│  • Reads ScormProgress      │  ────►  │  • Manifest parser          │
│    list for badge + lock    │  list   │  • Iframe + window.API shim │
│  • Hosts the webpart in a   │  reads  │  • Reads + writes           │
│    'webpart' tab (existing  │         │    ScormProgress list       │
│    mechanism, no new code)  │         │  • Restart / Resume UI      │
└─────────────────────────────┘         └─────────────────────────────┘
                    │                                  │
                    └──────────────┬───────────────────┘
                                   ▼
                  ┌─────────────────────────────────┐
                  │  PiCanvasScormProgress (list)   │
                  │  per-site, auto-provisioned     │
                  │  by pi-scorm-player on first    │
                  │  write. PiCanvas only reads.    │
                  └─────────────────────────────────┘
```

**Loose-coupling contract:** the SP list is the only API between the two webparts. PiCanvas never imports SCORM code. The SCORM webpart never imports PiCanvas code.

- If a customer installs only PiCanvas, nothing breaks — tab lock just never gates on SCORM.
- If they install only the SCORM webpart, it works standalone on any SP page.

**Solution layout.** New repo `~/Github/anthonyrhopkins/PiScormPlayer/`, peer to `PiCanvas/`. Its own `package.json`, `config/`, `gulpfile.js`, `sharepoint/solution/pi-scorm-player.sppkg`. Mirrors PiCanvas's layout.

## 4. `pi-scorm-player` webpart

Single React-based SPFx webpart.

### 4.1 File layout

```
src/webparts/piScormPlayer/
├── PiScormPlayerWebPart.ts
├── PiScormPlayerWebPart.manifest.json
├── components/
│   ├── PiScormPlayer.tsx       (top-level state + render)
│   ├── ScormFrame.tsx          (iframe lifecycle)
│   ├── ScormToolbar.tsx        (Restart / Resume / status pill)
│   └── ScormErrorState.tsx     (manifest missing / corrupt / no perms)
├── services/
│   ├── ManifestParser.ts       (fetch + parse imsmanifest.xml)
│   ├── ScormApi12.ts           (window.API shim — pure logic)
│   ├── ScormApiBridge.ts       (mounts shim onto wrapper iframe window)
│   └── ScormProgressService.ts (read/write list via PnPjs)
├── models/
│   └── ScormCmi12.ts           (CMI types + defaults)
└── configPanel/
    └── ScormFolderPicker.ts    (PropertyPane folder picker)
```

### 4.2 The `window.API` shim — load-bearing

To keep `window.API` off the host SharePoint page, the SCO never loads into a top-level iframe.

1. The webpart renders a wrapper `<iframe>` it owns (`about:blank`, same-origin).
2. The wrapper iframe's `contentWindow` gets `window.API = new ScormApi12(...)`.
3. Inside the wrapper, the webpart injects a child `<iframe src="…/index_lms.html">` for the SCO.
4. The SCO's `findAPI()` walks `window.parent` looking for `window.API` — finds it on the wrapper iframe's window.

This matches the isolation pattern PiCanvas already uses for remote content (recent commits: `fix: snapshot mode uses Shadow DOM for style isolation`, `fix: protect against iframe-PiCanvas pollution`). Two SCORM webparts on the same page each get their own `window.API` and cannot collide.

### 4.3 `ScormApi12` shim surface

Implements SCORM 1.2:
- `LMSInitialize("")` → `"true"` / `"false"`
- `LMSGetValue(element)` → string
- `LMSSetValue(element, value)` → `"true"` / `"false"`
- `LMSCommit("")` → `"true"` / `"false"`
- `LMSFinish("")` → `"true"` / `"false"`
- `LMSGetLastError()` → numeric code as string
- `LMSGetErrorString(code)` → human-readable
- `LMSGetDiagnostic(code)` → human-readable

Holds an in-memory CMI tree. On `LMSCommit` and `LMSFinish`, flushes the persisted subset to `ScormProgressService` (fire-and-forget, debounced — see §5.4).

Pure synchronous SCORM API surface — async work is decoupled.

### 4.4 Lifecycle

```
mount
 → fetch + parse manifest                  (ManifestParser)
 → load existing progress for this user    (ScormProgressService.get)
 → seed CMI from row (suspend_data, lesson_location, lesson_status, total_time)
 → render wrapper iframe + SCO iframe
 → SCO calls LMSInitialize → reads seeded values
 → user interacts → SCO sets values → periodic LMSCommit
 → ScormApi12 flushes subset to list
 → unload / unmount → LMSFinish → final flush
```

### 4.5 Property pane

- **SCORM folder** (required) — `ScormFolderPicker` PropertyPane control. Browses doc libraries on the current site. On selection, fetches `imsmanifest.xml`, surfaces Title + Package ID + Entry HTML for confirmation.
- **Entry HTML override** (optional) — for non-standard manifests.
- **Package ID** — auto-filled from manifest; editable. This is the row key in the progress list and the value PiCanvas tabs reference.

## 5. `PiCanvasScormProgress` list contract

The shared contract. **One list per site**, auto-provisioned by `pi-scorm-player` on first write. PiCanvas only reads.

### 5.1 Schema (v1)

| Internal name        | Type            | Notes                                                          |
|----------------------|-----------------|----------------------------------------------------------------|
| `Title`              | Single line     | Composite `{userId}::{packageId}` — row key                    |
| `UserId`             | Number          | SP user ID (`_spPageContextInfo.userId`)                       |
| `UserLoginName`      | Single line     | `i:0#.f|membership|...` — for cross-user reporting             |
| `PackageId`          | Single line     | Manifest `<manifest identifier="...">`                         |
| `PackageFolderUrl`   | Single line     | Server-relative, for traceability                              |
| `LessonStatus`       | Single line     | `not attempted` \| `incomplete` \| `completed` \| `passed` \| `failed` \| `browsed` |
| `ScoreRaw`           | Number          | nullable                                                       |
| `ScoreMin`           | Number          | nullable                                                       |
| `ScoreMax`           | Number          | nullable                                                       |
| `SessionTimeSeconds` | Number          | last session, parsed from CMI HH:MM:SS.ss                      |
| `TotalTimeSeconds`   | Number          | accumulated across sessions                                    |
| `LessonLocation`     | Single line     | bookmark string (max 255 per SCORM 1.2)                        |
| `SuspendData`        | Multiline plain | up to ~64KB; Storyline real-world is 4–10KB                    |
| `LastCommitUtc`      | DateTime        | when the SCO last committed                                    |

### 5.2 Schema versioning

Site property `PiCanvasScormProgress.SchemaVersion = "1"`. Future migrations key off this.

### 5.3 Provisioning

On first commit, `ScormProgressService` checks for the list by title `PiCanvasScormProgress`. If absent, creates it with the schema in §5.1. Idempotent — concurrent first-time learners get one list, not several. Provisioning needs site-level `manageLists`.

If the user lacks `manageLists`:
- The SCO still runs in-memory for the session (no in-flight data loss).
- A one-time non-blocking toast tells the learner progress couldn't save.
- The page console gets the actual error.
- Edit-mode preview shows a clear hint to authors.

### 5.4 Read / write patterns

**SCORM webpart write path:** debounced, max 1 write/sec per user+package, last-write-wins. Prevents a panicky SCO from hammering SharePoint. Final flush on `LMSFinish` always fires.

**SCORM webpart read path:** on mount, single `GET` for the row matching current user + package. If absent, start fresh.

**PiCanvas read path:** `GET` filtered by `UserId eq <me> and PackageId eq <id>`. One REST call per gated tab on render, deduped + cached for the page lifetime so multiple SCORM-gated tabs share one fetch round.

### 5.5 What v1 does NOT persist

CMI keys we deliberately ignore in v1 (the SCO can still set/get them in memory during a session):
- `cmi.interactions.*` (quiz answers)
- `cmi.objectives.*`
- `cmi.comments`, `cmi.comments_from_lms`
- `cmi.student_data.*`, `cmi.student_preference.*`

Adding any of these is a v2 schema bump. Documented as a known limitation.

## 6. PiCanvas hook changes

Small additions. No SCORM code in PiCanvas — only two new ways for tabs to read the shared list.

### 6.1 New tab-lock rule type

Add to `ITabTemplateConfig` (in `src/webparts/piCanvas/models/TemplateModels.ts`):

```ts
lockRule?: {
  type: 'scormCompleted';
  packageId: string;
  acceptedStatuses?: ('completed' | 'passed')[];  // default: both
};
```

One new branch in the existing lock-evaluation path: query the progress list, treat `LessonStatus` in `acceptedStatuses` as unlocked.

### 6.2 Optional completion badge

Add to `ITabTemplateConfig`:

```ts
showScormCompletionBadge?: { packageId: string };
```

When set and the user has completed that package, the tab label gets a "✓ Completed" pill using PiCanvas's existing chip styling. Independent of locking.

### 6.3 New service: `ScormProgressReader`

`src/webparts/piCanvas/services/ScormProgressReader.ts`. Read-only.

```ts
getCompletion(packageId: string): Promise<{
  status: string;
  scoreRaw: number | null;
  lastCommitUtc: Date;
} | null>
```

Cached per page render. No write or provisioning code. If the list doesn't exist, returns `null` silently — PiCanvas degrades cleanly when the SCORM webpart isn't installed on the site.

### 6.4 Config panel additions

In Tab Builder, two new property-pane rows:
- "Lock until SCORM package completed" → text input for package ID + checkbox group for accepted statuses.
- "Show completion badge for SCORM package" → text input for package ID.

Plain text inputs in v1. PiCanvas can't see into the SCORM webpart's config so a fancy picker isn't possible without coupling. Authors copy the package ID from the SCORM webpart's edit-mode display.

### 6.5 Schema version bump

`TEMPLATE_SCHEMA_VERSION` goes from `'3.0'` to `'3.1'` to cover the two new fields. Existing v3.0 templates load unchanged.

### 6.6 Footprint

- 1 new service file (~80 LOC)
- 2 new fields on `ITabTemplateConfig`
- 1 new branch in lock evaluation
- 2 new property-pane rows
- No new dependencies, no bundle bloat

## 7. Author UX flow

1. Unzip the SCORM package locally. PiCanvas does not extract zips.
2. Upload the unzipped folder to any SP doc library on the site (Documents, Site Assets, etc).
3. Add the `pi-scorm-player` webpart — to a SP page directly, or as a `'webpart'`-type tab in PiCanvas.
4. Open the property pane → **Pick SCORM folder** → browse → select the folder containing `imsmanifest.xml`.
5. Picker reads the manifest, shows Title + Package ID + Entry HTML for confirmation.
6. Save the page. The first learner to play it auto-creates the progress list.
7. *(Optional)* On a PiCanvas tab elsewhere, paste the package ID into "Lock until SCORM completed" or "Show completion badge."

The Package ID is visible and copyable in the picker confirmation panel and on the rendered webpart in edit mode.

## 8. Error handling & edge cases

- **Manifest missing or malformed** → `ScormErrorState` shows "Couldn't read SCORM manifest in this folder. Make sure imsmanifest.xml is at the folder root." Author sees this in edit mode; learner sees "This module is unavailable."
- **Author lacks `manageLists` on first commit** → in-memory CMI still works; one-time toast for learner; console error; clear hint in edit-mode preview.
- **Two SCORM webparts on the same page** → wrapper-iframe pattern means each gets its own `window.API`. They cannot see each other.
- **`LMSFinish` then quick reload** → debounced writes (max 1/sec, last-write-wins) prevent thrashing. Final flush on `LMSFinish` always fires.
- **`SuspendData` over ~64KB** → truncate, log a warning to the console. Storyline real-world output is well under this.
- **Cross-site SCORM packages** → not supported in v1. Folder picker scoped to current site.
- **Anonymous / external users** → no `UserId`, no list write. SCO runs in-memory; logged warning.
- **Iframe sandbox** → wrapper iframe is `about:blank` (same-origin); SCO iframe `src` is server-relative SP URL (same origin). No `sandbox` attribute — Storyline output relies on inline scripts and `eval`. Trust model matches any uploaded HTML on a SP page.
- **Multi-SCO manifests** → v1 picks first `<resource>` in the manifest; logs a warning if multiple are present. Sequencing is out of scope.

## 9. Testing

### 9.1 Unit tests in `pi-scorm-player`

- `ScormApi12` against fixtures: CMI get/set, error codes, time-format parsing (`HH:MM:SS.ss` ↔ seconds), `LMSCommit` triggers persistence call, debounce coalesces bursts.
- `ManifestParser` against:
  - This Storyline `Secure Passwords Exercise` package
  - A manifest with no `<resource>` element
  - A manifest with multiple `<resource>` elements (verify first-wins + warning)
  - An entirely missing manifest file
- `ScormProgressService` against a mocked SP REST client: schema provisioning idempotency, first-write creation flow, debounce behavior, `manageLists`-denied path.

### 9.2 Unit tests in PiCanvas

- `ScormProgressReader` against a mocked client: cache hit/miss, list-missing returns `null`, filter syntax correctness.
- Lock-evaluation branch: rule matches → unlocked, rule fails → locked, no row → locked.

### 9.3 Manual integration smoke (per release)

End-to-end with the `Secure Passwords Exercise` package:
1. Upload, configure, play, complete.
2. Reload page → confirm Resume picks up at the right slide.
3. Confirm `LessonStatus = passed` and a row exists in `PiCanvasScormProgress`.
4. Configure a separate PiCanvas tab to gate on this package ID → confirm it unlocks.
5. Configure a tab to show the completion badge → confirm it appears.
6. Click Restart → confirm CMI resets and list row updates.

### 9.4 Out of scope for v1

- Browser-automation tests of the SCO runtime. Storyline's runtime is async and timing-sensitive; Playwright tests against it are flaky for marginal value.

## 10. Open questions / future work

- **Package picker in PiCanvas tab config:** would require the SCORM webpart to publish a registry of known package IDs. Out of scope; revisit if authors complain about pasting IDs.
- **SCORM 2004 + xAPI:** the shim is structured so a `window.API_1484_11` implementation can be dropped in. Not built in v1.
- **Quiz/interactions reporting:** v1 ignores `cmi.interactions.*`. If reporting on individual answers becomes a need, v2 schema bump.
- **Multi-SCO sequencing:** no plan today. Most Storyline output is single-SCO.

## 11. Deployment

- Two `.sppkg` files, deployed independently.
- Per-site progress list is auto-created — no admin script needed.
- PiCanvas template schema bump from 3.0 → 3.1 is backward-compatible (new optional fields).
- Rollback: uninstalling `pi-scorm-player` leaves the progress list and any PiCanvas lock rules referencing missing package IDs in place. PiCanvas's `ScormProgressReader` returns `null` for missing rows, so locked tabs simply stay locked. Authors can clear the lock rules in the property pane.
