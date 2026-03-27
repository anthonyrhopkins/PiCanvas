# PiCanvas — SharePoint 25th Anniversary Hackathon Script (v4 — FINAL)

**Categories:** Most Innovative SharePoint Experience with SPFx + Best Design for SharePoint Site
**Presenter:** Anthony Hopkins, SAP
**Target Length:** 7:30–7:50 (buffer to hard stop at 8:00)
**Judging criteria:** Innovation, Impact, Technical Usability, Category Alignment
**Special recognition targets:** Most Enthusiastic Presenter, Most Innovative SharePoint Hack

---

## COMPETITIVE POSITIONING (For Your Eyes Only)

62 SPFx submissions. Most are AI chatbots or single-purpose tools. Your advantages:

- **You're the only non-developer origin story.** Nobody else leads with this.
- **Production at SAP.** Most entries are demos for fictional companies.
- **PnP Gallery accepted.** Community-validated. Open source. Anyone can use it today.
- **Breadth.** 11 content types vs. single-purpose tools. General-purpose vs. niche.
- **The human story.** Judges remember narratives, not feature lists.

Key competitors: SymanticRTE (Stefan Bauer — technically elegant but narrow), NOXEN Intranet (João Ferreira — beautiful but custom/fictional), ShareGPT (AI chatbot — different lane entirely), TransmittalFlow (strong architecture but niche workflow).

Your script counters all of them without naming any of them.

---

## SCRIPT

---

### [0:00–0:40] THE HOOK — Thesis, Then Proof

**[SCREEN: PiCanvas on a stunning SharePoint page. 6+ styled tabs visible. Webcam picture-in-picture, bottom-right. You're looking at the camera, not the screen.]**

> For the last 25 years, there's been a hard line between the people who manage SharePoint and the people who code for it. But with agentic coding tools like GitHub Copilot and Claude Code, I truly believe that line is blurring — fast.
>
> So let me take you on a quick tour of PiCanvas — and show you how one small idea on a Friday afternoon can snowball into something real.

**[Turn to screen. Click through tabs silently — one click per beat. Let each one register. Don't narrate what they are. Just click. The gap between "one small idea" and what's on screen does all the work.]**

> That's PiCanvas. One web part. Twelve content types. In production at SAP. Fair warning though — once you start vibe coding and seeing your ideas come to life, it is very hard to stop.

**[SCREEN: Quick flash of the GitHub repo page and PnP Sample Gallery listing.]**

> PiCanvas has been in the PnP Sample Gallery for a few months now. The code is all on GitHub — open source, MIT licensed. If you haven't taken a look, feel free. Fork it, extend it, submit questions or feedback. That's what this community is built on.

---

### [0:40–1:10] WHO YOU ARE — Credibility Without the Job Title

> I'm Anthony Hopkins. I work with Microsoft 365 technologies at SAP — on the leadership of our Copilot Technical Adoption team. Before SAP, I spent four and a half years at Microsoft as an escalation engineer.
>
> My whole career has been the bridge between builders and users. Now I'm an FDE building AI solutions for our go-to-market teams at SAP — or as I like to call it, professional vibe coder.

**[Gently click a tab or two while talking — screen never freezes.]**

---

### [1:10–2:20] THE FRIDAY AFTERNOON — Where It All Started

> A few months ago, somebody came to me with a problem. They had a lot of content they needed to share on SharePoint, but the page was getting way too long. Nobody's scrolling through all of that.

**[SCREEN: A painfully long SharePoint page. Scroll it slowly — let the length register.]**

> Now, they'd actually done their homework. They'd found a solution on their own — a community sample called Hillbilly Tabs. It lets you take individual web parts in the same section and put them in tabs. Great concept. The problem? It was over four years old, running SPFx 1.13.
>
> In my two and a half years at SAP, I've helped a lot of teams deploy custom web parts. I knew this one wasn't going to fly. There are certain things that need to happen before we can approve anything — even for a site collection app catalog.
>
> Thankfully, she reached out to me on a Friday — 75 minutes before I had to pick up my son. So instead of recommending she go through our consultation and development team, I asked her — do you mind if we take a stab at it ourselves?

**[SCREEN: Cut to the same content, now organized in PiCanvas tabs. Click through them.]**

> In the first 35, 40 minutes, we upgraded it to SPFx 1.21 and started adding features. The ability to have web parts in different sections of the page — not all grouped under one tab. The ability to put entire sections in a tab, not just individual web parts. Customizable tab names — not just plain text, but formatted. And then — why not use actual web parts *as* the tabs themselves? Images, banners, whatever you want.
>
> Seventy-five minutes. Upgraded, new features, tested, deployed. And it was really, really fun.

**[Beat. Look at camera.]**

> I thought that was it. That was *not* it.

---

### [2:20–3:20] THE SNOWBALL — You Know This Feeling

**[SCREEN: Click through progressively more advanced content types as you talk.]**

> The ideas just kept flooding in. Somebody wanted Mermaid diagrams and Markdown rendered in a tab — done. Somebody wanted to run JavaScript — okay, let's see. Can I pull in HTML source code and render it right on the page? Yes. Can I point to an external file — HTML, JavaScript, whatever — stored in another part of the site, or even another site entirely? Added that too.
>
> Every day, more ideas. And you just can't stop — because every one of them *works*.
>
> Eleven content types later, this wasn't a tab web part anymore. It was a canvas. And the name clicked — pi, the infinite number, theoretically contains every sequence that ever existed. PiCanvas. Infinite possibilities, one web part.
>
> And now I've taken it to where I have fully powered applications — using SharePoint lists as a database, document libraries as a file system, relational data linking files to items — building full-stack solutions where I'm displaying hundreds of thousands of files across thousands of customers in a clean, easy-to-use, easy-to-maintain interface. All in SharePoint. Zero external infrastructure.
>
> If you've ever vibe coded, you know this feeling. Every idea feels possible — because it *is* possible.

---

### [2:50–5:15] THE DEMO — Five Features, Rapid and Deep

**[Every transition smooth. Pre-load everything. Practice this section until you can do it without notes.]**

---

#### [2:50–3:25] SECTION TABS — "This is what sets it apart."

> Let me show you the feature I'm most proud of. Most tab web parts put *a* web part inside a tab. PiCanvas puts an entire SharePoint *section* in a tab — multiple columns, multiple web parts, the full layout.

**[DEMO: Click a section tab. A multi-column layout appears — image gallery, text column, chart — all inside one tab. Click to another section tab for contrast.]**

> Each tab is its own mini-page. Authors design them with the same SharePoint tools they already know — columns, web parts, all of it. No code required.

---

#### [3:25–4:00] THE CONFIGURATION PANEL — "Not your standard property pane."

**[DEMO: Click Edit → open PiCanvas config. The full-screen custom panel appears. Let the judges absorb the UI for a second.]**

> This is PiCanvas's configuration experience. Full-screen custom panel — not the standard property pane. Tab management with drag-and-drop. Appearance controls. And a full theming engine —

**[Open Colors section]**

> Six color pickers. Font controls. Border radius. Shadow intensity. Transition speed. Twenty-five CSS custom properties.

**[Rapid-fire: switch styles — default → pills → underline → boxed. Flip orientation horizontal → vertical. Change a color scheme.]**

> Four styles. Four alignments. Horizontal or vertical. Light and dark mode auto-detection — or manual override. You can make this look like anything.

---

#### [4:00–4:30] PERMISSION-BASED TABS — "One page. Smart tabs."

> Here's where it gets enterprise-serious.

**[DEMO: Open a tab's permission settings. Toggle the switch. Show group selector.]**

> Every individual tab can be restricted to specific SharePoint groups — Owners, Members, Visitors, any custom group. Same URL, completely different experience depending on who's logged in.
>
> Think about what this replaces. No duplicate pages. No complex audience targeting. The HR team sees their admin tools. Everyone else sees the public content. One page. Smart tabs.

**[If possible: "If I switch to a Members view right now, these two tabs simply disappear."]**

---

#### [4:30–4:55] TAB LOCKING — "Yes, the passwords are hashed."

**[DEMO: Click a locked tab. Lock screen appears with custom message.]**

> Password-protected tabs. Click one — you get a custom lock screen. Custom title, custom message.

**[Type password. Tab unlocks — content revealed.]**

> Enter the password, and you're in. I pulled this pattern from a password vault web part I built earlier. The passwords are hashed — bcrypt-style. No plain text. Ever. SAP's security team appreciated that.

---

#### [4:55–5:15] TEMPLATES — "Build once. Deploy everywhere."

**[DEMO: Open template panel. Show built-in templates and export/import.]**

> Templates. Save your entire PiCanvas configuration — tabs, content types, styling, permissions, everything. Export it. Import it on another page, another site, another tenant. Teams build their own template libraries. Configure once, deploy everywhere.

---

### [5:15–6:25] IN PRODUCTION — "This isn't a proof of concept."

**[This is your secret weapon. Most of the 62 entries are demos. Yours is real. And PiRadar elevates PiCanvas from "nice tab web part" to "full-stack platform."]**

> I want to be really clear about something. PiCanvas is not a hackathon demo. It's not running on localhost. It is in production at SAP, right now, being used by real people.

**[SCREEN: Show a production page — anonymized if needed. Or describe while showing your demo site.]**

> The People & Culture team that started this whole thing? Their initiative page went from that endless scroll to a clean tabbed experience. People actually use it now — because they can actually *find* things.
>
> Another team built a travel hub — policies, forms, booking tools organized by region, with permission-based tabs so each office only sees what's relevant to them.

**[SCREEN: Switch to PiRadar / the research portal. Show the interface — the landing page, the signals feed, the reports browser.]**

> But here's where it gets really interesting. Let me show you what happens when you push PiCanvas to its limit.
>
> This is a full-stack application — running entirely inside SharePoint. No external servers. No Azure Functions. Just SharePoint lists, document libraries, and PiCanvas tying it all together.
>
> A SharePoint list acts as the database — tens of thousands of items with structured fields, relational IDs, and person columns for ownership. A document library acts as the file system — organized into folders by content type, with files linked back to list items through a naming convention based on unique IDs. PiCanvas renders it all — pulling data from the list, loading files from the library in parallel, and displaying everything in tabs with permission-based visibility so different users see different views.

**[Click through tabs — show different views/content types loading. Keep it moving.]**

> SharePoint permissions handle the access control. The JavaScript sandbox API I built into PiCanvas connects to Microsoft Graph for live data. Templates make the whole setup portable. And the configuration panel means someone who isn't me can actually manage it.
>
> It's lists as a database, libraries as a file system, PiCanvas as the frontend, and SharePoint REST as the API layer. Full stack — zero external infrastructure.

**[Beat. Let that sink in.]**

> And here's what I'm most proud of. People keep showing up with *new* ideas. Use cases I never imagined. When your users become your product team — that's when you know you built something real.

---

### [6:25–7:05] UNDER THE HOOD — "Built for a tenant with tens of thousands of users."

**[SCREEN: GitHub repo → code structure → PnP listing. 5 seconds per visual. Keep moving.]**

> Quick technical picture — because none of this matters if it can't run at scale.
>
> SPFx 1.22 — the latest version. Heft build toolchain. TypeScript 5.6. Every single dependency current and maintained.

**[SCREEN: Flash the /services folder.]**

> The architecture is service-based. Separate modules for content rendering, permissions, theming, template management, tab locking, metadata tokens, RSS parsing, Table of Contents generation. Each one isolated. Testable. Extensible.
>
> Security was non-negotiable. DOMPurify sanitizes every piece of HTML. Embedded content runs through a domain whitelist. There's an application customizer extension that pre-hides content *before* page render — so you never see a flash of unstyled content. This went through SAP's full security scanning and code review process before it ever touched our tenant.

**[SCREEN: PnP Sample Gallery listing.]**

> And it's open source. PiCanvas was accepted into the PnP Sample Gallery — MIT licensed. The code is on GitHub. Take it, fork it, extend it, rip out pieces for your own projects. That's what this community is built on.

**[Beat. Slight smile — you're about to tell them something fun.]**

> And actually — funny story. While I was prepping for *this* demo, I wanted to show the GitHub repo right here inside SharePoint. Embed it in a tab. But GitHub blocks iframe embedding. Content Security Policy won't allow it.
>
> So I did what I've been doing this entire time — I vibe coded a new content type. A GitHub renderer that pulls repo data through the API and displays it natively. Built it, tested it, added it to PiCanvas. That's content type number twelve now.

**[SCREEN: If you have it ready — show the GitHub content type rendering the PiCanvas repo inside a PiCanvas tab. If not, just keep your webcam on and tell the story.]**

> That's the thing about this workflow. When you hit a wall, you don't file a ticket. You don't wait for a sprint. You just *build it*. Friday afternoon energy — every single time.

---

### [7:15–7:50] THE CLOSE — Bring It Full Circle

**[SCREEN: Back to the hero PiCanvas page from the opening — the beautiful one. Webcam can be larger now or full-frame for the final lines.]**

> I started this video by saying that line between managing SharePoint and building for it is blurring. PiCanvas is what happens when it disappears completely.
>
> It started as a 75-minute Friday afternoon favor. It's now a production solution with real users, real adoption, and a growing feature set — accepted into the PnP Gallery, open source, built by an admin who's never formally written SPFx in his life.
>
> AI didn't replace a developer here. It *created* one. And I don't think I'm the last.
>
> Happy 25th birthday, SharePoint. Here's to the next 25 — where anyone who knows the platform can build for it.
>
> Thank you.

**[Hold the hero page. 3 seconds of silence. End recording.]**

---

## TIMING BREAKDOWN (v4)

| Section | Duration | Cumulative | Energy |
|---------|----------|------------|--------|
| The Hook + demo burst | 0:35 | 0:35 | HIGH — dare them, then deliver |
| Who I Am | 0:20 | 0:55 | Quick, warm, confident |
| Friday Afternoon | 1:10 | 2:05 | Storytelling — pull them in |
| The Snowball | 0:45 | 2:50 | Building, addictive energy |
| Demo: Section Tabs | 0:35 | 3:25 | "This is what sets it apart" |
| Demo: Config Panel | 0:35 | 4:00 | Rapid visual, impressive |
| Demo: Permissions | 0:30 | 4:30 | Enterprise authority |
| Demo: Tab Locking | 0:25 | 4:55 | Quick, punchy |
| Demo: Templates | 0:20 | 5:15 | Fast — it speaks for itself |
| In Production + PiRadar | 1:10 | 6:25 | Pride → "full stack, zero infra" jaw-drop |
| Under the Hood + GitHub anecdote | 0:50 | 7:15 | Tech cred → "I built a feature for this demo" laugh |
| The Close | 0:35 | 7:50 | Emotional, full circle |

**Total: ~7:50** — 10 seconds of buffer.

---

## V4 CHANGES FROM V3

1. **Anthony's opening replaces the cold open.** "For the last 25 years, there's been a hard line..." is the thesis statement of the entire video. It frames PiCanvas as a *25-year moment*, not just a web part. "Watch this" creates a dare — now the demo burst has dramatic weight behind it.

2. **The close mirrors the open.** "I started this video by saying..." brings it full circle. The opening sets up the tension. The close resolves it. Judges remember bookended narratives.

3. **"AI didn't replace a developer here. It *created* one."** This is the money line. It's quotable. It's the sentence a judge writes down when they're justifying their pick. It reframes the entire vibe coding movement in one line.

4. **"I don't think I'm the last."** Implies PiCanvas is the beginning of something bigger. Judges want to pick winners that represent a trend, not just a product.

5. **"I thought that was it. That was *not* it."** Refined the comedic beat — slightly tighter, hits harder. The emphasis on "*not*" is the laugh line.

6. **Demo flow tightened.** Templates section cut to 20 seconds (it's visual — it sells itself). Freed up 15 seconds for a stronger close.

7. **"Not running on localhost"** — Added to the production section. Subtle but pointed. The judges know that most hackathon demos are local. You're calling that out.

---

## KEY LINES TO NAIL (Practice These)

These are the lines that win or lose the video. Say them out loud 5 times each before recording:

1. **"For the last 25 years, there's been a hard line between the people who manage SharePoint and the people who code for it."** — Slow, deliberate. Let it land.

2. **"Once you start coming up with ideas and seeing them come to life, it's very hard to stop coming up with more."** — Warm, knowing smile. The audience just watched the proof.

3. **"Do you mind if we take a stab at it ourselves?"** — This is the moment the story turns. Casual, conspiratorial. You're inviting the audience into the decision.

4. **"I thought that was it. That was *not* it."** — Pause after "it." Then the correction with a grin.

5. **"If you've ever vibe coded, you know this feeling."** — Direct address to the community. They nod along.

6. **"PiCanvas is not a hackathon demo. It's not running on localhost."** — Firm. You're drawing a line between you and the field.

7. **"When your users become your product team — that's when you know you built something real."** — Pride. Let it breathe.

8. **"So I did what I've been doing this entire time — I vibe coded a new content type."** — Grin. The judges will laugh because you literally built a feature to make the hackathon demo better. It's meta, it's real, and it proves the thesis.

9. **"You don't file a ticket. You don't wait for a sprint. You just *build it*. Friday afternoon energy — every single time."** — Callback to the origin story. Full circle before the full circle.

10. **"AI didn't replace a developer here. It *created* one."** — THE line. Deliver it clean. Pause after.

11. **"And I don't think I'm the last."** — Quiet confidence. Then move to "Happy 25th birthday."

---

## DEMO PREPARATION CHECKLIST

**Hero page (first + last frame):**
- [ ] PiCanvas with 6+ tabs, each a different content type
- [ ] Best color scheme / styling you have — this is your visual signature
- [ ] Page title and layout should look professional and polished
- [ ] This page appears TWICE — opening and closing — it must be beautiful

**Cold open demo tabs (in click order):**
- [ ] Tab 1: Markdown with syntax highlighting
- [ ] Tab 2: Mermaid diagram (flowchart or architecture)
- [ ] Tab 3: RSS feed (live, rendering cards or list)
- [ ] Tab 4: Embedded content (Power BI, YouTube, or Forms)
- [ ] Tab 5: Locked tab (lock screen customized with a good message)

**Deep demo assets:**
- [ ] Section tab with multi-column layout (2-3 web parts inside one tab)
- [ ] Config panel ready — colors and styles pre-set for dramatic switching
- [ ] Permission-configured tab — groups assigned, ready to explain/demo
- [ ] Template panel — at least one built-in template visible, export button ready
- [ ] "Before" page — a long, ugly SharePoint page to scroll (mock one if needed)

**Production / real-world pages:**
- [ ] People & Culture site or similar (anonymized if needed)
- [ ] Travel hub or team site using PiCanvas
- [ ] Research portal with list data, document views, Copilot/search integration
- [ ] Any other real deployment you can show

**GitHub content type (the anecdote):**
- [ ] A PiCanvas tab rendering the GitHub repo natively (if the feature is ready)
- [ ] If not ready in time, just tell the story on webcam — it still lands

**Technical visuals:**
- [ ] GitHub repo open in a browser tab (backup if GitHub content type isn't ready)
- [ ] /services folder or code structure visible
- [ ] PnP Sample Gallery listing page

**Recording environment:**
- [ ] All demo pages open in browser tabs, in presentation order
- [ ] Bookmarks bar hidden
- [ ] Zoom 125% across all tabs
- [ ] Do Not Disturb / notification silence ON
- [ ] Webcam tested — bottom-right picture-in-picture
- [ ] Good lighting on your face
- [ ] Quiet room, decent mic
- [ ] Screen recording software tested (OBS, ShareX, or similar)

---

## RECORDING STRATEGY

**Record in 3-4 segments:**
- **Segment A** [0:00–2:05]: Hook → Who I Am → Friday Afternoon
- **Segment B** [2:05–5:15]: Snowball → All 5 demo features
- **Segment C** [5:15–7:00]: Production → Under the Hood
- **Segment D** [7:00–7:40]: The Close

Cut between segments. Clean edits are expected and professional. Nobody records 8 minutes in one take.

**Pre-flight:**
- Click every tab in every demo page once before recording (cache all content)
- Do a full dry run with a timer — target 7:30
- Record the close FIRST while your energy is fresh — it's the most important part after the open

**Mouse discipline:**
- Move cursor to target → pause → click → pause 1 second → speak
- Viewers' eyes follow the cursor. Use it as a pointer.

**Energy management:**
- Open HIGH (the dare, the demo burst)
- Drop into warm storytelling (Friday afternoon)
- Build through the snowball and demo
- Steady authority for production + engineering
- Emotional, full-circle landing for the close
- The last line should be quieter than the first. That contrast is powerful.

---

## SUBMISSION CATEGORIES

**Submit to at minimum:**
1. **Most Innovative SharePoint Experience with SPFx** — Primary. 11 content types, section tabs, full-screen config, application customizer, templates, permissions, locking. Deep SPFx innovation.
2. **Best Design for SharePoint Site** — The hero page + theming engine + tab styling demonstrates design excellence.

**Strong stretch:**
3. **Best Use of SharePoint in AI Agents** — If the research portal with Copilot APIs is demo-ready. The script already features it.
