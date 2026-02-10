// Global state
let currentUser = null;
let currentWorkspace = 'tasks';

// Initialize app
async function initApp() {
    try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
            window.location.href = '/';
            return;
        }

        currentUser = await response.json();

        // Update UI with user info
        const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
        document.getElementById('user-initials').textContent = initials;
        document.getElementById('user-avatar').title = currentUser.name;

        // Show admin section if admin
        if (currentUser.role === 'admin') {
            document.getElementById('admin-section').style.display = 'block';
        }

        // Setup navigation
        setupNavigation();

        // Setup logout
        document.getElementById('logout-btn').addEventListener('click', logout);

        // Setup search
        setupSearch();

        // Load initial workspace (restore from local storage or default to dashboard)
        const lastWorkspace = localStorage.getItem('lastWorkspace') || 'dashboard';
        loadWorkspace(lastWorkspace);
    } catch (error) {
        console.error('Init error:', error);
        window.location.href = '/';
    }
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const workspace = item.dataset.workspace;
            if (workspace) {
                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');
                loadWorkspace(workspace);
                localStorage.setItem('lastWorkspace', workspace);
            }
        });
    });
}

function loadWorkspace(workspace) {
    try {
        console.log(`Loading workspace: ${workspace}`);

        // Clear existing interval if any
        if (window.dashboardInterval) {
            clearInterval(window.dashboardInterval);
            window.dashboardInterval = null;
        }

        window.currentWorkspace = workspace;
        const contentArea = document.getElementById('content-area');

        // Update active class if loading from storage/init
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            if (item.dataset.workspace === workspace) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        switch (workspace) {
            case 'dashboard':
                loadDashboardWorkspace();
                break;
            case 'tasks':
                loadTasksWorkspace();
                break;
            case 'projects':
                loadProjectsWorkspace();
                break;
            case 'team':
                if (currentUser && currentUser.role === 'admin') {
                    loadTeamWorkspace();
                }
                break;
            case 'attendance':
                loadAttendanceWorkspace();
                break;
            default:
                console.warn('Unknown workspace:', workspace);
                loadDashboardWorkspace();
        }
    } catch (error) {
        console.error(`Error loading workspace ${workspace}:`, error);
        document.getElementById('content-area').innerHTML =
            `<div style="padding: 2rem; color: #ef4444; text-align: center;">
                <h3>Error Loading Page</h3>
                <p>${error.message}</p>
                <button class="btn btn-primary" onclick="window.location.reload()">Reload Page</button>
            </div>`;
    }
}

function setupSearch() {
    const searchInput = document.getElementById('global-search');
    let searchTimeout;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = e.target.value.toLowerCase();
            if (currentWorkspace === 'tasks') {
                filterTasks(query);
            } else if (currentWorkspace === 'projects') {
                filterProjects(query);
            }
        }, 300);
    });
}

async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function showModal(content) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal">${content}</div>`;

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });

    document.body.appendChild(overlay);
    return overlay;
}

function closeModal(overlay) {
    if (overlay) {
        overlay.remove();
    }
}

function loadDashboardWorkspace() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="workspace-header">
            <h2>Dashboard</h2>
            <p>Welcome back, ${currentUser.name}!</p>
        </div>
        
        <!-- Quick Clock-In Widget -->
        <div id="clock-in-widget"></div>
        
        <!-- Stat Cards -->
        <div class="dashboard-stats">
            <div id="stat-cards" class="stat-cards-grid"></div>
        </div>
        
        <!-- Main Content Grid -->
        <div class="dashboard-grid">
            <!-- Upcoming Tasks -->
            <div class="dashboard-card">
                <div class="dashboard-card-header">
                    <h3>📅 Upcoming Tasks</h3>
                    <span class="card-subtitle">Next 7 days</span>
                </div>
                <div id="upcoming-tasks" class="task-list"></div>
            </div>
            
            <!-- Task Status Chart -->
            <div class="dashboard-card">
                <div class="dashboard-card-header">
                    <h3>📊 Task Status</h3>
                    <span class="card-subtitle">Overview</span>
                </div>
                <div id="status-chart" class="chart-container"></div>
            </div>
            
            <!-- Completed Tasks -->
            <div class="dashboard-card">
                <div class="dashboard-card-header">
                    <h3>✅ Recently Completed</h3>
                    <span class="card-subtitle">Last 10 tasks</span>
                </div>
                <div id="completed-tasks" class="task-list"></div>
            </div>
            
            <!-- Priority Breakdown -->
            <div class="dashboard-card">
                <div class="dashboard-card-header">
                    <h3>🎯 Priority Breakdown</h3>
                    <span class="card-subtitle">By priority level</span>
                </div>
                <div id="priority-chart" class="chart-container"></div>
            </div>
        </div>
    `;

    // Initialize dashboard after DOM is ready
    if (typeof initDashboard === 'function') {
        initDashboard();
    }
}

function loadAttendanceWorkspace() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="workspace-header">
            <h2>Attendance</h2>
            <p>Track your work hours and attendance</p>
        </div>
        
        <div id="attendance-widget"></div>
        
        <div class="attendance-history">
            <h3>Attendance History</h3>
            <table class="data-table" id="history-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Clock In</th>
                        <th>Clock Out</th>
                        <th>Duration</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td colspan="5" style="text-align: center; padding: 2rem;">Loading...</td></tr>
                </tbody>
            </table>
        </div>
        
        <div id="admin-section" style="display: none; margin-top: 2rem;">
            <h3>Team Attendance Today</h3>
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
                    <tr><td colspan="6" style="text-align: center; padding: 2rem;">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    // Initialize attendance after DOM is ready
    if (typeof initAttendance === 'function') {
        console.log('Calling initAttendance from app.js');
        initAttendance();
    } else {
        console.error('initAttendance function not found!');
        showError('Application Error: Attendance module failed to load. Please refresh the page.');
    }
}

function showError(message) {
    alert(message); // Simple error handling
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initApp);
