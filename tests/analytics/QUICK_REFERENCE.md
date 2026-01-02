# 🎯 Analytics Dashboard - Quick Reference Card

## ⚡ Start in 30 Seconds

```bash
cd tests/analytics
./start-analytics.sh
```

Then visit: **http://localhost:4200**

---

## 📊 Dashboard URL

| Resource | URL |
|----------|-----|
| **Dashboard** | http://localhost:4200 |
| **API Data** | http://localhost:4200/api/analytics/data |
| **API Tests** | http://localhost:4200/api/analytics/tests |
| **API Logs** | http://localhost:4200/api/analytics/vscode |
| **Health Check** | http://localhost:4200/api/analytics/health |

---

## 🎨 Dashboard Sections

| Section | What It Shows |
|---------|---|
| 📊 **Overview** | Summary stats, test pie chart, trend line, heatmap, timeline |
| 🔧 **VS Code** | Version dist, activity timeline, searchable log table |
| ✅ **Tests** | Results over time, duration dist, latest results list |
| ⚡ **Performance** | Speed trends, success rate, error dist, component perf |
| 📈 **Usage** | Monthly stats, time dist, tenant breakdown, test types |
| 💾 **Export** | JSON/CSV/HTML export, API docs, integration examples |

---

## 📦 Files Created

```
tests/analytics/
├── index.html                 # Dashboard (31KB)
├── dashboard.js              # Logic (34KB)
├── analytics-server.js       # Server (13KB)
├── collect_vscode_logs.py    # Collector (9KB)
├── start-analytics.sh        # Startup (2KB)
├── package.json              # Config
├── README.md                 # Full docs
├── SETUP.md                  # Setup guide
└── INTEGRATION.md            # Integration guide
```

---

## 🔗 API Endpoints

```
GET  /api/analytics/data              All data
GET  /api/analytics/tests             Tests only
GET  /api/analytics/vscode            VS Code logs
POST /api/analytics/vscode/log        Log event
GET  /api/analytics/export            Export data
GET  /api/analytics/health            Health check
```

---

## 💾 Export Formats

Click "Export & Integration" tab then:

| Format | Command | Use Case |
|--------|---------|----------|
| **JSON** | `curl .../export?format=json` | APIs, automation |
| **CSV** | `curl .../export?format=csv` | Excel, Sheets |
| **HTML** | `curl .../export?format=html` | Email, reports |
| **Excel** | Download via UI | Business reports |

---

## 🔧 Collect VS Code Logs

```bash
python3 collect_vscode_logs.py
```

Collects:
- VS Code version (stable & insiders)
- Extension activation events
- User actions
- Errors & performance data
- Platform information
- Timestamps

---

## 📱 Integration Examples

### SharePoint
```powershell
$data = Invoke-RestMethod -Uri "http://localhost:4200/api/analytics/data"
```

### Power BI
Get Data → Web → `http://localhost:4200/api/analytics/data`

### Google Sheets
```javascript
UrlFetchApp.fetch("http://localhost:4200/api/analytics/export?format=csv")
```

### Excel
1. Visit http://localhost:4200
2. Click "Export & Integration"
3. Download CSV

---

## ⚙️ Configuration

```bash
# Custom port
PORT=5200 npm start

# Dev mode (auto-reload)
npm run dev

# Custom data directory
DATA_DIR=../reports npm start
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Port in use | `PORT=5200 npm start` |
| No reports | `ls test_report_*.json` |
| Charts blank | Clear cache: Ctrl+Shift+Del |
| Server error | Check logs: `npm start` |

---

## 📊 What's Tracked

✅ Test execution times  
✅ Pass/fail rates  
✅ Error types  
✅ VS Code versions  
✅ Tenant usage  
✅ Daily activity  
✅ Performance metrics  
✅ Component performance  

---

## 📖 Documentation

| Doc | Purpose |
|-----|---------|
| [README.md](./analytics/README.md) | Complete features & API |
| [SETUP.md](./analytics/SETUP.md) | Setup & integration steps |
| [INTEGRATION.md](./analytics/INTEGRATION.md) | Integration examples |
| [ANALYTICS.md](../tests/ANALYTICS.md) | Quick reference |

---

## 🚀 Common Commands

```bash
# Start server
npm start

# Dev mode
npm run dev

# Collect VS Code logs
python3 collect_vscode_logs.py

# Export data
curl http://localhost:4200/api/analytics/export?format=csv > data.csv

# Check health
curl http://localhost:4200/api/analytics/health

# Log VS Code event
curl -X POST http://localhost:4200/api/analytics/vscode/log \
  -H "Content-Type: application/json" \
  -d '{"version":"1.95.0","type":"stable","eventType":"Test","status":"success"}'
```

---

## 🎯 Features at a Glance

| Feature | Details |
|---------|---------|
| 📊 **Charts** | 10+ interactive visualizations |
| 📈 **Analytics** | Automatic data aggregation |
| 🔍 **Search** | Full-text search on logs |
| 📥 **Export** | JSON, CSV, HTML, Excel |
| 🔌 **API** | 6 REST endpoints |
| 🔧 **VS Code** | Stable & Insiders tracking |
| 📱 **Responsive** | Mobile, tablet, desktop |
| 🌙 **Dark Theme** | VS Code-inspired UI |
| ♻️ **Auto-Refresh** | Updates every 30 seconds |
| 🎨 **Customizable** | Configurable refresh rates |

---

## ✅ Status

- ✅ Dashboard: **Complete**
- ✅ Server: **Complete**
- ✅ VS Code Logs: **Complete**
- ✅ Export: **Complete**
- ✅ API: **Complete**
- ✅ Docs: **Complete**

---

## 🎉 You're All Set!

Start the server and visit http://localhost:4200 to see your analytics dashboard in action!

---

**Questions?** See [ANALYTICS.md](../tests/ANALYTICS.md) or [INTEGRATION.md](./analytics/INTEGRATION.md)

**Last Updated:** December 21, 2025  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
