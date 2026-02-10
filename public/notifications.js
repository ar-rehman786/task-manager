// Notification System

let socket;
let audioContext;
let notificationCount = 0; // Fix: Initialize global variable

// Sound assets (Base64 encoded short beeps/sounds to avoid external dependencies for now)
// In a real production app, these would be proper .mp3 files loaded from /assets/sounds/
const SOUNDS = {
    new_task: 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU...', // Placeholder
    success: 'data:audio/wav;base64,...',
    alert: 'data:audio/wav;base64,...'
};

// Sound assets (Base64 encoded short beeps/sounds)
// Replaced by the function below using AudioContext directly

// Request audio permission interaction (kept as not explicitly removed)
document.addEventListener('click', () => {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContext.resume();
    }
}, { once: true });

document.addEventListener('DOMContentLoaded', () => {
    initNotifications();
});

async function initNotifications() {
    // Connect to Socket.io
    socket = io();

    // Attach click listener manually to ensure it works
    const bell = document.querySelector('.notification-bell');
    if (bell) {
        console.log('Notification bell found, attaching listener');
        bell.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent bubbling
            toggleNotifications();
        });
    } else {
        console.error('Notification bell NOT found in DOM');
    }

    // Request notification permission immediately
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('System notifications granted!');
                new Notification('Task Manager', { body: 'Notifications enabled!' });
            }
        });
    }

    // Join user room
    try {
        console.log('[DEEP_DEBUG] Fetching /api/auth/me...');
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            const user = await res.json();
            console.log(`[DEEP_DEBUG] User identified: ${user.id}. Joining room...`);
            socket.emit('join', user.id);
        } else {
            console.error('[DEEP_DEBUG] Failed to auth for notifications');
        }
    } catch (e) {
        console.error('Failed to join notification room', e);
    }

    // Listen for notifications
    socket.on('notification', (data) => {
        console.log(`[DEEP_DEBUG] RECEIVED NOTIFICATION:`, data);
        playNotificationSound(data.type);
        showToast(data.message, data.type, data.data); // data.data contains the payload like taskId
        showSystemNotification(data); // Add system notification support
        addNotificationToDropdown(data);
        incrementBadge();
    });

    // Load history
    await loadNotificationHistory();
}

async function loadNotificationHistory() {
    try {
        const res = await fetch('/api/notifications');

        // DEBUG: Check for server error
        if (!res.ok) {
            const errorText = await res.text();
            console.error('CRITICAL NOTIFICATION ERROR:', errorText);
            // Try to parse as JSON for cleaner logging
            try {
                const jsonErr = JSON.parse(errorText);
                console.error('Server Reason:', jsonErr.error || jsonErr.message);
            } catch (e) { }
            return;
        }

        const notifications = await res.json();

        // Safety check
        if (!Array.isArray(notifications)) {
            console.error('Expected array but got:', notifications);
            return;
        }

        const list = document.getElementById('notification-list');
        if (!list) return;

        list.innerHTML = '';
        if (notifications.length === 0) {
            list.innerHTML = '<div class="notification-empty">No notifications</div>';
        } else {
            notifications.forEach(n => addNotificationToDropdown(n));
        }

    } catch (error) {
        console.error('Error loading notifications', error);
    }
}



function addNotificationToDropdown(n) {
    const list = document.getElementById('notification-list');
    const empty = list.querySelector('.notification-empty');
    if (empty) empty.remove();

    const item = createNotificationItem(n);
    list.insertBefore(item, list.firstChild);
}

function updateBadge(count) {
    notificationCount = count;
    const badge = document.getElementById('notification-badge');
    if (badge) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

function incrementBadge() {
    updateBadge(notificationCount + 1);
}

function markAllRead() {
    fetch('/api/notifications/read', { method: 'PUT' });
    notificationCount = 0;
    updateBadge(0);
    document.querySelectorAll('.notification-item.unread').forEach(el => {
        el.classList.remove('unread');
        el.classList.add('read');
    });
}

function toggleNotifications() {
    console.log('Toggling notifications dropdown');
    const dropdown = document.getElementById('notification-dropdown');
    if (!dropdown) return console.error('Dropdown not found');

    dropdown.classList.toggle('show');
    if (dropdown.classList.contains('show') && notificationCount > 0) {
        markAllRead();
    }
}

// ... Helper functions (playNotificationSound, showToast, getIconForType, formatTimeAgo) ...
function playNotificationSound(type) {
    // Simple beep sound (Base64) to avoid missing file issues
    const audioSrc = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU';
    // This is a very short placeholder. For a real sound, we'd need a longer string.
    // Let's use a slightly longer one for a "pop" sound effect.
    const popSound = 'data:audio/mpeg;base64,//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';

    // Better approach: Use the browser's AudioContext for a synthesized beep if file fails
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = type === 'error' ? 'sawtooth' : 'sine';
    oscillator.frequency.setValueAtTime(type === 'error' ? 150 : 500, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(type === 'error' ? 100 : 300, audioContext.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
}



// Original createToastContainer is now unused
// function createToastContainer() {
//     const container = document.createElement('div');
//     container.id = 'toast-container';
//     document.body.appendChild(container);
//     return container;
// }

function getIconForType(type) {
    if (type === 'success') return '✅';
    if (type === 'error') return '❌';
    if (type === 'warning') return '⚠️';
    // Original icons for specific types are now unused
    // switch (type) {
    //     case 'new_task': return '📋';
    //     case 'task_update': return '📝';
    //     case 'new_member': return '👋';
    //     case 'attendance': return '⏰';
    //     case 'alert': return '⚠️';
    //     default: return '📢';
    // }
    return 'ℹ️';
}

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
}

function showSystemNotification(data) {
    if (!('Notification' in window)) {
        console.log('This browser does not support system notifications');
        return;
    }

    if (Notification.permission === 'granted') {
        const notification = new Notification('Task Manager', {
            body: data.message,
            tag: 'task-manager-notification'
        });

        notification.onclick = function () {
            window.focus();
            notification.close();
            handleNotificationClick(data);
        };
    }
}

// Handle notification click to open task
function handleNotificationClick(n) {
    let taskId = null;
    try {
        const data = typeof n.data === 'string' ? JSON.parse(n.data) : n.data;
        if (data && data.taskId) {
            taskId = data.taskId;
        }
    } catch (e) {
        console.error('Error parsing notification data', e);
    }

    if (taskId && window.showTaskDetails) {
        window.showTaskDetails(taskId);
    } else if (taskId) {
        console.warn('showTaskDetails not available, navigating to tasks...');
        // Fallback: navigate to tasks and let it handle opening
        sessionStorage.setItem('openTaskId', taskId);
        loadWorkspace('tasks'); // Assuming loadWorkspace is global from app.js
    }
}

function createNotificationItem(n) {
    const div = document.createElement('div');
    div.className = `notification-item ${n.isRead ? 'read' : 'unread'}`;
    div.style.cursor = 'pointer'; // Make clickable
    div.onclick = () => handleNotificationClick(n); // Add click handler

    div.innerHTML = `
        <div class="notification-icon ${n.type}">
            ${getIconForType(n.type)}
        </div>
        <div class="notification-content">
            <p class="notification-message">${n.message}</p>
            <span class="notification-time">${formatTimeAgo(n.createdAt)}</span>
        </div>
    `;
    return div;
}

// ... inside showToast ...
function showToast(message, type = 'info', data = null) {
    // Use existing toast logic or create new
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Add click handling if data exists
    if (data) {
        toast.style.cursor = 'pointer';
        toast.onclick = () => handleNotificationClick({ data });
    }

    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }, 100);
}

// Expose global for onclick
window.toggleNotifications = toggleNotifications;

// Add styles dynamically
const style = document.createElement('style');
style.textContent = `
    #toast-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .toast {
        background: var(--bg-secondary, #1e293b);
        color: var(--text-primary, #f1f5f9);
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        display: flex;
        justify-content: space-between;
        align-items: center;
        min-width: 300px;
        border-left: 4px solid var(--primary, #6366f1);
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease-out;
        cursor: pointer;
    }
    .toast.show {
        opacity: 1;
        transform: translateX(0);
    }
    
    /* Toast type colors */
    .toast-success {
        border-left-color: #10b981;
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), var(--bg-secondary, #1e293b));
    }
    .toast-error {
        border-left-color: #ef4444;
        background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), var(--bg-secondary, #1e293b));
    }
    .toast-warning {
        border-left-color: #f59e0b;
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), var(--bg-secondary, #1e293b));
    }
    .toast-info {
        border-left-color: #6366f1;
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), var(--bg-secondary, #1e293b));
    }
    
    .toast-content {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .toast-close {
        background: transparent;
        border: none;
        color: var(--text-muted, #94a3b8);
        cursor: pointer;
        font-size: 1.25rem;
    }
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(style);

// Init on load
document.addEventListener('DOMContentLoaded', initNotifications);
