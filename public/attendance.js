// Attendance Management
let attendanceUser = null;
let activeSession = null;
let timerInterval = null;

console.log('Attendance JS loaded');

// Initialize attendance page
async function initAttendance() {
    console.log('initAttendance called');
    try {
        const timestamp = Date.now();
        attendanceUser = await fetch(`/api/auth/me?t=${timestamp}`).then(r => r.json());
        await loadAttendanceStatus();
        await loadAttendanceHistory();

        if (attendanceUser.role === 'admin') {
            const adminSection = document.getElementById('admin-section');
            if (adminSection) {
                adminSection.style.display = 'block';
                await loadTodayAttendance();
            }
        }
    } catch (e) {
        console.error('initAttendance failed:', e);
        showError('Failed to initialize attendance: ' + e.message);
    }
}

// Load current attendance status
async function loadAttendanceStatus() {
    try {
        console.log('Loading status...');
        const timestamp = Date.now();
        const response = await fetch(`/api/attendance/status?t=${timestamp}`);
        activeSession = await response.json();

        renderAttendanceWidget();

        // If clockInTimer exists (from dashboard.js or other context), clear it
        if (window.clockInTimer) clearInterval(window.clockInTimer);

        if (activeSession) {
            startTimer();
        }
    } catch (error) {
        console.error('Load status error:', error);
    }
}

// Render clock in/out widget
function renderAttendanceWidget() {
    const widget = document.getElementById('attendance-widget');
    if (!widget) return;

    const isClockedIn = activeSession !== null;

    const clockInTime = activeSession ? new Date(activeSession.clockInTime).toLocaleTimeString() : '--:--';
    const duration = activeSession ? calculateDuration(activeSession.clockInTime) : '00:00:00';

    widget.innerHTML = `
        <div class="attendance-card">
            <div class="attendance-status ${isClockedIn ? 'clocked-in' : 'clocked-out'}">
                <div class="status-indicator"></div>
                <span>${isClockedIn ? 'Clocked In' : 'Clocked Out'}</span>
            </div>
            
            <div class="attendance-time">
                <div class="current-time">${new Date().toLocaleTimeString()}</div>
                ${isClockedIn ? `<div class="clock-in-time">Started at ${clockInTime}</div>` : ''}
            </div>
            
            ${isClockedIn ? `
                <div class="work-duration">
                    <div class="duration-label">Work Duration</div>
                    <div class="duration-time" id="duration-display">${duration}</div>
                </div>
            ` : ''}
            
            <div class="attendance-actions">
                ${isClockedIn ? `
                    <button class="btn btn-danger btn-lg" onclick="showClockOutModal()">
                        <span style="font-size: 1.5rem;">⏱️</span> Clock Out
                    </button>
                ` : `
                    <button class="btn btn-primary btn-lg" onclick="showClockInModal()">
                        <span style="font-size: 1.5rem;">▶️</span> Clock In
                    </button>
                `}
            </div>
        </div>
        
        <div class="today-summary">
            <h3>Today's Summary</h3>
            <div class="summary-stats">
                <div class="stat-card">
                    <div class="stat-label">Status</div>
                    <div class="stat-value">${isClockedIn ? '🟢 Working' : '⚪ Not Working'}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Clock In</div>
                    <div class="stat-value">${clockInTime}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Duration</div>
                    <div class="stat-value" id="summary-duration">${formatDuration(window.todayBaseMinutes || 0)}</div>
                </div>
            </div>
        </div>
    `;
}

// Show clock in modal
function showClockInModal() {
    const modalContent = `
        <div class="modal-header">
            <h3 class="modal-title">Clock In</h3>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <form id="clock-in-form">
            <div class="form-group">
                <label class="form-label">Notes (Optional)</label>
                <textarea class="form-textarea" id="clock-in-notes" placeholder="Add any notes about your shift..."></textarea>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                <button type="submit" class="btn btn-primary">Clock In Now</button>
            </div>
        </form>
    `;

    const modal = showModal(modalContent);

    document.getElementById('clock-in-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await clockIn();
        closeModal(modal);
    });
}

// Show clock out modal
function showClockOutModal() {
    const duration = activeSession ? calculateDuration(activeSession.clockInTime) : '00:00:00';

    const modalContent = `
        <div class="modal-header">
            <h3 class="modal-title">Clock Out</h3>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div style="padding: 1rem; background: #f0f0f0; border-radius: 0.5rem; margin-bottom: 1rem;">
            <p><strong>Work Duration:</strong> ${duration}</p>
            <p><strong>Clocked In At:</strong> ${activeSession ? new Date(activeSession.clockInTime).toLocaleString() : ''}</p>
        </div>
        <form id="clock-out-form">
            <div class="form-group">
                <label class="form-label">Notes (Optional)</label>
                <textarea class="form-textarea" id="clock-out-notes" placeholder="Add any notes about your shift..."></textarea>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                <button type="submit" class="btn btn-danger">Clock Out Now</button>
            </div>
        </form>
    `;

    const modal = showModal(modalContent);

    document.getElementById('clock-out-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await clockOut();
        closeModal(modal);
    });
}

// Clock in
async function clockIn() {
    const btn = document.querySelector('#clock-in-form button[type="submit"]');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner">⌛</span> Clocking in...';
    }

    const notes = document.getElementById('clock-in-notes')?.value;

    try {
        const response = await fetch('/api/attendance/clock-in', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes })
        });

        if (response.ok) {
            activeSession = await response.json();
            renderAttendanceWidget();
            startTimer();
            await loadAttendanceHistory();
            showSuccess('Clocked in successfully!');
        } else {
            const error = await response.json();
            showError(error.error || 'Failed to clock in');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'Clock In Now';
            }
        }
    } catch (error) {
        console.error('Clock in error:', error);
        showError('Failed to clock in');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Clock In Now';
        }
    }
}

// Clock out
async function clockOut() {
    const btn = document.querySelector('#clock-out-form button[type="submit"]');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner">⌛</span> Clocking out...';
    }

    const notes = document.getElementById('clock-out-notes')?.value;

    try {
        const response = await fetch('/api/attendance/clock-out', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes })
        });

        if (response.ok) {
            const session = await response.json();
            stopTimer();
            activeSession = null;
            renderAttendanceWidget();
            await loadAttendanceHistory();
            showSuccess(`Clocked out! Work duration: ${formatDuration(session.workDuration)}`);
        } else {
            const error = await response.json();
            showError(error.error || 'Failed to clock out');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'Clock Out Now';
            }
        }
    } catch (error) {
        console.error('Clock out error:', error);
        showError('Failed to clock out');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Clock Out Now';
        }
    }
}

// Start timer
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        if (activeSession) {
            const currentSessionDuration = calculateMinutes(activeSession.clockInTime);
            const totalDuration = (window.todayBaseMinutes || 0) + currentSessionDuration;

            const durationDisplay = document.getElementById('duration-display');
            const summaryDuration = document.getElementById('summary-duration');

            if (durationDisplay) durationDisplay.textContent = formatDuration(currentSessionDuration); // Show current session
            if (summaryDuration) summaryDuration.textContent = formatDuration(totalDuration); // Show DAY total
        }
    }, 1000);
}

// Calculate minutes duration
function calculateMinutes(startTime) {
    const start = new Date(startTime);
    const now = new Date();
    const diff = now - start;
    return Math.floor(diff / 1000 / 60);
}

// Stop timer
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// Calculate duration string HH:MM:SS
function calculateDuration(startTime) {
    const start = new Date(startTime);
    const now = new Date();
    const diff = now - start;

    const hours = Math.floor(diff / 1000 / 60 / 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Format minutes to pretty string
function formatDuration(minutes) {
    if (!minutes) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
}

// Load attendance history
async function loadAttendanceHistory() {
    console.log('loadAttendanceHistory called');
    try {
        const timestamp = Date.now();
        const response = await fetch(`/api/attendance/history?limit=30&t=${timestamp}`);
        if (!response.ok) throw new Error('Failed to load history');

        const records = await response.json();

        if (!Array.isArray(records)) throw new Error('Invalid response format');

        // Calculate today's total duration
        const today = new Date().toDateString();
        const todayRecords = records.filter(r => new Date(r.clockInTime).toDateString() === today);
        let totalMinutes = todayRecords.reduce((sum, r) => sum + (r.workDuration || 0), 0);

        // Update summary widget with total (static part)
        const summaryDuration = document.getElementById('summary-duration');
        if (summaryDuration && !activeSession) {
            summaryDuration.textContent = formatDuration(totalMinutes);
        }

        // Store for timer use
        window.todayBaseMinutes = totalMinutes;

        renderAttendanceHistory(records);
    } catch (error) {
        console.error('Load history error:', error);
        const tbody = document.querySelector('#history-table tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Error loading history: ${error.message}</td></tr>`;
        }
    }
}

// Render attendance history
function renderAttendanceHistory(records) {
    const tbody = document.querySelector('#history-table tbody');
    if (!tbody) return;

    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #999;">No attendance records found</td></tr>';
        return;
    }

    tbody.innerHTML = records.map(record => {
        const clockIn = new Date(record.clockInTime);
        const clockOut = record.clockOutTime ? new Date(record.clockOutTime) : null;
        const duration = record.workDuration ? formatDuration(record.workDuration) : 'In Progress';
        const status = record.status === 'active' ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-secondary">Completed</span>';

        return `
            <tr>
                <td>${clockIn.toLocaleDateString()}</td>
                <td>${clockIn.toLocaleTimeString()}</td>
                <td>${clockOut ? clockOut.toLocaleTimeString() : '--:--'}</td>
                <td><strong>${duration}</strong></td>
                <td>${status}</td>
            </tr>
        `;
    }).join('');
}

// Load today's attendance (admin)
async function loadTodayAttendance() {
    try {
        const timestamp = Date.now();
        const response = await fetch(`/api/attendance/today?t=${timestamp}`);
        const records = await response.json();
        renderTodayAttendance(records);
    } catch (error) {
        console.error('Load today error:', error);
    }
}

// Render today's attendance (admin)
function renderTodayAttendance(records) {
    const tbody = document.querySelector('#today-table tbody');
    if (!tbody) return;

    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #999;">No attendance records for today</td></tr>';
        return;
    }

    tbody.innerHTML = records.map(record => {
        const clockIn = new Date(record.clockInTime);
        const clockOut = record.clockOutTime ? new Date(record.clockOutTime) : null;
        const duration = record.workDuration ? formatDuration(record.workDuration) : calculateDuration(record.clockInTime);
        const status = record.status === 'active' ? '<span class="badge badge-success">🟢 Working</span>' : '<span class="badge badge-secondary">Completed</span>';

        return `
            <tr>
                <td><strong>${record.userName}</strong></td>
                <td>${record.userEmail}</td>
                <td>${clockIn.toLocaleTimeString()}</td>
                <td>${clockOut ? clockOut.toLocaleTimeString() : '--:--'}</td>
                <td><strong>${duration}</strong></td>
                <td>${status}</td>
            </tr>
        `;
    }).join('');
}

// Utility functions
function showModal(content) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal">${content}</div>`;
    document.body.appendChild(overlay);
    return overlay;
}

function closeModal(modal) {
    modal.remove();
}

function showSuccess(message) {
    // Check if we have notification function (e.g., from dashboard.js logic)
    // If not, use alert or create a temp toast
    if (typeof showNotification === 'function') {
        showNotification(message, 'success');
        return;
    }

    // Fallback: Create toast
    const notification = document.createElement('div');
    notification.className = 'notification notification-success';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: #10b981;
        color: white;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function showError(message) {
    if (typeof showNotification === 'function') {
        showNotification(message, 'error');
        return;
    }
    alert('Error: ' + message);
}
