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

function initNotifications() {
    // Connect to Socket.io
    socket = io();

    socket.on('connect', () => {
        console.log('Connected to notification service');
    });

    socket.on('notification', (data) => {
        console.log('Notification received:', data);
        showToast(data.message, data.type);
        playNotificationSound(data.type);
    });

    // Request audio permission interaction
    document.addEventListener('click', () => {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            audioContext.resume();
        }
    }, { once: true });
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container') || createToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">${getIconForType(type)}</span>
            <span class="toast-message">${message}</span>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
    return container;
}

function getIconForType(type) {
    switch (type) {
        case 'new_task': return '📋';
        case 'task_update': return '📝';
        case 'new_member': return '👋';
        case 'attendance': return '⏰';
        case 'alert': return '⚠️';
        default: return '📢';
    }
}

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
