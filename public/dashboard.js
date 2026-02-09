// Dashboard Page
let dashboardStats = null;
let dashboardUser = null;
let clockInTimer = null;

// Initialize dashboard
async function initDashboard() {
    dashboardUser = await fetch('/api/auth/me').then(r => r.json());
    await loadDashboardStats();
    await loadAttendanceWidget();

    // Refresh stats every 30 seconds
    setInterval(loadDashboardStats, 30000);
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

// Render dashboard
function renderDashboard() {
    if (!dashboardStats) return;

    renderStatCards();
    renderUpcomingTasks();
    renderCompletedTasks();
    renderTaskCharts();
}

// Render clock-in widget
function renderClockInWidget(activeSession) {
    const widget = document.getElementById('clock-in-widget');
    const isClockedIn = activeSession !== null;

    widget.innerHTML = `
        <div class="quick-clock-widget ${isClockedIn ? 'clocked-in' : ''}">
            <div class="clock-status">
                <div class="status-dot ${isClockedIn ? 'active' : ''}"></div>
                <span class="status-text">${isClockedIn ? 'Clocked In' : 'Not Clocked In'}</span>
            </div>
            ${isClockedIn ? `
                <div class="clock-duration" id="clock-duration">00:00:00</div>
                <button class="btn btn-danger btn-sm" onclick="quickClockOut()">Clock Out</button>
            ` : `
                <button class="btn btn-primary btn-sm" onclick="quickClockIn()">Clock In</button>
            `}
        </div>
    `;
}

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

// Format minutes to HH:MM
function formatMinutes(minutes) {
    if (!minutes) return '00:00';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// Render stat cards
function renderStatCards() {
    const container = document.getElementById('stat-cards');
    const stats = dashboardStats.statusBreakdown;

    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">📊</div>
            <div class="stat-info">
                <div class="stat-label">Total Tasks</div>
                <div class="stat-value">${dashboardStats.totalTasks}</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb, #f5576c);">📅</div>
            <div class="stat-info">
                <div class="stat-label">Upcoming</div>
                <div class="stat-value">${dashboardStats.upcomingTasks.length}</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon" style="background: linear-gradient(135deg, #4facfe, #00f2fe);">⚡</div>
            <div class="stat-info">
                <div class="stat-label">In Progress</div>
                <div class="stat-value">${stats.in_progress || 0}</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon" style="background: linear-gradient(135deg, #43e97b, #38f9d7);">✅</div>
            <div class="stat-info">
                <div class="stat-label">Completed</div>
                <div class="stat-value">${stats.done || 0}</div>
            </div>
        </div>
    `;
}

// Render upcoming tasks
function renderUpcomingTasks() {
    const container = document.getElementById('upcoming-tasks');
    const tasks = dashboardStats.upcomingTasks;

    if (tasks.length === 0) {
        container.innerHTML = '<p class="empty-state">No upcoming tasks</p>';
        return;
    }

    container.innerHTML = tasks.map(task => {
        const dueDate = new Date(task.dueDate);
        const daysUntil = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
        const urgency = daysUntil <= 1 ? 'urgent' : daysUntil <= 3 ? 'soon' : 'normal';

        return `
            <div class="task-item ${urgency}" onclick="viewTask(${task.id})">
                <div class="task-item-header">
                    <span class="task-item-title">${task.title}</span>
                    <span class="task-priority ${task.priority}">${task.priority}</span>
                </div>
                <div class="task-item-meta">
                    <span class="task-due-date">
                        📅 ${daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days`}
                    </span>
                    ${task.assignedUserName ? `<span class="task-assignee">👤 ${task.assignedUserName}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Render completed tasks
function renderCompletedTasks() {
    const container = document.getElementById('completed-tasks');
    const tasks = dashboardStats.completedTasks;

    if (tasks.length === 0) {
        container.innerHTML = '<p class="empty-state">No completed tasks yet</p>';
        return;
    }

    container.innerHTML = tasks.map(task => `
        <div class="task-item completed" onclick="viewTask(${task.id})">
            <div class="task-item-header">
                <span class="task-item-title">✓ ${task.title}</span>
            </div>
            <div class="task-item-meta">
                <span class="task-completed-date">Completed ${formatRelativeTime(task.updatedAt)}</span>
                ${task.assignedUserName ? `<span class="task-assignee">👤 ${task.assignedUserName}</span>` : ''}
            </div>
        </div>
    `).join('');
}

// Render task charts
function renderTaskCharts() {
    renderStatusChart();
    renderPriorityChart();
}

// Render status chart (simple text-based visualization)
function renderStatusChart() {
    const container = document.getElementById('status-chart');
    const stats = dashboardStats.statusBreakdown;
    const total = dashboardStats.totalTasks || 1;

    const statusData = [
        { label: 'To Do', count: stats.todo || 0, color: '#94a3b8' },
        { label: 'In Progress', count: stats.in_progress || 0, color: '#3b82f6' },
        { label: 'Blocked', count: stats.blocked || 0, color: '#f59e0b' },
        { label: 'Done', count: stats.done || 0, color: '#10b981' }
    ];

    container.innerHTML = `
        <div class="chart-bars">
            ${statusData.map(item => {
        const percentage = total > 0 ? (item.count / total * 100) : 0;
        return `
                    <div class="chart-bar-item">
                        <div class="chart-bar-label">
                            <span>${item.label}</span>
                            <span class="chart-bar-value">${item.count}</span>
                        </div>
                        <div class="chart-bar-track">
                            <div class="chart-bar-fill" style="width: ${percentage}%; background: ${item.color};"></div>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

// Render priority chart
function renderPriorityChart() {
    const container = document.getElementById('priority-chart');
    const stats = dashboardStats.priorityBreakdown;
    const total = (stats.low || 0) + (stats.medium || 0) + (stats.high || 0) || 1;

    const priorityData = [
        { label: 'Low', count: stats.low || 0, color: '#6ee7b7', percentage: ((stats.low || 0) / total * 100).toFixed(1) },
        { label: 'Medium', count: stats.medium || 0, color: '#fbbf24', percentage: ((stats.medium || 0) / total * 100).toFixed(1) },
        { label: 'High', count: stats.high || 0, color: '#f87171', percentage: ((stats.high || 0) / total * 100).toFixed(1) }
    ];

    container.innerHTML = `
        <div class="chart-legend">
            ${priorityData.map(item => `
                <div class="chart-legend-item">
                    <div class="chart-legend-color" style="background: ${item.color};"></div>
                    <div class="chart-legend-info">
                        <div class="chart-legend-label">${item.label}</div>
                        <div class="chart-legend-value">${item.count} (${item.percentage}%)</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// View task details
function viewTask(taskId) {
    // Navigate to tasks page and open task modal
    loadWorkspace('tasks');
    // Note: Task modal opening would be handled by tasks.js
}

// Format relative time
function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 1000 / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

// Show notification
function showNotification(message, type = 'info') {
    // Simple notification - can be enhanced with a toast library
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

// Initialize on page load
initDashboard();
