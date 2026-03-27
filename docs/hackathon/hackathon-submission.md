# GitHub Issue Submission — Copy/Paste Into the Form

Below is the text for each field on the submission form at https://aka.ms/SharePoint/Hackathon/ProjectSubmission

---

## Field: Submission Name

```
PiCanvas — Infinite Possibilities in One Web Part (Built by a SharePoint Admin Through Vibe Coding)
```

---

## Field: Description

```
For the last 25 years, there's been a hard line between the people who manage SharePoint and the people who code for it. PiCanvas is what happens when that line disappears.

I'm a SharePoint administrator at SAP — not a developer. When our People & Culture team needed a way to organize a painfully long SharePoint page into tabs, the only community solution available was built on SPFx 1.13 and wouldn't pass our security scans. So on a Friday afternoon, with 75 minutes before picking up my son, I used AI-assisted development to upgrade it, add features, run it through SAP's security scanning, and deploy it to production. That was a few months ago. I haven't stopped building since.

## What PiCanvas Does

PiCanvas is a single SPFx web part that organizes SharePoint content into flexible, fully customizable tabbed layouts — with **12 content types** (and counting), enterprise-grade security, and a configuration experience that goes far beyond what any existing tab solution offers.

### 12 Content Types in One Web Part

| Content Type | What It Does |
|---|---|
| **Web Part** | Any native SharePoint web part inside a tab |
| **Section** | Entire multi-column SharePoint sections grouped into tabs — each tab is its own mini-page |
| **Markdown** | GitHub Flavored Markdown with syntax highlighting |
| **HTML** | Sanitized HTML content (DOMPurify-protected) |
| **Mermaid** | Diagrams, flowcharts, and architecture visualizations |
| **Embed** | iframes for YouTube, Power BI, Forms, Vimeo — with domain whitelist |
| **RSS** | Feed reader with list, card, and compact layouts |
| **File** | External .html or .md files from SharePoint document libraries |
| **JavaScript** | Custom template execution with sandboxed API |
| **TOC** | Auto-generated Table of Contents from page headings |
| **Profile Report** | Company intelligence dashboards |
| **GitHub** | Native GitHub repo rendering via API — built when iframe embedding was blocked by CSP *(newest)* |

### Full-Screen Configuration Panel

PiCanvas replaces the standard property pane with a **full-screen configuration experience** — tab builder with drag-and-drop, appearance controls, a color engine with 6 pickers, typography settings, border/shadow/transition controls, and a template system for export/import.

![PiCanvas Configuration Panel](https://raw.githubusercontent.com/anthonyrhopkins/PiCanvas/main/docs/images/config-panel-tabs-expanded.png)

### Enterprise Features

- **Permission-Based Tab Visibility** — Show/hide individual tabs by SharePoint group (Owners, Members, Visitors, custom groups). Same page, different experience per audience.
- **Password-Protected Tabs** — Lock individual tabs with hashed passwords (bcrypt-style). Customizable lock screen UI.
- **Templates** — Save, export, and import full configurations. Built-in templates for common layouts. Teams build their own template libraries.
- **Application Customizer Extension** — Pre-hides content before page render to eliminate flash of unstyled content.
- **Deep Linking** — URL hash navigation (#tab-name) for direct links to specific tabs.
- **Lazy Loading** — Tab content loads on demand for performance.
- **Theme Awareness** — Auto-detects light/dark mode with 25+ CSS custom properties for full theming control.

![PiCanvas Templates](https://raw.githubusercontent.com/anthonyrhopkins/PiCanvas/main/docs/images/settings-templates.png)

### Styling & Customization

4 tab styles (default, pills, underline, boxed) × 4 alignments × horizontal/vertical orientation. Up to 20 tabs per instance. Web parts or images as tab labels. Tab dividers. Colored glows. Everything is customizable — this isn't a rigid component, it's a design system.

## The Technical Foundation

- **SPFx 1.22** — Latest version, Heft build toolchain, TypeScript 5.6
- **Service Architecture** — Dedicated services for content rendering, permissions, theming, templates, tab locking, metadata tokens, TOC generation, RSS parsing, and more
- **Security** — DOMPurify for HTML sanitization, domain whitelist for embeds, SAP's full security scanning and code review passed
- **Zero deprecated dependencies** — Modern ESLint, current packages throughout

## In Production at SAP

PiCanvas is not a proof of concept. It is deployed and actively used at SAP for:
- **People & Culture initiative pages** — The original use case. Long pages reorganized into tabbed experiences.
- **Travel resource hubs** — Policies, forms, and booking tools organized by region with permission-based visibility.
- **Full-stack applications built entirely on SharePoint** — This is where PiCanvas goes beyond tabs.

### Full-Stack SharePoint: Lists as Database, Libraries as File System, PiCanvas as Frontend

One of the most advanced deployments uses PiCanvas to power a complete application with **zero external infrastructure** — no Azure Functions, no external databases, no additional servers:

| Layer | SharePoint Feature | Role |
|---|---|---|
| **Database** | SharePoint List | Tens of thousands of structured items with relational IDs, person columns for ownership, rich metadata fields, and JSON columns for structured intelligence data |
| **File System** | Document Library | Organized folder hierarchy (12+ content folders) with files linked back to list items through a unique ID naming convention — enabling relational lookups across lists and libraries |
| **API** | SharePoint REST + Microsoft Graph | ProfileReportService queries lists with pagination (handling 50K+ items via @odata.nextLink), loads 9+ file types per record in parallel using Promise.allSettled, and connects to Graph for live data |
| **Access Control** | SharePoint Groups + Permissions | Permission-based tab visibility ensures different users see different views. Person columns on list items enable ownership-based filtering. No duplicate pages needed. |
| **Frontend** | PiCanvas Web Part | Renders everything — list data in tabs, library files as content, interactive reports, live feeds — with a JavaScript sandbox API (graphFetch, httpFetch) for custom rendering and Graph connectivity |

The result is a production application that leverages SharePoint's built-in infrastructure — security, versioning, search, permissions, storage — without bolting on external services. PiCanvas turns SharePoint from a content platform into an application platform.

## The Vibe Coding Story

This project was built almost entirely through AI-assisted development — GitHub Copilot and Claude Code as coding partners. I'm a SharePoint admin who spent years as the bridge between developers and end users. That perspective — knowing what people need and how the platform works — combined with AI tooling, is what made PiCanvas possible.

Case in point: while prepping this hackathon submission, I wanted to display the GitHub repo right inside SharePoint — in a PiCanvas tab. But GitHub blocks iframe embedding via Content Security Policy. So I did what I've been doing this entire time — I vibe coded a new content type. A **GitHub renderer** that pulls repo data through the GitHub API and displays it natively inside PiCanvas. Built it, tested it, deployed it. That's content type number twelve. When you hit a wall, you don't file a ticket — you just build it.

AI didn't replace a developer here. It created one.

## Open Source & Community

PiCanvas is accepted into the **PnP Sample Gallery** and is MIT licensed. The code is on GitHub — fork it, extend it, take pieces of it.

Originally based on [Mark Rackley's Hillbilly Tabs](http://www.markrackley.net/2022/06/29/the-return-of-hillbilly-tabs/), PiCanvas v2+ is a complete modernization — upgraded from SPFx 1.13 to 1.22, with 12 content types, a full configuration panel, enterprise security, and a template system that didn't exist in the original.

![PiCanvas Overview](https://raw.githubusercontent.com/anthonyrhopkins/PiCanvas/main/docs/images/picanvas-hero.png)
```

---

## Field: Submission Categories

```
- [x] SharePoint site
- [ ] Mobile experience
- [ ] Knowledge Agent
- [ ] Agents and SharePoint
- [x] SharePoint Framework
- [ ] SharePoint Embedded
```

---

## Field: Project video

```
https://pispace.sharepoint.com/sites/PiCanvas/Public/PiCanvas-Hackathon-Demo.mp4
```

> **Options (pick one):**
> 1. **YouTube (safest)** — Upload as unlisted, paste the youtu.be link. Guaranteed to work with the submission form.
> 2. **SharePoint "anyone" link** — Make the site public, upload the .mp4 to Site Assets or a Stream page, create an "Anyone with the link" sharing URL. This is brilliant because the judge lands *on the PiCanvas site itself* — the demo is the delivery mechanism. But verify the form accepts non-YouTube URLs first.
> 3. **Both** — Upload to YouTube for the form, but include the SharePoint link in your description as a bonus: "See PiCanvas in action on a live SharePoint site: [link]". Best of both worlds.
>
> **Recommendation: Option 3.** YouTube for the form field (guaranteed compatible), SharePoint "anyone" link in the description text (judges see the real thing). The SharePoint link is a flex nobody else in the hackathon can do.

---

## Field: Project Repository URL

```
https://github.com/anthonyrhopkins/PiCanvas
```

---

## Field: Team Members

```
anthonyrhopkins
```

---

## Field: LinkedIn Profiles

```
https://www.linkedin.com/in/anthonyrhopkins
```

---

## Field: Badge validation

```
- [x] I verify that all of my team members have completed the badge validation form at aka.ms/SharePointHackathon/Badges.
```

---

# WHY THIS SUBMISSION STANDS OUT

## What the top competitors do and how we counter:

| Competitor | Their Strength | Our Counter |
|---|---|---|
| **NOXEN Intranet** (5 categories) | Beautiful design, polished branding | PiCanvas is open source in PnP Gallery — anyone can use it, not a custom build for a fictional company |
| **SymanticRTE** | Technically elegant, from-scratch editor | Narrow single purpose. PiCanvas does 12 content types and solves a dozen use cases |
| **ShareGPT** (4 categories) | Full RAG pipeline, Azure stack | Completely different lane — AI chatbot vs. content platform |
| **TransmittalFlow** | Strong architecture, SPFx + Next.js | Niche workflow tool. PiCanvas is general purpose — anyone with a SharePoint page uses it today |

## What makes the submission text effective:

1. **Opens with the 25-year narrative** — same thesis as the video. Judges who read the submission and watch the video get a consistent, memorable story.
2. **The table of 12 content types** is a visual punch. When judges scan 62 SPFx submissions, this table makes them stop scrolling.
3. **Three embedded images** — hero screenshot, config panel, templates. The top submissions (NOXEN, TransmittalFlow) all use images to break up text and prove the product exists.
4. **"In Production at SAP"** as its own section — explicitly separates you from proofs of concept.
5. **"AI didn't replace a developer here. It created one."** — The money line appears in both the video and the submission. Judges remember this.
6. **Credits Mark Rackley** — Shows community respect and honesty about the project's origins. Judges (who are Microsoft PMs and advocates) notice this.
7. **Two categories selected** — SPFx (primary) and SharePoint site (the styling/design angle). Could add a third if the Copilot API research portal is demo-ready.

## IMPORTANT: Before submitting

- [ ] Upload your video to YouTube (unlisted is fine)
- [ ] Paste the YouTube URL into the "Project video" field
- [ ] Verify that your GitHub repo (https://github.com/anthonyrhopkins/PiCanvas) is public and the README is current
- [ ] Complete the badge validation form at aka.ms/SharePointHackathon/Badges
- [ ] Verify the image URLs work (they reference your GitHub repo's /docs/images/ folder — raw.githubusercontent.com links)
- [ ] Update your LinkedIn URL if the one above isn't exact
- [ ] Submit at https://aka.ms/SharePoint/Hackathon/ProjectSubmission
