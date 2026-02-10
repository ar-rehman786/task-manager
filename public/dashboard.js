// Dashboard Page - Premium Redesign
let dashboardStats = null;
let dashboardUser = null;
let clockInTimer = null;
let statusChart = null; // Chart.js instance

// Initialize dashboard
async function initDashboard() {
    try {
        dashboardUser = await fetch('/api/auth/me').then(r => r.json());
        await loadDashboardStats();
        await loadAttendanceWidget();

        // Refresh stats every 30 seconds
        if (window.dashboardInterval) clearInterval(window.dashboardInterval);
        window.dashboardInterval = setInterval(loadDashboardStats, 30000);

    } catch (err) {
        console.error("Dashboard init failed", err);
    }
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        const response = await fetch('/api/dashboard/stats');
        dashboardStats = await response.json();
        renderDashboard();
    } catch (error) {
        console.error('Load stats error:', error);
    }
}

// Load attendance widget
async function loadAttendanceWidget() {
    try {
        const response = await fetch('/api/attendance/status');
        const activeSession = await response.json();
        renderClockInWidget(activeSession);

        if (activeSession) {
            startClockInTimer(activeSession.clockInTime);
        }
    } catch (error) {
        console.error('Load attendance error:', error);
    }
}

// Render dashboard - The New "Premium" Layout
function renderDashboard() {
    // CRITICAL: Stop rendering if we moved away from dashboard
    if (typeof currentWorkspace !== 'undefined' && currentWorkspace !== 'dashboard') return;

    if (!dashboardStats) return;

    const container = document.getElementById('content-area');

    // Safety check if dashboard container exists
    if (!container) return;

    // Build the grid layout
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const greeting = getGreeting();

    container.innerHTML = `
        <div class="dashboard-grid">
            <!-- Header -->
            <div class="dashboard-header">
                <div class="welcome-section">
                    <h1 class="gradient-text">${greeting}, ${dashboardUser.name.split(' ')[0]}</h1>
                    <div class="date-display">${today}</div>
                </div>
                <div id="clock-in-widget-wrapper"></div>
            </div>

            <!-- Stat Cards Row -->
            <div class="stat-card-premium" style="grid-column: 1 / 2;">
                <div class="stat-icon-wrapper" style="background: rgba(99, 102, 241, 0.1); color: #818cf8;">
                    📋
                </div>
                <div class="stat-details">
                    <div class="stat-value-big">${dashboardStats.totalTasks}</div>
                    <div class="stat-label-small">Total Tasks</div>
                </div>
            </div>

            <div class="stat-card-premium" style="grid-column: 2 / 3;">
                <div class="stat-icon-wrapper" style="background: rgba(245, 158, 11, 0.1); color: #fbbf24;">
                    ⚡
                </div>
                <div class="stat-details">
                    <div class="stat-value-big">${dashboardStats.statusBreakdown.in_progress || 0}</div>
                    <div class="stat-label-small">In Progress</div>
                </div>
            </div>

            <div class="stat-card-premium" style="grid-column: 3 / 4;">
                <div class="stat-icon-wrapper" style="background: rgba(236, 72, 153, 0.1); color: #f472b6;">
                    📅
                </div>
                <div class="stat-details">
                    <div class="stat-value-big">${dashboardStats.upcomingTasks.length}</div>
                    <div class="stat-label-small">Upcoming</div>
                </div>
            </div>

            <div class="stat-card-premium" style="grid-column: 4 / 5;">
                <div class="stat-icon-wrapper" style="background: rgba(16, 185, 129, 0.1); color: #34d399;">
                    ✅
                </div>
                <div class="stat-details">
                    <div class="stat-value-big">${dashboardStats.statusBreakdown.done || 0}</div>
                    <div class="stat-label-small">Completed</div>
                </div>
            </div>

            <!-- Priority Focus Section (List) -->
            <div class="priority-focus-section">
                <div class="dashboard-section-title">
                    <span>🔥 Priority Focus</span>
                </div>
                <div id="upcoming-tasks-list">
                    <!-- Tasks injected here -->
                </div>
            </div>

            <!-- Analytics Section (Charts) -->
            <div class="analytics-section">
                <div class="chart-container-card">
                    <div class="dashboard-section-title">Task Distribution</div>
                    <div style="height: 250px; position: relative;">
                        <canvas id="statusChartCanvas"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Render Sub-components
    renderUpcomingTasksList();
    loadAttendanceWidget(); // Re-bind widget to new container

    // Render Chart using Chart.js
    renderChartJs();
}

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
}

function renderUpcomingTasksList() {
    const container = document.getElementById('upcoming-tasks-list');
    const tasks = dashboardStats.upcomingTasks;

    if (tasks.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted);">🎉 All caught up! No upcoming tasks.</div>';
        return;
    }

    container.innerHTML = tasks.slice(0, 5).map(task => { // Limit to 5 tasks
        const dueDate = new Date(task.dueDate);
        const daysUntil = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
        const colorClass = daysUntil <= 1 ? '#f87171' : '#cbd5e1'; // Red for urgent

        return `
            <div class="task-row" onclick="viewTask(${task.id})">
                <div class="task-row-icon">
                    ⚪
                </div>
                <div class="task-row-content">
                    <div class="task-row-title">${task.title}</div>
                    <div class="task-row-meta">
                        <span style="color: ${colorClass}">📅 Due ${new Date(task.dueDate).toLocaleDateString()}</span>
                        <span>• ${task.priority}</span>
                    </div>
                </div>
                <div class="task-row-status" style="background: rgba(255,255,255,0.1);">
                    ${task.status.replace('_', ' ')}
                </div>
            </div>
        `;
    }).join('');
}

function renderChartJs() {
    const ctx = document.getElementById('statusChartCanvas');
    if (!ctx) return;

    // Check if Chart is loaded
    if (typeof Chart === 'undefined') {
        ctx.parentNode.innerHTML = '<p style="color:red; text-align:center;">Chart.js not loaded. Check internet connection.</p>';
        return;
    }

    const dataValues = [
        stats.todo || 0,
        stats.in_progress || 0,
        stats.done || 0,
        stats.blocked || 0
    ];

    // If chart exists, update data instead of destroy/create
    if (statusChart) {
        statusChart.data.datasets[0].data = dataValues;
        statusChart.update(); // Smooth transition, no full animation
        return;
    }

    statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['To Do', 'In Progress', 'Done', 'Blocked'],
            datasets: [{
                data: dataValues,
                backgroundColor: [
                    '#94a3b8', // Todo (Gray)
                    '#818cf8', // In Progress (Indigo)
                    '#34d399', // Done (Emerald)
                    '#ef4444'  // Blocked (Red)
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#cbd5e1',
                        font: {
                            family: 'Inter',
                            size: 11
                        },
                        boxWidth: 12,
                        padding: 20
                    }
                }
            },
            cutout: '70%'
        }
    });
}

// Render clock-in widget (Re-implementation for new container)
function renderClockInWidget(activeSession) {
    const wrapper = document.getElementById('clock-in-widget-wrapper');
    if (!wrapper) return;

    const isClockedIn = activeSession !== null;

    wrapper.innerHTML = `
        <div style="display: flex; gap: 1rem; align-items: center;">
            ${isClockedIn ? `
                <div style="background: rgba(16, 185, 129, 0.2); color: #34d399; padding: 0.5rem 1rem; border-radius: 20px; font-weight: 600; font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem;">
                    <span style="animation: pulse 2s infinite">●</span> <span id="clock-duration">00:00:00</span>
                </div>
                <button class="btn btn-danger btn-sm" onclick="quickClockOut()">Stop</button>
            ` : `
                <button class="btn btn-primary" onclick="quickClockIn()">
                    <span style="margin-right: 0.5rem;">▶️</span> Clock In
                </button>
            `}
        </div>
    `;
}

// ... Keep existing Clock In/Out logic (quickClockIn, quickClockOut, Timer logic) ...
// (Re-pasting helper functions to ensure they exist)

// Quick clock in
async function quickClockIn() {
    try {
        const response = await fetch('/api/attendance/clock-in', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: 'Quick clock-in from dashboard' })
        });

        if (response.ok) {
            const session = await response.json();
            renderClockInWidget(session);
            startClockInTimer(session.clockInTime);
            showNotification('Clocked in successfully!', 'success');
        } else {
            const error = await response.json();
            showNotification(error.error || 'Failed to clock in', 'error');
        }
    } catch (error) {
        console.error('Clock in error:', error);
        showNotification('Failed to clock in', 'error');
    }
}

// Quick clock out
async function quickClockOut() {
    try {
        const response = await fetch('/api/attendance/clock-out', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: 'Quick clock-out from dashboard' })
        });

        if (response.ok) {
            const session = await response.json();
            stopClockInTimer();
            renderClockInWidget(null);
            showNotification(`Clocked out! Duration: ${formatMinutes(session.workDuration)}`, 'success');
        } else {
            const error = await response.json();
            showNotification(error.error || 'Failed to clock out', 'error');
        }
    } catch (error) {
        console.error('Clock out error:', error);
        showNotification('Failed to clock out', 'error');
    }
}

// Start clock-in timer
function startClockInTimer(clockInTime) {
    if (clockInTimer) clearInterval(clockInTimer);

    clockInTimer = setInterval(() => {
        const duration = calculateDuration(clockInTime);
        const durationEl = document.getElementById('clock-duration');
        if (durationEl) {
            durationEl.textContent = duration;
        }
    }, 1000);
}

// Stop clock-in timer
function stopClockInTimer() {
    if (clockInTimer) {
        clearInterval(clockInTimer);
        clockInTimer = null;
    }
}

// Calculate duration
function calculateDuration(startTime) {
    const start = new Date(startTime);
    const now = new Date();
    const diff = now - start;

    const hours = Math.floor(diff / 1000 / 60 / 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Format minutes to Xh Ym
function formatMinutes(minutes) {
    if (!minutes) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
}

// View task details
function viewTask(taskId) {
    loadWorkspace('tasks');
    // Note: In a full app, this would open the specific task modal
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

