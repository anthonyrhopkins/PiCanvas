#!/usr/bin/env node

/**
 * PiCanvas Analytics Server
 * 
 * Aggregates test reports, VS Code logs, and usage statistics
 * Provides REST API endpoints for analytics dashboard
 * Supports data export in multiple formats
 * 
 * Usage:
 *   node analytics-server.js
 *   
 * Port: 4200
 * Endpoints:
 *   GET  /api/analytics/data
 *   GET  /api/analytics/tests
 *   GET  /api/analytics/vscode
 *   GET  /api/analytics/export?format=json|csv|excel
 *   POST /api/analytics/vscode/log
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

let json2csv_parser;
try {
    const { Parser } = require('json2csv');
    json2csv_parser = Parser;
} catch (e) {
    console.warn('json2csv not installed - CSV export will be disabled');
    json2csv_parser = null;
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 4200;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuration
const DATA_DIR = path.join(__dirname, '..');
const REPORTS_PATTERN = /test_report_\d{8}_\d{6}\.json/;
const VSCODE_LOGS_FILE = path.join(DATA_DIR, 'vscode-logs.json');

// Initialize vscode logs file if it doesn't exist
if (!fs.existsSync(VSCODE_LOGS_FILE)) {
    fs.writeFileSync(VSCODE_LOGS_FILE, JSON.stringify([], null, 2));
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Load all test reports from the data directory
 */
function loadTestReports() {
    try {
        const files = fs.readdirSync(DATA_DIR);
        const reports = [];
        
        files.forEach(file => {
            if (REPORTS_PATTERN.test(file)) {
                try {
                    const filePath = path.join(DATA_DIR, file);
                    const content = fs.readFileSync(filePath, 'utf8');
                    const data = JSON.parse(content);
                    reports.push(data);
                } catch (error) {
                    console.warn(`Error reading report ${file}:`, error.message);
                }
            }
        });
        
        return reports;
    } catch (error) {
        console.error('Error loading test reports:', error);
        return [];
    }
}

/**
 * Load VS Code logs
 */
function loadVSCodeLogs() {
    try {
        if (fs.existsSync(VSCODE_LOGS_FILE)) {
            const content = fs.readFileSync(VSCODE_LOGS_FILE, 'utf8');
            return JSON.parse(content);
        }
    } catch (error) {
        console.error('Error loading VS Code logs:', error);
    }
    return [];
}

/**
 * Save VS Code logs
 */
function saveVSCodeLogs(logs) {
    try {
        fs.writeFileSync(VSCODE_LOGS_FILE, JSON.stringify(logs, null, 2));
    } catch (error) {
        console.error('Error saving VS Code logs:', error);
    }
}

/**
 * Calculate analytics from test reports
 */
function calculateAnalytics(reports) {
    const analytics = {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        totalDuration: 0,
        startDate: null,
        endDate: null,
        console_errors: [],
        tenants: {}
    };
    
    reports.forEach(report => {
        if (report.summary) {
            analytics.totalTests += report.summary.total || 0;
            analytics.passedTests += report.summary.passed || 0;
            analytics.failedTests += report.summary.failed || 0;
            analytics.totalDuration += report.summary.duration_ms || 0;
        }
        
        if (report.timestamp) {
            const date = new Date(report.timestamp);
            if (!analytics.startDate || date < analytics.startDate) {
                analytics.startDate = date;
            }
            if (!analytics.endDate || date > analytics.endDate) {
                analytics.endDate = date;
            }
        }
        
        if (report.console_errors) {
            analytics.console_errors.push(...report.console_errors);
        }
        
        // Track tenant usage
        if (report.url) {
            const match = report.url.match(/https:\/\/([^.]+)\./);
            if (match) {
                const tenant = match[1];
                analytics.tenants[tenant] = (analytics.tenants[tenant] || 0) + 1;
            }
        }
    });
    
    // Calculate pass rate
    analytics.passRate = analytics.totalTests > 0 
        ? ((analytics.passedTests / analytics.totalTests) * 100).toFixed(2)
        : 0;
    
    // Calculate average duration
    analytics.avgDuration = analytics.totalTests > 0
        ? Math.round(analytics.totalDuration / analytics.totalTests)
        : 0;
    
    return analytics;
}

/**
 * Aggregate all analytics data
 */
function aggregateAnalytics() {
    const reports = loadTestReports();
    const vscodeLogsAll = loadVSCodeLogs();
    const analytics = calculateAnalytics(reports);
    
    return {
        timestamp: new Date().toISOString(),
        analytics: analytics,
        reports: reports,
        vscodeLogsAll: vscodeLogsAll,
        summary: {
            totalReports: reports.length,
            totalVSCodeLogs: vscodeLogsAll.length,
            passRate: analytics.passRate,
            avgDuration: analytics.avgDuration,
            errorCount: analytics.console_errors.length
        }
    };
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * GET /api/analytics/data
 * Returns all aggregated analytics data
 */
app.get('/api/analytics/data', (req, res) => {
    try {
        const data = aggregateAnalytics();
        res.json(data);
    } catch (error) {
        console.error('Error getting analytics data:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/analytics/tests
 * Returns test reports
 */
app.get('/api/analytics/tests', (req, res) => {
    try {
        const reports = loadTestReports();
        res.json(reports);
    } catch (error) {
        console.error('Error getting test reports:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/analytics/vscode
 * Returns VS Code logs
 */
app.get('/api/analytics/vscode', (req, res) => {
    try {
        const logs = loadVSCodeLogs();
        res.json(logs);
    } catch (error) {
        console.error('Error getting VS Code logs:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/analytics/vscode/log
 * Log a new VS Code event
 */
app.post('/api/analytics/vscode/log', (req, res) => {
    try {
        const logs = loadVSCodeLogs();
        const newLog = {
            timestamp: new Date().toISOString(),
            version: req.body.version,
            type: req.body.type, // 'stable' or 'insiders'
            eventType: req.body.eventType,
            details: req.body.details,
            status: req.body.status || 'success',
            userId: req.body.userId,
            metadata: req.body.metadata || {}
        };
        
        logs.push(newLog);
        saveVSCodeLogs(logs);
        
        res.status(201).json({ success: true, log: newLog });
    } catch (error) {
        console.error('Error logging VS Code event:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/analytics/export
 * Export analytics data in various formats
 */
app.get('/api/analytics/export', (req, res) => {
    try {
        const format = (req.query.format || 'json').toLowerCase();
        const data = aggregateAnalytics();
        
        switch(format) {
            case 'json':
                res.json(data);
                break;
                
            case 'csv':
                exportAsCSV(res, data);
                break;
                
            case 'excel':
                exportAsExcel(res, data);
                break;
                
            case 'html':
                exportAsHTML(res, data);
                break;
                
            default:
                res.status(400).json({ error: 'Unsupported format: ' + format });
        }
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Export data as CSV
 */
function exportAsCSV(res, data) {
    try {
        if (!json2csv_parser) {
            // Fallback: simple CSV generation without json2csv
            const fields = ['timestamp', 'name', 'passed', 'failed', 'duration_ms'];
            const headers = fields.join(',');
            const rows = data.reports.map(report => 
                [
                    report.timestamp || 'N/A',
                    report.tests ? (report.tests[0]?.name || 'N/A') : 'N/A',
                    report.summary?.passed || 0,
                    report.summary?.failed || 0,
                    report.summary?.duration_ms || 0
                ].map(v => `"${v}"`).join(',')
            );
            const csv = [headers, ...rows].join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="analytics-export.csv"');
            res.send(csv);
            return;
        }
        
        const fields = ['timestamp', 'name', 'passed', 'duration_ms', 'url'];
        const json = data.reports.map(report => ({
            timestamp: report.timestamp,
            name: report.tests ? report.tests[0]?.name : 'N/A',
            passed: report.summary?.passed || 0,
            duration_ms: report.summary?.duration_ms || 0,
            url: report.url || 'N/A'
        }));
        
        const csv = new json2csv_parser({ fields }).parse(json);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="analytics-export.csv"');
        res.send(csv);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

/**
 * Export data as Excel (simplified)
 */
function exportAsExcel(res, data) {
    // For now, send as JSON (real Excel would require xlsx library)
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="analytics-export.json"');
    res.json(data);
}

/**
 * Export data as HTML report
 */
function exportAsHTML(res, data) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>PiCanvas Analytics Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        h1, h2 { color: #007acc; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background-color: #f2f2f2; }
        .metric { margin: 10px 0; padding: 10px; background-color: #f9f9f9; }
    </style>
</head>
<body>
    <h1>📊 PiCanvas Analytics Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    
    <h2>Summary</h2>
    <div class="metric">
        <strong>Total Tests:</strong> ${data.summary.totalReports}
    </div>
    <div class="metric">
        <strong>Pass Rate:</strong> ${data.summary.passRate}%
    </div>
    <div class="metric">
        <strong>Avg Duration:</strong> ${data.summary.avgDuration}ms
    </div>
    <div class="metric">
        <strong>VS Code Logs:</strong> ${data.summary.totalVSCodeLogs}
    </div>
    <div class="metric">
        <strong>Errors:</strong> ${data.summary.errorCount}
    </div>
    
    <h2>Test Reports</h2>
    <table>
        <tr>
            <th>Date</th>
            <th>Tests</th>
            <th>Passed</th>
            <th>Failed</th>
            <th>Duration</th>
        </tr>
        ${data.reports.map(r => `
        <tr>
            <td>${r.timestamp || 'N/A'}</td>
            <td>${r.summary?.total || 0}</td>
            <td>${r.summary?.passed || 0}</td>
            <td>${r.summary?.failed || 0}</td>
            <td>${r.summary?.duration_ms || 0}ms</td>
        </tr>
        `).join('')}
    </table>
</body>
</html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'attachment; filename="analytics-report.html"');
    res.send(html);
}

/**
 * GET /api/analytics/health
 * Health check endpoint
 */
app.get('/api/analytics/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        reports: loadTestReports().length,
        vscodeLogsAll: loadVSCodeLogs().length
    });
});

/**
 * GET /
 * Serve dashboard
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Not found',
        path: req.path,
        message: 'Please check the API documentation at /api/analytics/data'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message 
    });
});

// ============================================================================
// START SERVER
// ============================================================================

const server = app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║         🎨 PiCanvas Analytics Server                       ║
╚════════════════════════════════════════════════════════════╝

📊 Dashboard: http://localhost:${PORT}
🔌 API: http://localhost:${PORT}/api/analytics

Available Endpoints:
  GET  /api/analytics/data           - All analytics data
  GET  /api/analytics/tests          - Test reports
  GET  /api/analytics/vscode         - VS Code logs
  POST /api/analytics/vscode/log     - Log VS Code event
  GET  /api/analytics/export         - Export data
  GET  /api/analytics/health         - Health check

Export Formats:
  ?format=json   - JSON format
  ?format=csv    - CSV format
  ?format=excel  - Excel format
  ?format=html   - HTML report

Data Directory: ${DATA_DIR}
Reports Found: ${loadTestReports().length}
VS Code Logs: ${loadVSCodeLogs().length}

Press Ctrl+C to stop the server
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n📊 Shutting down analytics server...');
    server.close(() => {
        console.log('✓ Server stopped');
        process.exit(0);
    });
});

// Prevent unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
