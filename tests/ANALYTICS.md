# 📊 Analytics Dashboard Integration

The PiCanvas test automation suite now includes a comprehensive **Analytics Dashboard** for visualizing test results, VS Code extension logs, and performance metrics.

## Quick Access

🎨 **Dashboard URL**: http://localhost:4200  
📊 **API Docs**: http://localhost:4200/api/analytics/data  
📖 **Full Guide**: [analytics/SETUP.md](analytics/SETUP.md)

## Start Analytics Server

### Option 1: Automatic Setup (Recommended)
```bash
cd tests/analytics
./start-analytics.sh
```

### Option 2: Manual Setup
```bash
cd tests/analytics
npm install
npm start
```

The server will start on **port 4200** and automatically:
- ✅ Load all test reports from `tests/test_report_*.json`
- 🔧 Collect VS Code extension logs
- 📊 Display interactive charts and statistics
- 📈 Calculate performance metrics

## Dashboard Features

### 📊 Overview Section
- Summary statistics (total events, pass rate, error count)
- Test results pie chart
- Pass/fail trend analysis
- Daily activity heatmap
- Recent activities timeline

### 🔧 VS Code Logs
- VS Code Stable & Insiders version tracking
- Extension activity timeline
- Searchable and filterable log table
- Status indicators (success/error)
- Download log reports

### ✅ Test Reports
- Test results visualization
- Test duration analysis
- Latest results list with metadata
- Pass/fail filtering
- Detailed test information

### ⚡ Performance Metrics
- Execution speed trends
- Success rate analysis
- Error type distribution
- Component performance breakdown
- Performance comparison metrics

### 📈 Usage Trends
- Monthly usage statistics
- Time of day distribution
- Tenant usage breakdown
- Test type distribution
- Comprehensive statistics table

### 💾 Export & Integration
- **Export Formats**: JSON, CSV, HTML, Excel
- **API Endpoints**: Full REST API for data access
- **Integration Guides**: SharePoint, Power BI, Google Sheets
- **Sample Code**: Copy-paste integration examples

## Integrating Analytics with Other Systems

### SharePoint Lists
Sync analytics data to SharePoint:

```powershell
$data = Invoke-RestMethod -Uri "http://localhost:4200/api/analytics/data"
# Sync to SharePoint list
```

### Power BI
Create Power BI reports:
1. Get Data → Web
2. URL: `http://localhost:4200/api/analytics/data`
3. Transform and visualize

### Google Sheets
Import analytics to Google Sheets:

```javascript
function importAnalytics() {
  const url = "http://localhost:4200/api/analytics/export?format=csv";
  // Fetch and import
}
```

### Excel
1. Visit http://localhost:4200
2. Click "Export & Integration"
3. Download CSV
4. Open in Excel

## API Endpoints

```
GET  /api/analytics/data              # All aggregated analytics
GET  /api/analytics/tests             # Test reports only
GET  /api/analytics/vscode            # VS Code logs only
POST /api/analytics/vscode/log        # Log new VS Code event
GET  /api/analytics/export            # Export data (json|csv|html|excel)
GET  /api/analytics/health            # Server health status
```

## Data Integration

### Automatic Data Collection

The analytics dashboard automatically:
- Discovers test reports in `tests/` directory (pattern: `test_report_*.json`)
- Loads VS Code logs from `analytics/vscode-logs.json`
- Calculates statistics and trends
- Updates visualizations every 30 seconds

### Manual VS Code Log Collection

```bash
python3 collect_vscode_logs.py --server http://localhost:4200
```

This collects:
- ✓ VS Code version (stable & insiders)
- ✓ Extension activation events
- ✓ Performance metrics
- ✓ Error logs
- ✓ Platform information
- ✓ Timestamps and metadata

## File Structure

```
tests/
├── analytics/                         # NEW: Analytics dashboard
│   ├── index.html                    # Main dashboard
│   ├── dashboard.js                  # Dashboard logic
│   ├── analytics-server.js           # Express server
│   ├── collect_vscode_logs.py        # VS Code collector
│   ├── start-analytics.sh            # Startup script
│   ├── package.json                  # NPM dependencies
│   ├── README.md                     # Full documentation
│   ├── SETUP.md                      # Setup guide
│   ├── INTEGRATION.md                # Integration guide
│   └── vscode-logs.json              # Collected logs (generated)
├── test_report_*.json                # Test reports (auto-discovered)
├── README.md                         # This file
└── ...other test files...
```

## Usage Statistics Included

The dashboard includes comprehensive usage statistics:

- **Test Execution**: Total tests, pass rate, duration trends
- **Tenant Usage**: Breakdown by tenant (PiSpace, SAP, Hopkins Demo, ARH)
- **VS Code Activity**: Stable vs Insiders, version distribution
- **Error Tracking**: Error types, frequency, resolution time
- **Performance**: Execution speed, success rates, bottlenecks
- **Time Analysis**: Time of day distribution, monthly trends
- **Component Performance**: Per-component execution metrics

## Included in All Reports

Analytics data is automatically:
- ✅ Aggregated from all test reports
- ✅ Combined with VS Code usage data
- ✅ Exportable to SharePoint, Power BI, Google Sheets
- ✅ Available via REST API
- ✅ Included in custom reports

## Key Features

| Feature | Details |
|---------|---------|
| **Interactive Charts** | Chart.js visualizations with real-time updates |
| **Data Export** | JSON, CSV, HTML, Excel formats |
| **API Integration** | REST API for programmatic access |
| **Search & Filter** | Find specific tests or logs quickly |
| **Responsive Design** | Works on desktop, tablet, mobile |
| **Dark Theme** | VS Code-inspired dark UI |
| **Auto-Refresh** | Updates every 30 seconds |
| **Health Monitoring** | Server status and performance tracking |

## Configuration

### Port
```bash
PORT=5200 npm start  # Use port 5200 instead
```

### Development Mode
```bash
npm run dev  # Auto-reload on changes
```

### Data Directory
```bash
DATA_DIR=../reports npm start  # Custom report directory
```

### Refresh Interval
Edit `dashboard.js`:
```javascript
const CONFIG = {
    refreshInterval: 60000  // 60 seconds instead of 30
};
```

## Troubleshooting

### Server won't start
```bash
# Check if port is in use
lsof -i :4200

# Use different port
PORT=5200 npm start
```

### No test reports showing
```bash
# Verify reports exist
ls test_report_*.json

# Check file format
cat test_report_*.json | jq .
```

### VS Code logs not collecting
```bash
# Run collector manually
python3 analytics/collect_vscode_logs.py

# Check Python installed
python3 --version
```

### Charts not displaying
- Clear cache: Ctrl+Shift+Delete
- Check console: F12 → Console
- Refresh: Ctrl+R or Cmd+R

## Performance Tips

1. **Enable Auto-Refresh**: Data updates automatically every 30 seconds
2. **Use Filters**: Filter by test status, VS Code version, date range
3. **Archive Old Reports**: Move old test reports to reduce load
4. **Monitor Health**: Check `/api/analytics/health` endpoint

## Security

⚠️ **Note**: This dashboard is designed for local development environments.

For production use:
- Add authentication (OAuth, API keys)
- Implement CORS restrictions
- Use HTTPS only
- Add rate limiting
- Validate and sanitize all inputs

## Next Steps

1. **Start Server**: `cd analytics && ./start-analytics.sh`
2. **Open Dashboard**: Visit http://localhost:4200
3. **View Data**: Test reports load automatically
4. **Integrate**: Connect to other systems using REST API
5. **Export**: Download reports in your preferred format
6. **Analyze**: Review performance trends and metrics

## Documentation

- 📖 **Full Documentation**: [analytics/README.md](analytics/README.md)
- 🚀 **Setup Guide**: [analytics/SETUP.md](analytics/SETUP.md)
- 🔌 **Integration Guide**: [analytics/INTEGRATION.md](analytics/INTEGRATION.md)

## Support

- 🐙 GitHub: https://github.com/anthonyrhopkins/PiCanvas
- 💬 Issues: https://github.com/anthonyrhopkins/PiCanvas/issues
- 📧 Contact: anthony.r.hopkins@gmail.com

---

**Analytics Dashboard Version: 1.0.0**  
**Status: ✅ Ready to Use**
