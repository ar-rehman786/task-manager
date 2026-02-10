// Notification System

let socket;
let audioContext;

// Sound assets (Base64 encoded short beeps/sounds to avoid external dependencies for now)
// In a real production app, these would be proper .mp3 files loaded from /assets/sounds/
const SOUNDS = {
    new_task: 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU...', // Placeholder
    success: 'data:audio/wav;base64,...',
    alert: 'data:audio/wav;base64,...'
};

// We will use the Web Audio API for synthetic beeps if files are missing
const playBeep = (freq = 440, type = 'sine', duration = 0.1) => {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + duration);
    osc.stop(audioContext.currentTime + duration);
};

const playNotificationSound = (type) => {
    // Mapping events to sounds
    switch (type) {
        case 'new_task': playBeep(523.25, 'sine', 0.2); break; // C5
        case 'task_update': playBeep(440, 'sine', 0.1); break; // A4
        case 'new_member': playBeep(659.25, 'triangle', 0.3); break; // E5
        case 'attendance': playBeep(329.63, 'square', 0.15); break; // E4
        case 'alert': playBeep(880, 'sawtooth', 0.3); break; // A5
        default: playBeep(440, 'sine', 0.1);
    }
};

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

    // Join user room
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            const user = await res.json();
            socket.emit('join', user.id);
        }
    } catch (e) {
        console.error('Failed to join notification room', e);
    }

    // Listen for notifications
    socket.on('notification', (data) => {
        playNotificationSound(data.type);
        showToast(data.message, data.type);
        addNotificationToDropdown(data);
        incrementBadge();
    });

    // Load history
    await loadNotificationHistory();
}

async function loadNotificationHistory() {
    try {
        const res = await fetch('/api/notifications');
        const notifications = await res.json();

        const list = document.getElementById('notification-list');
        if (!list) return;

        list.innerHTML = '';
        let unreadCount = 0;

        if (notifications.length === 0) {
            list.innerHTML = '<div class="notification-empty">No notifications</div>';
        } else {
            notifications.forEach(n => {
                const item = createNotificationItem(n);
                list.appendChild(item);
                if (!n.isRead) unreadCount++;
            });
        }

        updateBadge(unreadCount);

    } catch (e) {
        console.error('Error loading notifications', e);
    }
}

function createNotificationItem(n) {
    const div = document.createElement('div');
    div.className = `notification-item ${n.isRead ? 'read' : 'unread'}`;
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
    const dropdown = document.getElementById('notification-dropdown');
    dropdown.classList.toggle('show');
    if (dropdown.classList.contains('show') && notificationCount > 0) {
        markAllRead();
    }
}

// ... Helper functions (playNotificationSound, showToast, getIconForType, formatTimeAgo) ...
function playNotificationSound(type) {
    const audio = new Audio(type === 'error' ? '/assets/error.mp3' : '/assets/notification.mp3');
    audio.play().catch(e => console.log('Audio play failed', e));
}

function showToast(message, type = 'info') {
    // Use existing toast logic or create new
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }, 100);
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
        animation: slideIn 0.3s ease-out;
        transition: opacity 0.3s ease;
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
