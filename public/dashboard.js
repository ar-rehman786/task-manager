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
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        dashboardStats = await response.json();
        renderDashboard();
    } catch (error) {
        console.error('Load stats error:', error);
        const container = document.getElementById('content-area');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #ef4444;">
                    <h3>⚠️ Failed to load dashboard data</h3>
                    <p>${error.message}</p>
                    <button class="btn btn-primary" onclick="loadDashboardStats()">Retry</button>
                </div>
            `;
        }
    }
}

// Load attendance widget
async function loadAttendanceWidget() {
    try {
        const response = await fetch('/api/attendance/status');
        if (response.ok) {
            activeSession = await response.json();
            renderClockInWidget(activeSession);
            if (activeSession) {
                startClockInTimer(activeSession.clockInTime);
            }
        }
    } catch (error) {
        console.error('Attendance widget error:', error);
    }
}

// Render dashboard data
function renderDashboard() {
    if (!dashboardStats) return;

    // Render Stats
    renderChartJs();
    renderPriorityChart();
    renderUpcomingTasks();
    renderCompletedTasks();
}

function renderUpcomingTasks() {
    const container = document.getElementById('upcoming-tasks');
    if (!container) return;

    if (!dashboardStats.upcomingTasks || dashboardStats.upcomingTasks.length === 0) {
        container.innerHTML = '<p class="text-muted" style="text-align:center; padding: 1rem;">No upcoming tasks due soon.</p>';
        return;
    }

    container.innerHTML = dashboardStats.upcomingTasks.map(task => `
        <div class="task-item" onclick="viewTask(${task.id})" style="cursor: pointer; padding: 0.75rem; border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div>
                    <div style="font-weight: 500; margin-bottom: 0.25rem;">${task.title}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">
                        Due: ${new Date(task.dueDate).toLocaleDateString()}
                        ${task.assignedUserName ? `• ${task.assignedUserName}` : ''}
                    </div>
                </div>
                <span class="badge badge-${getPriorityColor(task.priority)}">${task.priority}</span>
            </div>
        </div>
    `).join('');
}

function renderCompletedTasks() {
    const container = document.getElementById('completed-tasks');
    if (!container) return;

    if (!dashboardStats.completedTasks || dashboardStats.completedTasks.length === 0) {
        container.innerHTML = '<p class="text-muted" style="text-align:center; padding: 1rem;">No recently completed tasks.</p>';
        return;
    }

    container.innerHTML = dashboardStats.completedTasks.map(task => `
        <div class="task-item" style="padding: 0.75rem; border-bottom: 1px solid var(--border-color); opacity: 0.8;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="text-decoration: line-through; color: var(--text-secondary);">${task.title}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">
                    ${new Date(task.updatedAt).toLocaleDateString()}
                </div>
            </div>
        </div>
    `).join('');
}

function renderPriorityChart() {
    const ctx = document.getElementById('priority-chart');
    if (!ctx) return;

    // Check if we already have a chart instance for this canvas, if so destroy it or reused it? 
    // Since we don't track it globally like statusChart, let's look for a way to track it or just recreate simple HTML bars if Chart.js is too heavy for two charts.
    // Actually, let's use a simple HTML progress bar style for priority to vary the visuals.

    const stats = dashboardStats.priorityBreakdown || {};
    const total = (stats.low || 0) + (stats.medium || 0) + (stats.high || 0) || 1; // avoid divide by zero

    ctx.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1rem; padding: 1rem;">
            <div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
                    <span>High Priority</span>
                    <span>${stats.high || 0}</span>
                </div>
                <div style="height: 6px; background: var(--bg-secondary); border-radius: 3px; overflow: hidden;">
                    <div style="height: 100%; width: ${(stats.high || 0) / total * 100}%; background: #ef4444;"></div>
                </div>
            </div>
            <div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
                    <span>Medium Priority</span>
                    <span>${stats.medium || 0}</span>
                </div>
                <div style="height: 6px; background: var(--bg-secondary); border-radius: 3px; overflow: hidden;">
                    <div style="height: 100%; width: ${(stats.medium || 0) / total * 100}%; background: #f59e0b;"></div>
                </div>
            </div>
            <div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
                    <span>Low Priority</span>
                    <span>${stats.low || 0}</span>
                </div>
                <div style="height: 6px; background: var(--bg-secondary); border-radius: 3px; overflow: hidden;">
                    <div style="height: 100%; width: ${(stats.low || 0) / total * 100}%; background: #10b981;"></div>
                </div>
            </div>
        </div>
    `;
}

function getPriorityColor(priority) {
    if (priority === 'high') return 'danger';
    if (priority === 'medium') return 'warning';
    return 'success';
}

function renderChartJs() {
    const ctx = document.getElementById('statusChartCanvas');
    if (!ctx) return;

    // Check if Chart is loaded
    if (typeof Chart === 'undefined') {
        ctx.parentNode.innerHTML = '<p style="color:red; text-align:center;">Chart.js not loaded. Check internet connection.</p>';
        return;
    }

    // FIX: stats was undefined. Use dashboardStats.statusBreakdown
    const stats = dashboardStats.statusBreakdown || {};

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

