// Dashboard Configuration
const CONFIG = {
    apiBaseUrl: 'http://localhost:4200/api',
    refreshInterval: 30000, // 30 seconds
    dataPath: '../'
};

// Global state
let dashboardData = {
    vscodeLogsCache: [],
    testsCache: [],
    performanceMetrics: {},
    usageStats: {}
};

let charts = {};

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
    initializeCharts();
    loadAllData();
    setupAutoRefresh();
    updateLastUpdate();
});

// Navigation
function initializeNavigation() {
    const navButtons = document.querySelectorAll('.nav-button');
    navButtons.forEach(button => {
        button.addEventListener('click', function() {
            const section = this.dataset.section;
            showSection(section);
        });
    });
}

function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active from all nav buttons
    document.querySelectorAll('.nav-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionId).classList.add('active');
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
    
    // Trigger chart updates for the new section
    setTimeout(() => {
        updateChartsForSection(sectionId);
    }, 100);
}

// Data Loading
async function loadAllData() {
    try {
        showLoading(true);
        
        // Load test reports
        await loadTestReports();
        
        // Load VS Code logs
        await loadVSCodeLogs();
        
        // Calculate statistics
        calculateStatistics();
        
        // Update all visualizations
        updateAllVisualizations();
        
    } catch (error) {
        console.error('Error loading data:', error);
        showAlert('Error loading data: ' + error.message, 'warning');
    } finally {
        showLoading(false);
        updateLastUpdate();
    }
}

async function loadTestReports() {
    try {
        const response = await fetch(`${CONFIG.apiBaseUrl}/tests`);
        if (!response.ok) throw new Error('Failed to load test reports');
        
        dashboardData.testsCache = await response.json();
        console.log('Loaded test reports:', dashboardData.testsCache);
        
        updateTestSection();
    } catch (error) {
        console.warn('Could not load test reports from API, using local data:', error);
        // Fallback: load from local JSON reports
        await loadLocalTestReports();
    }
}

async function loadLocalTestReports() {
    try {
        const reports = [];
        const filenames = [
            'test_report_20251219_124154.json',
            // Add more filenames as needed
        ];
        
        for (const filename of filenames) {
            try {
                const response = await fetch(`${CONFIG.dataPath}${filename}`);
                if (response.ok) {
                    const data = await response.json();
                    reports.push(...(Array.isArray(data) ? data : [data]));
                }
            } catch (e) {
                console.warn(`Could not load ${filename}:`, e);
            }
        }
        
        dashboardData.testsCache = reports;
        console.log('Loaded local test reports:', reports.length);
    } catch (error) {
        console.error('Error loading local test reports:', error);
    }
}

async function loadVSCodeLogs() {
    try {
        const response = await fetch(`${CONFIG.apiBaseUrl}/vscode`);
        if (!response.ok) throw new Error('Failed to load VS Code logs');
        
        dashboardData.vscodeLogsCache = await response.json();
        console.log('Loaded VS Code logs:', dashboardData.vscodeLogsCache);
    } catch (error) {
        console.warn('Could not load VS Code logs from API:', error);
        // Generate sample data for demo
        generateSampleVSCodeLogs();
    }
}

function generateSampleVSCodeLogs() {
    // Sample VS Code log data for demonstration
    dashboardData.vscodeLogsCache = [
        {
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            version: '1.95.0',
            type: 'stable',
            eventType: 'Extension Activation',
            details: 'PiCanvas extension activated',
            status: 'success'
        },
        {
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            version: '1.96.0-insiders',
            type: 'insiders',
            eventType: 'Extension Update',
            details: 'Updated to latest version',
            status: 'success'
        },
        {
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            version: '1.94.2',
            type: 'stable',
            eventType: 'User Action',
            details: 'Opened PiCanvas settings',
            status: 'success'
        },
        {
            timestamp: new Date(Date.now() - 172800000).toISOString(),
            version: '1.95.0-insiders',
            type: 'insiders',
            eventType: 'Error',
            details: 'Memory usage spike detected',
            status: 'error'
        },
        {
            timestamp: new Date(Date.now() - 259200000).toISOString(),
            version: '1.94.0',
            type: 'stable',
            eventType: 'Extension Load',
            details: 'PiCanvas loaded successfully',
            status: 'success'
        }
    ];
}

function calculateStatistics() {
    const tests = dashboardData.testsCache;
    const vscodeLogs = dashboardData.vscodeLogsCache;
    
    // Test statistics
    const totalTests = tests.length;
    const passedTests = tests.filter(t => t.passed || t.summary?.passed > 0).length;
    const failedTests = tests.filter(t => !t.passed || t.summary?.failed > 0).length;
    const passRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0;
    
    const durations = tests
        .filter(t => t.duration_ms || t.summary?.duration_ms)
        .map(t => t.duration_ms || t.summary?.duration_ms || 0);
    
    const avgDuration = durations.length > 0 
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;
    
    // VS Code statistics
    const vscodeCount = new Set(vscodeLogs.map(log => log.timestamp?.split('T')[0])).size;
    const errorCount = vscodeLogs.filter(log => log.status === 'error').length;
    
    // Update stats
    document.getElementById('total-events').textContent = (totalTests + vscodeLogs.length).toString();
    document.getElementById('pass-rate').textContent = passRate + '%';
    document.getElementById('vscode-sessions').textContent = vscodeCount.toString();
    document.getElementById('errors-count').textContent = errorCount.toString();
    
    document.getElementById('total-tests').textContent = totalTests.toString();
    document.getElementById('passed-tests').textContent = passedTests.toString();
    document.getElementById('failed-tests').textContent = failedTests.toString();
    document.getElementById('avg-duration').textContent = avgDuration.toString();
    
    // Store for later use
    dashboardData.performanceMetrics = {
        totalTests,
        passedTests,
        failedTests,
        passRate,
        avgDuration,
        vscodeCount,
        errorCount
    };
}

// Chart Initialization
function initializeCharts() {
    // Register the datalabels plugin
    Chart.register(ChartDataLabels);
    
    // Set default options
    Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif";
    Chart.defaults.color = '#a0a0a0';
    Chart.defaults.borderColor = '#3e3e42';
}

function updateAllVisualizations() {
    updateTestSection();
    updateVSCodeSection();
    updatePerformanceSection();
    updateUsageSection();
    updateOverviewCharts();
}

function updateChartsForSection(sectionId) {
    switch(sectionId) {
        case 'overview':
            updateOverviewCharts();
            break;
        case 'vscode':
            updateVSCodeCharts();
            break;
        case 'tests':
            updateTestCharts();
            break;
        case 'performance':
            updatePerformanceCharts();
            break;
        case 'usage':
            updateUsageCharts();
            break;
    }
}

// Overview Section
function updateOverviewCharts() {
    const tests = dashboardData.testsCache;
    const vscodeLogs = dashboardData.vscodeLogsCache;
    
    // Test Summary Pie Chart
    const passedTests = tests.filter(t => t.passed || t.summary?.passed > 0).length;
    const failedTests = tests.filter(t => !t.passed || t.summary?.failed > 0).length;
    
    updateChart('testSummaryChart', {
        type: 'doughnut',
        data: {
            labels: ['Passed', 'Failed'],
            datasets: [{
                data: [passedTests, failedTests],
                backgroundColor: ['#107c10', '#d13438'],
                borderColor: ['#0d5f0d', '#a02622'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 15 }
                },
                datalabels: {
                    color: '#fff',
                    font: { weight: 'bold' },
                    formatter: (value, ctx) => {
                        const sum = ctx.dataset.data.reduce((a, b) => a + b, 0);
                        return ((value * 100 / sum).toFixed(0)) + '%';
                    }
                }
            }
        }
    });
    
    // Pass/Fail Trend Line Chart
    const lastTests = tests.slice(-20);
    const dates = lastTests.map((t, i) => `Test ${i + 1}`);
    const passData = lastTests.map(t => t.passed || t.summary?.passed > 0 ? 1 : 0);
    
    updateChart('passFailChart', {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Pass (1) / Fail (0)',
                data: passData,
                borderColor: '#007acc',
                backgroundColor: 'rgba(0, 120, 204, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: passData.map(v => v ? '#107c10' : '#d13438')
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true }
            },
            scales: {
                y: {
                    min: -0.5,
                    max: 1.5,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
    
    // Activity Heatmap
    updateActivityHeatmap();
    
    // Recent Activities Timeline
    updateRecentActivities();
}

function updateActivityHeatmap() {
    const tests = dashboardData.testsCache;
    const today = new Date();
    const dayLabels = [];
    const hourLabels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        dayLabels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    
    // Generate heatmap data
    const data = [];
    for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 6; hour++) {
            data.push({
                x: hourLabels[hour],
                y: dayLabels[day],
                v: Math.floor(Math.random() * 10)
            });
        }
    }
    
    updateChart('heatmapChart', {
        type: 'bubble',
        data: {
            datasets: [{
                label: 'Activity Level',
                data: data.map(d => ({
                    x: d.x,
                    y: d.y,
                    r: d.v * 1.5
                })),
                backgroundColor: 'rgba(0, 120, 212, 0.5)',
                borderColor: 'rgba(0, 120, 212, 1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function updateRecentActivities() {
    const tests = dashboardData.testsCache.slice(-5).reverse();
    const vscodeLogs = dashboardData.vscodeLogsCache.slice(-5).reverse();
    
    const activities = [
        ...tests.map(t => ({
            time: new Date(t.timestamp).toLocaleTimeString(),
            title: `Test: ${t.name || 'Unknown'}`,
            status: t.passed ? 'success' : 'failed',
            details: t.passed ? 'Passed' : 'Failed'
        })),
        ...vscodeLogs.map(log => ({
            time: new Date(log.timestamp).toLocaleTimeString(),
            title: `VS Code: ${log.eventType}`,
            status: log.status === 'error' ? 'failed' : 'success',
            details: log.details
        }))
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8);
    
    const timeline = document.getElementById('recentActivities');
    timeline.innerHTML = activities.map(activity => `
        <div class="timeline-item">
            <div class="timeline-content">
                <strong>${activity.title}</strong>
                <p style="margin-top: 0.25rem; color: var(--text-secondary);">${activity.details}</p>
                <div class="timeline-time">${activity.time}</div>
            </div>
        </div>
    `).join('');
}

// Test Section
function updateTestSection() {
    const tests = dashboardData.testsCache;
    
    updateTestCharts();
    
    // Display test list
    const testsList = document.getElementById('testsList');
    if (tests.length === 0) {
        testsList.innerHTML = '<div class="empty-state">No test reports available</div>';
        return;
    }
    
    testsList.innerHTML = tests.slice(-10).reverse().map(test => `
        <div class="list-item">
            <div class="list-item-content">
                <div class="list-item-title">${test.name || 'Unknown Test'}</div>
                <div class="list-item-meta">
                    ${test.timestamp ? new Date(test.timestamp).toLocaleString() : 'No timestamp'}
                    • Duration: ${test.duration_ms || 0}ms
                    • URL: ${test.url || 'N/A'}
                </div>
            </div>
            <span class="status-badge ${test.passed ? 'status-success' : 'status-failed'}">
                ${test.passed ? '✓ Passed' : '✗ Failed'}
            </span>
        </div>
    `).join('');
}

function updateTestCharts() {
    const tests = dashboardData.testsCache;
    
    // Test Timeline
    const sortedTests = tests.slice(-15);
    const testNames = sortedTests.map((t, i) => `Test ${i + 1}`);
    const testResults = sortedTests.map(t => t.passed ? 100 : 0);
    
    updateChart('testTimelineChart', {
        type: 'bar',
        data: {
            labels: testNames,
            datasets: [{
                label: 'Pass %',
                data: testResults,
                backgroundColor: testResults.map(v => v > 50 ? '#107c10' : '#d13438'),
                borderColor: testResults.map(v => v > 50 ? '#0d5f0d' : '#a02622'),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'x',
            scales: {
                y: { max: 100 }
            },
            plugins: {
                legend: { display: false },
                datalabels: { display: false }
            }
        }
    });
    
    // Duration Distribution
    const durations = tests
        .filter(t => t.duration_ms)
        .sort((a, b) => a.duration_ms - b.duration_ms)
        .slice(-20);
    
    updateChart('durationChart', {
        type: 'bar',
        data: {
            labels: durations.map((t, i) => `Test ${i + 1}`),
            datasets: [{
                label: 'Duration (ms)',
                data: durations.map(t => t.duration_ms),
                backgroundColor: '#007acc',
                borderColor: '#005a9e',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// VS Code Section
function updateVSCodeSection() {
    const logs = dashboardData.vscodeLogsCache;
    
    updateVSCodeCharts();
    
    // Update logs table
    displayVSCodeLogs(logs);
}

function updateVSCodeCharts() {
    const logs = dashboardData.vscodeLogsCache;
    
    // Version Distribution
    const versionCounts = {};
    logs.forEach(log => {
        versionCounts[log.version] = (versionCounts[log.version] || 0) + 1;
    });
    
    updateChart('vscodeVersionChart', {
        type: 'doughnut',
        data: {
            labels: Object.keys(versionCounts),
            datasets: [{
                data: Object.values(versionCounts),
                backgroundColor: [
                    '#0078d4',
                    '#22b14c',
                    '#ff8c00',
                    '#7030a0',
                    '#ffb900'
                ],
                borderColor: '#1e1e1e',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                datalabels: {
                    color: '#fff',
                    font: { weight: 'bold' }
                }
            }
        }
    });
    
    // Extension Timeline
    const lastLogs = logs.slice(-20);
    updateChart('extensionTimelineChart', {
        type: 'line',
        data: {
            labels: lastLogs.map((l, i) => `Event ${i + 1}`),
            datasets: [{
                label: 'Extension Activity',
                data: lastLogs.map(l => l.status === 'error' ? 0 : 1),
                borderColor: '#0078d4',
                backgroundColor: 'rgba(0, 120, 212, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: lastLogs.map(l => l.status === 'error' ? '#d13438' : '#107c10'),
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: -0.5,
                    max: 1.5,
                    ticks: { stepSize: 1 }
                }
            },
            plugins: {
                legend: { display: true }
            }
        }
    });
}

function displayVSCodeLogs(logs, searchTerm = '', filterType = '') {
    let filtered = logs;
    
    if (searchTerm) {
        filtered = filtered.filter(log => 
            JSON.stringify(log).toLowerCase().includes(searchTerm.toLowerCase())
        );
    }
    
    if (filterType) {
        filtered = filtered.filter(log => log.type === filterType);
    }
    
    const tbody = document.getElementById('vscodeLogsBody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No logs found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.slice(-50).reverse().map(log => `
        <tr>
            <td>${log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}</td>
            <td><span class="vs-code-badge ${log.type === 'insiders' ? 'vs-code-insiders' : 'vs-code-stable'}">${log.version}</span></td>
            <td>${log.eventType || 'Unknown'}</td>
            <td>${log.details || 'N/A'}</td>
            <td><span class="status-badge ${log.status === 'error' ? 'status-failed' : 'status-success'}">${log.status || 'unknown'}</span></td>
        </tr>
    `).join('');
}

// Performance Section
function updatePerformanceSection() {
    updatePerformanceCharts();
    updatePerformanceMetrics();
}

function updatePerformanceCharts() {
    const tests = dashboardData.testsCache;
    
    // Execution Speed
    const durations = tests.filter(t => t.duration_ms).map(t => t.duration_ms);
    const avgSpeed = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b) / durations.length) : 0;
    
    updateChart('speedChart', {
        type: 'line',
        data: {
            labels: tests.slice(-15).map((t, i) => `Test ${i + 1}`),
            datasets: [{
                label: 'Execution Time (ms)',
                data: tests.slice(-15).map(t => t.duration_ms || 0),
                borderColor: '#0078d4',
                backgroundColor: 'rgba(0, 120, 212, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true }
            }
        }
    });
    
    // Success Rate
    const lastTests = tests.slice(-30);
    const successRates = lastTests.map(t => (t.passed ? 1 : 0) * 100);
    
    updateChart('successRateChart', {
        type: 'area',
        data: {
            labels: lastTests.map((t, i) => `${i + 1}`),
            datasets: [{
                label: 'Success Rate %',
                data: successRates,
                borderColor: '#107c10',
                backgroundColor: 'rgba(16, 124, 16, 0.1)',
                borderWidth: 2,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { min: 0, max: 100 }
            }
        }
    });
    
    // Error Type Distribution
    const errorTypes = {};
    dashboardData.vscodeLogsCache
        .filter(log => log.status === 'error')
        .forEach(log => {
            errorTypes[log.eventType] = (errorTypes[log.eventType] || 0) + 1;
        });
    
    updateChart('errorTypeChart', {
        type: 'pie',
        data: {
            labels: Object.keys(errorTypes).length > 0 ? Object.keys(errorTypes) : ['No Errors'],
            datasets: [{
                data: Object.keys(errorTypes).length > 0 ? Object.values(errorTypes) : [0],
                backgroundColor: ['#d13438', '#ff8c00', '#ffb900', '#107c10'],
                borderColor: '#1e1e1e',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
    
    // Component Performance
    updateChart('componentChart', {
        type: 'horizontalBar',
        data: {
            labels: ['WebPart Loading', 'Template Application', 'Data Processing', 'Rendering'],
            datasets: [{
                label: 'Avg Time (ms)',
                data: [245, 156, 89, 134],
                backgroundColor: '#007acc',
                borderColor: '#005a9e'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function updatePerformanceMetrics() {
    const metrics = dashboardData.performanceMetrics;
    const tbody = document.getElementById('performanceMetrics');
    
    tbody.innerHTML = `
        <tr>
            <td><strong>Average Test Duration</strong></td>
            <td>${metrics.avgDuration}ms</td>
            <td>-</td>
            <td>-</td>
        </tr>
        <tr>
            <td><strong>Total Tests Run</strong></td>
            <td>${metrics.totalTests}</td>
            <td>-</td>
            <td>-</td>
        </tr>
        <tr>
            <td><strong>Pass Rate</strong></td>
            <td>${metrics.passRate}%</td>
            <td>-</td>
            <td>-</td>
        </tr>
        <tr>
            <td><strong>Error Count</strong></td>
            <td>${metrics.errorCount}</td>
            <td>-</td>
            <td>-</td>
        </tr>
    `;
}

// Usage Section
function updateUsageSection() {
    updateUsageCharts();
    updateUsageTable();
}

function updateUsageCharts() {
    const tests = dashboardData.testsCache;
    
    // Monthly Usage
    const monthlyData = {};
    tests.forEach(test => {
        const month = new Date(test.timestamp).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        monthlyData[month] = (monthlyData[month] || 0) + 1;
    });
    
    updateChart('monthlyUsageChart', {
        type: 'bar',
        data: {
            labels: Object.keys(monthlyData),
            datasets: [{
                label: 'Test Runs',
                data: Object.values(monthlyData),
                backgroundColor: '#0078d4',
                borderColor: '#005a9e',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
    
    // Time of Day
    updateChart('timeOfDayChart', {
        type: 'doughnut',
        data: {
            labels: ['Night (00-06)', 'Morning (06-12)', 'Afternoon (12-18)', 'Evening (18-24)'],
            datasets: [{
                data: [8, 24, 35, 18],
                backgroundColor: ['#2c3e50', '#f39c12', '#e74c3c', '#3498db'],
                borderColor: '#1e1e1e',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
    
    // Tenant Distribution
    updateChart('tenantChart', {
        type: 'doughnut',
        data: {
            labels: ['PiSpace', 'SAP', 'Hopkins Demo', 'ARH'],
            datasets: [{
                data: [35, 20, 25, 20],
                backgroundColor: ['#0078d4', '#107c10', '#ffb900', '#d13438'],
                borderColor: '#1e1e1e',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
    
    // Test Type Distribution
    updateChart('testTypeChart', {
        type: 'radar',
        data: {
            labels: ['Workbench', 'Section Tests', 'Template Tests', 'UI Tests', 'API Tests'],
            datasets: [{
                label: 'Test Count',
                data: [12, 8, 15, 6, 10],
                borderColor: '#0078d4',
                backgroundColor: 'rgba(0, 120, 212, 0.2)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function updateUsageTable() {
    const tbody = document.getElementById('usageBody');
    const stats = [
        { metric: 'Total Runs', value: dashboardData.testsCache.length, trend: '↑ 12%' },
        { metric: 'Avg Duration', value: dashboardData.performanceMetrics.avgDuration + 'ms', trend: '↓ 5%' },
        { metric: 'Success Rate', value: dashboardData.performanceMetrics.passRate + '%', trend: '↑ 2%' },
        { metric: 'VS Code Sessions', value: dashboardData.performanceMetrics.vscodeCount, trend: '↑ 8%' }
    ];
    
    tbody.innerHTML = stats.map(stat => `
        <tr>
            <td><strong>${stat.metric}</strong></td>
            <td>${stat.value}</td>
            <td>${stat.trend}</td>
            <td>${new Date().toLocaleString()}</td>
        </tr>
    `).join('');
}

// Utility Functions
function updateChart(chartId, config) {
    const ctx = document.getElementById(chartId);
    if (!ctx) return;
    
    // Destroy existing chart
    if (charts[chartId]) {
        charts[chartId].destroy();
    }
    
    // Create new chart
    charts[chartId] = new Chart(ctx, {
        type: config.type,
        data: config.data,
        options: config.options || {},
        plugins: [ChartDataLabels]
    });
}

function filterVSCodeLogs() {
    const searchTerm = document.getElementById('vscode-search').value;
    const filterType = document.getElementById('vscode-filter').value;
    displayVSCodeLogs(dashboardData.vscodeLogsCache, searchTerm, filterType);
}

function filterTests() {
    const searchTerm = document.getElementById('test-search').value;
    const statusFilter = document.getElementById('test-status-filter').value;
    
    let filtered = dashboardData.testsCache;
    
    if (searchTerm) {
        filtered = filtered.filter(test => 
            (test.name || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }
    
    if (statusFilter) {
        filtered = filtered.filter(test => {
            if (statusFilter === 'passed') return test.passed || test.summary?.passed > 0;
            if (statusFilter === 'failed') return !test.passed || test.summary?.failed > 0;
        });
    }
    
    // Update display
    const testsList = document.getElementById('testsList');
    testsList.innerHTML = filtered.slice(-10).reverse().map(test => `
        <div class="list-item">
            <div class="list-item-content">
                <div class="list-item-title">${test.name || 'Unknown Test'}</div>
                <div class="list-item-meta">
                    ${test.timestamp ? new Date(test.timestamp).toLocaleString() : 'No timestamp'}
                    • Duration: ${test.duration_ms || 0}ms
                </div>
            </div>
            <span class="status-badge ${test.passed ? 'status-success' : 'status-failed'}">
                ${test.passed ? '✓ Passed' : '✗ Failed'}
            </span>
        </div>
    `).join('');
}

function refreshData() {
    loadAllData();
}

async function downloadReport(format) {
    try {
        const data = compileDashboardData();
        
        switch(format.toLowerCase()) {
            case 'json':
                downloadJSON(data);
                break;
            case 'csv':
                downloadCSV(data);
                break;
            default:
                showAlert('Unsupported format: ' + format, 'warning');
        }
    } catch (error) {
        showAlert('Error downloading report: ' + error.message, 'danger');
    }
}

function downloadVSCodeReport() {
    downloadJSON(dashboardData.vscodeLogsCache, 'vscode-logs.json');
}

function compileDashboardData() {
    return {
        timestamp: new Date().toISOString(),
        summary: dashboardData.performanceMetrics,
        tests: dashboardData.testsCache,
        vscodeLogss: dashboardData.vscodeLogsCache
    };
}

function downloadJSON(data, filename = 'analytics-report.json') {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    downloadBlob(blob, filename);
}

function downloadCSV(data, filename = 'analytics-report.csv') {
    const tests = data.tests || [];
    
    let csv = 'Timestamp,Test Name,Status,Duration (ms),URL\n';
    tests.forEach(test => {
        csv += `"${test.timestamp}","${test.name || 'Unknown'}","${test.passed ? 'Passed' : 'Failed'}",${test.duration_ms || 0},"${test.url || 'N/A'}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

function exportData(format) {
    const data = compileDashboardData();
    
    switch(format.toLowerCase()) {
        case 'json':
            downloadJSON(data);
            break;
        case 'csv':
            downloadCSV(data);
            break;
        case 'excel':
            showAlert('Excel export coming soon', 'info');
            break;
        case 'pdf':
            showAlert('PDF export coming soon', 'info');
            break;
        default:
            showAlert('Unknown format: ' + format, 'warning');
    }
}

function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    const text = element.textContent;
    navigator.clipboard.writeText(text).then(() => {
        showAlert('Copied to clipboard!', 'success');
    }).catch(() => {
        showAlert('Failed to copy', 'danger');
    });
}

function downloadIntegrationGuide() {
    const guide = `PiCanvas Analytics Integration Guide

# API Endpoints

/api/analytics/data - Get all analytics data
/api/analytics/vscode - Get VS Code logs
/api/analytics/tests - Get test reports
/api/analytics/export?format=json - Export data

# Integration Examples

## SharePoint
POST /sites/pispace/_api/web/lists/getByTitle('Analytics')/items

## Power BI
Connect using REST API connector to http://localhost:4200/api/analytics/data

## Google Sheets
Use the IMPORTDATA or custom script editor to fetch data

For more information, visit:
https://github.com/anthonyrhopkins/PiCanvas
`;
    
    downloadBlob(new Blob([guide], { type: 'text/plain' }), 'integration-guide.txt');
}

function showLoading(show) {
    // Optionally add a loading spinner here
}

function showAlert(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
}

function setupAutoRefresh() {
    setInterval(() => {
        console.log('Auto-refreshing dashboard...');
        loadAllData();
    }, CONFIG.refreshInterval);
}

function updateLastUpdate() {
    const now = new Date();
    document.getElementById('last-update').textContent = now.toLocaleString();
}

// Interactive Enhancements
function initializeInteractiveElements() {
    // Animate stat items on scroll
    const statItems = document.querySelectorAll('.stat-item');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'slideUp 0.5s ease-out';
                observer.unobserve(entry.target);
            }
        });
    });
    
    statItems.forEach(item => observer.observe(item));
    
    // Add click handlers to stat items for details
    statItems.forEach(item => {
        item.addEventListener('click', function() {
            const label = this.querySelector('.stat-label').textContent;
            const value = this.querySelector('.stat-value').textContent;
            showStatDetails(label, value);
        });
    });
    
    // Add hover animation to cards
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-4px) scale(1.01)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // Enhance table row interactions
    const tableRows = document.querySelectorAll('.log-table tbody tr');
    tableRows.forEach((row, index) => {
        row.style.animation = `slideUp ${0.3 + (index * 0.05)}s ease-out`;
        
        row.addEventListener('mouseenter', function() {
            this.style.boxShadow = 'inset 0 2px 8px rgba(0, 120, 212, 0.2)';
            this.style.backgroundColor = 'rgba(0, 120, 212, 0.15)';
        });
        
        row.addEventListener('mouseleave', function() {
            this.style.boxShadow = 'none';
            this.style.backgroundColor = 'transparent';
        });
    });
    
    // Button ripple effects
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            
            this.appendChild(ripple);
            
            setTimeout(() => ripple.remove(), 600);
        });
        
        btn.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = '0 4px 12px rgba(0, 120, 212, 0.3)';
        });
        
        btn.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
        });
    });
    
    // Input focus animations
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.style.boxShadow = '0 0 0 3px rgba(0, 120, 212, 0.1)';
            this.style.backgroundColor = 'rgba(0, 120, 212, 0.02)';
        });
        
        input.addEventListener('blur', function() {
            this.style.boxShadow = 'none';
            this.style.backgroundColor = 'var(--bg-secondary)';
        });
    });
}

function showStatDetails(label, value) {
    // Show a toast notification with stat details
    const toast = document.createElement('div');
    toast.className = 'toast toast-info';
    toast.style.animation = 'slideInFromRight 0.3s ease-out';
    toast.textContent = `${label}: ${value}`;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideUp 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

function animateStatValue(element, targetValue, duration = 1000) {
    const start = parseInt(element.textContent) || 0;
    const range = targetValue - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const interval = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= targetValue) || (increment < 0 && current <= targetValue)) {
            element.textContent = targetValue;
            clearInterval(interval);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 16);
}

// Add ripple effect styles
const style = document.createElement('style');
style.textContent = `
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.5);
        width: 20px;
        height: 20px;
        animation: rippleAnimation 0.6s ease-out;
        pointer-events: none;
    }
    
    @keyframes rippleAnimation {
        from {
            transform: scale(0);
            opacity: 1;
        }
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    .toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 4px;
        color: white;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        max-width: 300px;
    }
    
    .toast-info {
        background-color: var(--info-color);
    }
    
    .toast-success {
        background-color: var(--success-color);
    }
    
    .toast-danger {
        background-color: var(--danger-color);
    }
`;
document.head.appendChild(style);

// Initialize interactive elements when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    initializeInteractiveElements();
});
