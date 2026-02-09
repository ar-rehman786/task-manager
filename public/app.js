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

        // Load initial workspace
        loadWorkspace('tasks');
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
            }
        });
    });
}

function loadWorkspace(workspace) {
    currentWorkspace = workspace;
    const contentArea = document.getElementById('content-area');

    switch (workspace) {
        case 'tasks':
            loadTasksWorkspace();
            break;
        case 'projects':
            loadProjectsWorkspace();
            break;
        case 'team':
            if (currentUser.role === 'admin') {
                loadTeamWorkspace();
            }
            break;
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

function showError(message) {
    alert(message); // Simple error handling
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initApp);
