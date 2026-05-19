# SCORM Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a standalone `pi-scorm-player` SPFx webpart that hosts SCORM 1.2 packages with per-user progress persistence, plus minimal PiCanvas hooks so tabs can show completion badges and gate on completion.

**Architecture:** Two SPFx solutions in two repos communicating only via a shared SharePoint list (`PiCanvasScormProgress`). The SCORM webpart owns the SCORM API shim, manifest parsing, and list writes. PiCanvas adds a read-only consumer service that lets tab config reference a package ID for badging or gating. See `docs/superpowers/specs/2026-05-19-scorm-block-design.md` for the full design.

**Tech Stack:** SPFx 1.x with Heft + Webpack, React, TypeScript, `spHttpClient` (built-in, matching existing PiCanvas pattern), Jest for unit tests.

## Notes from grounding

Two minor spec deviations the plan locks in:

1. **`TabLockService` is password-only.** The existing service handles password hashing + session unlock TTL — it is not a generic rule evaluator. SCORM completion gating is implemented as a *separate* gate in the tab-render path, not a new branch inside `TabLockService`. Both gates can apply to the same tab (e.g. SCORM-completed *and* password-protected).
2. **`spHttpClient`, not PnPjs.** PiCanvas uses the SPFx-built-in `spHttpClient` everywhere. Both webparts in this plan do the same — no new dependency.

## Phase map

- **Phase 1** — Scaffold PiScormPlayer repo (Tasks 1–2)
- **Phase 2** — CMI model + SCORM 1.2 API shim (Tasks 3–5)
- **Phase 3** — Manifest parser + progress service (Tasks 6–8)
- **Phase 4** — API bridge + React components (Tasks 9–12)
- **Phase 5** — Property pane folder picker (Task 13)
- **Phase 6** — Webpart entry + first end-to-end smoke (Tasks 14–15)
- **Phase 7** — PiCanvas hooks (Tasks 16–19)
- **Phase 8** — Final integration smoke + release prep (Task 20)

---

## Phase 1 — Scaffold PiScormPlayer repo

### Task 1: Generate SPFx project via Yeoman

**Files:**
- Create: `~/Github/anthonyrhopkins/PiScormPlayer/` (entire SPFx project tree)

- [ ] **Step 1: Run the Yeoman SPFx generator**

```bash
cd ~/Github/anthonyrhopkins
yo @microsoft/sharepoint
```

Generator inputs (answer in this order):

| Prompt                                            | Answer                          |
|---------------------------------------------------|---------------------------------|
| What is your solution name?                       | `pi-scorm-player`               |
| Which type of client-side component to create?    | `WebPart`                       |
| What is your Web Part name?                       | `PiScormPlayer`                 |
| Which template would you like to use?             | `React`                         |
| Do you want to allow tenant admins option to be used on a single site?  | `Yes`                           |

- [ ] **Step 2: Verify scaffold landed correctly**

```bash
ls ~/Github/anthonyrhopkins/PiScormPlayer/src/webparts/piScormPlayer/
```

Expected: `PiScormPlayerWebPart.ts`, `PiScormPlayerWebPart.manifest.json`, `components/`, `loc/`.

- [ ] **Step 3: Initialize git and make first commit**

```bash
cd ~/Github/anthonyrhopkins/PiScormPlayer
git init
git add -A
git commit -m "chore: initial SPFx scaffold via Yeoman"
```

### Task 2: Add Jest for unit tests

**Files:**
- Modify: `~/Github/anthonyrhopkins/PiScormPlayer/config/heft.json`
- Modify: `~/Github/anthonyrhopkins/PiScormPlayer/package.json`
- Create: `~/Github/anthonyrhopkins/PiScormPlayer/config/jest.config.json`

- [ ] **Step 1: Install heft-jest plugin**

```bash
cd ~/Github/anthonyrhopkins/PiScormPlayer
npm install --save-dev @rushstack/heft-jest-plugin@latest
```

- [ ] **Step 2: Register the Jest plugin in `config/heft.json`**

Open `config/heft.json` and add to the `heftPlugins` array (create the array if absent):

```json
{
  "heftPlugins": [
    { "plugin": "@rushstack/heft-jest-plugin" }
  ]
}
```

- [ ] **Step 3: Create `config/jest.config.json`**

```json
{
  "preset": "@rushstack/heft-jest-plugin",
  "testMatch": ["<rootDir>/src/**/*.test.ts", "<rootDir>/src/**/*.test.tsx"],
  "moduleFileExtensions": ["ts", "tsx", "js"],
  "transform": {
    "^.+\\.(ts|tsx)$": "ts-jest"
  }
}
```

- [ ] **Step 4: Add a smoke test to confirm Jest runs**

Create `src/webparts/piScormPlayer/__tests__/smoke.test.ts`:

```ts
describe('jest smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run Jest via heft**

```bash
npx heft test
```

Expected: 1 passed test.

- [ ] **Step 6: Commit**

```bash
git add config/heft.json config/jest.config.json package.json package-lock.json src/webparts/piScormPlayer/__tests__/smoke.test.ts
git commit -m "chore: add Jest via heft-jest-plugin"
```

---

## Phase 2 — CMI model + SCORM 1.2 API shim

### Task 3: Define `ScormCmi12` model

**Files:**
- Create: `src/webparts/piScormPlayer/models/ScormCmi12.ts`
- Test: `src/webparts/piScormPlayer/models/__tests__/ScormCmi12.test.ts`

- [ ] **Step 1: Write the failing test**

`src/webparts/piScormPlayer/models/__tests__/ScormCmi12.test.ts`:

```ts
import { createDefaultCmi, isReadOnly, isValidCmiKey } from '../ScormCmi12';

describe('ScormCmi12', () => {
  it('createDefaultCmi seeds lesson_status as not attempted', () => {
    const cmi = createDefaultCmi();
    expect(cmi['cmi.core.lesson_status']).toBe('not attempted');
    expect(cmi['cmi.core.entry']).toBe('');
    expect(cmi['cmi.core.score.raw']).toBe('');
    expect(cmi['cmi.suspend_data']).toBe('');
  });

  it('isReadOnly flags total_time and exit/entry as read-only/write-only correctly', () => {
    expect(isReadOnly('cmi.core.total_time')).toBe(true);
    expect(isReadOnly('cmi.core.lesson_status')).toBe(false);
    expect(isReadOnly('cmi.core.score.raw')).toBe(false);
  });

  it('isValidCmiKey accepts known SCORM 1.2 keys', () => {
    expect(isValidCmiKey('cmi.core.lesson_status')).toBe(true);
    expect(isValidCmiKey('cmi.suspend_data')).toBe(true);
    expect(isValidCmiKey('cmi.core.score.raw')).toBe(true);
    expect(isValidCmiKey('cmi.totally_made_up')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
npx heft test --test-path-pattern ScormCmi12
```

Expected: FAIL with module not found.

- [ ] **Step 3: Write minimal implementation**

`src/webparts/piScormPlayer/models/ScormCmi12.ts`:

```ts
export type CmiTree = Record<string, string>;

const KNOWN_KEYS = new Set<string>([
  'cmi.core._children',
  'cmi.core.student_id',
  'cmi.core.student_name',
  'cmi.core.lesson_location',
  'cmi.core.credit',
  'cmi.core.lesson_status',
  'cmi.core.entry',
  'cmi.core.score._children',
  'cmi.core.score.raw',
  'cmi.core.score.min',
  'cmi.core.score.max',
  'cmi.core.total_time',
  'cmi.core.lesson_mode',
  'cmi.core.exit',
  'cmi.core.session_time',
  'cmi.suspend_data',
  'cmi.launch_data',
  'cmi.comments',
  'cmi.comments_from_lms',
  'cmi.objectives._children',
  'cmi.objectives._count',
  'cmi.student_data._children',
  'cmi.student_data.mastery_score',
  'cmi.student_data.max_time_allowed',
  'cmi.student_data.time_limit_action',
  'cmi.student_preference._children',
  'cmi.student_preference.audio',
  'cmi.student_preference.language',
  'cmi.student_preference.speed',
  'cmi.student_preference.text',
  'cmi.interactions._children',
  'cmi.interactions._count'
]);

const READ_ONLY = new Set<string>([
  'cmi.core._children',
  'cmi.core.student_id',
  'cmi.core.student_name',
  'cmi.core.credit',
  'cmi.core.total_time',
  'cmi.core.lesson_mode',
  'cmi.core.score._children',
  'cmi.launch_data',
  'cmi.comments_from_lms',
  'cmi.objectives._children',
  'cmi.objectives._count',
  'cmi.student_data._children',
  'cmi.student_data.mastery_score',
  'cmi.student_data.max_time_allowed',
  'cmi.student_data.time_limit_action',
  'cmi.student_preference._children',
  'cmi.interactions._children',
  'cmi.interactions._count'
]);

export function createDefaultCmi(): CmiTree {
  return {
    'cmi.core._children': 'student_id,student_name,lesson_location,credit,lesson_status,entry,score,total_time,lesson_mode,exit,session_time',
    'cmi.core.student_id': '',
    'cmi.core.student_name': '',
    'cmi.core.lesson_location': '',
    'cmi.core.credit': 'credit',
    'cmi.core.lesson_status': 'not attempted',
    'cmi.core.entry': '',
    'cmi.core.score._children': 'raw,min,max',
    'cmi.core.score.raw': '',
    'cmi.core.score.min': '',
    'cmi.core.score.max': '',
    'cmi.core.total_time': '0000:00:00.00',
    'cmi.core.lesson_mode': 'normal',
    'cmi.suspend_data': '',
    'cmi.launch_data': '',
    'cmi.comments': '',
    'cmi.comments_from_lms': ''
  };
}

export function isReadOnly(key: string): boolean {
  return READ_ONLY.has(key);
}

export function isValidCmiKey(key: string): boolean {
  if (KNOWN_KEYS.has(key)) return true;
  return /^cmi\.(interactions|objectives)\.\d+\./.test(key);
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
npx heft test --test-path-pattern ScormCmi12
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/webparts/piScormPlayer/models/
git commit -m "feat: SCORM 1.2 CMI model + key validation"
```

### Task 4: SCORM time-format helpers

**Files:**
- Create: `src/webparts/piScormPlayer/services/scormTime.ts`
- Test: `src/webparts/piScormPlayer/services/__tests__/scormTime.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { parseScormTime, formatScormTime, addScormTimes } from '../scormTime';

describe('scormTime', () => {
  it('parseScormTime handles HH:MM:SS.ss', () => {
    expect(parseScormTime('00:00:00.00')).toBe(0);
    expect(parseScormTime('01:30:45.50')).toBe(5445.5);
    expect(parseScormTime('0000:00:30.00')).toBe(30);
  });

  it('formatScormTime rounds to 2 decimals', () => {
    expect(formatScormTime(0)).toBe('0000:00:00.00');
    expect(formatScormTime(5445.5)).toBe('0001:30:45.50');
    expect(formatScormTime(30.123)).toBe('0000:00:30.12');
  });

  it('addScormTimes sums two SCORM-format strings', () => {
    expect(addScormTimes('0000:00:30.00', '0000:00:15.50')).toBe('0000:00:45.50');
    expect(addScormTimes('0001:00:00.00', '0000:30:00.00')).toBe('0001:30:00.00');
  });

  it('parseScormTime returns 0 for malformed input', () => {
    expect(parseScormTime('garbage')).toBe(0);
    expect(parseScormTime('')).toBe(0);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx heft test --test-path-pattern scormTime
```

- [ ] **Step 3: Implement**

`src/webparts/piScormPlayer/services/scormTime.ts`:

```ts
const TIME_RE = /^(\d{2,4}):(\d{2}):(\d{2})(?:\.(\d{1,2}))?$/;

export function parseScormTime(value: string): number {
  if (!value) return 0;
  const m = TIME_RE.exec(value.trim());
  if (!m) return 0;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const s = parseInt(m[3], 10);
  const cs = m[4] ? parseInt(m[4].padEnd(2, '0').slice(0, 2), 10) : 0;
  return h * 3600 + mm * 60 + s + cs / 100;
}

export function formatScormTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const cs = Math.floor((safe - Math.floor(safe)) * 100);
  return `${String(h).padStart(4, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function addScormTimes(a: string, b: string): string {
  return formatScormTime(parseScormTime(a) + parseScormTime(b));
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npx heft test --test-path-pattern scormTime
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/webparts/piScormPlayer/services/
git commit -m "feat: SCORM 1.2 time-format parse/format/add helpers"
```

### Task 5: `ScormApi12` shim — core API surface

**Files:**
- Create: `src/webparts/piScormPlayer/services/ScormApi12.ts`
- Test: `src/webparts/piScormPlayer/services/__tests__/ScormApi12.test.ts`

- [ ] **Step 1: Write the failing tests** (covering init/finish, get/set, error codes, commit callback, read-only enforcement)

```ts
import { ScormApi12 } from '../ScormApi12';
import { createDefaultCmi } from '../../models/ScormCmi12';

describe('ScormApi12', () => {
  const newApi = (onCommit = jest.fn()) => new ScormApi12({
    initialCmi: createDefaultCmi(),
    onCommit,
    studentId: 'i:0#.f|membership|user@example.com',
    studentName: 'User, Example'
  });

  it('LMSInitialize returns "true" once', () => {
    const api = newApi();
    expect(api.LMSInitialize('')).toBe('true');
    expect(api.LMSInitialize('')).toBe('false');
    expect(api.LMSGetLastError()).toBe('101');
  });

  it('LMSGetValue/LMSSetValue round-trip writable keys', () => {
    const api = newApi();
    api.LMSInitialize('');
    expect(api.LMSSetValue('cmi.core.lesson_status', 'completed')).toBe('true');
    expect(api.LMSGetValue('cmi.core.lesson_status')).toBe('completed');
  });

  it('LMSSetValue rejects read-only keys', () => {
    const api = newApi();
    api.LMSInitialize('');
    expect(api.LMSSetValue('cmi.core.total_time', '0001:00:00.00')).toBe('false');
    expect(api.LMSGetLastError()).toBe('403');
  });

  it('LMSCommit fires onCommit with current snapshot', () => {
    const onCommit = jest.fn();
    const api = newApi(onCommit);
    api.LMSInitialize('');
    api.LMSSetValue('cmi.core.lesson_status', 'completed');
    expect(api.LMSCommit('')).toBe('true');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0]['cmi.core.lesson_status']).toBe('completed');
  });

  it('LMSFinish accumulates session_time into total_time and commits', () => {
    const onCommit = jest.fn();
    const api = newApi(onCommit);
    api.LMSInitialize('');
    api.LMSSetValue('cmi.core.session_time', '0000:00:30.00');
    expect(api.LMSFinish('')).toBe('true');
    expect(onCommit).toHaveBeenCalled();
    const final = onCommit.mock.calls[onCommit.mock.calls.length - 1][0];
    expect(final['cmi.core.total_time']).toBe('0000:00:30.00');
  });

  it('LMSGetValue on unknown key sets error 401', () => {
    const api = newApi();
    api.LMSInitialize('');
    expect(api.LMSGetValue('cmi.totally_made_up')).toBe('');
    expect(api.LMSGetLastError()).toBe('401');
  });

  it('seeds student_id and student_name from constructor', () => {
    const api = newApi();
    api.LMSInitialize('');
    expect(api.LMSGetValue('cmi.core.student_id')).toBe('i:0#.f|membership|user@example.com');
    expect(api.LMSGetValue('cmi.core.student_name')).toBe('User, Example');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx heft test --test-path-pattern ScormApi12
```

- [ ] **Step 3: Implement**

`src/webparts/piScormPlayer/services/ScormApi12.ts`:

```ts
import { CmiTree, createDefaultCmi, isReadOnly, isValidCmiKey } from '../models/ScormCmi12';
import { addScormTimes } from './scormTime';

export interface IScormApi12Options {
  initialCmi?: CmiTree;
  onCommit: (snapshot: CmiTree) => void;
  studentId: string;
  studentName: string;
}

export class ScormApi12 {
  private cmi: CmiTree;
  private initialized = false;
  private finished = false;
  private lastError = '0';
  private readonly onCommit: (snapshot: CmiTree) => void;

  constructor(opts: IScormApi12Options) {
    this.cmi = { ...createDefaultCmi(), ...(opts.initialCmi || {}) };
    this.cmi['cmi.core.student_id'] = opts.studentId || '';
    this.cmi['cmi.core.student_name'] = opts.studentName || '';
    this.onCommit = opts.onCommit;
  }

  public LMSInitialize(_param: string): string {
    if (this.initialized) {
      this.lastError = '101';
      return 'false';
    }
    this.initialized = true;
    this.lastError = '0';
    return 'true';
  }

  public LMSFinish(_param: string): string {
    if (!this.initialized || this.finished) {
      this.lastError = '301';
      return 'false';
    }
    const session = this.cmi['cmi.core.session_time'] || '0000:00:00.00';
    const total = this.cmi['cmi.core.total_time'] || '0000:00:00.00';
    this.cmi['cmi.core.total_time'] = addScormTimes(total, session);
    this.finished = true;
    this.onCommit({ ...this.cmi });
    this.lastError = '0';
    return 'true';
  }

  public LMSGetValue(key: string): string {
    if (!this.initialized) {
      this.lastError = '301';
      return '';
    }
    if (!isValidCmiKey(key)) {
      this.lastError = '401';
      return '';
    }
    this.lastError = '0';
    return this.cmi[key] ?? '';
  }

  public LMSSetValue(key: string, value: string): string {
    if (!this.initialized) {
      this.lastError = '301';
      return 'false';
    }
    if (!isValidCmiKey(key)) {
      this.lastError = '401';
      return 'false';
    }
    if (isReadOnly(key)) {
      this.lastError = '403';
      return 'false';
    }
    this.cmi[key] = value;
    this.lastError = '0';
    return 'true';
  }

  public LMSCommit(_param: string): string {
    if (!this.initialized) {
      this.lastError = '301';
      return 'false';
    }
    this.onCommit({ ...this.cmi });
    this.lastError = '0';
    return 'true';
  }

  public LMSGetLastError(): string {
    return this.lastError;
  }

  public LMSGetErrorString(code: string): string {
    const map: Record<string, string> = {
      '0': 'No error',
      '101': 'General exception',
      '201': 'Invalid argument error',
      '301': 'Not initialized',
      '401': 'Not implemented error',
      '402': 'Invalid set value, element is a keyword',
      '403': 'Element is read only',
      '404': 'Element is write only',
      '405': 'Incorrect data type'
    };
    return map[code] || '';
  }

  public LMSGetDiagnostic(code: string): string {
    return this.LMSGetErrorString(code);
  }
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npx heft test --test-path-pattern ScormApi12
```

Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/webparts/piScormPlayer/services/ScormApi12.ts src/webparts/piScormPlayer/services/__tests__/ScormApi12.test.ts
git commit -m "feat: SCORM 1.2 API shim with read-only enforcement and commit hook"
```

---

## Phase 3 — Manifest parser + progress service

### Task 6: `ManifestParser`

**Files:**
- Create: `src/webparts/piScormPlayer/services/ManifestParser.ts`
- Test: `src/webparts/piScormPlayer/services/__tests__/ManifestParser.test.ts`
- Test fixtures: `src/webparts/piScormPlayer/services/__tests__/fixtures/manifest-*.xml`

- [ ] **Step 1: Add fixture files**

Create `__tests__/fixtures/manifest-storyline.xml` (the real one — copy from `/Users/I741344/Downloads/Secure Passwords Exercise SCORM/imsmanifest.xml`).

Create `__tests__/fixtures/manifest-multi-resource.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest identifier="multi-pkg" version="1.0" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2">
  <organizations default="ORG"><organization identifier="ORG"><title>Multi</title></organization></organizations>
  <resources>
    <resource identifier="R1" type="webcontent" href="first.html"></resource>
    <resource identifier="R2" type="webcontent" href="second.html"></resource>
  </resources>
</manifest>
```

Create `__tests__/fixtures/manifest-no-resource.xml` — same as above but with empty `<resources/>`.

- [ ] **Step 2: Write the failing tests**

```ts
import * as fs from 'fs';
import * as path from 'path';
import { parseManifest } from '../ManifestParser';

const fixture = (name: string) =>
  fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

describe('ManifestParser', () => {
  it('parses Storyline export: id, title, entry', () => {
    const result = parseManifest(fixture('manifest-storyline.xml'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.packageId).toBe('_69N0JE8a7oc');
    expect(result.title).toBe('Secure Passwords Exercise');
    expect(result.entryHref).toBe('index_lms.html');
  });

  it('multi-resource manifest picks first and warns', () => {
    const result = parseManifest(fixture('manifest-multi-resource.xml'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entryHref).toBe('first.html');
    expect(result.warnings).toContain('multiple-resources');
  });

  it('manifest with no resources fails clearly', () => {
    const result = parseManifest(fixture('manifest-no-resource.xml'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/no.*resource/i);
  });

  it('garbage XML fails clearly', () => {
    const result = parseManifest('<not valid xml');
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 3: Run, expect fail**

```bash
npx heft test --test-path-pattern ManifestParser
```

- [ ] **Step 4: Implement**

`src/webparts/piScormPlayer/services/ManifestParser.ts`:

```ts
export type ManifestResult =
  | {
      ok: true;
      packageId: string;
      title: string;
      entryHref: string;
      warnings: string[];
    }
  | {
      ok: false;
      error: string;
    };

export function parseManifest(xml: string): ManifestResult {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, 'application/xml');
  } catch (e) {
    return { ok: false, error: 'Could not parse manifest XML' };
  }
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return { ok: false, error: 'Manifest XML is malformed' };
  }
  const manifest = doc.documentElement;
  if (!manifest || manifest.localName !== 'manifest') {
    return { ok: false, error: 'Root element is not <manifest>' };
  }

  const packageId = manifest.getAttribute('identifier') || '';
  if (!packageId) {
    return { ok: false, error: 'Manifest is missing identifier attribute' };
  }

  const resources = manifest.getElementsByTagName('resource');
  if (resources.length === 0) {
    return { ok: false, error: 'Manifest has no <resource> entries' };
  }

  const warnings: string[] = [];
  if (resources.length > 1) warnings.push('multiple-resources');

  const entryHref = resources[0].getAttribute('href') || '';
  if (!entryHref) {
    return { ok: false, error: 'First <resource> has no href' };
  }

  let title = '';
  const orgs = manifest.getElementsByTagName('organization');
  if (orgs.length > 0) {
    const t = orgs[0].getElementsByTagName('title')[0];
    if (t && t.textContent) title = t.textContent.trim();
  }
  if (!title) {
    const t = manifest.getElementsByTagName('title')[0];
    if (t && t.textContent) title = t.textContent.trim();
  }

  return { ok: true, packageId, title, entryHref, warnings };
}
```

- [ ] **Step 5: jsdom env for DOMParser**

Append to `config/jest.config.json`:

```json
{
  "testEnvironment": "jsdom"
}
```

- [ ] **Step 6: Run, expect pass**

```bash
npx heft test --test-path-pattern ManifestParser
```

Expected: 4 passed.

- [ ] **Step 7: Commit**

```bash
git add src/webparts/piScormPlayer/services/ManifestParser.ts src/webparts/piScormPlayer/services/__tests__/ManifestParser.test.ts src/webparts/piScormPlayer/services/__tests__/fixtures/ config/jest.config.json
git commit -m "feat: SCORM imsmanifest.xml parser"
```

### Task 7: `ScormProgressService` — list provisioning + write path

**Files:**
- Create: `src/webparts/piScormPlayer/services/ScormProgressService.ts`
- Test: `src/webparts/piScormPlayer/services/__tests__/ScormProgressService.test.ts`

- [ ] **Step 1: Write the failing tests** (provisioning idempotency, debounce, last-write-wins)

```ts
import { ScormProgressService } from '../ScormProgressService';
import { CmiTree } from '../../models/ScormCmi12';

const sampleCmi = (): CmiTree => ({
  'cmi.core.lesson_status': 'completed',
  'cmi.core.score.raw': '85',
  'cmi.core.score.min': '0',
  'cmi.core.score.max': '100',
  'cmi.core.session_time': '0000:05:00.00',
  'cmi.core.total_time': '0000:10:00.00',
  'cmi.core.lesson_location': 'slide-7',
  'cmi.suspend_data': 'AAAA'
});

describe('ScormProgressService', () => {
  let mockClient: { get: jest.Mock; post: jest.Mock; merge: jest.Mock };

  beforeEach(() => {
    mockClient = {
      get: jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ value: [{ Title: 'PiCanvasScormProgress' }] }) }),
      post: jest.fn().mockResolvedValue({ ok: true, status: 201 }),
      merge: jest.fn().mockResolvedValue({ ok: true, status: 204 })
    };
  });

  it('first commit provisions the list if missing', async () => {
    mockClient.get.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ value: [] }) });
    const svc = new ScormProgressService({
      siteUrl: 'https://t.sharepoint.com/sites/x',
      userId: 1,
      userLoginName: 'me',
      packageId: 'pkg',
      packageFolderUrl: '/sites/x/Shared%20Documents/pkg',
      client: mockClient as never,
      debounceMs: 0
    });
    await svc.commit(sampleCmi());
    const createListCall = mockClient.post.mock.calls.find(c => /lists\/getbytitle.*\/items/.test(c[0]) === false && /\/_api\/web\/lists$/.test(c[0]));
    expect(createListCall).toBeDefined();
  });

  it('debounces back-to-back commits, last write wins', async () => {
    const svc = new ScormProgressService({
      siteUrl: 'https://t.sharepoint.com/sites/x',
      userId: 1,
      userLoginName: 'me',
      packageId: 'pkg',
      packageFolderUrl: '/sites/x/Shared%20Documents/pkg',
      client: mockClient as never,
      debounceMs: 50
    });
    svc.commit({ ...sampleCmi(), 'cmi.core.score.raw': '50' });
    svc.commit({ ...sampleCmi(), 'cmi.core.score.raw': '70' });
    svc.commit({ ...sampleCmi(), 'cmi.core.score.raw': '90' });
    await new Promise(r => setTimeout(r, 100));
    const postCalls = mockClient.post.mock.calls.filter(c => /\/items/.test(c[0]));
    expect(postCalls.length).toBe(1);
    const body = JSON.parse(postCalls[0][1].body);
    expect(body.ScoreRaw).toBe(90);
  });

  it('flush() bypasses debounce and awaits the write', async () => {
    const svc = new ScormProgressService({
      siteUrl: 'https://t.sharepoint.com/sites/x',
      userId: 1,
      userLoginName: 'me',
      packageId: 'pkg',
      packageFolderUrl: '/sites/x/Shared%20Documents/pkg',
      client: mockClient as never,
      debounceMs: 5000
    });
    svc.commit(sampleCmi());
    await svc.flush();
    const postCalls = mockClient.post.mock.calls.filter(c => /\/items/.test(c[0]));
    expect(postCalls.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx heft test --test-path-pattern ScormProgressService
```

- [ ] **Step 3: Implement**

`src/webparts/piScormPlayer/services/ScormProgressService.ts`:

```ts
import { CmiTree } from '../models/ScormCmi12';
import { parseScormTime } from './scormTime';

export interface ISpRestClient {
  get(url: string): Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
  post(url: string, init: { headers?: Record<string, string>; body: string }): Promise<{ ok: boolean; status: number }>;
  merge(url: string, init: { headers?: Record<string, string>; body: string }): Promise<{ ok: boolean; status: number }>;
}

export interface IScormProgressOptions {
  siteUrl: string;
  userId: number;
  userLoginName: string;
  packageId: string;
  packageFolderUrl: string;
  client: ISpRestClient;
  debounceMs?: number;
}

const LIST_TITLE = 'PiCanvasScormProgress';

export class ScormProgressService {
  private readonly opts: Required<IScormProgressOptions>;
  private listEnsured = false;
  private existingItemId: number | undefined;
  private pending: CmiTree | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: Promise<void> | undefined;

  constructor(opts: IScormProgressOptions) {
    this.opts = { debounceMs: 1000, ...opts } as Required<IScormProgressOptions>;
  }

  public commit(cmi: CmiTree): void {
    this.pending = { ...cmi };
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.drain(); }, this.opts.debounceMs);
  }

  public async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    await this.drain();
  }

  private async drain(): Promise<void> {
    if (this.inFlight) await this.inFlight;
    if (!this.pending) return;
    const snapshot = this.pending;
    this.pending = undefined;
    this.inFlight = this.persist(snapshot).finally(() => { this.inFlight = undefined; });
    await this.inFlight;
  }

  private async persist(cmi: CmiTree): Promise<void> {
    await this.ensureList();
    const item = this.snapshotToItem(cmi);
    if (this.existingItemId === undefined) {
      this.existingItemId = await this.findExistingRow();
    }
    if (this.existingItemId === undefined) {
      const resp = await this.opts.client.post(
        `${this.opts.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items`,
        { headers: { 'Content-Type': 'application/json;odata=verbose', Accept: 'application/json;odata=nometadata' }, body: JSON.stringify(item) }
      );
      if (!resp.ok) throw new Error(`Insert failed: ${resp.status}`);
    } else {
      await this.opts.client.merge(
        `${this.opts.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items(${this.existingItemId})`,
        { headers: { 'Content-Type': 'application/json;odata=verbose', 'IF-MATCH': '*', Accept: 'application/json;odata=nometadata' }, body: JSON.stringify(item) }
      );
    }
  }

  private snapshotToItem(cmi: CmiTree): Record<string, unknown> {
    const sessionSec = parseScormTime(cmi['cmi.core.session_time'] || '0');
    const totalSec = parseScormTime(cmi['cmi.core.total_time'] || '0');
    return {
      Title: `${this.opts.userId}::${this.opts.packageId}`,
      UserId: this.opts.userId,
      UserLoginName: this.opts.userLoginName,
      PackageId: this.opts.packageId,
      PackageFolderUrl: this.opts.packageFolderUrl,
      LessonStatus: cmi['cmi.core.lesson_status'] || 'not attempted',
      ScoreRaw: numOrNull(cmi['cmi.core.score.raw']),
      ScoreMin: numOrNull(cmi['cmi.core.score.min']),
      ScoreMax: numOrNull(cmi['cmi.core.score.max']),
      SessionTimeSeconds: sessionSec,
      TotalTimeSeconds: totalSec,
      LessonLocation: (cmi['cmi.core.lesson_location'] || '').slice(0, 255),
      SuspendData: (cmi['cmi.suspend_data'] || '').slice(0, 65000),
      LastCommitUtc: new Date().toISOString()
    };
  }

  private async ensureList(): Promise<void> {
    if (this.listEnsured) return;
    const resp = await this.opts.client.get(
      `${this.opts.siteUrl}/_api/web/lists?$filter=Title eq '${LIST_TITLE}'&$select=Title`
    );
    const json = (await resp.json()) as { value: Array<{ Title: string }> };
    if (json.value && json.value.length > 0) {
      this.listEnsured = true;
      return;
    }
    await this.createList();
    this.listEnsured = true;
  }

  private async createList(): Promise<void> {
    const create = await this.opts.client.post(`${this.opts.siteUrl}/_api/web/lists`, {
      headers: { 'Content-Type': 'application/json;odata=verbose', Accept: 'application/json;odata=nometadata' },
      body: JSON.stringify({ __metadata: { type: 'SP.List' }, Title: LIST_TITLE, BaseTemplate: 100 })
    });
    if (!create.ok) throw new Error(`List creation failed: ${create.status}`);

    const fields: Array<{ name: string; type: number; extra?: Record<string, unknown> }> = [
      { name: 'UserId', type: 9 },
      { name: 'UserLoginName', type: 2 },
      { name: 'PackageId', type: 2 },
      { name: 'PackageFolderUrl', type: 2 },
      { name: 'LessonStatus', type: 2 },
      { name: 'ScoreRaw', type: 9 },
      { name: 'ScoreMin', type: 9 },
      { name: 'ScoreMax', type: 9 },
      { name: 'SessionTimeSeconds', type: 9 },
      { name: 'TotalTimeSeconds', type: 9 },
      { name: 'LessonLocation', type: 2 },
      { name: 'SuspendData', type: 3, extra: { RichText: false } },
      { name: 'LastCommitUtc', type: 4 }
    ];
    for (const f of fields) {
      await this.opts.client.post(
        `${this.opts.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/fields`,
        {
          headers: { 'Content-Type': 'application/json;odata=verbose', Accept: 'application/json;odata=nometadata' },
          body: JSON.stringify({ __metadata: { type: 'SP.Field' }, Title: f.name, FieldTypeKind: f.type, ...f.extra })
        }
      );
    }

    // Persist schema version on the web's property bag so future migrations can detect it.
    await this.opts.client.post(
      `${this.opts.siteUrl}/_api/web/AllProperties/validateUpdateListItem`,
      {
        headers: { 'Content-Type': 'application/json;odata=verbose', Accept: 'application/json;odata=nometadata' },
        body: JSON.stringify({ formValues: [{ FieldName: 'PiCanvasScormProgress_SchemaVersion', FieldValue: '1' }] })
      }
    ).catch(() => { /* best-effort; missing property-bag write is not fatal */ });
  }

  private async findExistingRow(): Promise<number | undefined> {
    const filter = `UserId eq ${this.opts.userId} and PackageId eq '${this.opts.packageId}'`;
    const resp = await this.opts.client.get(
      `${this.opts.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items?$filter=${encodeURIComponent(filter)}&$select=Id&$top=1`
    );
    const json = (await resp.json()) as { value: Array<{ Id: number }> };
    return json.value && json.value.length > 0 ? json.value[0].Id : undefined;
  }
}

function numOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npx heft test --test-path-pattern ScormProgressService
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/webparts/piScormPlayer/services/ScormProgressService.ts src/webparts/piScormPlayer/services/__tests__/ScormProgressService.test.ts
git commit -m "feat: SCORM progress list service with provisioning + debounced writes"
```

### Task 8: `ScormProgressService` — read path (load existing for resume)

**Files:**
- Modify: `src/webparts/piScormPlayer/services/ScormProgressService.ts`
- Modify: `src/webparts/piScormPlayer/services/__tests__/ScormProgressService.test.ts`

- [ ] **Step 1: Add failing test for `load`**

Append to the test file:

```ts
it('load returns null when no row exists', async () => {
  mockClient.get.mockImplementation(async (url: string) => {
    if (url.includes('$filter=UserId')) return { ok: true, status: 200, json: async () => ({ value: [] }) };
    return { ok: true, status: 200, json: async () => ({ value: [{ Title: 'PiCanvasScormProgress' }] }) };
  });
  const svc = new ScormProgressService({ siteUrl: 'https://t.sharepoint.com/sites/x', userId: 1, userLoginName: 'me', packageId: 'pkg', packageFolderUrl: '/x', client: mockClient as never, debounceMs: 0 });
  expect(await svc.load()).toBeNull();
});

it('load hydrates a CMI subset from an existing row', async () => {
  mockClient.get.mockImplementation(async (url: string) => {
    if (url.includes('$filter=UserId')) {
      return { ok: true, status: 200, json: async () => ({ value: [{ Id: 42, LessonStatus: 'completed', ScoreRaw: 85, LessonLocation: 'slide-7', SuspendData: 'XYZ', TotalTimeSeconds: 600 }] }) };
    }
    return { ok: true, status: 200, json: async () => ({ value: [{ Title: 'PiCanvasScormProgress' }] }) };
  });
  const svc = new ScormProgressService({ siteUrl: 'https://t.sharepoint.com/sites/x', userId: 1, userLoginName: 'me', packageId: 'pkg', packageFolderUrl: '/x', client: mockClient as never, debounceMs: 0 });
  const cmi = await svc.load();
  expect(cmi).not.toBeNull();
  expect(cmi!['cmi.core.lesson_status']).toBe('completed');
  expect(cmi!['cmi.core.score.raw']).toBe('85');
  expect(cmi!['cmi.core.lesson_location']).toBe('slide-7');
  expect(cmi!['cmi.suspend_data']).toBe('XYZ');
  expect(cmi!['cmi.core.total_time']).toBe('0000:10:00.00');
  expect(cmi!['cmi.core.entry']).toBe('resume');
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx heft test --test-path-pattern ScormProgressService
```

- [ ] **Step 3: Add `load` method to the service**

Insert into `ScormProgressService`:

```ts
public async load(): Promise<CmiTree | null> {
  await this.ensureList();
  const id = await this.findExistingRow();
  if (id === undefined) return null;
  this.existingItemId = id;
  const resp = await this.opts.client.get(
    `${this.opts.siteUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items(${id})?$select=LessonStatus,ScoreRaw,ScoreMin,ScoreMax,LessonLocation,SuspendData,TotalTimeSeconds`
  );
  const row = (await resp.json()) as Record<string, unknown>;
  return rowToCmi(row);
}
```

Add module-private:

```ts
import { formatScormTime } from './scormTime';

function rowToCmi(row: Record<string, unknown>): CmiTree {
  const cmi: CmiTree = {};
  if (row.LessonStatus) cmi['cmi.core.lesson_status'] = String(row.LessonStatus);
  if (row.ScoreRaw !== null && row.ScoreRaw !== undefined) cmi['cmi.core.score.raw'] = String(row.ScoreRaw);
  if (row.ScoreMin !== null && row.ScoreMin !== undefined) cmi['cmi.core.score.min'] = String(row.ScoreMin);
  if (row.ScoreMax !== null && row.ScoreMax !== undefined) cmi['cmi.core.score.max'] = String(row.ScoreMax);
  if (row.LessonLocation) cmi['cmi.core.lesson_location'] = String(row.LessonLocation);
  if (row.SuspendData) cmi['cmi.suspend_data'] = String(row.SuspendData);
  if (typeof row.TotalTimeSeconds === 'number') cmi['cmi.core.total_time'] = formatScormTime(row.TotalTimeSeconds);
  cmi['cmi.core.entry'] = 'resume';
  return cmi;
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npx heft test --test-path-pattern ScormProgressService
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/webparts/piScormPlayer/services/ScormProgressService.ts src/webparts/piScormPlayer/services/__tests__/ScormProgressService.test.ts
git commit -m "feat: load existing SCORM progress for resume"
```

---

## Phase 4 — API bridge + React components

### Task 9: `ScormApiBridge` — mount shim onto wrapper iframe

**Files:**
- Create: `src/webparts/piScormPlayer/services/ScormApiBridge.ts`

The bridge owns the wrapper iframe. The SCO iframe is injected inside the wrapper. `window.API` lives on the wrapper's `contentWindow`, never on the host page.

- [ ] **Step 1: Implement**

```ts
import { ScormApi12 } from './ScormApi12';

export interface IBridgeOptions {
  api: ScormApi12;
  ssoEntryUrl: string;
  wrapperEl: HTMLDivElement;
  onScoLoad?: () => void;
  onUnload?: () => void;
}

export interface IBridgeHandle {
  destroy(): void;
}

export function mountBridge(opts: IBridgeOptions): IBridgeHandle {
  const wrapper = document.createElement('iframe');
  wrapper.style.width = '100%';
  wrapper.style.height = '100%';
  wrapper.style.border = '0';
  wrapper.title = 'SCORM player';
  opts.wrapperEl.appendChild(wrapper);

  const wrapperWin = wrapper.contentWindow as (Window & { API?: ScormApi12 }) | null;
  if (!wrapperWin) {
    throw new Error('Wrapper iframe contentWindow unavailable');
  }
  wrapperWin.API = opts.api;

  const scoFrame = wrapperWin.document.createElement('iframe');
  scoFrame.style.width = '100%';
  scoFrame.style.height = '100%';
  scoFrame.style.border = '0';
  scoFrame.src = opts.ssoEntryUrl;
  if (opts.onScoLoad) scoFrame.addEventListener('load', opts.onScoLoad);
  wrapperWin.document.body.style.margin = '0';
  wrapperWin.document.body.appendChild(scoFrame);

  const beforeUnload = () => { if (opts.onUnload) opts.onUnload(); };
  wrapperWin.addEventListener('beforeunload', beforeUnload);

  return {
    destroy(): void {
      try { wrapperWin.removeEventListener('beforeunload', beforeUnload); } catch (e) { /* iframe may already be detached */ }
      if (opts.onUnload) opts.onUnload();
      wrapper.remove();
    }
  };
}
```

> **Why no Jest test for the bridge:** this is DOM-against-real-iframe glue. Manual smoke (Task 15) exercises it end-to-end with the actual SCORM package; that's higher-fidelity coverage than mocking iframe windows.

- [ ] **Step 2: Commit**

```bash
git add src/webparts/piScormPlayer/services/ScormApiBridge.ts
git commit -m "feat: SCORM API bridge mounts shim onto isolated wrapper iframe"
```

### Task 10: `ScormErrorState` component

**Files:**
- Create: `src/webparts/piScormPlayer/components/ScormErrorState.tsx`

- [ ] **Step 1: Implement**

```tsx
import * as React from 'react';

export interface IScormErrorStateProps {
  variant: 'manifestMissing' | 'manifestMalformed' | 'noPermission' | 'configMissing' | 'unknown';
  detail?: string;
  isEditMode: boolean;
}

const COPY: Record<IScormErrorStateProps['variant'], { learner: string; author: string }> = {
  manifestMissing:    { learner: 'This module is unavailable.',  author: "Couldn't find imsmanifest.xml in the selected folder. Confirm the SCORM package was unzipped before upload." },
  manifestMalformed:  { learner: 'This module is unavailable.',  author: "imsmanifest.xml is malformed. Re-export the package or check for upload corruption." },
  noPermission:       { learner: 'Progress could not be saved.', author: 'You need Manage Lists on this site to provision PiCanvasScormProgress. Ask a site owner to play this module once, or grant the permission.' },
  configMissing:      { learner: 'This module is unavailable.',  author: 'No SCORM folder is selected. Open the property pane and pick a folder.' },
  unknown:            { learner: 'This module is unavailable.',  author: 'Unexpected error — check the browser console for details.' }
};

export const ScormErrorState: React.FC<IScormErrorStateProps> = ({ variant, detail, isEditMode }) => {
  const copy = COPY[variant];
  return (
    <div role="alert" style={{ padding: '24px', border: '1px solid #d1d1d1', borderRadius: '4px', background: '#faf9f8' }}>
      <strong>{copy.learner}</strong>
      {isEditMode && (
        <div style={{ marginTop: '12px', fontSize: '0.9em', color: '#605e5c' }}>
          <div><em>Author note:</em> {copy.author}</div>
          {detail && <pre style={{ marginTop: '8px', fontSize: '0.85em', whiteSpace: 'pre-wrap' }}>{detail}</pre>}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/webparts/piScormPlayer/components/ScormErrorState.tsx
git commit -m "feat: SCORM error state with author/learner-aware copy"
```

### Task 11: `ScormToolbar` component

**Files:**
- Create: `src/webparts/piScormPlayer/components/ScormToolbar.tsx`

- [ ] **Step 1: Implement**

```tsx
import * as React from 'react';

export interface IScormToolbarProps {
  title: string;
  status: string;
  scoreRaw?: number | null;
  scoreMax?: number | null;
  hasResumeData: boolean;
  onRestart: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  'not attempted': 'Not started',
  'incomplete':    'In progress',
  'completed':     'Completed',
  'passed':        'Passed',
  'failed':        'Failed',
  'browsed':       'Browsed'
};

export const ScormToolbar: React.FC<IScormToolbarProps> = (props) => {
  const label = STATUS_LABELS[props.status] || props.status;
  const score = props.scoreRaw !== null && props.scoreRaw !== undefined ? props.scoreRaw : null;
  const max = props.scoreMax !== null && props.scoreMax !== undefined ? props.scoreMax : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderBottom: '1px solid #edebe9' }}>
      <span style={{ fontWeight: 600 }}>{props.title}</span>
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ padding: '2px 8px', borderRadius: '12px', background: '#edf3fe', fontSize: '0.85em' }}>{label}</span>
        {score !== null && <span style={{ fontSize: '0.9em' }}>{score}{max !== null ? `/${max}` : ''}</span>}
        {props.hasResumeData && (
          <button onClick={props.onRestart} style={{ background: 'transparent', border: '1px solid #c8c6c4', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer' }}>
            Restart
          </button>
        )}
      </span>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/webparts/piScormPlayer/components/ScormToolbar.tsx
git commit -m "feat: SCORM toolbar with status pill, score, restart"
```

### Task 12: `PiScormPlayer` top-level component + `ScormFrame`

**Files:**
- Create: `src/webparts/piScormPlayer/components/ScormFrame.tsx`
- Create: `src/webparts/piScormPlayer/components/PiScormPlayer.tsx`

- [ ] **Step 1: `ScormFrame` — bridge mount/unmount + ref container**

```tsx
import * as React from 'react';
import { ScormApi12 } from '../services/ScormApi12';
import { mountBridge, IBridgeHandle } from '../services/ScormApiBridge';

export interface IScormFrameProps {
  api: ScormApi12;
  entryUrl: string;
  height: string;
  onUnload: () => void;
}

export const ScormFrame: React.FC<IScormFrameProps> = ({ api, entryUrl, height, onUnload }) => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!ref.current) return;
    let handle: IBridgeHandle | undefined;
    try {
      handle = mountBridge({ api, ssoEntryUrl: entryUrl, wrapperEl: ref.current, onUnload });
    } catch (e) {
      console.error('SCORM bridge mount failed', e);
    }
    return () => { if (handle) handle.destroy(); };
  }, [api, entryUrl]);
  return <div ref={ref} style={{ width: '100%', height }} />;
};
```

- [ ] **Step 2: `PiScormPlayer` — orchestrates lifecycle**

```tsx
import * as React from 'react';
import { ScormApi12 } from '../services/ScormApi12';
import { ScormProgressService, ISpRestClient } from '../services/ScormProgressService';
import { parseManifest, ManifestResult } from '../services/ManifestParser';
import { CmiTree, createDefaultCmi } from '../models/ScormCmi12';
import { ScormFrame } from './ScormFrame';
import { ScormToolbar } from './ScormToolbar';
import { ScormErrorState } from './ScormErrorState';

export interface IPiScormPlayerProps {
  packageFolderUrl: string | undefined;
  entryHrefOverride: string | undefined;
  packageIdOverride: string | undefined;
  height: string;
  isEditMode: boolean;
  siteUrl: string;
  userId: number;
  userLoginName: string;
  userDisplayName: string;
  spClient: ISpRestClient;
  fetchText: (url: string) => Promise<string>;
}

interface ILoaded {
  manifest: { packageId: string; title: string; entryHref: string; warnings: string[] };
  initialCmi: CmiTree;
  hasResumeData: boolean;
}

export const PiScormPlayer: React.FC<IPiScormPlayerProps> = (props) => {
  const [error, setError] = React.useState<{ variant: 'manifestMissing' | 'manifestMalformed' | 'noPermission' | 'configMissing' | 'unknown'; detail?: string } | null>(null);
  const [loaded, setLoaded] = React.useState<ILoaded | null>(null);
  const [api, setApi] = React.useState<ScormApi12 | null>(null);
  const [progress, setProgress] = React.useState<ScormProgressService | null>(null);
  const [restartKey, setRestartKey] = React.useState(0);
  const [latestStatus, setLatestStatus] = React.useState<string>('not attempted');
  const [latestScoreRaw, setLatestScoreRaw] = React.useState<number | null>(null);
  const [latestScoreMax, setLatestScoreMax] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!props.packageFolderUrl) {
        setError({ variant: 'configMissing' });
        return;
      }
      const manifestUrl = joinUrl(props.packageFolderUrl, 'imsmanifest.xml');
      let xml: string;
      try {
        xml = await props.fetchText(manifestUrl);
      } catch (e) {
        if (!cancelled) setError({ variant: 'manifestMissing', detail: String(e) });
        return;
      }
      const result: ManifestResult = parseManifest(xml);
      if (!result.ok) {
        if (!cancelled) setError({ variant: 'manifestMalformed', detail: result.error });
        return;
      }
      const packageId = props.packageIdOverride || result.packageId;
      const entryHref = props.entryHrefOverride || result.entryHref;
      const svc = new ScormProgressService({
        siteUrl: props.siteUrl,
        userId: props.userId,
        userLoginName: props.userLoginName,
        packageId,
        packageFolderUrl: props.packageFolderUrl,
        client: props.spClient
      });
      let existing: CmiTree | null = null;
      try {
        existing = await svc.load();
      } catch (e) {
        console.warn('SCORM progress load failed', e);
      }
      if (cancelled) return;
      const initialCmi = existing ? { ...createDefaultCmi(), ...existing } : { ...createDefaultCmi(), 'cmi.core.entry': 'ab-initio' };
      const shim = new ScormApi12({
        initialCmi,
        studentId: props.userLoginName,
        studentName: props.userDisplayName,
        onCommit: (snap) => {
          setLatestStatus(snap['cmi.core.lesson_status'] || 'not attempted');
          setLatestScoreRaw(toNum(snap['cmi.core.score.raw']));
          setLatestScoreMax(toNum(snap['cmi.core.score.max']));
          try { svc.commit(snap); }
          catch (e) { console.warn('SCORM commit persist failed', e); }
        }
      });
      setApi(shim);
      setProgress(svc);
      setLoaded({ manifest: { packageId, title: result.title, entryHref, warnings: result.warnings }, initialCmi, hasResumeData: !!existing });
      setLatestStatus(initialCmi['cmi.core.lesson_status'] || 'not attempted');
    })().catch((e) => { if (!cancelled) setError({ variant: 'unknown', detail: String(e) }); });
    return () => { cancelled = true; };
  }, [props.packageFolderUrl, props.entryHrefOverride, props.packageIdOverride, restartKey]);

  const handleRestart = (): void => {
    setApi(null);
    setLoaded(null);
    setRestartKey((k) => k + 1);
  };

  const handleUnload = (): void => {
    if (progress) { void progress.flush(); }
  };

  if (error) return <ScormErrorState variant={error.variant} detail={error.detail} isEditMode={props.isEditMode} />;
  if (!loaded || !api) return <div style={{ padding: 24 }}>Loading…</div>;

  const entryUrl = joinUrl(props.packageFolderUrl!, loaded.manifest.entryHref);

  return (
    <div>
      <ScormToolbar
        title={loaded.manifest.title}
        status={latestStatus}
        scoreRaw={latestScoreRaw}
        scoreMax={latestScoreMax}
        hasResumeData={loaded.hasResumeData}
        onRestart={handleRestart}
      />
      <ScormFrame api={api} entryUrl={entryUrl} height={props.height} onUnload={handleUnload} />
    </div>
  );
};

function joinUrl(base: string, rel: string): string {
  return base.replace(/\/$/, '') + '/' + rel.replace(/^\//, '');
}
function toNum(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/webparts/piScormPlayer/components/ScormFrame.tsx src/webparts/piScormPlayer/components/PiScormPlayer.tsx
git commit -m "feat: PiScormPlayer top-level orchestration with restart + flush-on-unload"
```

---

## Phase 5 — Property pane folder picker

### Task 13: `ScormFolderPicker` PropertyPane control

**Files:**
- Create: `src/webparts/piScormPlayer/configPanel/ScormFolderPicker.ts`

This is a custom property-pane control. It opens an inline folder browser scoped to the current site, fetches the manifest on selection, and writes back three webpart properties: `packageFolderUrl`, `packageId`, `entryHref`.

- [ ] **Step 1: Implement** (uses `@pnp/spfx-property-controls` if already a dep; otherwise this is a thin custom control)

```ts
import * as React from 'react';
import * as ReactDom from 'react-dom';
import {
  IPropertyPaneField,
  PropertyPaneFieldType
} from '@microsoft/sp-property-pane';
import { parseManifest } from '../services/ManifestParser';

export interface IScormFolderPickerValue {
  packageFolderUrl: string;
  packageId: string;
  entryHref: string;
  title: string;
}

export interface IScormFolderPickerProps {
  label: string;
  value: IScormFolderPickerValue | undefined;
  siteUrl: string;
  fetchText: (url: string) => Promise<string>;
  onChange: (value: IScormFolderPickerValue | undefined) => void;
}

interface IInternalProps extends IScormFolderPickerProps {
  key: string;
}

class ScormFolderPickerHost extends React.Component<IScormFolderPickerProps, { input: string; busy: boolean; error?: string; preview?: IScormFolderPickerValue }> {
  constructor(props: IScormFolderPickerProps) {
    super(props);
    this.state = { input: props.value?.packageFolderUrl || '', busy: false, preview: props.value };
  }

  private validate = async (): Promise<void> => {
    const folder = this.state.input.trim().replace(/\/$/, '');
    if (!folder) { this.setState({ error: 'Enter a server-relative folder URL.' }); return; }
    this.setState({ busy: true, error: undefined });
    try {
      const xml = await this.props.fetchText(`${folder}/imsmanifest.xml`);
      const result = parseManifest(xml);
      if (!result.ok) { this.setState({ busy: false, error: result.error }); return; }
      const next: IScormFolderPickerValue = {
        packageFolderUrl: folder,
        packageId: result.packageId,
        entryHref: result.entryHref,
        title: result.title
      };
      this.setState({ busy: false, preview: next });
      this.props.onChange(next);
    } catch (e) {
      this.setState({ busy: false, error: `Could not read manifest: ${String(e)}` });
    }
  };

  private clear = (): void => {
    this.setState({ input: '', preview: undefined, error: undefined });
    this.props.onChange(undefined);
  };

  public render(): React.ReactElement {
    const p = this.state.preview;
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
      React.createElement('label', { style: { fontWeight: 600 } }, this.props.label),
      React.createElement('input', {
        type: 'text',
        value: this.state.input,
        placeholder: '/sites/x/Shared%20Documents/MyScormFolder',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => this.setState({ input: e.target.value }),
        style: { padding: 6, border: '1px solid #c8c6c4' }
      }),
      React.createElement('div', { style: { display: 'flex', gap: 6 } },
        React.createElement('button', { onClick: this.validate, disabled: this.state.busy, style: { padding: '4px 10px' } }, this.state.busy ? 'Reading…' : 'Validate folder'),
        p ? React.createElement('button', { onClick: this.clear, style: { padding: '4px 10px' } }, 'Clear') : null
      ),
      this.state.error ? React.createElement('div', { style: { color: '#a4262c', fontSize: '0.85em' } }, this.state.error) : null,
      p ? React.createElement('div', { style: { fontSize: '0.85em', background: '#f3f2f1', padding: 8, borderRadius: 4 } },
        React.createElement('div', null, React.createElement('strong', null, 'Title: '), p.title),
        React.createElement('div', null, React.createElement('strong', null, 'Package ID: '), p.packageId),
        React.createElement('div', null, React.createElement('strong', null, 'Entry: '), p.entryHref)
      ) : null
    );
  }
}

export function ScormFolderPicker(targetProperty: string, props: IScormFolderPickerProps): IPropertyPaneField<IInternalProps> {
  return {
    type: PropertyPaneFieldType.Custom,
    targetProperty,
    properties: { ...props, key: targetProperty } as IInternalProps,
    onRender: (elem: HTMLElement) => {
      ReactDom.render(React.createElement(ScormFolderPickerHost, props), elem);
    },
    onDispose: (elem: HTMLElement) => {
      ReactDom.unmountComponentAtNode(elem);
    }
  } as unknown as IPropertyPaneField<IInternalProps>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/webparts/piScormPlayer/configPanel/
git commit -m "feat: SCORM folder picker property-pane control"
```

---

## Phase 6 — Webpart entry + first end-to-end smoke

### Task 14: Wire up `PiScormPlayerWebPart`

**Files:**
- Modify: `src/webparts/piScormPlayer/PiScormPlayerWebPart.ts` (replace the Yeoman default)
- Modify: `src/webparts/piScormPlayer/PiScormPlayerWebPart.manifest.json`

- [ ] **Step 1: Replace `PiScormPlayerWebPart.ts`**

```ts
import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IPropertyPaneConfiguration, PropertyPaneTextField } from '@microsoft/sp-property-pane';
import { SPHttpClient } from '@microsoft/sp-http';
import { PiScormPlayer } from './components/PiScormPlayer';
import { ScormFolderPicker, IScormFolderPickerValue } from './configPanel/ScormFolderPicker';
import { ISpRestClient } from './services/ScormProgressService';

export interface IPiScormPlayerWebPartProps {
  packageFolderUrl: string;
  packageId: string;
  entryHrefOverride: string;
  height: string;
}

export default class PiScormPlayerWebPart extends BaseClientSideWebPart<IPiScormPlayerWebPartProps> {
  public render(): void {
    const ctx = this.context;
    const fetchText = async (url: string): Promise<string> => {
      const resp = await ctx.spHttpClient.get(absUrl(ctx.pageContext.web.absoluteUrl, url), SPHttpClient.configurations.v1);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.text();
    };
    const spClient: ISpRestClient = {
      get: (url) => ctx.spHttpClient.get(url, SPHttpClient.configurations.v1) as unknown as ReturnType<ISpRestClient['get']>,
      post: (url, init) => ctx.spHttpClient.post(url, SPHttpClient.configurations.v1, init) as unknown as ReturnType<ISpRestClient['post']>,
      merge: (url, init) => ctx.spHttpClient.fetch(url, SPHttpClient.configurations.v1, { ...init, method: 'POST', headers: { ...(init.headers || {}), 'X-HTTP-Method': 'MERGE' } }) as unknown as ReturnType<ISpRestClient['merge']>
    };
    const element = React.createElement(PiScormPlayer, {
      packageFolderUrl: this.properties.packageFolderUrl || undefined,
      entryHrefOverride: this.properties.entryHrefOverride || undefined,
      packageIdOverride: this.properties.packageId || undefined,
      height: this.properties.height || '600px',
      isEditMode: this.displayMode === 1,
      siteUrl: ctx.pageContext.web.absoluteUrl,
      userId: ctx.pageContext.legacyPageContext?.userId as number,
      userLoginName: ctx.pageContext.user.loginName,
      userDisplayName: ctx.pageContext.user.displayName,
      spClient,
      fetchText
    });
    ReactDom.render(element, this.domElement);
  }

  protected onDispose(): void { ReactDom.unmountComponentAtNode(this.domElement); }
  protected get dataVersion(): Version { return Version.parse('1.0'); }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [{
        header: { description: 'Configure SCORM module' },
        groups: [{
          groupName: 'Package',
          groupFields: [
            ScormFolderPicker('packageFolderUrl', {
              label: 'SCORM folder',
              siteUrl: this.context.pageContext.web.absoluteUrl,
              value: this.properties.packageFolderUrl ? { packageFolderUrl: this.properties.packageFolderUrl, packageId: this.properties.packageId, entryHref: this.properties.entryHrefOverride, title: '' } : undefined,
              fetchText: async (url) => {
                const r = await this.context.spHttpClient.get(absUrl(this.context.pageContext.web.absoluteUrl, url), SPHttpClient.configurations.v1);
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.text();
              },
              onChange: (val: IScormFolderPickerValue | undefined) => {
                this.properties.packageFolderUrl = val?.packageFolderUrl || '';
                this.properties.packageId = val?.packageId || '';
                this.properties.entryHrefOverride = val?.entryHref || '';
                this.render();
              }
            }),
            PropertyPaneTextField('entryHrefOverride', { label: 'Entry HTML override (optional)' }),
            PropertyPaneTextField('packageId', { label: 'Package ID' }),
            PropertyPaneTextField('height', { label: 'Player height (e.g. 600px)' })
          ]
        }]
      }]
    };
  }
}

function absUrl(siteUrl: string, urlOrServerRel: string): string {
  if (/^https?:/i.test(urlOrServerRel)) return urlOrServerRel;
  if (urlOrServerRel.startsWith('/')) {
    const u = new URL(siteUrl);
    return `${u.protocol}//${u.host}${urlOrServerRel}`;
  }
  return `${siteUrl.replace(/\/$/, '')}/${urlOrServerRel}`;
}
```

- [ ] **Step 2: Update manifest** (`PiScormPlayerWebPart.manifest.json`) — set `title` to "PiCanvas SCORM Player", `description` to "Hosts SCORM 1.2 packages with per-user progress tracking", `supportsFullBleed: true`.

- [ ] **Step 3: Build**

```bash
npx heft build --clean
```

Expected: clean build, no TS errors.

- [ ] **Step 4: Commit**

```bash
git add src/webparts/piScormPlayer/PiScormPlayerWebPart.ts src/webparts/piScormPlayer/PiScormPlayerWebPart.manifest.json
git commit -m "feat: wire PiScormPlayer webpart entry + property pane"
```

### Task 15: First end-to-end smoke against the Secure Passwords package

**Files:** none (manual verification)

- [ ] **Step 1: Start the dev server**

```bash
cd ~/Github/anthonyrhopkins/PiScormPlayer
npx heft start
```

- [ ] **Step 2: Open the SharePoint workbench** at `https://<tenant>.sharepoint.com/sites/<site>/_layouts/15/workbench.aspx`. Add the PiCanvas SCORM Player webpart.

- [ ] **Step 3: Upload the package**

Upload the unzipped `Secure Passwords Exercise SCORM` folder to `/sites/<site>/Shared Documents/SecurePasswords` via the SharePoint UI.

- [ ] **Step 4: Configure the webpart**

Open property pane → SCORM folder → enter `/sites/<site>/Shared%20Documents/SecurePasswords` → click Validate folder. Confirm preview shows Title `Secure Passwords Exercise`, Package ID `_69N0JE8a7oc`, Entry `index_lms.html`.

- [ ] **Step 5: Play the module**

Click through the SCO. Verify:
- The toolbar shows the title and "In progress" status as you advance.
- The browser console has no `findAPI` warnings (SCO found `window.API`).
- After completing/passing, the toolbar status becomes "Completed" or "Passed".

- [ ] **Step 6: Verify list provisioning**

Navigate to `/sites/<site>/Lists/PiCanvasScormProgress`. Confirm:
- The list exists.
- One row exists for your user with the correct `LessonStatus`, `ScoreRaw`, `LessonLocation`, `SuspendData`.

- [ ] **Step 7: Test resume**

Reload the page. The SCO should resume at the correct slide (verifies `LessonLocation`/`SuspendData` round-trip and `cmi.core.entry = 'resume'`).

- [ ] **Step 8: Test restart**

Click Restart in the toolbar. Confirm the SCO starts from slide 1 and that the list row has been reset (`LessonStatus = 'not attempted'`, no `LessonLocation`).

- [ ] **Step 9: Document any deviations**

If any step fails, file an issue and pause the plan to debug. If everything passes, commit a CHANGELOG note:

```bash
echo "## v0.1.0 (unreleased) — first SCORM end-to-end" >> CHANGELOG.md
git add CHANGELOG.md
git commit -m "docs: record first successful SCORM end-to-end smoke"
```

---

## Phase 7 — PiCanvas hooks

Switching repos. All tasks below operate in `~/Github/anthonyrhopkins/PiCanvas/`.

### Task 16: Add Jest to PiCanvas

**Files:**
- Modify: `~/Github/anthonyrhopkins/PiCanvas/config/heft.json`
- Modify: `~/Github/anthonyrhopkins/PiCanvas/package.json`
- Create: `~/Github/anthonyrhopkins/PiCanvas/config/jest.config.json`

- [ ] **Step 1: Install plugin**

```bash
cd ~/Github/anthonyrhopkins/PiCanvas
npm install --save-dev @rushstack/heft-jest-plugin@latest
```

- [ ] **Step 2: Register plugin** in `config/heft.json` (add to `heftPlugins` array; create if absent).

- [ ] **Step 3: Add `config/jest.config.json`**

```json
{
  "preset": "@rushstack/heft-jest-plugin",
  "testMatch": ["<rootDir>/src/**/*.test.ts", "<rootDir>/src/**/*.test.tsx"],
  "testEnvironment": "jsdom",
  "moduleFileExtensions": ["ts", "tsx", "js"],
  "transform": { "^.+\\.(ts|tsx)$": "ts-jest" }
}
```

- [ ] **Step 4: Smoke-test Jest**

Create `src/webparts/piCanvas/services/__tests__/jest-smoke.test.ts`:

```ts
describe('jest in PiCanvas', () => {
  it('runs', () => { expect(true).toBe(true); });
});
```

```bash
npx heft test
```

Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add config/heft.json config/jest.config.json package.json package-lock.json src/webparts/piCanvas/services/__tests__/jest-smoke.test.ts
git commit -m "chore: add Jest via heft-jest-plugin"
```

### Task 17: Bump template schema + add SCORM fields to `ITabTemplateConfig`

**Files:**
- Modify: `src/webparts/piCanvas/models/TemplateModels.ts`

- [ ] **Step 1: Bump version constant**

Find `export const TEMPLATE_SCHEMA_VERSION = '3.0';` and change to `'3.1'`. Update the comment block above with a v3.1 line:

```ts
/**
 * Schema version for backwards compatibility
 * v1.0 - Initial version
 * v2.0 - Added content types (markdown, html, mermaid, embed), deep linking, lazy loading
 * v3.0 - Added lockable tabs with customizable lock UI
 * v3.1 - Added SCORM completion gate + completion badge fields
 */
export const TEMPLATE_SCHEMA_VERSION = '3.1';
```

- [ ] **Step 2: Add fields to `ITabTemplateConfig`**

Append (just before the closing `}` of the interface):

```ts
  // SCORM completion integration (v3.1+)
  scormGate?: {
    packageId: string;
    acceptedStatuses?: ('completed' | 'passed')[];  // default: both
  };
  scormBadge?: {
    packageId: string;
  };
```

- [ ] **Step 3: Build to confirm no TS errors**

```bash
npx heft build --clean
```

- [ ] **Step 4: Commit**

```bash
git add src/webparts/piCanvas/models/TemplateModels.ts
git commit -m "feat(picanvas): schema v3.1 — add scormGate + scormBadge tab fields"
```

### Task 18: `ScormProgressReader` service

**Files:**
- Create: `src/webparts/piCanvas/services/ScormProgressReader.ts`
- Test: `src/webparts/piCanvas/services/__tests__/ScormProgressReader.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { ScormProgressReader } from '../ScormProgressReader';

const mkResp = (body: unknown, ok = true, status = 200) => ({
  ok, status, json: async () => body
});

describe('ScormProgressReader', () => {
  it('returns null when the list does not exist', async () => {
    const get = jest.fn().mockResolvedValue(mkResp({}, false, 404));
    const reader = new ScormProgressReader({ siteUrl: 'https://t/sites/x', userId: 1, get });
    const result = await reader.getCompletion('pkg');
    expect(result).toBeNull();
  });

  it('returns null when no row matches user+package', async () => {
    const get = jest.fn().mockResolvedValue(mkResp({ value: [] }));
    const reader = new ScormProgressReader({ siteUrl: 'https://t/sites/x', userId: 1, get });
    expect(await reader.getCompletion('pkg')).toBeNull();
  });

  it('returns row data on match', async () => {
    const get = jest.fn().mockResolvedValue(mkResp({ value: [{ LessonStatus: 'passed', ScoreRaw: 88, LastCommitUtc: '2026-05-19T10:00:00Z' }] }));
    const reader = new ScormProgressReader({ siteUrl: 'https://t/sites/x', userId: 1, get });
    const row = await reader.getCompletion('pkg');
    expect(row).toEqual({ status: 'passed', scoreRaw: 88, lastCommitUtc: new Date('2026-05-19T10:00:00Z') });
  });

  it('caches subsequent reads of the same packageId', async () => {
    const get = jest.fn().mockResolvedValue(mkResp({ value: [{ LessonStatus: 'completed', ScoreRaw: 50, LastCommitUtc: '2026-05-19T10:00:00Z' }] }));
    const reader = new ScormProgressReader({ siteUrl: 'https://t/sites/x', userId: 1, get });
    await reader.getCompletion('pkg');
    await reader.getCompletion('pkg');
    expect(get).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
npx heft test --test-path-pattern ScormProgressReader
```

- [ ] **Step 3: Implement**

```ts
export interface IScormCompletion {
  status: string;
  scoreRaw: number | null;
  lastCommitUtc: Date;
}

export interface IScormReaderOptions {
  siteUrl: string;
  userId: number;
  get: (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
}

export class ScormProgressReader {
  private readonly cache = new Map<string, IScormCompletion | null>();
  private inFlight = new Map<string, Promise<IScormCompletion | null>>();

  constructor(private readonly opts: IScormReaderOptions) {}

  public async getCompletion(packageId: string): Promise<IScormCompletion | null> {
    if (this.cache.has(packageId)) return this.cache.get(packageId) ?? null;
    const existing = this.inFlight.get(packageId);
    if (existing) return existing;
    const p = this.fetch(packageId).then((r) => { this.cache.set(packageId, r); this.inFlight.delete(packageId); return r; });
    this.inFlight.set(packageId, p);
    return p;
  }

  private async fetch(packageId: string): Promise<IScormCompletion | null> {
    const filter = `UserId eq ${this.opts.userId} and PackageId eq '${escapeOdata(packageId)}'`;
    const url = `${this.opts.siteUrl}/_api/web/lists/getbytitle('PiCanvasScormProgress')/items?$filter=${encodeURIComponent(filter)}&$select=LessonStatus,ScoreRaw,LastCommitUtc&$top=1`;
    let resp;
    try { resp = await this.opts.get(url); }
    catch { return null; }
    if (!resp.ok) return null;
    const json = (await resp.json()) as { value?: Array<{ LessonStatus?: string; ScoreRaw?: number | null; LastCommitUtc?: string }> };
    const row = json.value && json.value[0];
    if (!row) return null;
    return {
      status: row.LessonStatus || 'not attempted',
      scoreRaw: typeof row.ScoreRaw === 'number' ? row.ScoreRaw : null,
      lastCommitUtc: new Date(row.LastCommitUtc || 0)
    };
  }
}

function escapeOdata(s: string): string { return s.replace(/'/g, "''"); }
```

- [ ] **Step 4: Run, expect pass**

```bash
npx heft test --test-path-pattern ScormProgressReader
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/webparts/piCanvas/services/ScormProgressReader.ts src/webparts/piCanvas/services/__tests__/ScormProgressReader.test.ts
git commit -m "feat(picanvas): ScormProgressReader — read-only consumer of progress list"
```

### Task 19: Wire reader into tab render path + property pane rows

**Files:**
- Modify: `src/webparts/piCanvas/PiCanvasWebPart.ts` (one shared reader instance + two consumer call-sites)
- Modify: `src/webparts/piCanvas/configPanel/sections/TabBuilderSection.ts`

The two consumer call-sites:
1. **Gate evaluation** — wherever PiCanvas decides whether to show a tab's content vs. a locked placeholder. Today this is the password-lock check; we add a SCORM check that runs alongside it. If `tab.scormGate` is set and the reader returns `null` or a status not in `acceptedStatuses` (default `['completed', 'passed']`), render the existing locked placeholder. Both gates can apply; tab is unlocked only if BOTH pass.
2. **Badge rendering** — wherever PiCanvas renders the tab label, append a "✓ Completed" pill if `tab.scormBadge` is set and the reader returns a row with status in `['completed', 'passed']`.

- [ ] **Step 1: Instantiate `ScormProgressReader` once per webpart**

In `PiCanvasWebPart.ts`:

```ts
import { SPHttpClient } from '@microsoft/sp-http';
import { ScormProgressReader, IScormCompletion, IScormReaderOptions } from './services/ScormProgressReader';

// Class fields (add to PiCanvasWebPart):
private _scormReader?: ScormProgressReader;
private _scormCache: Map<string, IScormCompletion | null> = new Map();
```

In `render()` (or `onInit`), once per webpart instance:

```ts
if (!this._scormReader) {
  this._scormReader = new ScormProgressReader({
    siteUrl: this.context.pageContext.web.absoluteUrl,
    userId: this.context.pageContext.legacyPageContext?.userId as number,
    get: (url) => this.context.spHttpClient.get(url, SPHttpClient.configurations.v1) as unknown as ReturnType<IScormReaderOptions['get']>
  });
}
```

Before evaluating tabs each render, prefetch all referenced package IDs into `this._scormCache`:

```ts
const packageIds = new Set<string>();
for (const tab of tabs) {
  if (tab.scormGate?.packageId) packageIds.add(tab.scormGate.packageId);
  if (tab.scormBadge?.packageId) packageIds.add(tab.scormBadge.packageId);
}
await Promise.all(
  Array.from(packageIds).map(async (id) => {
    if (!this._scormCache.has(id)) {
      this._scormCache.set(id, await this._scormReader!.getCompletion(id));
    }
  })
);
```

This batches the reads so per-tab evaluation can be synchronous against the cache.

- [ ] **Step 2: Gate check — find the password-lock evaluation point and add a sibling SCORM check**

Search for `lockEnabled` in `PiCanvasWebPart.ts`. At each render-time decision, add:

```ts
if (tab.scormGate && tab.scormGate.packageId) {
  const completion = await this._scormReader.getCompletion(tab.scormGate.packageId);
  const accepted = tab.scormGate.acceptedStatuses || ['completed', 'passed'];
  if (!completion || accepted.indexOf(completion.status as 'completed' | 'passed') === -1) {
    return renderLockedPlaceholder(tab);  // reuse the existing locked-tab UI
  }
}
```

If the existing path is synchronous, kick off the read in `onInit` and cache results before render: a `Map<packageId, IScormCompletion | null>` populated once per page render. Same-render synchronous lookup, no re-fetch on each tab evaluation.

- [ ] **Step 3: Badge rendering — find tab label render**

Search for where `tab.label` is rendered in the tab nav. Add:

```ts
const badge = tab.scormBadge && this._scormCache.get(tab.scormBadge.packageId);
const showBadge = badge && (badge.status === 'completed' || badge.status === 'passed');
return (
  <span className="picanvas-tab-label">
    {tab.label}
    {showBadge && <span className="picanvas-tab-completion-pill">✓ Completed</span>}
  </span>
);
```

Reuse PiCanvas's existing chip styling — find an existing `*Pill` or chip class in `PiCanvasWebPart.module.scss` and add a `.picanvas-tab-completion-pill` rule mirroring it.

- [ ] **Step 4: Add property-pane rows in `TabBuilderSection.ts`**

Inside the per-tab settings render (locate the existing lock-section block), append:

```ts
// SCORM gate
PropertyPaneTextField(`tab${i}_scormGatePackageId`, {
  label: 'Lock until SCORM package completed (Package ID)'
}),
PropertyPaneCheckbox(`tab${i}_scormGateAcceptCompleted`, {
  text: 'Accept "completed"',
  checked: tab.scormGate?.acceptedStatuses?.indexOf('completed') !== -1
}),
PropertyPaneCheckbox(`tab${i}_scormGateAcceptPassed`, {
  text: 'Accept "passed"',
  checked: tab.scormGate?.acceptedStatuses?.indexOf('passed') !== -1
}),
// Completion badge
PropertyPaneTextField(`tab${i}_scormBadgePackageId`, {
  label: 'Show completion badge for SCORM package (Package ID)'
})
```

In `setProperty` handlers, normalize back into `tab.scormGate` and `tab.scormBadge` shapes (or clear them if package ID is empty). Mirror the pattern already used for other per-tab compound settings (see how `permissionStandardGroups` is wired).

- [ ] **Step 5: Build**

```bash
npx heft build --clean
```

Expected: clean build.

- [ ] **Step 6: Commit**

```bash
git add src/webparts/piCanvas/
git commit -m "feat(picanvas): tab-level SCORM gate + completion badge wired to ScormProgressReader"
```

---

## Phase 8 — Final integration smoke + release prep

### Task 20: End-to-end across both webparts

**Files:** none (manual + release notes)

- [ ] **Step 1: Build + package both solutions**

```bash
cd ~/Github/anthonyrhopkins/PiScormPlayer
npx heft build --clean --production && npx heft package-solution --production
ls sharepoint/solution/*.sppkg

cd ~/Github/anthonyrhopkins/PiCanvas
npm run package
ls sharepoint/solution/pi-canvas.sppkg
```

- [ ] **Step 2: Deploy both to a test site app catalog**

Reuse the deploy commands from `CLAUDE.md` / memory for the SAP `213105` site, swapping in the new SCORM .sppkg for one of them. (Add a second `m365 spo app add/deploy` block for `pi-scorm-player.sppkg`.)

- [ ] **Step 3: Configure a test page**

On a SP page on the test site, add:
1. A PiCanvas SCORM Player webpart pointing at the Secure Passwords folder.
2. A PiCanvas webpart with two tabs:
   - Tab A: `scormBadge.packageId = '_69N0JE8a7oc'`
   - Tab B: `scormGate.packageId = '_69N0JE8a7oc'`, `acceptedStatuses = ['completed', 'passed']`

- [ ] **Step 4: Run the integration smoke**

Acting as a fresh test user:
- Tab A label: should NOT show completion badge initially.
- Tab B: should render as locked.
- Play and complete the SCORM module.
- Reload the page.
- Tab A label: now shows ✓ Completed.
- Tab B: now unlocked, content visible.

- [ ] **Step 5: Run the cross-degradation smoke**

Uninstall `pi-scorm-player` from the test site. Reload PiCanvas. Confirm:
- Tab A renders without crashing (badge just doesn't show).
- Tab B renders as locked (existing locked placeholder, no error).
- Browser console: no uncaught errors from `ScormProgressReader` (404 on the missing list is expected and swallowed).

Re-install. Confirm Tab A and B return to normal.

- [ ] **Step 6: Write release notes**

In each repo:

```bash
# PiScormPlayer
cat >> CHANGELOG.md <<'EOF'
## v0.1.0 - 2026-MM-DD
- Initial release: SCORM 1.2 player webpart
- Auto-provisions PiCanvasScormProgress site list
- Per-user resume + restart
- Known limits: 1.2 only, single-SCO packages, no interactions/objectives persistence
EOF
git add CHANGELOG.md && git commit -m "docs: v0.1.0 release notes"

# PiCanvas
cat >> CHANGELOG.md <<'EOF'
## v2.4.0 - 2026-MM-DD
- Tab schema v3.1: scormGate + scormBadge fields
- New ScormProgressReader service (read-only)
- Tabs can gate or badge based on PiCanvasScormProgress list (provisioned by pi-scorm-player webpart)
EOF
git add CHANGELOG.md && git commit -m "docs: v2.4.0 release notes — SCORM completion hooks"
```

- [ ] **Step 7: Tag both releases**

```bash
cd ~/Github/anthonyrhopkins/PiScormPlayer && git tag v0.1.0
cd ~/Github/anthonyrhopkins/PiCanvas && git tag v2.4.0
```

(Pushing/publishing is a separate manual step; not in this plan.)

---

## Done

When Task 20 passes the cross-degradation smoke and the release notes are committed, the feature is shippable.

