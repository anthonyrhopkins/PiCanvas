# PiCanvas Test Automation Suite

Comprehensive, resilient automation framework for testing the PiCanvas SharePoint web part in the SharePoint Workbench environment.

## Features

- **Rich CLI Interface** - Beautiful terminal output with progress bars, panels, tables, and color-coded status
- **Interactive Debugging** - Step-by-step REPL for manual testing and exploration
- **Automated Test Suite** - Pre-built test cases for common scenarios
- **Resilience** - Automatic retry logic, error recovery, and graceful failure handling
- **Visual Feedback** - Browser toast notifications and element highlighting during automation
- **Detailed Reporting** - JSON test reports with screenshots and console error capture

## Prerequisites

- Python 3.9 or later
- Node.js (for Playwright browsers)
- Access to SharePoint workbench URL

## Installation

```bash
# Navigate to tests directory
cd tests

# Run setup script (creates venv, installs dependencies)
./setup.sh

# Or manual setup:
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

## Quick Start

### 1. Interactive Debugging (Recommended for exploration)

```bash
source .venv/bin/activate
python interactive_debug.py
```

This opens a browser and presents an interactive menu:

```
╭────────────────────── Commands ──────────────────────╮
│ Key    │ Command              │ Description          │
├────────┼──────────────────────┼──────────────────────┤
│ 1      │ inspect              │ Inspect page structure│
│ 2      │ add_section          │ Add a new section    │
│ 3      │ add_webpart          │ Add a web part       │
│ 4      │ set_text             │ Set text in web part │
│ 5      │ toggle_preview       │ Toggle Edit/Preview  │
│ 6      │ screenshot           │ Take screenshot      │
│ 7      │ check_errors         │ Check console errors │
│ 8      │ get_options          │ Get PiCanvas options │
│ 9      │ run_test             │ Run section-as-tab   │
│ q      │ quit                 │ Exit                 │
╰────────┴──────────────────────┴──────────────────────╯
```

### 2. Automated Test Suite

```bash
# Run all tests with visible browser
python workbench_automation.py --headed

# Run headless (faster, no browser window)
python workbench_automation.py

# Custom workbench URL
python workbench_automation.py --url "https://yoursite.sharepoint.com/_layouts/15/workbench.aspx"
```

### 3. Pytest Regression Tests

```bash
# Run all tests
pytest test_picanvas_bugs.py -v

# Run specific test class
pytest test_picanvas_bugs.py::TestSectionAsTab -v

# Run with output
pytest test_picanvas_bugs.py -v -s
```

## Test Scenarios

### Automated Tests (`workbench_automation.py`)

| Test | Description | What it verifies |
|------|-------------|------------------|
| `test_workbench_loads` | Page load validation | No "Unknown" or rejection errors in console |
| `test_add_section` | Section creation | Sections with different layouts can be added |
| `test_section_as_tab` | Section as tab content | Multi-column section works as PiCanvas tab |
| `test_preview_mode` | Mode switching | Edit/Preview toggle works correctly |

### Regression Tests (`test_picanvas_bugs.py`)

| Test Class | Tests | Purpose |
|------------|-------|---------|
| `TestWorkbenchErrors` | 1 | Verify workbench-specific error handling |
| `TestSectionAsTab` | 3 | Verify section/column tab functionality |
| `TestDOMInspection` | 2 | Verify DOM query capabilities |
| `TestPreviewMode` | 2 | Verify Edit/Preview mode switching |

## Configuration

### Environment Variables

```bash
# Custom workbench URL
export WORKBENCH_URL="https://yoursite.sharepoint.com/_layouts/15/workbench.aspx"
```

### Debug Server

When using debug manifests, the tests will auto-start `npm run serve` if the
debug server is not already running. To disable this behavior:

```bash
export PICANVAS_AUTO_SERVE=0
```

To override the serve command (for example, `npm run serve:workbench`):

```bash
export PICANVAS_SERVE_COMMAND="npm run serve:workbench"
```

### Test Configuration (`TestConfig` class)

```python
@dataclass
class TestConfig:
    workbench_url: str = WORKBENCH_URL      # Target URL
    headed: bool = False                      # Show browser window
    slow_mo: int = 50                         # Delay between actions (ms)
    timeout: int = 30000                      # Default timeout (ms)
    screenshot_dir: Path = Path("screenshots") # Screenshot output
    retry_attempts: int = 3                   # Retry failed operations
    retry_delay: float = 1.0                  # Delay between retries (s)
    highlight_elements: bool = True           # Visual element highlighting
```

## Output Files

After running tests, you'll find:

```
tests/
├── screenshots/                    # Auto-captured screenshots
│   ├── workbench_loads_20241217_181500.png
│   ├── add_section_20241217_181530.png
│   └── section_as_tab_error_20241217_181600.png
├── test_report_20241217_181700.json   # Detailed JSON report
└── workbench_test_20241217_181700.log # Execution log
```

### JSON Report Structure

```json
{
  "timestamp": "2024-12-17T18:17:00",
  "url": "https://pispace.sharepoint.com/_layouts/15/workbench.aspx",
  "summary": {
    "total": 4,
    "passed": 3,
    "failed": 1,
    "duration_ms": 45000
  },
  "tests": [
    {
      "name": "workbench_loads",
      "passed": true,
      "duration_ms": 5000,
      "screenshot": "screenshots/workbench_loads_20241217_181500.png",
      "details": { "inspection": {...}, "unknown_errors": 0 }
    }
  ],
  "console_errors": []
}
```

## Troubleshooting

### Browser doesn't launch

```bash
# Reinstall Playwright browsers
playwright install chromium
```

### Authentication issues

The workbench requires SharePoint authentication. If running in headed mode, you may need to:
1. Sign in manually when the browser opens
2. Wait for the page to fully load
3. The automation will detect when the canvas is ready

### Timeout errors

Increase timeout in the command:
```bash
python workbench_automation.py --headed  # Headed mode has more time for auth
```

Or modify `TestConfig`:
```python
config = TestConfig(timeout=60000)  # 60 second timeout
```

### "Unknown" console errors

These indicate API calls failing in workbench. The PiCanvas code has been updated to detect workbench environment and skip problematic API calls. If you still see these:

1. Check `PermissionService.ts` has workbench detection
2. Check `TemplateService.ts` has workbench detection
3. Both should skip API calls when `window.location.href` contains "workbench"

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Test Automation Suite                     │
├─────────────────────────────────────────────────────────────┤
│  interactive_debug.py     │  workbench_automation.py        │
│  ├── RichDebugSession     │  ├── SharePointWorkbenchAuto    │
│  ├── Interactive REPL     │  ├── Test Runner                │
│  └── Manual Commands      │  └── Report Generator           │
├─────────────────────────────────────────────────────────────┤
│                    Common Components                         │
│  ├── Rich CLI (panels, tables, progress)                    │
│  ├── Playwright Browser Automation                          │
│  ├── Retry Logic (@retry_async decorator)                   │
│  ├── Console Error Capture                                  │
│  └── Screenshot Management                                  │
├─────────────────────────────────────────────────────────────┤
│  test_picanvas_bugs.py                                      │
│  ├── Pytest-based regression tests                          │
│  └── CI/CD compatible                                       │
└─────────────────────────────────────────────────────────────┘
```

## Contributing

### Adding New Tests

1. Add test method to `SharePointWorkbenchAutomation` class:

```python
async def test_my_new_feature(self) -> TestResult:
    """Test: Description of what this tests"""
    test_name = "my_new_feature"
    start_time = datetime.now()

    console.print(Panel(
        "[bold]Test: My New Feature[/bold]\n\n"
        "Description of what this test verifies.",
        title=f"[cyan]🧪 {test_name}[/cyan]",
        border_style="cyan"
    ))

    try:
        # Test steps here
        await self.add_section("two_column")
        # ... more steps

        screenshot = await self.take_screenshot(test_name)
        passed = True  # Your pass/fail logic

        return TestResult(
            name=test_name,
            passed=passed,
            duration_ms=(datetime.now() - start_time).total_seconds() * 1000,
            screenshot=screenshot,
            details={"key": "value"}
        )

    except Exception as e:
        return TestResult(
            name=test_name,
            passed=False,
            duration_ms=(datetime.now() - start_time).total_seconds() * 1000,
            error=str(e)
        )
```

2. Register in `run_all_tests()`:

```python
async def run_all_tests(self):
    tests = [
        self.test_workbench_loads,
        self.test_add_section,
        self.test_my_new_feature,  # Add here
    ]
```

### Adding Interactive Commands

Add to `RichDebugSession` class in `interactive_debug.py`:

```python
async def my_new_command(self) -> Any:
    """Description of command"""
    console.print("[cyan]Running my new command...[/cyan]")
    # Implementation
    return result
```

Then add to menu and command handler in `interactive_mode()`.

## License

Part of PiCanvas project. See main project for license details.
