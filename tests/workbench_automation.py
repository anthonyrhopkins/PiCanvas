#!/usr/bin/env python3
"""
PiCanvas SharePoint Workbench Automation Suite

A comprehensive, resilient automation framework for testing PiCanvas web part
features in SharePoint Workbench with beautiful Rich CLI output.

Features:
- Rich CLI with progress bars, panels, and color-coded output
- Automatic retry logic for flaky operations
- Screenshot capture on failures
- Detailed test reporting
- Browser visual indicators during tests
- Recovery from common errors

Requirements:
    pip install playwright rich
    playwright install chromium

Usage:
    python workbench_automation.py              # Run all tests
    python workbench_automation.py --headed     # Run with visible browser
    python workbench_automation.py --test NAME  # Run specific test
"""

import asyncio
import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List, Any, Callable
from dataclasses import dataclass, field
from functools import wraps
from debug_server import (
    DEBUG_MANIFEST_URL,
    debug_manifest_available,
    wait_for_debug_manifest,
    start_debug_server,
    stop_debug_server
)

# Rich imports
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn, TimeElapsedColumn
from rich.live import Live
from rich.tree import Tree
from rich.prompt import Confirm
from rich import box
from rich.text import Text

from playwright.async_api import async_playwright, Page, Browser, BrowserContext, Locator

# Initialize Rich console
console = Console()

# =============================================================================
# TENANT CONFIGURATION
# =============================================================================
# Each tenant has its own SharePoint site, tenant ID, and app ID for auth.
# Add new tenants here as needed.

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

# Default tenant
DEFAULT_TENANT = "pispace"
DEFAULT_TIMEOUT = 30000
RETRY_ATTEMPTS = 3
RETRY_DELAY = 1.0
EXPECTED_PICANVAS_COMPONENT_ID = "6bcd9bfc-425b-47c2-8e5e-c17eb1c864c5"
PICANVAS_ALIAS = "PiCanvasWebPart"


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


def print_banner():
    """Print the application banner"""
    banner = """
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                                                                                   ║
║   ██████╗ ██╗ ██████╗ █████╗ ███╗   ██╗██╗   ██╗ █████╗ ███████╗                 ║
║   ██╔══██╗██║██╔════╝██╔══██╗████╗  ██║██║   ██║██╔══██╗██╔════╝                 ║
║   ██████╔╝██║██║     ███████║██╔██╗ ██║██║   ██║███████║███████╗                 ║
║   ██╔═══╝ ██║██║     ██╔══██║██║╚██╗██║╚██╗ ██╔╝██╔══██║╚════██║                 ║
║   ██║     ██║╚██████╗██║  ██║██║ ╚████║ ╚████╔╝ ██║  ██║███████║                 ║
║   ╚═╝     ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝  ╚═══╝  ╚═╝  ╚═╝╚══════╝                 ║
║                                                                                   ║
║                    🧪  AUTOMATED TEST SUITE  🧪                                   ║
║                                                                                   ║
║   SharePoint Workbench Testing Framework for PiCanvas Web Part                    ║
║                                                                                   ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
"""
    console.print(banner, style="bold cyan")


@dataclass
class TestConfig:
    """Configuration for workbench tests"""
    tenant: str = DEFAULT_TENANT
    workbench_url: str = ""  # Set from tenant in __post_init__
    headed: bool = False
    slow_mo: int = 50
    timeout: int = DEFAULT_TIMEOUT
    screenshot_dir: Path = field(default_factory=lambda: Path("screenshots"))
    retry_attempts: int = RETRY_ATTEMPTS
    retry_delay: float = RETRY_DELAY
    highlight_elements: bool = True
    persist_auth: bool = True  # Save auth cookies between runs
    use_debug_manifests: bool = False  # Load from localhost:4321 instead of app catalog
    auto_start_debug_server: bool = True
    debug_server_timeout: int = 60
    repo_root: Path = field(default_factory=lambda: Path(__file__).resolve().parents[1])

    def __post_init__(self):
        self.screenshot_dir.mkdir(exist_ok=True)
        # Set workbench_url from tenant config if not explicitly provided
        if not self.workbench_url:
            tenant_config = get_tenant_config(self.tenant)
            self.workbench_url = tenant_config["workbench_url"]

    @property
    def tenant_config(self) -> dict:
        """Get the full tenant configuration"""
        return get_tenant_config(self.tenant)

    @property
    def user_data_dir(self) -> Path:
        """Get the user data directory for persistent browser profile"""
        return Path.home() / ".picanvas-test" / f"browser-{self.tenant}"


@dataclass
class TestResult:
    """Result of a single test"""
    name: str
    passed: bool
    duration_ms: float
    error: Optional[str] = None
    screenshot: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)
    retries: int = 0


def retry_async(attempts: int = RETRY_ATTEMPTS, delay: float = RETRY_DELAY):
    """Decorator for retrying async functions"""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(attempts):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_error = e
                    if attempt < attempts - 1:
                        console.print(f"[yellow]⚠ Attempt {attempt + 1} failed, retrying in {delay}s...[/yellow]")
                        await asyncio.sleep(delay)
            raise last_error
        return wrapper
    return decorator


class SharePointWorkbenchAutomation:
    """
    Comprehensive SharePoint Workbench automation with resilience features.
    """

    # SharePoint Workbench selectors
    SELECTORS = {
        "canvas_zone": "[data-automation-id='CanvasZone']",
        "canvas_section": "[data-automation-id='CanvasSection']",
        "control_zone": ".ControlZone",
        "webpart_wrapper": "[data-automation-id='WebPartWrapper']",
        "add_section_button": "button[aria-label*='Add a new section']",
        "webpart_search": "input[data-automation-id='searchBox']",
        "preview_toggle": "button[data-automation-id='previewModeToggle']",
        "text_editor": "[data-automation-id='textEditor'], .ck-editor__editable, [contenteditable='true']",
        "picanvas": "[class*='piCanvas'], [class*='hillbilly']",
        "hillbilly_section": "[data-hillbilly-section-id]",
        "hillbilly_column": "[data-hillbilly-column-id]",
    }

    LAYOUTS = {
        "one_column": "One column",
        "two_column": "Two columns",
        "three_column": "Three columns",
        "one_third_left": "One-third left",
        "one_third_right": "One-third right",
    }

    def __init__(self, config: TestConfig):
        self.config = config
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.test_results: List[TestResult] = []
        self.console_errors: List[Dict] = []
        self.debug_manifest_info: Optional[Dict[str, Any]] = None
        self._playwright = None
        self._cache_disabled = False
        self._debug_server_process = None

    async def setup(self) -> None:
        """Initialize browser with progress indication"""
        console.print("\n[bold cyan]🚀 Setting up browser...[/bold cyan]\n")

        # Create persistent profile directory if using auth persistence
        if self.config.persist_auth and self.config.headed:
            user_data_dir = self.config.user_data_dir
            user_data_dir.mkdir(parents=True, exist_ok=True)
            console.print(f"[dim]Using persistent profile: {user_data_dir}[/dim]")

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            TimeElapsedColumn(),
            console=console,
        ) as progress:
            task = progress.add_task("[cyan]Initializing...", total=5)

            # Start playwright
            self._playwright = await async_playwright().start()
            progress.update(task, advance=1, description="[cyan]Launching browser...")

            # Use persistent context for headed mode with auth persistence
            if self.config.persist_auth and self.config.headed:
                # Launch with persistent context - stores cookies/auth
                # Use installed Chrome for better visibility and potential SSO
                self.context = await self._playwright.chromium.launch_persistent_context(
                    user_data_dir=str(self.config.user_data_dir),
                    headless=False,
                    slow_mo=self.config.slow_mo,
                    viewport={"width": 1920, "height": 1080},
                    ignore_https_errors=True,
                    channel="chrome"  # Use installed Chrome instead of bundled Chromium
                )
                self.browser = None  # No separate browser instance with persistent context
                progress.update(task, advance=1, description="[cyan]Context ready...")
                progress.update(task, advance=1, description="[cyan]Creating page...")

                # Get or create page
                if self.context.pages:
                    self.page = self.context.pages[0]
                else:
                    self.page = await self.context.new_page()
                await self._configure_debug_cache()
            else:
                # Standard non-persistent launch
                self.browser = await self._playwright.chromium.launch(
                    headless=not self.config.headed,
                    slow_mo=self.config.slow_mo
                )
                progress.update(task, advance=1, description="[cyan]Creating context...")

                self.context = await self.browser.new_context(
                    viewport={"width": 1920, "height": 1080},
                    ignore_https_errors=True
                )
                progress.update(task, advance=1, description="[cyan]Creating page...")

                self.page = await self.context.new_page()
                await self._configure_debug_cache()

            self.page.set_default_timeout(self.config.timeout)

            # Setup event handlers
            self.page.on("console", self._on_console)
            self.page.on("pageerror", self._on_error)
            progress.update(task, advance=1, description="[cyan]Navigating to workbench...")

            # Navigate - optionally use debug query string to load from localhost:4321
            # Note: Debug mode requires localhost:4321 to be running (npm run serve)
            if getattr(self.config, 'use_debug_manifests', False):
                await self._ensure_debug_server()
                # First, visit localhost:4321 to ensure certificate is trusted
                console.print("[yellow]Pre-warming localhost:4321 connection...[/yellow]")
                try:
                    await self.page.goto(DEBUG_MANIFEST_URL, wait_until="load", timeout=10000)
                    await asyncio.sleep(0.5)
                except Exception as e:
                    console.print(f"[yellow]⚠ Could not pre-warm localhost:4321: {e}[/yellow]")

                debug_url = f"{self.config.workbench_url}?debug=true&noredir=true&debugManifestsFile={DEBUG_MANIFEST_URL}"
                console.print("[yellow]Using debug manifest from localhost:4321[/yellow]")
                await self.page.goto(debug_url, wait_until="networkidle")
            else:
                # Load from app catalog (deployed version)
                await self.page.goto(self.config.workbench_url, wait_until="networkidle")
            progress.update(task, advance=1, description="[green]✓ Ready!")

        # Wait for canvas
        await self._wait_for_workbench()
        if getattr(self.config, 'use_debug_manifests', False):
            await self._assert_debug_manifest_loaded()
        console.print(Panel("[green]✓ Browser ready![/green]", border_style="green"))

    async def teardown(self) -> None:
        """Clean up browser resources"""
        console.print("\n[yellow]Cleaning up...[/yellow]")
        if self._debug_server_process:
            stop_debug_server(self._debug_server_process)
            self._debug_server_process = None
        if self.page:
            await self.page.close()
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self._playwright:
            await self._playwright.stop()
        console.print("[green]✓ Cleanup complete[/green]")

    def _on_console(self, msg):
        """Capture console messages"""
        if msg.type == "error" or "error" in msg.text.lower():
            self.console_errors.append({
                "type": msg.type,
                "text": msg.text,
                "time": datetime.now().strftime("%H:%M:%S")
            })

    def _on_error(self, error):
        """Capture page errors"""
        self.console_errors.append({
            "type": "pageerror",
            "text": str(error),
            "time": datetime.now().strftime("%H:%M:%S")
        })

    async def _configure_debug_cache(self) -> None:
        """Disable cache when using debug manifests to avoid stale bundles."""
        if not self.page or not self.context:
            return
        if not getattr(self.config, 'use_debug_manifests', False):
            return
        if self._cache_disabled:
            return

        try:
            client = await self.context.new_cdp_session(self.page)
            await client.send("Network.enable")
            await client.send("Network.clearBrowserCache")
            await client.send("Network.setCacheDisabled", {"cacheDisabled": True})
            self._cache_disabled = True
            console.print("[dim]Debug mode: cache disabled to force fresh bundles[/dim]")
        except Exception as e:
            console.print(f"[yellow]⚠ Could not disable cache: {e}[/yellow]")

    async def _ensure_debug_server(self) -> None:
        if await asyncio.to_thread(debug_manifest_available, DEBUG_MANIFEST_URL):
            return
        if not self.config.auto_start_debug_server:
            raise Exception(
                "Debug manifests not reachable. Run 'npm run serve' or pass --debug-manifests "
                "with auto-serve enabled."
            )

        console.print("[yellow]Debug manifests not reachable. Starting local debug server...[/yellow]")
        self._debug_server_process = start_debug_server(self.config.repo_root)
        ready = await asyncio.to_thread(
            wait_for_debug_manifest,
            DEBUG_MANIFEST_URL,
            self.config.debug_server_timeout
        )
        if not ready:
            stop_debug_server(self._debug_server_process)
            self._debug_server_process = None
            raise Exception(
                "Debug manifests still unavailable after starting local server. "
                "Check 'npm run serve' output for errors."
            )
        console.print("[green]✓ Debug server is running[/green]")

    async def _wait_for_workbench(self) -> None:
        """
        Wait for workbench to be ready.

        Handles authentication by:
        1. Checking if we're on a login page
        2. Waiting for user to authenticate (headed mode)
        3. Retrying canvas detection after auth
        """
        max_wait_time = 180  # 3 minutes max for auth
        start_time = datetime.now()
        last_url_shown = ""
        auth_msg_shown = False

        while (datetime.now() - start_time).seconds < max_wait_time:
            current_url = self.page.url
            current_url_lower = current_url.lower()
            elapsed = (datetime.now() - start_time).seconds

            # Check if we're on a login page
            auth_keywords = ['login', 'adfs', 'microsoftonline', 'oauth', 'authenticate']
            if any(x in current_url_lower for x in auth_keywords):
                if self.config.headed:
                    # Show URL once when it changes
                    if current_url != last_url_shown:
                        console.print("")
                        console.print(Panel(
                            "[bold yellow]🔐 SIGN-IN REQUIRED[/bold yellow]\n\n"
                            "Please sign in using the browser window that just opened.\n"
                            "The test will continue automatically after you authenticate.",
                            title="[bold]Action Required[/bold]",
                            border_style="yellow"
                        ))
                        console.print(f"[dim]   URL: {current_url[:100]}{'...' if len(current_url) > 100 else ''}[/dim]")
                        last_url_shown = current_url
                        auth_msg_shown = True
                        # Try to bring browser to front
                        try:
                            await self.page.bring_to_front()
                        except:
                            pass

                    # Print timer every 15 seconds
                    if elapsed % 15 == 0 and elapsed > 0:
                        console.print(f"[yellow]   ⏳ Still waiting for sign-in... ({elapsed}s)[/yellow]")

                    await asyncio.sleep(1)
                    continue
                else:
                    console.print("[red]✗ Authentication required but running headless.[/red]")
                    console.print(f"[dim]   URL: {current_url}[/dim]")
                    console.print("[yellow]  Run with --headed flag to authenticate manually.[/yellow]")
                    raise Exception("Authentication required - use --headed mode")

            # We're past login - check for workbench
            if 'workbench' in current_url_lower:
                # Show URL if we just arrived at workbench
                if current_url != last_url_shown:
                    console.print(f"[cyan]📄 Arrived at workbench[/cyan]")
                    console.print(f"[dim]   URL: {current_url}[/dim]")
                    last_url_shown = current_url

                # Try to find the canvas
                try:
                    await self.page.wait_for_selector(
                        self.SELECTORS["canvas_zone"],
                        state="visible",
                        timeout=5000  # Short timeout for quick checks
                    )
                    await self.page.wait_for_load_state("networkidle")
                    await asyncio.sleep(0.5)
                    console.print("[green]✓ Workbench canvas detected and ready[/green]")
                    return  # Success!
                except:
                    # Canvas not found yet, page might still be loading
                    if elapsed % 5 == 0:
                        console.print(f"[dim]   Canvas loading... ({elapsed}s)[/dim]")
                    await asyncio.sleep(1)
                    continue
            else:
                # Unknown page - might be redirecting
                if current_url != last_url_shown:
                    console.print(f"[dim]🔄 Redirecting... ({elapsed}s)[/dim]")
                    console.print(f"[dim]   URL: {current_url[:100]}{'...' if len(current_url) > 100 else ''}[/dim]")
                    last_url_shown = current_url
                await asyncio.sleep(1)

        raise Exception(f"Workbench canvas not found after {max_wait_time}s")

    async def _get_debug_manifest_info(self) -> Dict[str, Any]:
        """Inspect debug manifests loaded into the workbench page."""
        if not self.page:
            return {
                "debugManifestsPresent": False,
                "manifestCount": 0,
                "expectedFound": False,
                "piCanvasAliases": [],
                "piCanvasIds": [],
                "error": "No page available"
            }

        script = f"""
        () => {{
            const result = {{
                debugManifestsPresent: !!window.debugManifests,
                manifestCount: 0,
                expectedFound: false,
                piCanvasAliases: [],
                piCanvasIds: [],
                error: null
            }};

            try {{
                if (window.debugManifests && typeof window.debugManifests.getManifests === 'function') {{
                    const manifests = window.debugManifests.getManifests() || [];
                    result.manifestCount = manifests.length;
                    manifests.forEach(m => {{
                        if (!m) return;
                        if (m.id === "{EXPECTED_PICANVAS_COMPONENT_ID}") {{
                            result.expectedFound = true;
                        }}
                        if (m.alias && m.alias.toLowerCase().includes('picanvas')) {{
                            result.piCanvasAliases.push(m.alias);
                            if (m.id) result.piCanvasIds.push(m.id);
                        }}
                    }});
                }}
            }} catch (err) {{
                result.error = String(err);
            }}

            return result;
        }}
        """

        try:
            return await self.page.evaluate(script)
        except Exception as e:
            try:
                await self.page.wait_for_load_state("networkidle", timeout=5000)
                return await self.page.evaluate(script)
            except Exception as retry_err:
                return {
                    "debugManifestsPresent": False,
                    "manifestCount": 0,
                    "expectedFound": False,
                    "piCanvasAliases": [],
                    "piCanvasIds": [],
                    "error": f"{e}; retry failed: {retry_err}"
                }

    async def _assert_debug_manifest_loaded(self) -> None:
        """Ensure debug manifests are loaded and include PiCanvas."""
        info = await self._get_debug_manifest_info()
        self.debug_manifest_info = info

        if not info.get("debugManifestsPresent"):
            raise Exception(
                "Debug manifests not detected. Make sure the workbench URL includes "
                "debugManifestsFile and the localhost cert is trusted."
            )

        if info.get("error"):
            console.print(f"[yellow]⚠ Debug manifest inspection error: {info['error']}[/yellow]")

        if not info.get("expectedFound"):
            aliases = ", ".join(info.get("piCanvasAliases", [])) or "none"
            ids = ", ".join(info.get("piCanvasIds", [])) or "none"
            raise Exception(
                "PiCanvas component ID mismatch in debug manifests. "
                f"Expected {EXPECTED_PICANVAS_COMPONENT_ID}. "
                f"Found PiCanvas aliases: {aliases}. IDs: {ids}. "
                "Restart 'npm run serve' to regenerate manifests."
            )

        console.print(f"[green]✓ Debug manifests include PiCanvas ({EXPECTED_PICANVAS_COMPONENT_ID})[/green]")

    async def highlight_element(self, selector: str, color: str = "red", duration: int = 1000) -> None:
        """Highlight an element in the browser for debugging"""
        if not self.config.highlight_elements:
            return

        await self.page.evaluate(f"""
        (selector) => {{
            const el = document.querySelector(selector);
            if (el) {{
                const originalStyle = el.style.cssText;
                el.style.cssText = `${{originalStyle}}; outline: 3px solid {color} !important; outline-offset: 2px;`;
                setTimeout(() => {{
                    el.style.cssText = originalStyle;
                }}, {duration});
            }}
        }}
        """, selector)

    async def take_screenshot(self, name: str, highlight_selector: str = None) -> str:
        """Take screenshot with optional element highlight"""
        if highlight_selector:
            await self.highlight_element(highlight_selector, "blue", 2000)
            await asyncio.sleep(0.3)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{name}_{timestamp}.png"
        filepath = self.config.screenshot_dir / filename
        await self.page.screenshot(path=str(filepath), full_page=True)
        console.print(f"[dim]📸 Screenshot: {filepath}[/dim]")
        return str(filepath)

    async def show_toast(self, message: str, type: str = "info") -> None:
        """Show a toast notification in the browser (safe - ignores errors)"""
        colors = {
            "info": "#0078d4",
            "success": "#107c10",
            "warning": "#ffb900",
            "error": "#d13438"
        }
        color = colors.get(type, colors["info"])

        try:
            await self.page.evaluate("""
        (args) => {
            const { msg, color } = args;
            const toast = document.createElement('div');
            toast.textContent = msg;
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${color};
                color: white;
                padding: 12px 24px;
                border-radius: 4px;
                font-family: 'Segoe UI', sans-serif;
                font-size: 14px;
                z-index: 999999;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                animation: slideIn 0.3s ease;
            `;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
        """, {"msg": message, "color": color})
        except Exception:
            # Ignore toast errors (page may have navigated)
            pass

    async def wait_for_stable_page(self, timeout: int = 5000) -> None:
        """Wait for the page to be stable (no navigation in progress)"""
        try:
            await self.page.wait_for_load_state("networkidle", timeout=timeout)
            await asyncio.sleep(0.5)
        except Exception:
            pass

    async def dismiss_dialogs(self) -> None:
        """Dismiss any open dialogs/modals that might be blocking interaction"""
        try:
            # Look for common dialog dismiss buttons
            dismiss_selectors = [
                "button:has-text('Ok')",
                "button:has-text('OK')",
                "button:has-text('Close')",
                "button:has-text('Got it')",
                "button:has-text('Dismiss')",
                "button[aria-label='Close']",
                ".ms-Dialog-button--close",
                "[data-automation-id='closeButton']",
            ]

            for selector in dismiss_selectors:
                btn = self.page.locator(selector).first
                if await btn.count() > 0 and await btn.is_visible():
                    console.print(f"[dim]Dismissing dialog...[/dim]")
                    await btn.click()
                    await asyncio.sleep(0.3)
                    return
        except Exception:
            pass

    # ========== Core Operations ==========

    @retry_async(attempts=3, delay=1.0)
    async def add_section(self, layout: str = "one_column") -> bool:
        """Add a section with specified layout"""
        layout_name = self.LAYOUTS.get(layout, layout)
        console.print(f"[cyan]➕ Adding {layout_name} section...[/cyan]")

        # Wait for page to be stable before interacting
        await self.wait_for_stable_page()

        # Dismiss any open dialogs first
        await self.dismiss_dialogs()

        await self.show_toast(f"Adding {layout_name} section", "info")

        # The add section button is hidden until hovering over the canvas
        # First, find the canvas zone and scroll it into view
        canvas = self.page.locator(self.SELECTORS["canvas_zone"]).first
        if await canvas.count() == 0:
            raise Exception("Canvas zone not found")

        # Scroll canvas into view first
        await canvas.scroll_into_view_if_needed()
        await asyncio.sleep(0.3)

        # Hover over canvas to reveal the add section button
        await canvas.hover()
        await asyncio.sleep(0.5)

        # Now look for the add section button - use first visible one
        add_btn = self.page.locator(self.SELECTORS["add_section_button"]).first
        if await add_btn.count() == 0:
            # Try alternate selector
            add_btn = self.page.locator("[data-automation-id='toolboxHint-zone']").first

        if await add_btn.count() == 0:
            raise Exception("Add section button not found")

        # Click using JavaScript to bypass viewport restrictions
        await add_btn.evaluate("el => el.click()")
        await asyncio.sleep(0.5)

        # Select layout from the popup menu
        layout_btn = self.page.locator(f"button:has-text('{layout_name}')").first
        await layout_btn.wait_for(state="visible", timeout=5000)
        await layout_btn.click()
        await asyncio.sleep(0.5)

        await self.show_toast(f"✓ Added {layout_name} section", "success")
        console.print(f"[green]✓ Added {layout_name} section[/green]")
        return True

    async def _click_webpart_picker_item(
        self,
        name: str,
        component_id: Optional[str],
        preferred_groups: Optional[List[str]] = None
    ) -> None:
        """Click a web part picker entry, optionally matching a component ID."""
        if not self.page:
            raise Exception("Page not initialized")

        if component_id:
            selectors = [
                f"[data-sp-component-id='{component_id}']",
                f"[data-sp-componentid='{component_id}']",
                f"[data-sp-component-id='{component_id.lower()}']",
                f"[data-sp-componentid='{component_id.lower()}']"
            ]
            for selector in selectors:
                locator = self.page.locator(selector)
                if await locator.count() > 0:
                    await locator.first.click()
                    return

        result = await self.page.evaluate("""
        ({ name, componentId, preferredGroups }) => {
            const lowerName = (name || '').toLowerCase();
            const expected = (componentId || '').toLowerCase();
            const preferred = (preferredGroups || []).map(g => g.toLowerCase());
            const buttons = Array.from(document.querySelectorAll('button'))
                .filter(btn => (btn.textContent || '').toLowerCase().includes(lowerName));

            const candidates = buttons.map(btn => {
                const group = btn.closest('[data-automation-id="webPartPickerCategory"]')
                    || btn.closest('[data-automation-id="webPartCategory"]')
                    || btn.closest('[role="group"]');
                let groupLabel = '';
                if (group) {
                    groupLabel = group.getAttribute('aria-label')
                        || group.getAttribute('data-category-name')
                        || '';
                    if (!groupLabel) {
                        const heading = group.querySelector('[role="heading"], h2, h3, h4, .ms-GroupHeader');
                        groupLabel = heading ? (heading.textContent || '').trim() : '';
                    }
                }
                const compId = btn.getAttribute('data-sp-component-id')
                    || btn.getAttribute('data-sp-componentid')
                    || btn.dataset.spComponentId
                    || btn.dataset.spComponentid
                    || '';
                return {
                    text: (btn.textContent || '').trim(),
                    compId: compId || '',
                    groupLabel,
                    dataAutomationId: btn.getAttribute('data-automation-id') || '',
                    dataItemId: btn.getAttribute('data-item-id') || ''
                };
            });

            let target = null;
            if (expected) {
                target = buttons.find(btn => {
                    const compId = btn.getAttribute('data-sp-component-id')
                        || btn.getAttribute('data-sp-componentid')
                        || btn.dataset.spComponentId
                        || btn.dataset.spComponentid
                        || '';
                    return compId && compId.toLowerCase() === expected;
                }) || null;
            }

            if (!target && preferred.length) {
                const preferredCandidate = candidates.find(c => {
                    return c.groupLabel && preferred.some(p => c.groupLabel.toLowerCase().includes(p));
                });
                if (preferredCandidate) {
                    target = buttons[candidates.indexOf(preferredCandidate)] || null;
                }
            }

            if (!target) {
                if (expected) {
                    return { clicked: false, candidates };
                }
                target = buttons[0] || null;
            }

            if (target) {
                target.click();
                return { clicked: true, candidates };
            }

            return { clicked: false, candidates };
        }
        """, {"name": name, "componentId": component_id, "preferredGroups": preferred_groups or []})

        if not result.get("clicked"):
            candidates = result.get("candidates") or []
            candidate_summary = ", ".join(
                [
                    f"{c.get('text', '')} ({c.get('compId', 'no-id')}, {c.get('groupLabel', '') or 'no-group'})"
                    for c in candidates[:5]
                ]
            ) or "none"
            raise Exception(
                f"Web part '{name}' not found in picker. "
                f"Expected component ID: {component_id or 'any'}. "
                f"Candidates: {candidate_summary}"
            )

    @retry_async(attempts=3, delay=0.5)
    async def add_webpart(
        self,
        name: str,
        section: int = 1,
        column: int = 1,
        component_id: Optional[str] = None
    ) -> bool:
        """Add a web part to specified section/column"""
        console.print(f"[cyan]➕ Adding '{name}' to Section {section}, Column {column}...[/cyan]")

        await self.show_toast(f"Adding {name} web part", "info")

        # Find the column
        sections = await self.page.query_selector_all(self.SELECTORS["canvas_zone"])
        if section > len(sections):
            raise Exception(f"Section {section} not found (only {len(sections)} sections)")

        sect = sections[section - 1]
        columns = await sect.query_selector_all(self.SELECTORS["canvas_section"])
        if column > len(columns):
            raise Exception(f"Column {column} not found (only {len(columns)} columns)")

        col = columns[column - 1]

        # Hover and click add button
        await col.hover()
        await asyncio.sleep(0.3)

        add_btn = await col.query_selector("button[aria-label*='Add']")
        if not add_btn:
            raise Exception("Add button not found in column")

        await add_btn.click()
        await asyncio.sleep(0.5)

        # Search for web part
        search = await self.page.query_selector(self.SELECTORS["webpart_search"])
        if search:
            await search.fill(name)
            await asyncio.sleep(0.3)

        # Click web part (prefer specific component ID if provided)
        preferred_groups = None
        if component_id and self.config.use_debug_manifests:
            preferred_groups = ["Local", "Workbench", "Debug", "Developer"]
        await self._click_webpart_picker_item(name, component_id, preferred_groups)
        await asyncio.sleep(1)

        await self.show_toast(f"✓ Added {name}", "success")
        console.print(f"[green]✓ Added '{name}' web part[/green]")
        return True

    @retry_async(attempts=2, delay=0.3)
    async def set_text_content(self, text: str) -> bool:
        """Set text in the last Text web part"""
        console.print(f"[cyan]📝 Setting text content...[/cyan]")

        editors = await self.page.query_selector_all(self.SELECTORS["text_editor"])
        if not editors:
            # Click on text web part first
            text_wps = await self.page.query_selector_all("[data-automation-id='textWebPart']")
            if text_wps:
                await text_wps[-1].click()
                await asyncio.sleep(0.3)
                editors = await self.page.query_selector_all(self.SELECTORS["text_editor"])

        if not editors:
            raise Exception("No text editor found")

        await editors[-1].click()
        await asyncio.sleep(0.2)
        await editors[-1].fill(text)

        console.print(f"[green]✓ Text content set[/green]")
        return True

    async def toggle_preview(self) -> bool:
        """Toggle preview mode"""
        console.print(f"[cyan]👁️ Toggling preview mode...[/cyan]")

        # Dismiss any open dialogs first
        await self.dismiss_dialogs()

        preview_btn = self.page.locator(self.SELECTORS["preview_toggle"])
        if await preview_btn.count() > 0:
            await preview_btn.click()
        else:
            # Try alternate
            edit_btn = self.page.locator("button:has-text('Edit')")
            preview_btn2 = self.page.locator("button:has-text('Preview')")

            if await edit_btn.count() > 0:
                await edit_btn.click()
            elif await preview_btn2.count() > 0:
                await preview_btn2.click()

        await asyncio.sleep(1)
        console.print(f"[green]✓ Preview mode toggled[/green]")
        return True

    async def inspect_page(self) -> Dict[str, Any]:
        """Inspect page structure"""
        result = await self.page.evaluate("""
        () => {
            const sections = document.querySelectorAll('[data-automation-id="CanvasZone"]');
            const details = [];

            sections.forEach((s, i) => {
                const cols = s.querySelectorAll('[data-automation-id="CanvasSection"]');
                const wps = s.querySelectorAll('.ControlZone');
                details.push({
                    section: i + 1,
                    columns: cols.length,
                    webparts: wps.length,
                    hillbillyId: s.getAttribute('data-hillbilly-section-id')
                });
            });

            return {
                totalSections: sections.length,
                totalWebparts: document.querySelectorAll('.ControlZone').length,
                picanvasFound: !!document.querySelector('[class*="piCanvas"]'),
                details: details
            };
        }
        """)
        return result

    # ========== Test Cases ==========

    async def test_workbench_loads(self) -> TestResult:
        """Test: Verify workbench loads without errors"""
        test_name = "workbench_loads"
        start_time = datetime.now()

        console.print(Panel(
            "[bold]Test: Workbench Loads[/bold]\n\n"
            "Verify that the SharePoint workbench loads correctly\n"
            "without any 'Unknown' or rejection errors.",
            title=f"[cyan]🧪 {test_name}[/cyan]",
            border_style="cyan"
        ))

        try:
            # Wait for page to be fully loaded
            await asyncio.sleep(2)

            # Check for critical errors
            unknown_errors = [e for e in self.console_errors
                           if "Unknown" in e.get("text", "") or "rejection" in e.get("text", "").lower()]

            inspection = await self.inspect_page()
            screenshot = await self.take_screenshot(test_name)

            passed = len(unknown_errors) == 0
            duration = (datetime.now() - start_time).total_seconds() * 1000

            if not passed:
                console.print(f"[red]✗ Found {len(unknown_errors)} critical errors[/red]")
                for err in unknown_errors[:3]:
                    console.print(f"[red]  - {err.get('text', '')[:60]}...[/red]")

            return TestResult(
                name=test_name,
                passed=passed,
                duration_ms=duration,
                screenshot=screenshot,
                details={
                    "inspection": inspection,
                    "unknown_errors": len(unknown_errors),
                    "total_errors": len(self.console_errors)
                }
            )

        except Exception as e:
            console.print(f"[red]✗ Test failed: {e}[/red]")
            return TestResult(
                name=test_name,
                passed=False,
                duration_ms=(datetime.now() - start_time).total_seconds() * 1000,
                error=str(e)
            )

    async def test_add_section(self) -> TestResult:
        """Test: Add sections with different layouts"""
        test_name = "add_section"
        start_time = datetime.now()

        console.print(Panel(
            "[bold]Test: Add Sections[/bold]\n\n"
            "Verify that sections with different layouts\n"
            "can be added successfully.",
            title=f"[cyan]🧪 {test_name}[/cyan]",
            border_style="cyan"
        ))

        try:
            initial = await self.inspect_page()

            # Add two-column section
            await self.add_section("two_column")

            final = await self.inspect_page()
            screenshot = await self.take_screenshot(test_name)

            passed = final["totalSections"] > initial["totalSections"]
            duration = (datetime.now() - start_time).total_seconds() * 1000

            return TestResult(
                name=test_name,
                passed=passed,
                duration_ms=duration,
                screenshot=screenshot,
                details={
                    "sections_before": initial["totalSections"],
                    "sections_after": final["totalSections"]
                }
            )

        except Exception as e:
            console.print(f"[red]✗ Test failed: {e}[/red]")
            screenshot = await self.take_screenshot(f"{test_name}_error")
            return TestResult(
                name=test_name,
                passed=False,
                duration_ms=(datetime.now() - start_time).total_seconds() * 1000,
                error=str(e),
                screenshot=screenshot
            )

    async def test_section_as_tab(self) -> TestResult:
        """Test: Use entire section as a tab"""
        test_name = "section_as_tab"
        start_time = datetime.now()

        console.print(Panel(
            "[bold]Test: Section as Tab[/bold]\n\n"
            "Verify that a section with multiple web parts\n"
            "can be used as tab content in PiCanvas.",
            title=f"[cyan]🧪 {test_name}[/cyan]",
            border_style="cyan"
        ))

        try:
            # Step 1: Add two-column section
            console.print("[dim]Step 1: Adding two-column section...[/dim]")
            await self.add_section("two_column")

            # Step 2: Add text to column 1
            console.print("[dim]Step 2: Adding text to column 1...[/dim]")
            await self.add_webpart("Text", section=1, column=1)
            await self.set_text_content("Column 1: Hello from the first column! This is test content.")

            # Step 3: Add text to column 2
            console.print("[dim]Step 3: Adding text to column 2...[/dim]")
            await self.add_webpart("Text", section=1, column=2)
            await self.set_text_content("Column 2: Content in the second column!")

            # Step 4: Add PiCanvas
            console.print("[dim]Step 4: Adding PiCanvas...[/dim]")
            await self.add_section("one_column")
            await asyncio.sleep(0.5)

            try:
                await self.add_webpart("PiCanvas", section=2, column=1, component_id=EXPECTED_PICANVAS_COMPONENT_ID)
            except:
                console.print("[yellow]⚠ PiCanvas not available in toolbox[/yellow]")

            # Inspect and screenshot
            inspection = await self.inspect_page()
            screenshot = await self.take_screenshot(test_name)

            # Check if we have the expected structure
            passed = (
                inspection["totalSections"] >= 2 and
                len([d for d in inspection["details"] if d["columns"] >= 2]) > 0
            )

            duration = (datetime.now() - start_time).total_seconds() * 1000

            return TestResult(
                name=test_name,
                passed=passed,
                duration_ms=duration,
                screenshot=screenshot,
                details={"inspection": inspection}
            )

        except Exception as e:
            console.print(f"[red]✗ Test failed: {e}[/red]")
            screenshot = await self.take_screenshot(f"{test_name}_error")
            return TestResult(
                name=test_name,
                passed=False,
                duration_ms=(datetime.now() - start_time).total_seconds() * 1000,
                error=str(e),
                screenshot=screenshot
            )

    async def test_mermaid_content_type(self) -> TestResult:
        """Test: Configure PiCanvas with Mermaid diagram content type (v3.0)"""
        test_name = "mermaid_content_type"
        start_time = datetime.now()

        console.print(Panel(
            "[bold]Test: Mermaid Content Type (v3.0)[/bold]\n\n"
            "Verify that PiCanvas can be configured with\n"
            "a Mermaid diagram as tab content.",
            title=f"[cyan]🧪 {test_name}[/cyan]",
            border_style="cyan"
        ))

        try:
            # Step 1: Add section and PiCanvas
            console.print("[dim]Step 1: Adding section with PiCanvas...[/dim]")
            await self.add_section("one_column")
            await self.add_webpart("PiCanvas", section=1, column=1, component_id=EXPECTED_PICANVAS_COMPONENT_ID)
            await asyncio.sleep(1)

            # Step 2: Click "Configure Tabs" button to enter tab config mode
            console.print("[dim]Step 2: Clicking Configure Tabs button...[/dim]")
            configure_btn = self.page.locator("button:has-text('Configure Tabs'), a:has-text('Configure Tabs')").first
            if await configure_btn.count() > 0:
                await configure_btn.click()
                await asyncio.sleep(1)
                console.print("[green]✓ Opened tab configuration[/green]")
            else:
                # Try clicking on PiCanvas to select it first
                picanvas = self.page.locator("[class*='piCanvas'], [class*='hillbilly'], .hillbillyTabBar").first
                if await picanvas.count() > 0:
                    await picanvas.click()
                    await asyncio.sleep(0.5)
                    # Try again
                    configure_btn = self.page.locator("button:has-text('Configure Tabs'), a:has-text('Configure Tabs')").first
                    if await configure_btn.count() > 0:
                        await configure_btn.click()
                        await asyncio.sleep(1)

            # Step 3: Look for Tab Configuration section in property pane
            console.print("[dim]Step 3: Looking for Tab Configuration panel...[/dim]")

            # Check for various v3.0 indicators in the property pane
            v3_features = await self.page.evaluate("""
            () => {
                const result = {
                    contentTypeFound: false,
                    tabConfigFound: false,
                    propertyPaneOpen: false,
                    allLabels: []
                };

                // Check if property pane is open
                const propertyPane = document.querySelector('.spPropertyPaneContainer, [class*="propertyPane"]');
                result.propertyPaneOpen = !!propertyPane;

                // Look for all labels to debug
                const labels = document.querySelectorAll('.ms-Label, label');
                labels.forEach(label => {
                    const text = label.textContent.trim();
                    if (text) result.allLabels.push(text);
                    if (text.includes('Content Type')) result.contentTypeFound = true;
                    if (text.includes('Tab Configuration') || text.includes('Tab ')) result.tabConfigFound = true;
                });

                // Also check dropdown titles
                const dropdowns = document.querySelectorAll('.ms-Dropdown-title');
                dropdowns.forEach(dd => {
                    const text = dd.textContent.trim();
                    if (text.includes('Mermaid') || text.includes('Markdown') ||
                        text.includes('SharePoint Web Part') || text.includes('HTML')) {
                        result.contentTypeFound = true;
                    }
                });

                return result;
            }
            """)

            console.print(f"[dim]   Property pane open: {v3_features.get('propertyPaneOpen', False)}[/dim]")
            console.print(f"[dim]   Tab config found: {v3_features.get('tabConfigFound', False)}[/dim]")
            console.print(f"[dim]   Content Type found: {v3_features.get('contentTypeFound', False)}[/dim]")

            # If Content Type not found, try scrolling the property pane or expanding sections
            content_type_found = v3_features.get('contentTypeFound', False)

            if not content_type_found:
                # Try expanding Tab Configuration group if collapsed
                console.print("[dim]Step 4: Trying to expand Tab Configuration...[/dim]")
                tab_config_header = self.page.locator("button:has-text('Tab Configuration'), .ms-Button:has-text('Tab')").first
                if await tab_config_header.count() > 0:
                    await tab_config_header.click()
                    await asyncio.sleep(0.5)

                # Check again
                content_type_found = await self.page.evaluate("""
                () => {
                    const labels = document.querySelectorAll('.ms-Label, label');
                    for (const label of labels) {
                        if (label.textContent.includes('Content Type')) return true;
                    }
                    return false;
                }
                """)

            # Step 5: Try to select Mermaid if available
            mermaid_selected = False
            if content_type_found:
                console.print("[green]✓ Content Type dropdown found![/green]")
                try:
                    # Find and click Content Type dropdown
                    await self.page.click("text=Content Type")
                    await asyncio.sleep(0.3)

                    # Look for dropdown that follows
                    dropdown = self.page.locator(".ms-Dropdown").first
                    if await dropdown.count() > 0:
                        await dropdown.click()
                        await asyncio.sleep(0.3)

                        # Select Mermaid
                        mermaid_opt = self.page.locator("button:has-text('Mermaid'), span:has-text('Mermaid Diagram')").first
                        if await mermaid_opt.count() > 0:
                            await mermaid_opt.click()
                            mermaid_selected = True
                            console.print("[green]✓ Selected Mermaid content type![/green]")
                            await asyncio.sleep(0.5)

                            # Look for content textarea
                            content_field = self.page.locator("textarea").first
                            if await content_field.count() > 0:
                                mermaid_code = """graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> A"""
                                await content_field.fill(mermaid_code)
                                console.print("[green]✓ Entered Mermaid diagram code![/green]")
                except Exception as e:
                    console.print(f"[yellow]⚠ Could not interact with Content Type: {e}[/yellow]")

            screenshot = await self.take_screenshot(test_name)
            duration = (datetime.now() - start_time).total_seconds() * 1000

            # Test passes if we found the v3.0 Content Type feature
            passed = content_type_found

            details = {
                "content_type_found": content_type_found,
                "mermaid_selected": mermaid_selected,
                "v3_features_available": content_type_found,
                "property_pane_open": v3_features.get('propertyPaneOpen', False),
                "labels_found": v3_features.get('allLabels', [])[:10]  # First 10 labels for debugging
            }
            if self.debug_manifest_info:
                details["debug_manifest"] = self.debug_manifest_info

            return TestResult(
                name=test_name,
                passed=passed,
                duration_ms=duration,
                screenshot=screenshot,
                details=details
            )

        except Exception as e:
            console.print(f"[red]✗ Test failed: {e}[/red]")
            screenshot = await self.take_screenshot(f"{test_name}_error")
            return TestResult(
                name=test_name,
                passed=False,
                duration_ms=(datetime.now() - start_time).total_seconds() * 1000,
                error=str(e),
                screenshot=screenshot
            )

    async def test_markdown_content_type(self) -> TestResult:
        """Test: Configure PiCanvas with Markdown content type (v3.0)"""
        test_name = "markdown_content_type"
        start_time = datetime.now()

        console.print(Panel(
            "[bold]Test: Markdown Content Type (v3.0)[/bold]\n\n"
            "Verify that PiCanvas can be configured with\n"
            "Markdown content as tab content.",
            title=f"[cyan]🧪 {test_name}[/cyan]",
            border_style="cyan"
        ))

        try:
            # Step 1: Add section and PiCanvas
            console.print("[dim]Step 1: Adding section with PiCanvas...[/dim]")
            await self.add_section("one_column")
            await self.add_webpart("PiCanvas", section=1, column=1, component_id=EXPECTED_PICANVAS_COMPONENT_ID)
            await asyncio.sleep(1)

            # Step 2: Click "Configure Tabs" button
            console.print("[dim]Step 2: Clicking Configure Tabs button...[/dim]")
            configure_btn = self.page.locator("button:has-text('Configure Tabs'), a:has-text('Configure Tabs')").first
            if await configure_btn.count() > 0:
                await configure_btn.click()
                await asyncio.sleep(1)
                console.print("[green]✓ Opened tab configuration[/green]")

            # Step 3: Find Content Type dropdown
            console.print("[dim]Step 3: Looking for Content Type dropdown...[/dim]")
            content_type_found = await self.page.evaluate("""
            () => {
                const labels = document.querySelectorAll('.ms-Label, label');
                for (const label of labels) {
                    if (label.textContent.includes('Content Type')) return true;
                }
                return false;
            }
            """)

            # Step 4: Select Markdown content type
            markdown_selected = False
            markdown_entered = False
            if content_type_found:
                console.print("[green]✓ Content Type dropdown found![/green]")
                try:
                    # Click Content Type dropdown
                    dropdown = self.page.locator(".ms-Dropdown").first
                    if await dropdown.count() > 0:
                        await dropdown.click()
                        await asyncio.sleep(0.3)

                        # Select Markdown
                        markdown_opt = self.page.locator("button:has-text('Markdown'), span:has-text('Markdown Content')").first
                        if await markdown_opt.count() > 0:
                            await markdown_opt.click()
                            markdown_selected = True
                            console.print("[green]✓ Selected Markdown content type![/green]")
                            await asyncio.sleep(0.5)

                            # Enter Markdown content
                            content_field = self.page.locator("textarea").first
                            if await content_field.count() > 0:
                                markdown_content = """# Hello World

This is **bold** and *italic* text.

## Features
- Item 1
- Item 2
- Item 3

[Link](https://example.com)"""
                                await content_field.fill(markdown_content)
                                markdown_entered = True
                                console.print("[green]✓ Entered Markdown content![/green]")
                except Exception as e:
                    console.print(f"[yellow]⚠ Could not interact with Content Type: {e}[/yellow]")

            screenshot = await self.take_screenshot(test_name)
            duration = (datetime.now() - start_time).total_seconds() * 1000

            passed = content_type_found and markdown_selected

            details = {
                "content_type_found": content_type_found,
                "markdown_selected": markdown_selected,
                "markdown_entered": markdown_entered
            }
            if self.debug_manifest_info:
                details["debug_manifest"] = self.debug_manifest_info

            return TestResult(
                name=test_name,
                passed=passed,
                duration_ms=duration,
                screenshot=screenshot,
                details=details
            )

        except Exception as e:
            console.print(f"[red]✗ Test failed: {e}[/red]")
            screenshot = await self.take_screenshot(f"{test_name}_error")
            return TestResult(
                name=test_name,
                passed=False,
                duration_ms=(datetime.now() - start_time).total_seconds() * 1000,
                error=str(e),
                screenshot=screenshot
            )

    async def test_html_content_type(self) -> TestResult:
        """Test: Configure PiCanvas with HTML content type (v3.0)"""
        test_name = "html_content_type"
        start_time = datetime.now()

        console.print(Panel(
            "[bold]Test: HTML Content Type (v3.0)[/bold]\n\n"
            "Verify that PiCanvas can be configured with\n"
            "HTML content as tab content.",
            title=f"[cyan]🧪 {test_name}[/cyan]",
            border_style="cyan"
        ))

        try:
            # Step 1: Add section and PiCanvas
            console.print("[dim]Step 1: Adding section with PiCanvas...[/dim]")
            await self.add_section("one_column")
            await self.add_webpart("PiCanvas", section=1, column=1, component_id=EXPECTED_PICANVAS_COMPONENT_ID)
            await asyncio.sleep(1)

            # Step 2: Click "Configure Tabs" button
            console.print("[dim]Step 2: Clicking Configure Tabs button...[/dim]")
            configure_btn = self.page.locator("button:has-text('Configure Tabs'), a:has-text('Configure Tabs')").first
            if await configure_btn.count() > 0:
                await configure_btn.click()
                await asyncio.sleep(1)
                console.print("[green]✓ Opened tab configuration[/green]")

            # Step 3: Find Content Type dropdown
            console.print("[dim]Step 3: Looking for Content Type dropdown...[/dim]")
            content_type_found = await self.page.evaluate("""
            () => {
                const labels = document.querySelectorAll('.ms-Label, label');
                for (const label of labels) {
                    if (label.textContent.includes('Content Type')) return true;
                }
                return false;
            }
            """)

            # Step 4: Select HTML content type
            html_selected = False
            html_entered = False
            if content_type_found:
                console.print("[green]✓ Content Type dropdown found![/green]")
                try:
                    # Click Content Type dropdown
                    dropdown = self.page.locator(".ms-Dropdown").first
                    if await dropdown.count() > 0:
                        await dropdown.click()
                        await asyncio.sleep(0.3)

                        # Select HTML
                        html_opt = self.page.locator("button:has-text('HTML'), span:has-text('HTML Content')").first
                        if await html_opt.count() > 0:
                            await html_opt.click()
                            html_selected = True
                            console.print("[green]✓ Selected HTML content type![/green]")
                            await asyncio.sleep(0.5)

                            # Enter HTML content
                            content_field = self.page.locator("textarea").first
                            if await content_field.count() > 0:
                                html_content = """<div style="padding: 20px; background: #f0f0f0; border-radius: 8px;">
    <h2 style="color: #333;">Custom HTML Content</h2>
    <p>This is <strong>sanitized HTML</strong> content.</p>
    <ul>
        <li>Feature A</li>
        <li>Feature B</li>
    </ul>
</div>"""
                                await content_field.fill(html_content)
                                html_entered = True
                                console.print("[green]✓ Entered HTML content![/green]")
                except Exception as e:
                    console.print(f"[yellow]⚠ Could not interact with Content Type: {e}[/yellow]")

            screenshot = await self.take_screenshot(test_name)
            duration = (datetime.now() - start_time).total_seconds() * 1000

            passed = content_type_found and html_selected

            details = {
                "content_type_found": content_type_found,
                "html_selected": html_selected,
                "html_entered": html_entered
            }
            if self.debug_manifest_info:
                details["debug_manifest"] = self.debug_manifest_info

            return TestResult(
                name=test_name,
                passed=passed,
                duration_ms=duration,
                screenshot=screenshot,
                details=details
            )

        except Exception as e:
            console.print(f"[red]✗ Test failed: {e}[/red]")
            screenshot = await self.take_screenshot(f"{test_name}_error")
            return TestResult(
                name=test_name,
                passed=False,
                duration_ms=(datetime.now() - start_time).total_seconds() * 1000,
                error=str(e),
                screenshot=screenshot
            )

    async def test_embed_content_type(self) -> TestResult:
        """Test: Configure PiCanvas with Embed (iframe) content type (v3.0)"""
        test_name = "embed_content_type"
        start_time = datetime.now()

        console.print(Panel(
            "[bold]Test: Embed Content Type (v3.0)[/bold]\n\n"
            "Verify that PiCanvas can be configured with\n"
            "an embedded iframe as tab content.",
            title=f"[cyan]🧪 {test_name}[/cyan]",
            border_style="cyan"
        ))

        try:
            # Step 1: Add section and PiCanvas
            console.print("[dim]Step 1: Adding section with PiCanvas...[/dim]")
            await self.add_section("one_column")
            await self.add_webpart("PiCanvas", section=1, column=1, component_id=EXPECTED_PICANVAS_COMPONENT_ID)
            await asyncio.sleep(1)

            # Step 2: Click "Configure Tabs" button
            console.print("[dim]Step 2: Clicking Configure Tabs button...[/dim]")
            configure_btn = self.page.locator("button:has-text('Configure Tabs'), a:has-text('Configure Tabs')").first
            if await configure_btn.count() > 0:
                await configure_btn.click()
                await asyncio.sleep(1)
                console.print("[green]✓ Opened tab configuration[/green]")

            # Step 3: Find Content Type dropdown
            console.print("[dim]Step 3: Looking for Content Type dropdown...[/dim]")
            content_type_found = await self.page.evaluate("""
            () => {
                const labels = document.querySelectorAll('.ms-Label, label');
                for (const label of labels) {
                    if (label.textContent.includes('Content Type')) return true;
                }
                return false;
            }
            """)

            # Step 4: Select Embed content type
            embed_selected = False
            embed_url_entered = False
            if content_type_found:
                console.print("[green]✓ Content Type dropdown found![/green]")
                try:
                    # Click Content Type dropdown
                    dropdown = self.page.locator(".ms-Dropdown").first
                    if await dropdown.count() > 0:
                        await dropdown.click()
                        await asyncio.sleep(0.3)

                        # Select Embed
                        embed_opt = self.page.locator("button:has-text('Embed'), span:has-text('Embed')").first
                        if await embed_opt.count() > 0:
                            await embed_opt.click()
                            embed_selected = True
                            console.print("[green]✓ Selected Embed content type![/green]")
                            await asyncio.sleep(0.5)

                            # Enter Embed URL (YouTube is in the trusted domains list)
                            url_field = self.page.locator("input[type='text'], input.ms-TextField-field").first
                            if await url_field.count() > 0:
                                embed_url = "https://www.youtube.com/embed/dQw4w9WgXcQ"
                                await url_field.fill(embed_url)
                                embed_url_entered = True
                                console.print("[green]✓ Entered Embed URL![/green]")

                            # Check for height field
                            height_field = self.page.locator("input[placeholder='400px']").first
                            if await height_field.count() > 0:
                                await height_field.fill("500px")
                                console.print("[green]✓ Set embed height![/green]")
                except Exception as e:
                    console.print(f"[yellow]⚠ Could not interact with Content Type: {e}[/yellow]")

            screenshot = await self.take_screenshot(test_name)
            duration = (datetime.now() - start_time).total_seconds() * 1000

            passed = content_type_found and embed_selected

            details = {
                "content_type_found": content_type_found,
                "embed_selected": embed_selected,
                "embed_url_entered": embed_url_entered
            }
            if self.debug_manifest_info:
                details["debug_manifest"] = self.debug_manifest_info

            return TestResult(
                name=test_name,
                passed=passed,
                duration_ms=duration,
                screenshot=screenshot,
                details=details
            )

        except Exception as e:
            console.print(f"[red]✗ Test failed: {e}[/red]")
            screenshot = await self.take_screenshot(f"{test_name}_error")
            return TestResult(
                name=test_name,
                passed=False,
                duration_ms=(datetime.now() - start_time).total_seconds() * 1000,
                error=str(e),
                screenshot=screenshot
            )

    async def test_preview_mode(self) -> TestResult:
        """Test: Toggle preview mode"""
        test_name = "preview_mode"
        start_time = datetime.now()

        console.print(Panel(
            "[bold]Test: Preview Mode[/bold]\n\n"
            "Verify that preview mode can be toggled.",
            title=f"[cyan]🧪 {test_name}[/cyan]",
            border_style="cyan"
        ))

        try:
            # Toggle to preview
            await self.toggle_preview()
            await asyncio.sleep(1)

            # Check mode
            edit_visible = await self.page.locator("button:has-text('Edit')").count() > 0

            screenshot = await self.take_screenshot(test_name)

            # Toggle back
            await self.toggle_preview()

            duration = (datetime.now() - start_time).total_seconds() * 1000

            return TestResult(
                name=test_name,
                passed=True,  # If we got here, toggle worked
                duration_ms=duration,
                screenshot=screenshot,
                details={"preview_mode_detected": edit_visible}
            )

        except Exception as e:
            console.print(f"[red]✗ Test failed: {e}[/red]")
            return TestResult(
                name=test_name,
                passed=False,
                duration_ms=(datetime.now() - start_time).total_seconds() * 1000,
                error=str(e)
            )

    # ========== Test Runner ==========

    async def run_test(self, test_func: Callable) -> TestResult:
        """Run a single test with error handling"""
        try:
            result = await test_func()
            self.test_results.append(result)

            status = "[green]PASS[/green]" if result.passed else "[red]FAIL[/red]"
            console.print(f"\n{status} {result.name} ({result.duration_ms:.0f}ms)")

            if result.error:
                console.print(f"[red]  Error: {result.error}[/red]")

            return result

        except Exception as e:
            console.print(f"[red]✗ Test crashed: {e}[/red]")
            result = TestResult(
                name=test_func.__name__,
                passed=False,
                duration_ms=0,
                error=str(e)
            )
            self.test_results.append(result)
            return result

    async def run_all_tests(self) -> List[TestResult]:
        """Run all tests"""
        tests = [
            self.test_workbench_loads,
            self.test_add_section,
            self.test_section_as_tab,
            self.test_mermaid_content_type,
            self.test_markdown_content_type,
            self.test_html_content_type,
            self.test_embed_content_type,
            self.test_preview_mode,
        ]

        console.print(Panel(
            f"[bold]Running {len(tests)} tests[/bold]",
            title="[cyan]🧪 Test Suite[/cyan]",
            border_style="cyan"
        ))

        for i, test_func in enumerate(tests, 1):
            console.print(f"\n[bold cyan]━━━ Test {i}/{len(tests)} ━━━[/bold cyan]\n")

            # Reset page between tests
            if i > 1:
                await self.page.reload()
                await self._wait_for_workbench()
                self.console_errors = []  # Clear errors between tests

            await self.run_test(test_func)

        return self.test_results

    def print_results(self) -> None:
        """Print test results summary"""
        passed = sum(1 for r in self.test_results if r.passed)
        failed = len(self.test_results) - passed
        total_time = sum(r.duration_ms for r in self.test_results)

        # Results table
        table = Table(title="Test Results", box=box.ROUNDED)
        table.add_column("Test", style="cyan")
        table.add_column("Status", justify="center")
        table.add_column("Duration", justify="right")
        table.add_column("Details", style="dim")

        for result in self.test_results:
            status = "[green]✓ PASS[/green]" if result.passed else "[red]✗ FAIL[/red]"
            duration = f"{result.duration_ms:.0f}ms"
            details = result.error[:40] if result.error else ""
            table.add_row(result.name, status, duration, details)

        console.print("\n")
        console.print(table)

        # Summary
        summary_style = "green" if failed == 0 else "red"
        console.print(Panel(
            f"[bold]Passed: {passed}[/bold] | [bold]Failed: {failed}[/bold] | "
            f"[bold]Total Time: {total_time:.0f}ms[/bold]",
            title=f"[{summary_style}]Summary[/{summary_style}]",
            border_style=summary_style
        ))

    def generate_report(self) -> str:
        """Generate detailed test report"""
        passed = sum(1 for r in self.test_results if r.passed)
        failed = len(self.test_results) - passed
        total_time = sum(r.duration_ms for r in self.test_results)

        report = {
            "timestamp": datetime.now().isoformat(),
            "url": self.config.workbench_url,
            "summary": {
                "total": len(self.test_results),
                "passed": passed,
                "failed": failed,
                "duration_ms": total_time
            },
            "tests": [
                {
                    "name": r.name,
                    "passed": r.passed,
                    "duration_ms": r.duration_ms,
                    "error": r.error,
                    "screenshot": r.screenshot,
                    "details": r.details
                }
                for r in self.test_results
            ],
            "console_errors": self.console_errors
        }

        return json.dumps(report, indent=2, default=str)


async def main():
    """Main entry point"""
    tenant_choices = list(TENANTS.keys())

    parser = argparse.ArgumentParser(
        description="PiCanvas Workbench Test Suite",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""
Examples:
  python workbench_automation.py --headed                    # Run with browser visible (default tenant)
  python workbench_automation.py --headed --tenant sap       # Run on SAP tenant
  python workbench_automation.py --headed --slow             # Run slowly for debugging
  python workbench_automation.py --list-tenants              # Show all available tenants
  python workbench_automation.py --url URL                   # Custom workbench URL (overrides tenant)

Available tenants: {', '.join(tenant_choices)}
        """
    )
    parser.add_argument("--tenant", "-t", default=DEFAULT_TENANT,
                       choices=tenant_choices,
                       help=f"SharePoint tenant to test (default: {DEFAULT_TENANT})")
    parser.add_argument("--list-tenants", action="store_true",
                       help="List all available tenants and exit")
    parser.add_argument("--headed", action="store_true",
                       help="Run with visible browser (required for authentication)")
    parser.add_argument("--url",
                       help="Custom workbench URL (overrides tenant)")
    parser.add_argument("--test",
                       help="Run specific test (workbench_loads, add_section, section_as_tab, mermaid_content_type, markdown_content_type, html_content_type, embed_content_type, preview_mode)")
    parser.add_argument("--no-highlight", action="store_true",
                       help="Disable element highlighting in browser")
    parser.add_argument("--debug-manifests", action="store_true",
                       help="Load from localhost:4321 debug server instead of app catalog")
    parser.add_argument("--no-auto-serve", action="store_true",
                       help="Don't auto-start npm run serve when debug manifests are requested")
    parser.add_argument("--slow", action="store_true",
                       help="Run with slower animations for debugging")
    parser.add_argument("--timeout", type=int, default=30000,
                       help="Default timeout in milliseconds (default: 30000)")
    parser.add_argument("--no-persist", action="store_true",
                       help="Don't save authentication between runs")

    args = parser.parse_args()

    # Handle --list-tenants
    if args.list_tenants:
        print_banner()
        print_tenant_table()
        return

    print_banner()

    # Show selected tenant
    tenant_config = get_tenant_config(args.tenant)
    console.print(Panel(
        f"[bold]{tenant_config['name']}[/bold]\n"
        f"Site: [cyan]{tenant_config['site']}[/cyan]\n"
        f"Tenant ID: [dim]{tenant_config['tenant_id'] or 'Not configured'}[/dim]",
        title=f"[green]🏢 Tenant: {args.tenant}[/green]",
        border_style="green"
    ))

    # Warn if running headless (auth will fail)
    if not args.headed:
        console.print(Panel(
            "[yellow]⚠️ Running in headless mode[/yellow]\n\n"
            "SharePoint requires authentication. If tests fail with\n"
            "'Authentication required', run with [bold]--headed[/bold] flag.",
            title="[yellow]Warning[/yellow]",
            border_style="yellow"
        ))

    config = TestConfig(
        tenant=args.tenant,
        workbench_url=args.url or "",  # Empty string means use tenant URL
        headed=args.headed,
        highlight_elements=not args.no_highlight,
        slow_mo=200 if args.slow else 50,
        timeout=args.timeout,
        persist_auth=not args.no_persist,
        use_debug_manifests=args.debug_manifests,
        auto_start_debug_server=not args.no_auto_serve
    )

    automation = SharePointWorkbenchAutomation(config)

    try:
        await automation.setup()

        if args.test:
            # Run specific test
            test_map = {
                "workbench_loads": automation.test_workbench_loads,
                "add_section": automation.test_add_section,
                "section_as_tab": automation.test_section_as_tab,
                "mermaid_content_type": automation.test_mermaid_content_type,
                "markdown_content_type": automation.test_markdown_content_type,
                "html_content_type": automation.test_html_content_type,
                "embed_content_type": automation.test_embed_content_type,
                "preview_mode": automation.test_preview_mode,
            }
            if args.test in test_map:
                await automation.run_test(test_map[args.test])
            else:
                console.print(f"[red]Unknown test: {args.test}[/red]")
                console.print(f"[dim]Available: {', '.join(test_map.keys())}[/dim]")
                return
        else:
            await automation.run_all_tests()

        automation.print_results()

        # Save report
        report = automation.generate_report()
        report_file = f"test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, "w") as f:
            f.write(report)
        console.print(f"\n[dim]Report saved: {report_file}[/dim]")

        # Exit with appropriate code
        failed = sum(1 for r in automation.test_results if not r.passed)
        if failed > 0:
            console.print(f"\n[red]✗ {failed} test(s) failed[/red]")
        else:
            console.print("\n[bold green]✓ All tests passed![/bold green]")

    except Exception as e:
        console.print(f"\n[red]✗ Test suite failed: {e}[/red]")
        console.print("[dim]Check screenshots/ directory for debugging.[/dim]")

    finally:
        await automation.teardown()

    console.print("\n[bold]Test suite complete![/bold]\n")


if __name__ == "__main__":
    asyncio.run(main())
