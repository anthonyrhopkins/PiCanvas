# PiCanvas — Hackathon Script (Clean Read-Through)

Just the words. No stage directions. Read it out loud, practice it, time it.

---

For the last 25 years, there's been a hard line between the people who manage SharePoint and the people who code for it. But with agentic coding tools like GitHub Copilot and Claude Code, I truly believe that line is blurring — fast.

So let me take you on a quick tour of PiCanvas — and show you how one small idea on a Friday afternoon can snowball into something real.

*[Click through tabs silently — one click per beat. Let each one register.]*

That's PiCanvas. One web part. Twelve content types. In production at SAP. Fair warning though — once you start vibe coding and seeing your ideas come to life, it is very hard to stop.

PiCanvas has been in the PnP Sample Gallery for a few months now. The code is all on GitHub — open source, MIT licensed. If you haven't taken a look, feel free. Fork it, extend it, submit questions or feedback. That's what this community is built on.

---

I'm Anthony Hopkins. I work with Microsoft 365 technologies at SAP — on the leadership of our Copilot Technical Adoption team. Before SAP, I spent four and a half years at Microsoft as an escalation engineer.

My whole career has been the bridge between builders and users. Now I'm an FDE building AI solutions for our go-to-market teams at SAP — or as I like to call it, professional vibe coder.

---

A few months ago, somebody came to me with a problem. They had a lot of content they needed to share on SharePoint, but the page was getting way too long. Nobody's scrolling through all of that.

Now, they'd actually done their homework. They'd found a solution on their own — a community sample called Hillbilly Tabs. It lets you take individual web parts in the same section and put them in tabs. Great concept. The problem? It was over four years old, running SPFx 1.13.

In my two and a half years at SAP, I've helped a lot of teams deploy custom web parts. I knew this one wasn't going to fly. There are certain things that need to happen before we can approve anything — even for a site collection app catalog.

Thankfully, she reached out to me on a Friday — 75 minutes before I had to pick up my son. So instead of recommending she go through our consultation and development team, I asked her — do you mind if we take a stab at it ourselves?

In the first 35, 40 minutes, we upgraded it to SPFx 1.21 and started adding features. The ability to have web parts in different sections of the page — not all grouped under one tab. The ability to put entire sections in a tab, not just individual web parts. Customizable tab names — not just plain text, but formatted. And then — why not use actual web parts *as* the tabs themselves? Images, banners, whatever you want.

Seventy-five minutes. Upgraded, new features, tested, deployed. And it was really, really fun.

I thought that was it. That was *not* it.

---

The ideas just kept flooding in. Somebody wanted Mermaid diagrams and Markdown rendered in a tab — done. Somebody wanted to run JavaScript — okay, let's see. Can I pull in HTML source code and render it right on the page? Yes. Can I point to an external file — HTML, JavaScript, whatever — stored in another part of the site, or even another site entirely? Added that too.

Every day, more ideas. And you just can't stop — because every one of them *works*.

Eleven content types later, this wasn't a tab web part anymore. It was a canvas. And the name clicked — pi, the infinite number, theoretically contains every sequence that ever existed. PiCanvas. Infinite possibilities, one web part.

And now I've taken it to where I have fully powered applications — using SharePoint lists as a database, document libraries as a file system, relational data linking files to items — building full-stack solutions where I'm displaying hundreds of thousands of files across thousands of customers in a clean, easy-to-use, easy-to-maintain interface. All in SharePoint. Zero external infrastructure.

If you've ever vibe coded, you know this feeling. Every idea feels possible — because it *is* possible.

---

Let me show you the feature I'm most proud of. Most tab web parts put *a* web part inside a tab. PiCanvas puts an entire SharePoint *section* in a tab — multiple columns, multiple web parts, the full layout.

Each tab is its own mini-page. Authors design them with the same SharePoint tools they already know — columns, web parts, all of it. No code required.

---

This is PiCanvas's configuration experience. Full-screen custom panel — not the standard property pane. Tab management with drag-and-drop. Appearance controls. And a full theming engine — six color pickers. Font controls. Border radius. Shadow intensity. Transition speed. Twenty-five CSS custom properties.

Four styles. Four alignments. Horizontal or vertical. Light and dark mode auto-detection — or manual override. You can make this look like anything.

---

Here's where it gets enterprise-serious.

Every individual tab can be restricted to specific SharePoint groups — Owners, Members, Visitors, any custom group. Same URL, completely different experience depending on who's logged in.

Think about what this replaces. No duplicate pages. No complex audience targeting. The HR team sees their admin tools. Everyone else sees the public content. One page. Smart tabs.

---

Password-protected tabs. Click one — you get a custom lock screen. Custom title, custom message.

Enter the password, and you're in. I pulled this pattern from a password vault web part I built earlier. The passwords are hashed — bcrypt-style. No plain text. Ever. SAP's security team appreciated that.

---

Templates. Save your entire PiCanvas configuration — tabs, content types, styling, permissions, everything. Export it. Import it on another page, another site, another tenant. Teams build their own template libraries. Configure once, deploy everywhere.

---

I want to be really clear about something. PiCanvas is not a hackathon demo. It's not running on localhost. It is in production at SAP, right now, being used by real people.

The People & Culture team that started this whole thing? Their initiative page went from that endless scroll to a clean tabbed experience. People actually use it now — because they can actually *find* things.

Another team built a travel hub — policies, forms, booking tools organized by region, with permission-based tabs so each office only sees what's relevant to them.

But here's where it gets really interesting. Let me show you what happens when you push PiCanvas to its limit.

This is a full-stack application — running entirely inside SharePoint. No external servers. No Azure Functions. Just SharePoint lists, document libraries, and PiCanvas tying it all together.

A SharePoint list acts as the database — tens of thousands of items with structured fields, relational IDs, and person columns for ownership. A document library acts as the file system — organized into folders by content type, with files linked back to list items through a naming convention based on unique IDs. PiCanvas renders it all — pulling data from the list, loading files from the library in parallel, and displaying everything in tabs with permission-based visibility so different users see different views.

SharePoint permissions handle the access control. The JavaScript sandbox API I built into PiCanvas connects to Microsoft Graph for live data. Templates make the whole setup portable. And the configuration panel means someone who isn't me can actually manage it.

It's lists as a database, libraries as a file system, PiCanvas as the frontend, and SharePoint REST as the API layer. Full stack — zero external infrastructure.

And here's what I'm most proud of. People keep showing up with *new* ideas. Use cases I never imagined. When your users become your product team — that's when you know you built something real.

---

Quick technical picture — because none of this matters if it can't run at scale.

SPFx 1.22 — the latest version. Heft build toolchain. TypeScript 5.6. Every single dependency current and maintained.

The architecture is service-based. Separate modules for content rendering, permissions, theming, template management, tab locking, metadata tokens, RSS parsing, Table of Contents generation. Each one isolated. Testable. Extensible.

Security was non-negotiable. DOMPurify sanitizes every piece of HTML. Embedded content runs through a domain whitelist. There's an application customizer extension that pre-hides content *before* page render — so you never see a flash of unstyled content. This went through SAP's full security scanning and code review process before it ever touched our tenant.

And it's open source. PiCanvas was accepted into the PnP Sample Gallery — MIT licensed. The code is on GitHub. Take it, fork it, extend it, rip out pieces for your own projects. That's what this community is built on.

And actually — funny story. While I was prepping for *this* demo, I wanted to show the GitHub repo right here inside SharePoint. Embed it in a tab. But GitHub blocks iframe embedding. Content Security Policy won't allow it.

So I did what I've been doing this entire time — I vibe coded a new content type. A GitHub renderer that pulls repo data through the API and displays it natively. Built it, tested it, added it to PiCanvas. That's content type number twelve now.

That's the thing about this workflow. When you hit a wall, you don't file a ticket. You don't wait for a sprint. You just *build it*. Friday afternoon energy — every single time.

---

I started this video by saying that line between managing SharePoint and building for it is blurring. PiCanvas is what happens when it disappears completely.

It started as a 75-minute Friday afternoon favor. It's now a production solution with real users, real adoption, and a growing feature set — accepted into the PnP Gallery, open source, built by an admin who's never formally written SPFx in his life.

AI didn't replace a developer here. It *created* one. And I don't think I'm the last.

Happy 25th birthday, SharePoint. Here's to the next 25 — where anyone who knows the platform can build for it.

Thank you.
