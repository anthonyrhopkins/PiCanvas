# 📊 PiCanvas Analytics Setup & Integration Guide

## Quick Setup (5 minutes)

### Step 1: Navigate to Analytics Directory
```bash
cd tests/analytics
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Start the Analytics Server
```bash
# Option A: Using the startup script (recommended)
chmod +x start-analytics.sh
./start-analytics.sh

# Option B: Direct npm command
npm start
```

### Step 4: Open Dashboard
Visit: **http://localhost:4200**

You should see an interactive dashboard with:
- 📊 Overview tab with summary statistics
- 🔧 VS Code Logs showing extension usage
- ✅ Test Reports with all test results
- ⚡ Performance metrics
- 📈 Usage trends

## Features

### 1. 📊 Overview Dashboard
The main overview tab displays:
- **Total Events**: Combined test runs and VS Code logs
- **Pass Rate**: Percentage of successful tests
- **VS Code Sessions**: Number of unique VS Code days
- **Errors**: Total error count

Interactive visualizations:
- Test results pie chart (Passed vs Failed)
- Pass/fail trend line chart
- Daily activity heatmap
- Recent activities timeline

### 2. 🔧 VS Code Integration
Shows VS Code and VS Code Insiders extension usage:
- Version distribution chart
- Extension activity timeline
- Complete log table with:
  - Timestamp
  - Version (stable/insiders)
  - Event Type
  - Details
  - Status badge

**Features:**
- 🔍 Search logs by any field
- 🔽 Filter by VS Code version
- 📥 Download log reports
- Real-time updates

### 3. ✅ Test Reports
Displays all test reports from your test automation:
- Test results over time
- Test duration distribution
- Latest test results list
- 🔍 Search and filter by status

**Metrics:**
- Total tests run
- Passed/Failed count
- Average test duration
- Failure rates

### 4. ⚡ Performance Analysis
Detailed performance metrics:
- Execution speed trends
- Success rate over time
- Error type distribution
- Component performance breakdown

### 5. 📈 Usage Trends
Comprehensive usage analytics:
- Monthly usage statistics
- Time of day distribution
- Tenant usage breakdown
- Test type distribution

### 6. 💾 Export & Integration
Export your analytics data:
- **JSON**: For APIs and programmatic access
- **CSV**: For Excel and spreadsheets
- **HTML**: For email reports
- **Excel**: Excel workbook format

**Integration APIs:**
- SharePoint REST API
- Power BI connector
- Google Sheets integration
- Custom webhook support

## Data Integration with Other Reports

### With SharePoint

Add analytics data to SharePoint lists:

```powershell
# PowerShell script to sync analytics to SharePoint
$analyticsUrl = "http://localhost:4200/api/analytics/data"
$sharePointUrl = "https://pispace.sharepoint.com"

# Connect to SharePoint
Connect-PnPOnline -Url $sharePointUrl -Interactive

# Get analytics data
$analytics = Invoke-RestMethod -Uri $analyticsUrl

# Sync to SharePoint list
$analytics.reports | ForEach-Object {
    Add-PnPListItem -List "Analytics" -Values @{
        Title = $_.name
        TestDate = $_.timestamp
        TestStatus = if($_.passed) { "Passed" } else { "Failed" }
        Duration = $_.duration_ms
        URL = $_.url
    }
}
```

### With Power BI

Create Power BI reports from analytics data:

1. **Open Power BI Desktop**
2. **Home** → **Get Data** → **Web**
3. **Enter URL**: `http://localhost:4200/api/analytics/data`
4. **Load** the JSON data
5. **Transform** in Power Query
6. **Create visualizations**

### With Google Sheets

Automatically import analytics to Google Sheets:

```javascript
function importAnalytics() {
  const url = "http://localhost:4200/api/analytics/export?format=csv";
  const response = UrlFetchApp.fetch(url);
  const csv = response.getContentText();
  
  // Parse CSV
  const lines = csv.split("\n");
  const data = lines.map(line => line.split(","));
  
  // Insert into sheet
  const sheet = SpreadsheetApp.getActiveSheet();
  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
}

// Run automatically every hour
function setupTrigger() {
  ScriptApp.newTrigger('importAnalytics')
    .timeBased()
    .everyHours(1)
    .create();
}
```

### With Excel/CSV Import

Export analytics to your existing reports:

1. Visit `http://localhost:4200`
2. Click **Export & Integration** tab
3. Click **Download CSV**
4. Open in Excel
5. Create pivot tables and charts
6. Use for reports

## VS Code Extension Log Collection

### Automatic Collection

The dashboard automatically collects VS Code extension logs when the server starts.

### Manual Collection

```bash
# Collect VS Code logs for stable version
python3 collect_vscode_logs.py

# Send to specific server
python3 collect_vscode_logs.py --server http://localhost:4200

# Specify data directory
python3 collect_vscode_logs.py --data-dir ../
```

### What Gets Collected

- ✓ VS Code version (stable and insiders)
- ✓ Extension activation events
- ✓ User actions in VS Code
- ✓ Error messages
- ✓ Performance metrics
- ✓ Platform information (macOS/Windows/Linux)
- ✓ Timestamps
- ✓ Event details and metadata

### Privacy & Security

- Data is stored locally in `vscode-logs.json`
- No data is sent to external servers without explicit configuration
- You control all data collection and export
- Can be disabled in configuration

## API Reference

All endpoints return JSON responses.

### GET /api/analytics/data
Complete analytics dataset

### GET /api/analytics/tests
All test reports

### GET /api/analytics/vscode
All VS Code logs

### POST /api/analytics/vscode/log
Log a new VS Code event

**Body:**
```json
{
  "version": "1.95.0",
  "type": "stable",
  "eventType": "Extension Activation",
  "details": "PiCanvas extension loaded",
  "status": "success"
}
```

### GET /api/analytics/export
Export data in different formats

**Parameters:**
- `format=json` - JSON format
- `format=csv` - CSV format  
- `format=excel` - Excel workbook
- `format=html` - HTML report

### GET /api/analytics/health
Server health check

## Troubleshooting

### Server Won't Start

```bash
# Check if port is already in use
lsof -i :4200

# Use a different port
PORT=5200 npm start

# Kill the process
kill -9 <PID>
```

### Test Reports Not Loading

```bash
# Verify reports exist
ls tests/test_report_*.json

# Check report format
cat tests/test_report_*.json | jq .

# Validate JSON
npm install -g jsonlint
jsonlint tests/test_report_*.json
```

### VS Code Logs Not Collecting

```bash
# Check VS Code paths
python3 collect_vscode_logs.py

# Verify VS Code is installed
code --version

# Check for Python dependencies
pip install requests
```

### Charts Not Displaying

- Clear browser cache: Ctrl+Shift+Delete
- Check browser console: F12 → Console
- Verify Chart.js loaded: Check network tab
- Refresh page: Ctrl+R or Cmd+R

## Advanced Configuration

### Custom Port
```bash
PORT=5200 npm start
```

### Development Mode with Auto-reload
```bash
npm run dev
```

### Data Directory
Specify where test reports are stored:

Edit `analytics-server.js`:
```javascript
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..');
```

### Auto-refresh Interval
Change refresh frequency in `dashboard.js`:

```javascript
const CONFIG = {
    refreshInterval: 60000  // 60 seconds instead of 30
};
```

## Integration Examples

### Send Webhook to Teams/Slack

```bash
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "📊 Analytics Update",
    "attachments": [
      {
        "color": "good",
        "fields": [
          {"title": "Pass Rate", "value": "96.5%"},
          {"title": "Tests Run", "value": "125"}
        ]
      }
    ]
  }'
```

### CI/CD Pipeline Integration

In your GitHub Actions workflow:

```yaml
- name: Upload Analytics
  run: |
    curl -X POST http://localhost:4200/api/analytics/vscode/log \
      -H "Content-Type: application/json" \
      -d '{
        "version": "1.95.0",
        "type": "stable",
        "eventType": "CI Build Complete",
        "details": "Build ${{ github.run_number }} completed",
        "status": "success"
      }'
```

## Performance Tips

1. **Enable Auto-refresh**: Let the server periodically reload data
2. **Use Filters**: Filter data to show only relevant results
3. **Archive Old Reports**: Move old test reports to archive folder
4. **Clear Browser Cache**: F12 → Network → Disable Cache + Hard Refresh
5. **Monitor Server**: Check `GET /api/analytics/health`

## Next Steps

1. ✅ Analytics server is running
2. ✅ Dashboard is accessible at http://localhost:4200
3. 🔄 Test reports are automatically loaded
4. 🔧 VS Code logs are collected
5. 📊 Create your own custom visualizations
6. 🔌 Integrate with other systems

## Getting Help

- 📖 Full documentation: [analytics/README.md](./README.md)
- 🐙 GitHub Issues: https://github.com/anthonyrhopkins/PiCanvas/issues
- 💬 Discussions: https://github.com/anthonyrhopkins/PiCanvas/discussions

---

**Happy analyzing! 📊**
