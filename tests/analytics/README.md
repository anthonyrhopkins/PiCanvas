# 📊 PiCanvas Analytics Dashboard

A comprehensive analytics and monitoring dashboard for PiCanvas test reports, VS Code extension usage, and performance metrics.

## Features

✨ **Interactive Visualizations**
- Real-time charts and graphs (Chart.js)
- Test results summary and trends
- VS Code version distribution
- Performance metrics and bottleneck analysis
- Daily activity heatmaps

📈 **Data Integration**
- Automatic aggregation of test reports
- VS Code extension log collection (stable & insiders)
- Performance metrics calculation
- Usage statistics and trends
- Error tracking and analysis

🔌 **Data Export & Integration**
- Export in JSON, CSV, and HTML formats
- RESTful API endpoints for data access
- Integration guides for SharePoint, Power BI, Google Sheets
- Real-time webhooks support

🎨 **Professional UI**
- VS Code dark theme styling
- Fully responsive design
- Interactive data tables and timelines
- Filter and search capabilities

## Quick Start

### 1. Install Dependencies

```bash
cd tests/analytics
npm install
```

### 2. Start the Server

```bash
# Using the startup script (recommended)
chmod +x start-analytics.sh
./start-analytics.sh

# Or manually
npm start

# Or with auto-reload (development)
npm run dev
```

The dashboard will be available at: **http://localhost:4200**

### 3. Collect VS Code Logs (Optional)

```bash
python3 collect_vscode_logs.py --server http://localhost:4200
```

## API Endpoints

### Get Analytics Data
```bash
GET /api/analytics/data
```
Returns aggregated analytics including tests, VS Code logs, and statistics.

**Response:**
```json
{
  "timestamp": "2025-12-21T00:00:00Z",
  "analytics": {
    "totalTests": 125,
    "passedTests": 120,
    "failedTests": 5,
    "passRate": "96.00",
    "avgDuration": 1245,
    "console_errors": [...],
    "tenants": {...}
  },
  "reports": [...],
  "vscodeLogsAll": [...]
}
```

### Get Test Reports
```bash
GET /api/analytics/tests
```
Returns all test reports found in the data directory.

### Get VS Code Logs
```bash
GET /api/analytics/vscode
```
Returns all VS Code extension logs.

### Log VS Code Event
```bash
POST /api/analytics/vscode/log
Content-Type: application/json

{
  "version": "1.95.0",
  "type": "stable|insiders",
  "eventType": "Extension Activation",
  "details": "Description of the event",
  "status": "success|error",
  "metadata": {}
}
```

### Export Data
```bash
GET /api/analytics/export?format=json|csv|excel|html
```

### Health Check
```bash
GET /api/analytics/health
```

## Dashboard Sections

### 📊 Overview
- Summary statistics (total events, pass rate, VS Code sessions, errors)
- Test results pie chart
- Pass/fail trend line chart
- Daily activity heatmap
- Recent activities timeline

### 🔧 VS Code Logs
- Version distribution chart
- Extension activity timeline
- Searchable and filterable log table
- Status indicators (success/error)
- Download capabilities

### ✅ Test Reports
- Test results over time
- Test duration distribution
- Latest test results list
- Pass/fail filtering
- Test metadata and details

### ⚡ Performance
- Execution speed trends
- Success rate over time
- Error type distribution
- Component performance metrics
- Performance comparison table

### 📈 Usage Trends
- Monthly usage statistics
- Time of day distribution
- Tenant distribution
- Test type distribution
- Comprehensive usage table

### 💾 Export & Integration
- Multiple export formats (JSON, CSV, Excel, PDF)
- API endpoint documentation
- Integration guides
- Sample integration code

## Configuration

### Environment Variables
```bash
# Server configuration
PORT=4200                           # Server port
NODE_ENV=production                 # or development

# Data collection
VSCODE_LOG_ENABLED=true             # Enable VS Code log collection
VSCODE_LOG_INTERVAL=3600000         # Collection interval in ms
```

### Server Configuration
Edit `analytics-server.js`:
```javascript
const PORT = process.env.PORT || 4200;
const DATA_DIR = path.join(__dirname, '..');  // Test reports directory
```

## Integration Guides

### SharePoint
```powershell
# Using PnP PowerShell to sync analytics to SharePoint
Connect-PnPOnline -Url "https://pispace.sharepoint.com"

# Get analytics data via REST API
$data = Invoke-RestMethod -Uri "http://localhost:4200/api/analytics/data"

# Create list items
$data.reports | ForEach-Object {
    Add-PnPListItem -List "Analytics" -Values @{
        "Title" = $_.name
        "TestPassed" = $_.passed
        "Duration" = $_.duration_ms
    }
}
```

### Power BI
1. Open Power BI Desktop
2. Get Data → Web
3. Enter URL: `http://localhost:4200/api/analytics/data`
4. Select JSON response
5. Load and transform data
6. Create visualizations

### Google Sheets
```javascript
function getAnalyticsData() {
  const url = "http://localhost:4200/api/analytics/export?format=csv";
  const response = UrlFetchApp.fetch(url);
  const csv = response.getContentText();
  
  const sheet = SpreadsheetApp.getActiveSheet();
  const data = Utilities.parseCsv(csv);
  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
}
```

## Data Collection

### Test Reports
Automatically discovered from `tests/` directory with pattern: `test_report_YYYYMMDD_HHMMSS.json`

**Expected Format:**
```json
{
  "timestamp": "2025-12-21T00:00:00Z",
  "url": "https://tenant.sharepoint.com/_layouts/15/workbench.aspx",
  "summary": {
    "total": 10,
    "passed": 8,
    "failed": 2,
    "duration_ms": 12450
  },
  "tests": [...],
  "console_errors": [...]
}
```

### VS Code Logs
Stored in `vscode-logs.json` in the analytics directory.

**Format:**
```json
{
  "timestamp": "2025-12-21T00:00:00Z",
  "version": "1.95.0|1.96.0-insiders",
  "type": "stable|insiders",
  "eventType": "Extension Activation|Error|User Action|etc",
  "details": "Event description",
  "status": "success|error",
  "metadata": {...}
}
```

## Troubleshooting

### Server won't start
```bash
# Check if port 4200 is in use
lsof -i :4200

# Use a different port
PORT=5200 npm start
```

### No test reports loading
```bash
# Check test report directory
ls -la tests/test_report_*.json

# Ensure correct JSON format
npm install -g jsonlint
jsonlint tests/test_report_*.json
```

### VS Code logs not collecting
```bash
# Check VS Code paths
python3 collect_vscode_logs.py --server http://localhost:4200

# Verify VS Code is installed
code --version

# Check permissions
ls -la ~/Library/Application\ Support/Code/Logs/  # macOS
```

### Charts not rendering
- Check browser console for errors: F12 → Console
- Ensure Chart.js is loaded: `http://localhost:4200` → open dev tools
- Try clearing browser cache: Ctrl+Shift+Delete

## Development

### Project Structure
```
analytics/
├── index.html                 # Main dashboard HTML
├── dashboard.js              # Dashboard JavaScript
├── analytics-server.js       # Express server
├── collect_vscode_logs.py    # VS Code log collector
├── start-analytics.sh        # Startup script
├── package.json              # npm dependencies
└── README.md                 # This file
```

### Adding a New Chart
1. Add canvas element in `index.html`
2. Create update function in `dashboard.js`:
```javascript
function updateMyChart() {
    updateChart('myChartId', {
        type: 'bar',
        data: { ... },
        options: { ... }
    });
}
```
3. Call from `updateAllVisualizations()` or section-specific function

### Adding a New API Endpoint
1. Add route in `analytics-server.js`:
```javascript
app.get('/api/analytics/custom', (req, res) => {
    // Implementation
    res.json({ /* data */ });
});
```
2. Document in API Endpoints section

## Performance Optimization

- Test reports are loaded once on startup and cached
- Auto-refresh interval: 30 seconds (configurable)
- Charts use Canvas rendering for better performance
- Data pagination for large datasets
- Lazy loading of images and assets

## Security Considerations

⚠️ **Note:** This dashboard should only be used in internal development environments.

For production use:
- Add authentication (OAuth, API keys)
- Implement rate limiting
- Use HTTPS
- Validate all inputs
- Sanitize data before display
- Implement CORS properly

## Contributing

To contribute improvements:
1. Create a feature branch
2. Make changes to appropriate files
3. Test locally: `npm start`
4. Submit pull request with description

## License

MIT License - See LICENSE file for details

## Support

For issues or questions:
- 📧 Email: anthony.r.hopkins@gmail.com
- 🐙 GitHub: https://github.com/anthonyrhopkins/PiCanvas
- 💬 Discussions: GitHub Issues

---

**Last Updated:** December 21, 2025  
**Analytics Server Version:** 1.0.0
