#!/usr/bin/env python3
"""
PiCanvas Interactive Debug Script with Rich CLI GUI

A beautiful, interactive debugging tool for SharePoint Workbench with:
- Real-time status updates
- Progress indicators
- Color-coded output
- Live DOM inspection
- Visual step-by-step guidance

Requirements:
    pip install playwright rich
    playwright install chromium

Usage:
    python interactive_debug.py              # Interactive mode
    python interactive_debug.py --inspect    # Quick inspection
    python interactive_debug.py --test       # Run section-as-tab test
"""

import asyncio
import sys
import os
from datetime import datetime
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, field

# Rich imports for beautiful CLI
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
from rich.live import Live
from rich.layout import Layout
from rich.text import Text
from rich.tree import Tree
from rich.prompt import Prompt, Confirm
from rich.markdown import Markdown
from rich.syntax import Syntax
from rich.style import Style
from rich import box

from playwright.async_api import async_playwright, Page, Browser, BrowserContext

# Initialize Rich console
console = Console()

# =============================================================================
# TENANT CONFIGURATION
# =============================================================================
# Each tenant has its own SharePoint site, tenant ID, and app ID for auth.

TENANTS = {
    "pispace": {
        "name": "PiSpace",
        "site": "pispace.sharepoint.com",
        "workbench_url": "https://pispace.sharepoint.com/_layouts/15/workbench.aspx",
        "tenant_id": "b86f4164-0f66-4b25-ac5f-30d4a744cdd4",
        "app_id": "ec37f1f2-0630-42fd-a0da-f3fbecf294df",  # PiSpace_Dev_Local
        "description": "PiSpace development tenant"
    },
    "sap": {
        "name": "SAP",
        "site": "sap.sharepoint.com",
        "workbench_url": "https://sap.sharepoint.com/_layouts/15/workbench.aspx",
        "tenant_id": "42f7676c-f455-423c-82f6-dc2d99791af7",
        "app_id": "f494a4c5-6af1-4517-8805-e4c9a7161462",  # SAP-specific App
        "description": "SAP corporate tenant"
    },
    "hopkinsdemo": {
        "name": "Hopkins Demo",
        "site": "hopkinsdemo.sharepoint.com",
        "workbench_url": "https://hopkinsdemo.sharepoint.com/_layouts/15/workbench.aspx",
        "tenant_id": "1c622f7e-c83b-4c9f-b226-9bc6906f0b71",
        "app_id": "1ce62ddf-71e7-42e0-a11f-232d4b836cea",  # Pi-Space-DEV (single org)
        "description": "Hopkins Demo tenant"
    },
    "arh": {
        "name": "Anthony R Hopkins",
        "site": "anthonyrhopkins.sharepoint.com",
        "workbench_url": "https://anthonyrhopkins.sharepoint.com/_layouts/15/workbench.aspx",
        "tenant_id": "5ee0dbc7-b409-4b23-9e51-358a9ccbaa22",
        "app_id": "1641e90e-09c6-4eba-a71a-e14bfff1ebe1",  # PiSpace_Local_Dev_Multi_ARH (multi-tenant)
        "description": "Anthony R Hopkins (multi-tenant app)"
    },
    "arhdev": {
        "name": "ARH Dev",
        "site": "anthonyrhopkins.sharepoint.com",
        "workbench_url": "https://anthonyrhopkins.sharepoint.com/_layouts/15/workbench.aspx",
        "tenant_id": "5ee0dbc7-b409-4b23-9e51-358a9ccbaa22",
        "app_id": "9e0b850e-d8c1-47b8-b81a-94d2f467710f",  # PiSpace_Local_Dev_Local_ARHDEV (single org)
        "description": "Anthony R Hopkins (single-org app)"
    },
}

DEFAULT_TENANT = "pispace"


def get_tenant_config(tenant_key: str) -> dict:
    """Get tenant configuration by key"""
    if tenant_key not in TENANTS:
        available = ", ".join(TENANTS.keys())
        raise ValueError(f"Unknown tenant '{tenant_key}'. Available: {available}")
    return TENANTS[tenant_key]


def print_tenant_table():
    """Print available tenants as a table"""
    table = Table(title="Available Tenants", box=box.ROUNDED)
    table.add_column("Key", style="cyan", no_wrap=True)
    table.add_column("Name", style="green")
    table.add_column("Site", style="blue")
    table.add_column("Description", style="dim")

    for key, config in TENANTS.items():
        default_marker = " ⭐" if key == DEFAULT_TENANT else ""
        table.add_row(
            key + default_marker,
            config["name"],
            config["site"],
            config["description"]
        )

    console.print(table)


@dataclass
class DebugState:
    """Tracks the current state of the debugging session"""
    browser_open: bool = False
    page_loaded: bool = False
    current_url: str = ""
    sections: int = 0
    columns: int = 0
    webparts: int = 0
    picanvas_found: bool = False
    preview_mode: bool = False
    errors: List[str] = field(default_factory=list)
    last_action: str = "None"
    screenshots: List[str] = field(default_factory=list)


class RichDebugSession:
    """Interactive debugging session with Rich CLI GUI"""

    def __init__(self, tenant: str = DEFAULT_TENANT, url: str = None):
        self.tenant = tenant
        self.tenant_config = get_tenant_config(tenant)
        self.url = url or self.tenant_config["workbench_url"]
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None
        self._playwright = None
        self.state = DebugState()
        self.console_errors: List[Dict] = []

    def print_header(self):
        """Print beautiful header"""
        header = """
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║   ██████╗ ██╗ ██████╗ █████╗ ███╗   ██╗██╗   ██╗ █████╗ ███████╗             ║
║   ██╔══██╗██║██╔════╝██╔══██╗████╗  ██║██║   ██║██╔══██╗██╔════╝             ║
║   ██████╔╝██║██║     ███████║██╔██╗ ██║██║   ██║███████║███████╗             ║
║   ██╔═══╝ ██║██║     ██╔══██║██║╚██╗██║╚██╗ ██╔╝██╔══██║╚════██║             ║
║   ██║     ██║╚██████╗██║  ██║██║ ╚████║ ╚████╔╝ ██║  ██║███████║             ║
║   ╚═╝     ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝  ╚═══╝  ╚═╝  ╚═╝╚══════╝             ║
║                                                                               ║
║                    🧪  DEBUG & TEST AUTOMATION  🧪                            ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
"""
        console.print(header, style="bold cyan")

    def print_status_panel(self):
        """Print current status as a panel"""
        table = Table(show_header=False, box=box.SIMPLE, padding=(0, 2))
        table.add_column("Property", style="cyan")
        table.add_column("Value", style="green")

        table.add_row("🌐 Browser", "✓ Open" if self.state.browser_open else "✗ Closed")
        table.add_row("📄 Page", "✓ Loaded" if self.state.page_loaded else "✗ Not loaded")
        table.add_row("🔗 URL", self.state.current_url[:60] + "..." if len(self.state.current_url) > 60 else self.state.current_url or "N/A")
        table.add_row("📦 Sections", str(self.state.sections))
        table.add_row("📊 Columns", str(self.state.columns))
        table.add_row("🧩 Web Parts", str(self.state.webparts))
        table.add_row("🎨 PiCanvas", "✓ Found" if self.state.picanvas_found else "✗ Not found")
        table.add_row("👁️ Mode", "Preview" if self.state.preview_mode else "Edit")
        table.add_row("⚠️ Errors", str(len(self.state.errors)))
        table.add_row("🎬 Last Action", self.state.last_action)

        panel = Panel(table, title="[bold white]Session Status[/bold white]", border_style="blue")
        console.print(panel)

    def print_menu(self):
        """Print command menu"""
        menu_items = [
            ("1", "inspect", "Inspect page structure"),
            ("2", "add_section", "Add a new section"),
            ("3", "add_webpart", "Add a web part"),
            ("4", "set_text", "Set text in Text web part"),
            ("5", "toggle_preview", "Toggle Edit/Preview mode"),
            ("6", "screenshot", "Take screenshot"),
            ("7", "check_errors", "Check console errors"),
            ("8", "get_options", "Get PiCanvas tab options"),
            ("9", "run_test", "Run section-as-tab test"),
            ("r", "refresh", "Refresh page"),
            ("s", "status", "Show status"),
            ("h", "help", "Show help"),
            ("q", "quit", "Exit"),
        ]

        table = Table(show_header=True, header_style="bold magenta", box=box.ROUNDED)
        table.add_column("Key", style="cyan", width=6)
        table.add_column("Command", style="green", width=20)
        table.add_column("Description", style="white")

        for key, cmd, desc in menu_items:
            table.add_row(key, cmd, desc)

        panel = Panel(table, title="[bold white]Commands[/bold white]", border_style="green")
        console.print(panel)

    async def start(self, headed: bool = True) -> Page:
        """Start browser with progress indication"""
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            console=console,
        ) as progress:
            task = progress.add_task("[cyan]Starting browser...", total=4)

            # Start playwright
            self._playwright = await async_playwright().start()
            progress.update(task, advance=1, description="[cyan]Launching Chromium...")

            # Launch browser
            self.browser = await self._playwright.chromium.launch(
                headless=not headed,
                slow_mo=50
            )
            self.state.browser_open = True
            progress.update(task, advance=1, description="[cyan]Creating context...")

            # Create context
            context = await self.browser.new_context(
                viewport={"width": 1920, "height": 1080}
            )
            self.page = await context.new_page()
            progress.update(task, advance=1, description="[cyan]Navigating to workbench...")

            # Setup console error capture
            self.page.on("console", self._capture_console)
            self.page.on("pageerror", self._capture_error)

            # Navigate
            await self.page.goto(self.url, wait_until="networkidle")
            self.state.current_url = self.url
            progress.update(task, advance=1, description="[green]✓ Browser ready!")

            # Wait for canvas with authentication handling
            await self._wait_for_canvas_with_auth()

        console.print(Panel("[green]✓ Browser started successfully![/green]", border_style="green"))
        self.state.last_action = "Browser started"
        return self.page

    async def _wait_for_canvas_with_auth(self):
        """Wait for canvas, handling authentication if needed"""
        max_wait = 120  # 2 minutes for auth
        start = datetime.now()

        while (datetime.now() - start).seconds < max_wait:
            url = self.page.url.lower()

            # Check for login pages
            if any(x in url for x in ['login', 'adfs', 'microsoftonline', 'oauth']):
                console.print("[yellow]⏳ Authentication required - please sign in...[/yellow]")
                await asyncio.sleep(3)
                continue

            # Try to find canvas
            try:
                await self.page.wait_for_selector(
                    "[data-automation-id='CanvasZone']",
                    timeout=5000
                )
                self.state.page_loaded = True
                self.state.current_url = self.page.url
                console.print("[green]✓ Canvas detected[/green]")
                return
            except:
                elapsed = (datetime.now() - start).seconds
                console.print(f"[dim]Waiting for canvas... ({elapsed}s)[/dim]")
                await asyncio.sleep(2)

        console.print(Panel("[green]✓ Browser started successfully![/green]", border_style="green"))
        self.state.last_action = "Browser started"
        return self.page

    def _capture_console(self, msg):
        """Capture console messages"""
        if msg.type == "error" or "error" in msg.text.lower():
            self.console_errors.append({
                "type": msg.type,
                "text": msg.text,
                "time": datetime.now().strftime("%H:%M:%S")
            })
            if "Unknown" in msg.text or "rejection" in msg.text.lower():
                self.state.errors.append(msg.text[:100])

    def _capture_error(self, error):
        """Capture page errors"""
        self.state.errors.append(str(error)[:100])

    async def stop(self):
        """Close browser with status update"""
        console.print("[yellow]Closing browser...[/yellow]")
        if self.browser:
            await self.browser.close()
        if self._playwright:
            await self._playwright.stop()
        self.state.browser_open = False
        self.state.page_loaded = False
        console.print("[green]✓ Browser closed[/green]")

    async def inspect(self) -> Dict:
        """Inspect page structure with rich output"""
        console.print("\n[bold cyan]🔍 Inspecting Page Structure...[/bold cyan]\n")

        with console.status("[bold green]Analyzing DOM...[/bold green]"):
            result = await self.page.evaluate("""
            () => {
                const sections = document.querySelectorAll('[data-automation-id="CanvasZone"]');
                const webparts = document.querySelectorAll('.ControlZone');
                const picanvas = document.querySelector('[class*="piCanvas"], [class*="hillbilly"]');

                const details = [];
                sections.forEach((s, i) => {
                    const cols = s.querySelectorAll('[data-automation-id="CanvasSection"]');
                    const wps = s.querySelectorAll('.ControlZone');
                    const wpTypes = [];
                    wps.forEach(wp => {
                        const typeAttr = wp.getAttribute('data-automation-id') || wp.className.split(' ')[0];
                        wpTypes.push(typeAttr);
                    });
                    details.push({
                        section: i + 1,
                        columns: cols.length,
                        webparts: wps.length,
                        webpartTypes: wpTypes,
                        hillbillyId: s.getAttribute('data-hillbilly-section-id')
                    });
                });

                return {
                    totalSections: sections.length,
                    totalWebparts: webparts.length,
                    picanvasFound: !!picanvas,
                    details: details,
                    url: window.location.href,
                    title: document.title
                };
            }
            """)

        # Update state
        self.state.sections = result['totalSections']
        self.state.webparts = result['totalWebparts']
        self.state.picanvas_found = result['picanvasFound']
        self.state.columns = sum(d['columns'] for d in result['details'])
        self.state.current_url = result['url']
        self.state.last_action = "Inspected page"

        # Build tree view
        tree = Tree(f"[bold]📄 {result['title'][:50]}[/bold]")
        tree.add(f"[cyan]URL:[/cyan] {result['url'][:70]}...")

        sections_branch = tree.add(f"[bold green]📦 Sections ({result['totalSections']})[/bold green]")
        for detail in result['details']:
            section_node = sections_branch.add(
                f"[yellow]Section {detail['section']}[/yellow] - "
                f"{detail['columns']} col(s), {detail['webparts']} webpart(s)"
            )
            if detail['hillbillyId']:
                section_node.add(f"[dim]hillbilly-id: {detail['hillbillyId']}[/dim]")
            for wt in detail['webpartTypes'][:5]:
                section_node.add(f"[blue]🧩 {wt[:40]}[/blue]")

        summary_branch = tree.add("[bold magenta]📊 Summary[/bold magenta]")
        summary_branch.add(f"Total Sections: {result['totalSections']}")
        summary_branch.add(f"Total Columns: {self.state.columns}")
        summary_branch.add(f"Total Web Parts: {result['totalWebparts']}")
        summary_branch.add(f"PiCanvas Found: {'✓ Yes' if result['picanvasFound'] else '✗ No'}")

        console.print(Panel(tree, title="[bold white]DOM Structure[/bold white]", border_style="cyan"))
        return result

    async def add_section(self, layout: str = None) -> None:
        """Add section with interactive selection"""
        layouts = {
            "1": ("one_column", "One column"),
            "2": ("two_column", "Two columns"),
            "3": ("three_column", "Three columns"),
            "4": ("one_third_left", "One-third left"),
            "5": ("one_third_right", "One-third right"),
        }

        if not layout:
            console.print("\n[bold cyan]Select Section Layout:[/bold cyan]")
            for key, (_, name) in layouts.items():
                console.print(f"  [cyan]{key}[/cyan] - {name}")
            choice = Prompt.ask("Enter choice", choices=list(layouts.keys()), default="1")
            layout, layout_name = layouts[choice]
        else:
            layout_name = layout.replace("_", " ").title()

        console.print(f"\n[bold green]➕ Adding {layout_name} section...[/bold green]")

        with console.status(f"[bold green]Adding {layout_name} section...[/bold green]"):
            # Find and click add section button
            try:
                add_btn = self.page.locator("button[aria-label*='Add a new section']").last
                if await add_btn.count() > 0:
                    await add_btn.click()
                else:
                    await self.page.click("button:has-text('Add a new section')")

                await asyncio.sleep(0.5)

                # Click layout option
                layout_text = layout_name
                await self.page.click(f"button:has-text('{layout_text}')")
                await asyncio.sleep(0.5)

                console.print(f"[green]✓ Added {layout_name} section[/green]")
                self.state.last_action = f"Added {layout_name} section"

            except Exception as e:
                console.print(f"[red]✗ Failed to add section: {e}[/red]")

    async def add_webpart(self, name: str = None, section: int = None, column: int = None) -> None:
        """Add web part with interactive selection"""
        webpart_types = ["Text", "Image", "PiCanvas", "Quick Links", "Hero", "Button"]

        if not name:
            console.print("\n[bold cyan]Select Web Part Type:[/bold cyan]")
            for i, wp in enumerate(webpart_types, 1):
                console.print(f"  [cyan]{i}[/cyan] - {wp}")
            choice = Prompt.ask("Enter choice or type name", default="1")
            try:
                name = webpart_types[int(choice) - 1]
            except (ValueError, IndexError):
                name = choice

        if section is None:
            section = int(Prompt.ask("Section number", default="1"))
        if column is None:
            column = int(Prompt.ask("Column number", default="1"))

        console.print(f"\n[bold green]➕ Adding '{name}' to Section {section}, Column {column}...[/bold green]")

        with console.status(f"[bold green]Adding {name} web part...[/bold green]"):
            try:
                # Find the column
                sections = await self.page.query_selector_all("[data-automation-id='CanvasZone']")
                if section > len(sections):
                    console.print(f"[red]✗ Section {section} not found (only {len(sections)} sections)[/red]")
                    return

                sect = sections[section - 1]
                columns = await sect.query_selector_all("[data-automation-id='CanvasSection']")
                if column > len(columns):
                    console.print(f"[red]✗ Column {column} not found (only {len(columns)} columns)[/red]")
                    return

                col = columns[column - 1]

                # Hover and click add button
                await col.hover()
                await asyncio.sleep(0.3)

                add_btn = await col.query_selector("button[aria-label*='Add']")
                if add_btn:
                    await add_btn.click()
                else:
                    console.print("[red]✗ Could not find add button in column[/red]")
                    return

                await asyncio.sleep(0.5)

                # Search and select web part
                search = await self.page.query_selector("input[data-automation-id='searchBox']")
                if search:
                    await search.fill(name)
                    await asyncio.sleep(0.3)

                await self.page.click(f"button:has-text('{name}')")
                await asyncio.sleep(1)

                console.print(f"[green]✓ Added '{name}' web part to Section {section}, Column {column}[/green]")
                self.state.last_action = f"Added {name} web part"

            except Exception as e:
                console.print(f"[red]✗ Failed to add web part: {e}[/red]")

    async def set_text(self, text: str = None) -> None:
        """Set text in Text web part"""
        if not text:
            text = Prompt.ask("Enter text content")

        console.print(f"\n[bold green]📝 Setting text: '{text[:50]}...'[/bold green]")

        with console.status("[bold green]Setting text content...[/bold green]"):
            try:
                editors = await self.page.query_selector_all(
                    "[data-automation-id='textEditor'], .ck-editor__editable, [contenteditable='true']"
                )
                if not editors:
                    # Click on text web part first
                    text_wps = await self.page.query_selector_all("[data-automation-id='textWebPart']")
                    if text_wps:
                        await text_wps[-1].click()
                        await asyncio.sleep(0.3)
                        editors = await self.page.query_selector_all(
                            "[data-automation-id='textEditor'], .ck-editor__editable, [contenteditable='true']"
                        )

                if editors:
                    await editors[-1].click()
                    await asyncio.sleep(0.2)
                    await editors[-1].fill(text)
                    console.print("[green]✓ Text content set[/green]")
                    self.state.last_action = "Set text content"
                else:
                    console.print("[yellow]⚠ No text editor found - try clicking on a Text web part first[/yellow]")

            except Exception as e:
                console.print(f"[red]✗ Failed to set text: {e}[/red]")

    async def toggle_preview(self) -> None:
        """Toggle between Edit and Preview mode"""
        console.print("\n[bold green]👁️ Toggling preview mode...[/bold green]")

        try:
            preview_btn = self.page.locator("button[data-automation-id='previewModeToggle']")
            if await preview_btn.count() > 0:
                await preview_btn.click()
            else:
                # Try alternate selector
                edit_btn = self.page.locator("button:has-text('Edit')")
                preview_btn2 = self.page.locator("button:has-text('Preview')")

                if await edit_btn.count() > 0:
                    await edit_btn.click()
                elif await preview_btn2.count() > 0:
                    await preview_btn2.click()

            await asyncio.sleep(1)

            # Check mode
            edit_visible = await self.page.locator("button:has-text('Edit')").count() > 0
            self.state.preview_mode = edit_visible

            mode = "Preview" if self.state.preview_mode else "Edit"
            console.print(f"[green]✓ Now in {mode} mode[/green]")
            self.state.last_action = f"Switched to {mode} mode"

        except Exception as e:
            console.print(f"[red]✗ Failed to toggle preview: {e}[/red]")

    async def screenshot(self, name: str = None) -> str:
        """Take a screenshot"""
        if not name:
            name = Prompt.ask("Screenshot name", default="debug")

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{name}_{timestamp}.png"

        console.print(f"\n[bold green]📸 Taking screenshot: {filename}[/bold green]")

        await self.page.screenshot(path=filename, full_page=True)
        self.state.screenshots.append(filename)
        self.state.last_action = f"Screenshot: {filename}"

        console.print(f"[green]✓ Screenshot saved: {filename}[/green]")
        return filename

    async def check_errors(self) -> List[Dict]:
        """Check and display console errors"""
        console.print("\n[bold cyan]⚠️ Console Errors[/bold cyan]\n")

        if not self.console_errors:
            console.print("[green]✓ No console errors detected![/green]")
            return []

        table = Table(show_header=True, header_style="bold red", box=box.ROUNDED)
        table.add_column("Time", style="dim")
        table.add_column("Type", style="yellow")
        table.add_column("Message", style="red")

        for err in self.console_errors[-20:]:  # Last 20 errors
            table.add_row(
                err.get("time", ""),
                err.get("type", "error"),
                err.get("text", "")[:80]
            )

        console.print(table)

        # Highlight critical errors
        unknown_errors = [e for e in self.console_errors if "Unknown" in e.get("text", "")]
        if unknown_errors:
            console.print(f"\n[bold red]⚠️ Found {len(unknown_errors)} 'Unknown' errors - this may indicate API issues in workbench![/bold red]")

        self.state.last_action = "Checked errors"
        return self.console_errors

    async def get_picanvas_options(self) -> List[str]:
        """Get PiCanvas tab dropdown options"""
        console.print("\n[bold cyan]🎨 Getting PiCanvas Tab Options...[/bold cyan]")

        with console.status("[bold green]Opening property pane...[/bold green]"):
            try:
                # Click on PiCanvas
                picanvas = await self.page.query_selector("[class*='piCanvas'], [class*='hillbilly']")
                if picanvas:
                    await picanvas.click()
                    await asyncio.sleep(0.5)

                    edit_btn = await self.page.query_selector("button:has-text('Edit web part')")
                    if edit_btn:
                        await edit_btn.click()
                        await asyncio.sleep(0.5)

                # Get dropdown options
                options = await self.page.evaluate("""
                () => {
                    const options = [];
                    const selects = document.querySelectorAll('select');
                    selects.forEach(select => {
                        const opts = select.querySelectorAll('option');
                        opts.forEach(opt => {
                            if (opt.text && opt.text.trim()) {
                                options.push({
                                    text: opt.text.trim(),
                                    value: opt.value
                                });
                            }
                        });
                    });

                    // Also check for custom dropdowns
                    const dropdownItems = document.querySelectorAll('.ms-Dropdown-item');
                    dropdownItems.forEach(item => {
                        options.push({
                            text: item.innerText.trim(),
                            value: item.getAttribute('data-value') || item.innerText.trim()
                        });
                    });

                    return options;
                }
                """)

                if options:
                    table = Table(show_header=True, header_style="bold green", box=box.ROUNDED)
                    table.add_column("#", style="dim")
                    table.add_column("Option", style="cyan")
                    table.add_column("Value", style="dim")

                    seen = set()
                    for i, opt in enumerate(options, 1):
                        if opt['text'] not in seen:
                            table.add_row(str(i), opt['text'], opt['value'][:30])
                            seen.add(opt['text'])

                    console.print(table)
                else:
                    console.print("[yellow]⚠ No dropdown options found - PiCanvas may not be selected[/yellow]")

                self.state.last_action = "Got tab options"
                return [o['text'] for o in options]

            except Exception as e:
                console.print(f"[red]✗ Failed to get options: {e}[/red]")
                return []

    async def run_section_tab_test(self) -> bool:
        """Run comprehensive section-as-tab test"""
        console.print(Panel(
            "[bold]Running Section-as-Tab Test[/bold]\n\n"
            "This test will:\n"
            "1. Add a two-column section\n"
            "2. Add Text web parts to each column\n"
            "3. Add PiCanvas to configure tabs\n"
            "4. Guide you through tab configuration\n"
            "5. Verify tab content in preview mode",
            title="[bold cyan]🧪 Test: Section as Tab[/bold cyan]",
            border_style="cyan"
        ))

        if not Confirm.ask("Proceed with test?"):
            return False

        steps = [
            ("Adding two-column section", self._test_add_section),
            ("Adding Text web part to column 1", self._test_add_text_col1),
            ("Adding Text web part to column 2", self._test_add_text_col2),
            ("Adding PiCanvas web part", self._test_add_picanvas),
            ("Manual: Configure PiCanvas tab", self._test_manual_config),
            ("Toggle to Preview mode", self._test_preview),
            ("Verify tab content", self._test_verify),
        ]

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            console=console,
        ) as progress:
            task = progress.add_task("[cyan]Running test...", total=len(steps))

            for step_name, step_func in steps:
                progress.update(task, description=f"[cyan]{step_name}...")
                try:
                    result = await step_func()
                    if result is False:
                        console.print(f"[red]✗ Step failed: {step_name}[/red]")
                        return False
                    progress.update(task, advance=1)
                except Exception as e:
                    console.print(f"[red]✗ Error in {step_name}: {e}[/red]")
                    return False

        console.print(Panel("[bold green]✓ Test completed successfully![/bold green]", border_style="green"))
        return True

    async def _test_add_section(self):
        await self.add_section("two_column")
        await asyncio.sleep(1)
        return True

    async def _test_add_text_col1(self):
        await self.add_webpart("Text", section=1, column=1)
        await self.set_text("Column 1: Hello from the first column! This is test content for Tab 1.")
        return True

    async def _test_add_text_col2(self):
        await self.add_webpart("Text", section=1, column=2)
        await self.set_text("Column 2: Content in the second column! More test content here.")
        return True

    async def _test_add_picanvas(self):
        await self.add_section("one_column")
        await asyncio.sleep(0.5)
        await self.add_webpart("PiCanvas", section=2, column=1)
        return True

    async def _test_manual_config(self):
        console.print(Panel(
            "[bold yellow]Manual Step Required[/bold yellow]\n\n"
            "Please configure PiCanvas in the browser:\n"
            "1. Click on the PiCanvas web part\n"
            "2. Click 'Edit web part' to open property pane\n"
            "3. Set Tab 1 name (e.g., 'My Tab')\n"
            "4. Select 'Section 1 (2 web parts)' from dropdown\n"
            "5. Click outside to close property pane",
            title="[bold yellow]👆 Action Required[/bold yellow]",
            border_style="yellow"
        ))
        await self.screenshot("before_config")
        Prompt.ask("Press Enter when configuration is complete")
        return True

    async def _test_preview(self):
        await self.toggle_preview()
        await asyncio.sleep(2)
        return True

    async def _test_verify(self):
        await self.inspect()
        await self.screenshot("preview_mode")
        await self.check_errors()
        return True


async def interactive_mode(headed: bool = True):
    """Run interactive debugging session"""
    session = RichDebugSession()

    try:
        session.print_header()
        console.print("\n[bold]Starting interactive session...[/bold]\n")

        await session.start(headed=headed)
        await session.inspect()

        while True:
            console.print()
            session.print_status_panel()
            session.print_menu()

            try:
                cmd = Prompt.ask("\n[bold cyan]Enter command[/bold cyan]")
                cmd = cmd.strip().lower()

                if cmd in ('q', 'quit', 'exit'):
                    break
                elif cmd in ('1', 'inspect'):
                    await session.inspect()
                elif cmd in ('2', 'add_section'):
                    await session.add_section()
                elif cmd in ('3', 'add_webpart'):
                    await session.add_webpart()
                elif cmd in ('4', 'set_text'):
                    await session.set_text()
                elif cmd in ('5', 'toggle_preview'):
                    await session.toggle_preview()
                elif cmd in ('6', 'screenshot'):
                    await session.screenshot()
                elif cmd in ('7', 'check_errors'):
                    await session.check_errors()
                elif cmd in ('8', 'get_options'):
                    await session.get_picanvas_options()
                elif cmd in ('9', 'run_test'):
                    await session.run_section_tab_test()
                elif cmd in ('r', 'refresh'):
                    console.print("[yellow]Refreshing page...[/yellow]")
                    await session.page.reload()
                    await asyncio.sleep(2)
                    await session.inspect()
                elif cmd in ('s', 'status'):
                    session.print_status_panel()
                elif cmd in ('h', 'help'):
                    session.print_menu()
                else:
                    console.print(f"[yellow]Unknown command: {cmd}[/yellow]")

            except KeyboardInterrupt:
                break
            except Exception as e:
                console.print(f"[red]Error: {e}[/red]")

    finally:
        await session.stop()
        console.print("\n[bold green]Thanks for using PiCanvas Debug Tool![/bold green]\n")


async def quick_test(headed: bool = True):
    """Run quick section-as-tab test"""
    session = RichDebugSession()
    try:
        session.print_header()
        await session.start(headed=headed)
        await session.run_section_tab_test()
    finally:
        await session.stop()


async def quick_inspect(tenant: str = DEFAULT_TENANT, headed: bool = False):
    """Quick inspection mode"""
    session = RichDebugSession(tenant=tenant)
    try:
        session.print_header()
        await session.start(headed=headed)
        await session.inspect()
        await session.check_errors()
    finally:
        await session.stop()


def main():
    import argparse
    tenant_choices = list(TENANTS.keys())

    parser = argparse.ArgumentParser(
        description="PiCanvas Debug Tool with Rich CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""
Examples:
  python interactive_debug.py                           # Interactive mode (default tenant)
  python interactive_debug.py --tenant sap              # Use SAP tenant
  python interactive_debug.py --list-tenants            # Show all tenants
  python interactive_debug.py --inspect --tenant pispace  # Quick inspect on pispace

Available tenants: {', '.join(tenant_choices)}
        """
    )
    parser.add_argument("--tenant", "-t", default=DEFAULT_TENANT,
                       choices=tenant_choices,
                       help=f"SharePoint tenant to test (default: {DEFAULT_TENANT})")
    parser.add_argument("--list-tenants", action="store_true",
                       help="List all available tenants and exit")
    parser.add_argument("--url", help="Custom workbench URL (overrides tenant)")
    parser.add_argument("--headed", action="store_true", help="Show browser window")
    parser.add_argument("--inspect", action="store_true", help="Quick inspection only")
    parser.add_argument("--test", action="store_true", help="Run section-as-tab test")

    args = parser.parse_args()

    # Handle --list-tenants
    if args.list_tenants:
        print_tenant_table()
        return

    # Show selected tenant
    tenant_config = get_tenant_config(args.tenant)
    console.print(Panel(
        f"[bold]{tenant_config['name']}[/bold]\n"
        f"Site: [cyan]{tenant_config['site']}[/cyan]",
        title=f"[green]🏢 Tenant: {args.tenant}[/green]",
        border_style="green"
    ))

    if args.inspect:
        asyncio.run(quick_inspect(tenant=args.tenant, headed=args.headed))
    elif args.test:
        asyncio.run(quick_test(headed=True))
    else:
        asyncio.run(interactive_mode(headed=True))


if __name__ == "__main__":
    main()
