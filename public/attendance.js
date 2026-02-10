// Attendance Management
let attendanceUser = null;
let activeSession = null;
let timerInterval = null;

console.log('Attendance JS loaded');

// Initialize attendance page
async function initAttendance() {
    console.log('initAttendance called');
    const timestamp = Date.now();

    try {
        attendanceUser = await fetch(`/api/auth/me?t=${timestamp}`).then(r => r.json());
    } catch (e) {
        console.error('Failed to fetch user:', e);
        return;
    }

    try {
        await loadAttendanceStatus();
    } catch (e) {
        console.error('Failed to load status:', e);
    }

    try {
        await loadAttendanceHistory();
    } catch (e) {
        console.error('Failed to load history:', e);
    }

    try {
        if (attendanceUser && attendanceUser.role === 'admin') {
            // construct HTML with native classes for dark mode support
            const adminHtml = `
                <div id="dynamic-admin-section" class="attendance-history" style="margin-bottom: 2rem; border-color: var(--primary);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <h3 style="color: var(--primary); margin: 0;">👑 Team Attendance Overview</h3>
                        <span class="badge badge-secondary">Admin View</span>
                    </div>
                    
                    <h4 style="margin-bottom: 1rem; color: var(--text-secondary);">Today's Team Activity</h4>
                    <div style="overflow-x: auto;">
                        <table class="data-table" id="today-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Clock In</th>
                                    <th>Clock Out</th>
                                    <th>Duration</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td colspan="6" style="text-align: center;">Loading...</td></tr>
                            </tbody>
                        </table>
                    </div>

                    <h4 style="margin-top: 2rem; margin-bottom: 1rem; color: var(--text-secondary);">Full History (All Members)</h4>
                    <div style="overflow-x: auto;">
                        <table class="data-table" id="admin-history-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Date</th>
                                    <th>Clock In</th>
                                    <th>Clock Out</th>
                                    <th>Duration</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td colspan="6" style="text-align: center;">Loading...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            // Inject at the top of content-area (after header)
            const header = document.querySelector('.workspace-header');
            if (header) {
                // Remove existing if any (prevent duplicates on re-render)
                const existing = document.getElementById('dynamic-admin-section');
                if (existing) existing.remove();

                header.insertAdjacentHTML('afterend', adminHtml);

                // Now load data into these new tables
                await loadTodayAttendance();
                await loadAllAttendanceHistory();
            } else {
                console.error('Could not find .workspace-header to inject admin panel');
            }
        }
    } catch (e) {
        console.error('Error in admin injection:', e);
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

// Render attendance history (Redesign: Logs & Requests)
function renderAttendanceHistory(records) {
    // We are overriding the entire container for the new design
    // Find the container where we want to render this
    // We will target the .attendance-history div created in app.js, or create a new one
    let container = document.querySelector('.attendance-history');

    // If we can't find the container (e.g. app structure changed), let's assume content-area is where we want to be, 
    // but app.js creates specific structure. Let's try to overwrite the ".attendance-history" content.
    if (!container) {
        // Fallback or potentially overwrite content-area if we are in attendance workspace
        // But for safety, let's look for #history-table and go up
        const table = document.getElementById('history-table');
        if (table) container = table.closest('.attendance-history');
    }

    if (!container) return;

    // Generate Last 30 Days Data
    const days = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        days.push(d);
    }

    // Process Records into a Map for easy lookup
    // Key: YYYY-MM-DD
    const recordsMap = {};
    records.forEach(r => {
        const dateKey = new Date(r.clockInTime).toDateString();
        // Handle multiple sessions if needed? For now assuming 1 per day or taking the first/sum
        // If multiple, we might want to sum duration.
        if (!recordsMap[dateKey]) {
            recordsMap[dateKey] = r;
        } else {
            // If checking multiple sessions, we'd add their durations here.
            // For simplicity in this display, let's just stick to the main one or most recent
        }
    });

    const rowsHtml = days.map(date => {
        const dateKey = date.toDateString();
        const record = recordsMap[dateKey];
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateStr = date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
        const isWeekend = dayName === 'Sat' || dayName === 'Sun';

        // Row Logic
        let visualHtml = '';
        let effectiveHtml = '';
        let grossHtml = '';
        let arrivalHtml = '';
        let rowClass = '';
        let weekendTag = '';

        if (isWeekend) {
            rowClass = 'row-weekend';
            weekendTag = '<span class="tag-weekend">W-OFF</span>';
            effectiveHtml = '<span class="text-muted">Full day Weekly-off</span>';
        } else if (record) {
            // Has data
            const duration = record.workDuration ? formatDuration(record.workDuration) : 'Active';
            const widthPct = Math.min(100, Math.max(5, (record.workDuration || 0) / 480 * 100)); // Assume 8h = 100%

            visualHtml = `
                <div class="visual-bar-container">
                    <div class="visual-bar" style="width: ${widthPct}%"></div>
                </div>
            `;
            effectiveHtml = `<strong>${duration}</strong>`;
            grossHtml = duration; // Same for now

            // Arrival Logic (Assume 9:00 AM)
            const clockIn = new Date(record.clockInTime);
            const isLate = clockIn.getHours() > 9 || (clockIn.getHours() === 9 && clockIn.getMinutes() > 0);

            if (!isLate) {
                arrivalHtml = `<div class="status-check"><span>✔</span> On Time</div>`;
            } else {
                arrivalHtml = `<div class="status-check" style="color: #f59e0b"><span>⚠</span> Late</div>`;
            }

        } else {
            // No data (Absent or Future?)
            if (date.getTime() > Date.now()) {
                // Future - shouldn't happen with "Last 30 days" loop going backwards
            } else {
                effectiveHtml = '<span class="text-muted">No Time Entries Logged</span>';
                arrivalHtml = '<span class="text-muted">-</span>';
                grossHtml = '<span class="text-muted">-</span>';
            }
        }

        return `
            <tr class="${rowClass}">
                <td style="width: 200px;">
                    <div style="font-weight: 500; color: var(--text-primary); display: flex; align-items: center;">
                        ${dayName}, ${dateStr} ${weekendTag}
                    </div>
                </td>
                <td style="width: 30%;">
                    ${visualHtml}
                </td>
                <td>${effectiveHtml}</td>
                <td>${grossHtml}</td>
                <td>${arrivalHtml}</td>
                <td style="text-align: right;">
                    <span class="action-icon">⋯</span>
                </td>
            </tr>
        `;
    }).join('');

    // Rebuild the Container HTML
    container.innerHTML = `
        <div class="workspace-header" style="margin-bottom: 0;">
            <h2>Logs & Requests</h2>
            <div style="display: flex; gap: 8px; align-items: center;">
                <label class="switch-label" style="font-size: 0.8rem; color: var(--text-secondary);">
                    <input type="checkbox" checked> 24 hour format
                </label>
            </div>
        </div>

        <div class="attendance-dashboard">
            <div class="attendance-header-nav">
                <div class="attendance-tabs">
                    <button class="att-tab active">Attendance Log</button>
                    <button class="att-tab">Calendar</button>
                    <button class="att-tab">Attendance Requests</button>
                </div>
            </div>

            <div class="attendance-controls">
                <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary); margin-right: auto;">Last 30 Days</span>
                
                <button class="date-filter-btn active">30 Days</button>
                <button class="date-filter-btn">Jan</button>
                <button class="date-filter-btn">Dec</button>
                <button class="date-filter-btn">Nov</button>
                <button class="date-filter-btn">Oct</button>
                <button class="date-filter-btn">Sep</button>
                <button class="date-filter-btn">Aug</button>
            </div>

            <div class="att-table-container">
                <table class="att-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Attendance Visual</th>
                            <th>Effective Hours</th>
                            <th>Gross Hours</th>
                            <th>Arrival</th>
                            <th style="text-align: right;">Log</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Load today's attendance (admin)
async function loadTodayAttendance() {
    console.log('loadTodayAttendance: START');
    try {
        const timestamp = Date.now();
        console.log('loadTodayAttendance: Fetching...');
        const response = await fetch(`/api/attendance/today?t=${timestamp}`);
        console.log('loadTodayAttendance: Response received', response.status);

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const records = await response.json();
        console.log('loadTodayAttendance: JSON parsed, records:', records.length);
        renderTodayAttendance(records);
    } catch (error) {
        console.error('loadTodayAttendance ERROR:', error);
    }
    console.log('loadTodayAttendance: END');
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

// Load all attendance history (admin)
async function loadAllAttendanceHistory() {
    console.log('loadAllAttendanceHistory: START');
    try {
        const timestamp = Date.now();
        console.log('loadAllAttendanceHistory: Fetching...');
        const response = await fetch(`/api/attendance/admin/history?t=${timestamp}`);
        console.log('loadAllAttendanceHistory: Response received', response.status);

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const records = await response.json();
        console.log('loadAllAttendanceHistory: JSON parsed, records:', records.length);
        renderAllAttendanceHistory(records);
    } catch (error) {
        console.error('loadAllAttendanceHistory ERROR:', error);
    }
    console.log('loadAllAttendanceHistory: END');
}

// Render all attendance history (admin)
function renderAllAttendanceHistory(records) {
    const tbody = document.querySelector('#admin-history-table tbody');
    if (!tbody) return;

    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #999;">No attendance records found</td></tr>';
        return;
    }

    tbody.innerHTML = records.map(record => {
        const clockIn = new Date(record.clockInTime);
        const clockOut = record.clockOutTime ? new Date(record.clockOutTime) : null;
        const duration = record.workDuration ? formatDuration(record.workDuration) : calculateDuration(record.clockInTime);
        const status = record.status === 'active' ? '<span class="badge badge-success">🟢 Working</span>' : '<span class="badge badge-secondary">Completed</span>';

        return `
            <tr>
                <td>
                    <strong>${record.userName}</strong><br>
                    <small style="color: var(--text-muted)">${record.userEmail}</small>
                </td>
                <td>${clockIn.toLocaleDateString()}</td>
                <td>${clockIn.toLocaleTimeString()}</td>
                <td>${clockOut ? clockOut.toLocaleTimeString() : '--:--'}</td>
                <td><strong>${duration}</strong></td>
                <td>${status}</td>
            </tr>
        `;
    }).join('');
}
