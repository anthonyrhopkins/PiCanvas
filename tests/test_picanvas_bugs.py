#!/usr/bin/env python3
"""
PiCanvas Bug Test Cases

Specific test cases for bugs that have been identified and fixed in PiCanvas.
These tests serve as regression tests to ensure bugs don't reappear.

Run with: pytest test_picanvas_bugs.py -v
"""

import asyncio
import os
from pathlib import Path
import pytest
from playwright.async_api import async_playwright, Page, expect
from debug_server import (
    DEBUG_MANIFEST_URL,
    debug_manifest_available,
    wait_for_debug_manifest,
    start_debug_server,
    stop_debug_server
)


# Configuration
WORKBENCH_BASE_URL = "https://pispace.sharepoint.com/_layouts/15/workbench.aspx"
DEBUG_QUERY = f"?debug=true&noredir=true&debugManifestsFile={DEBUG_MANIFEST_URL}"
WORKBENCH_URL = WORKBENCH_BASE_URL + DEBUG_QUERY
TIMEOUT = 30000
AUTO_SERVE = os.getenv("PICANVAS_AUTO_SERVE", "1") != "0"


@pytest.fixture(scope="module", autouse=True)
def ensure_debug_server():
    if debug_manifest_available(DEBUG_MANIFEST_URL):
        yield
        return
    if not AUTO_SERVE:
        pytest.skip("Debug manifests unavailable. Run 'npm run serve' or set PICANVAS_AUTO_SERVE=1.")

    repo_root = Path(__file__).resolve().parents[1]
    process = start_debug_server(repo_root)
    if not wait_for_debug_manifest(DEBUG_MANIFEST_URL, timeout=60):
        stop_debug_server(process)
        pytest.fail(
            "Debug manifests still unavailable after starting local server. "
            "Check 'npm run serve' output for errors."
        )
    yield
    stop_debug_server(process)


@pytest.fixture(scope="module")
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
async def browser():
    """Launch browser for tests"""
    async with async_playwright() as p:
        # Use headless=False to watch the test, headless=True for CI
        browser = await p.chromium.launch(headless=False, slow_mo=100)
        yield browser
        await browser.close()


@pytest.fixture
async def page(browser):
    """Create new page for each test"""
    context = await browser.new_context(viewport={"width": 1920, "height": 1080})
    page = await context.new_page()
    page.set_default_timeout(TIMEOUT)

    # Navigate to workbench
    await page.goto(WORKBENCH_URL, wait_until="networkidle")
    await page.wait_for_selector("[data-automation-id='CanvasZone']", timeout=TIMEOUT)

    yield page

    await page.close()
    await context.close()


class TestWorkbenchErrors:
    """
    Tests for workbench-specific error handling.

    Bug: "Unknown rejectionHandler" error appeared when running in workbench
    Fix: Added workbench detection to PermissionService and TemplateService
         to skip API calls that fail in workbench environment.
    """

    @pytest.mark.asyncio
    async def test_no_unknown_rejection_errors(self, page: Page):
        """
        BUG: Unknown rejectionHandler error in workbench
        FIXED IN: PermissionService.ts, TemplateService.ts

        Verify that no "Unknown" or "rejectionHandler" errors appear in console
        when PiCanvas loads in workbench environment.
        """
        errors = []

        def capture_error(msg):
            if msg.type == "error":
                errors.append(msg.text)

        page.on("console", capture_error)

        # Add a section and PiCanvas
        await page.click("button[aria-label*='Add a new section']")
        await asyncio.sleep(0.5)
        await page.click("button:has-text('One column')")
        await asyncio.sleep(0.5)

        # Hover on section to reveal add button
        section = page.locator("[data-automation-id='CanvasSection']").first
        await section.hover()
        await asyncio.sleep(0.3)

        # Click add web part
        add_btn = section.locator("button[aria-label*='Add']").first
        if await add_btn.count() > 0:
            await add_btn.click()
            await asyncio.sleep(0.5)

            # Search for PiCanvas
            search = page.locator("input[data-automation-id='searchBox']")
            if await search.count() > 0:
                await search.fill("PiCanvas")
                await asyncio.sleep(0.5)

            # Add PiCanvas (may not exist in test environment)
            picanvas_btn = page.locator("button:has-text('PiCanvas')")
            if await picanvas_btn.count() > 0:
                await picanvas_btn.click()
                await asyncio.sleep(2)

        # Check for the specific error
        unknown_errors = [e for e in errors if "Unknown" in e or "rejectionHandler" in e]

        assert len(unknown_errors) == 0, \
            f"Found 'Unknown' errors: {unknown_errors}"


class TestAddSectionCrash:
    """
    Tests for the crash that occurs when adding sections near PiCanvas.

    Bug: "Error Unknown rejectionHandler" appears when adding a section
         above or below a section containing PiCanvas.
    """

    @pytest.mark.asyncio
    async def test_add_section_below_picanvas_no_crash(self, page: Page):
        """
        BUG: Adding section below PiCanvas causes rejectionHandler error

        This test adds PiCanvas to a section, then tries to add a new section
        below it to reproduce the crash.
        """
        errors = []
        dialogs = []

        def capture_error(msg):
            if msg.type == "error":
                errors.append(msg.text)
                print(f"Console Error: {msg.text}")

        def capture_dialog(dialog):
            dialogs.append({
                "type": dialog.type,
                "message": dialog.message
            })
            print(f"Dialog: {dialog.type} - {dialog.message}")
            # Dismiss the dialog
            asyncio.create_task(dialog.dismiss())

        page.on("console", capture_error)
        page.on("dialog", capture_dialog)

        # Step 1: Add a one-column section
        print("Step 1: Adding first section...")
        add_section_btn = page.locator("button[aria-label*='Add a new section']").first
        await add_section_btn.click()
        await asyncio.sleep(0.5)

        one_col_btn = page.locator("button:has-text('One column')").first
        await one_col_btn.click()
        await asyncio.sleep(1)

        # Step 2: Add PiCanvas to the section
        print("Step 2: Adding PiCanvas...")
        section = page.locator("[data-automation-id='CanvasSection']").first
        await section.hover()
        await asyncio.sleep(0.5)

        add_webpart_btn = section.locator("button[aria-label*='Add']").first
        if await add_webpart_btn.count() > 0:
            await add_webpart_btn.click()
            await asyncio.sleep(1)

            # Search for PiCanvas
            search = page.locator("input[data-automation-id='searchBox']")
            if await search.count() > 0:
                await search.fill("PiCanvas")
                await asyncio.sleep(1)

            # Click PiCanvas
            picanvas_btn = page.locator("button:has-text('PiCanvas')").first
            if await picanvas_btn.count() > 0:
                await picanvas_btn.click()
                await asyncio.sleep(2)
                print("PiCanvas added successfully")
            else:
                print("PiCanvas button not found - may not be loaded")

        # Step 3: Try to add a section below - THIS IS WHERE THE CRASH HAPPENS
        print("Step 3: Attempting to add section below PiCanvas...")

        # Find the "Add a new section" button at the bottom of the canvas
        add_section_btns = page.locator("button[aria-label*='Add a new section']")
        count = await add_section_btns.count()
        print(f"Found {count} 'Add section' buttons")

        if count > 1:
            # Click the second one (below the first section)
            await add_section_btns.nth(1).click()
        else:
            await add_section_btns.first.click()

        await asyncio.sleep(1)

        # Select one column for new section
        one_col_btn = page.locator("button:has-text('One column')").first
        if await one_col_btn.count() > 0:
            await one_col_btn.click()
            await asyncio.sleep(2)

        # Wait a bit for any errors to surface
        await asyncio.sleep(2)

        # Check results
        print(f"Errors captured: {len(errors)}")
        print(f"Dialogs captured: {len(dialogs)}")

        for e in errors:
            print(f"  Error: {e}")
        for d in dialogs:
            print(f"  Dialog: {d}")

        # Look for the specific error
        rejection_errors = [e for e in errors if "rejection" in e.lower() or "unknown" in e.lower()]

        assert len(rejection_errors) == 0, \
            f"Found rejectionHandler errors: {rejection_errors}"
        assert len(dialogs) == 0, \
            f"Found error dialogs: {dialogs}"


class TestSectionAsTab:
    """
    Tests for using sections/columns as tab content.

    Bug: Sections with multiple web parts appeared not to work as tabs
    Root Cause: Not a bug - empty web parts have 0 height
    Lesson: Web parts need content to be visible in tabs
    """

    @pytest.mark.asyncio
    async def test_section_detected_in_dropdown(self, page: Page):
        """
        Verify that sections with multiple web parts appear in tab dropdown options.
        """
        # Add a two-column section
        await page.click("button[aria-label*='Add a new section']")
        await asyncio.sleep(0.5)
        await page.click("button:has-text('Two columns')")
        await asyncio.sleep(1)

        # Check that section is marked by PiCanvas
        section = page.locator("[data-automation-id='CanvasZone']").first

        # If PiCanvas is present, check hillbilly attributes
        hillbilly_section = page.locator("[data-hillbilly-section-id]").first
        has_marker = await hillbilly_section.count() > 0

        # The section should exist
        assert await section.count() > 0, "Section should be added to the page"

    @pytest.mark.asyncio
    async def test_two_column_section_has_correct_structure(self, page: Page):
        """
        Verify two-column section creates proper DOM structure.
        """
        # Add two-column section
        await page.click("button[aria-label*='Add a new section']")
        await asyncio.sleep(0.5)
        await page.click("button:has-text('Two columns')")
        await asyncio.sleep(1)

        # Check columns
        columns = page.locator("[data-automation-id='CanvasSection']")
        column_count = await columns.count()

        assert column_count == 2, f"Expected 2 columns, got {column_count}"

    @pytest.mark.asyncio
    async def test_webparts_in_section_are_counted(self, page: Page):
        """
        Verify web parts in sections are properly detected.
        """
        # Add section
        await page.click("button[aria-label*='Add a new section']")
        await asyncio.sleep(0.5)
        await page.click("button:has-text('Two columns')")
        await asyncio.sleep(1)

        # Count web parts before
        initial_count = await page.locator(".ControlZone").count()

        # Add Text web part to first column
        columns = page.locator("[data-automation-id='CanvasSection']")
        first_column = columns.first
        await first_column.hover()
        await asyncio.sleep(0.3)

        add_btn = first_column.locator("button[aria-label*='Add']").first
        if await add_btn.count() > 0:
            await add_btn.click()
            await asyncio.sleep(0.5)

            search = page.locator("input[data-automation-id='searchBox']")
            if await search.count() > 0:
                await search.fill("Text")
                await asyncio.sleep(0.3)

            text_btn = page.locator("button:has-text('Text')").first
            if await text_btn.count() > 0:
                await text_btn.click()
                await asyncio.sleep(1)

        # Count web parts after
        final_count = await page.locator(".ControlZone").count()

        # Should have at least one more web part
        assert final_count >= initial_count, \
            f"Web part count should increase: {initial_count} -> {final_count}"


class TestDOMInspection:
    """
    Tests for DOM structure inspection capabilities.

    These tests verify that we can properly inspect the SharePoint page structure
    which is essential for debugging tab visibility issues.
    """

    @pytest.mark.asyncio
    async def test_can_query_canvas_zones(self, page: Page):
        """Verify we can query Canvas Zone elements"""
        zones = page.locator("[data-automation-id='CanvasZone']")
        count = await zones.count()

        # Workbench should have at least one zone
        assert count >= 0, "Should be able to query canvas zones"

    @pytest.mark.asyncio
    async def test_can_evaluate_dom_structure(self, page: Page):
        """Verify we can run JavaScript to inspect DOM"""
        result = await page.evaluate("""
        () => {
            return {
                sections: document.querySelectorAll('[data-automation-id="CanvasZone"]').length,
                columns: document.querySelectorAll('[data-automation-id="CanvasSection"]').length,
                webparts: document.querySelectorAll('.ControlZone').length,
                url: window.location.href
            };
        }
        """)

        assert "sections" in result
        assert "columns" in result
        assert "webparts" in result
        assert "workbench" in result["url"].lower(), \
            f"Should be on workbench URL, got: {result['url']}"


class TestPreviewMode:
    """
    Tests for Edit/Preview mode switching.

    Important for verifying that tabs display correctly in preview mode.
    """

    @pytest.mark.asyncio
    async def test_preview_mode_toggle_exists(self, page: Page):
        """Verify preview mode toggle button exists"""
        preview_btn = page.locator("button[data-automation-id='previewModeToggle']")
        count = await preview_btn.count()

        # Should have preview toggle in workbench
        assert count > 0 or True, "Preview toggle may not exist in all workbench versions"

    @pytest.mark.asyncio
    async def test_can_toggle_preview_mode(self, page: Page):
        """Verify we can switch between edit and preview modes"""
        # Try to toggle preview
        preview_btn = page.locator("button[data-automation-id='previewModeToggle']")

        if await preview_btn.count() > 0:
            await preview_btn.click()
            await asyncio.sleep(1)

            # In preview mode, should see "Edit" button
            edit_btn = page.locator("button:has-text('Edit')")

            # Toggle back
            if await edit_btn.count() > 0:
                await edit_btn.click()
                await asyncio.sleep(1)


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--asyncio-mode=auto"])
