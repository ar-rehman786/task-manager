// Profile Management

// Elements
const profileView = document.getElementById('profile-view');
let isEditing = false;
let userProfile = null; // Store current user data

async function initProfile() {
    renderProfileSkeleton();
    await loadUserProfile();
}

async function loadUserProfile() {
    try {
        const response = await fetch('/api/auth/me');
        userProfile = await response.json();
        renderProfile(userProfile);
    } catch (error) {
        console.error('Failed to load profile:', error);
        showError('Could not load profile data');
    }
}

function renderProfileSkeleton() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = '<div class="profile-loading">Loading profile...</div>';
}

function renderProfile(user) {
    const contentArea = document.getElementById('content-area');

    // Default images
    const coverImage = user.coverImage || '/assets/default-cover.jpg'; // We need a default
    const profilePic = user.profilePicture || `https://ui-avatars.com/api/?name=${user.name}&background=random`;

    contentArea.innerHTML = `
        <div class="profile-container">
            <!-- Hero Section -->
            <div class="profile-hero" style="background-image: url('${coverImage}');">
                <button class="btn-edit-cover" onclick="triggerFileInput('cover-upload')">📷 Edit Cover</button>
                <input type="file" id="cover-upload" hidden accept="image/*" onchange="previewImage(this, 'hero-bg')">
            </div>

            <!-- Header Section -->
            <div class="profile-header">
                <div class="profile-avatar-container">
                    <img src="${profilePic}" alt="Profile" class="profile-avatar" id="avatar-preview">
                    <button class="btn-edit-avatar" onclick="triggerFileInput('avatar-upload')">✏️</button>
                    <input type="file" id="avatar-upload" hidden accept="image/*" onchange="previewImage(this, 'avatar-img')">
                </div>

                <div class="profile-info-primary">
                    <div class="profile-name-row">
                        <h1>${user.name}</h1>
                        <span class="status-badge status-${user.active ? 'active' : 'inactive'}">
                            ${user.active ? 'ACTIVE' : 'AWAY'}
                        </span>
                    </div>
                    <p class="profile-title">🔒 ${user.title || 'Team Member'}</p>
                </div>
            </div>

            <!-- Info Bar -->
            <div class="profile-info-bar">
                <div class="info-item">
                    <span class="icon">📧</span> ${user.email}
                </div>
                <div class="info-item">
                    <span class="icon">📞</span> ${user.phone || 'No phone added'}
                </div>
                <div class="info-item">
                    <span class="icon">📍</span> ${user.location || 'Remote'}
                </div>
                <div class="info-item">
                    <span class="icon">🆔</span> ${user.employeeId || 'ID: N/A'}
                </div>
             </div>

            <!-- Tabs -->
             <div class="profile-tabs">
                <button class="tab-btn active" onclick="switchProfileTab('about')">ABOUT</button>
                <button class="tab-btn" onclick="switchProfileTab('job')">JOB</button>
                <button class="tab-btn" onclick="switchProfileTab('assets')">ASSETS</button>
             </div>

             <!-- Tab Content -->
             <div class="profile-tab-content" id="tab-about">
                <div class="card profile-card">
                    <div class="card-header">
                        <h3>Personal Details</h3>
                        <button class="btn btn-primary btn-sm" onclick="toggleEditProfile()">
                            ${isEditing ? 'Save Changes' : 'Edit Profile'}
                        </button>
                    </div>
                    <div class="card-body">
                        <form id="profile-form" class="profile-form ${isEditing ? 'editing' : 'view-only'}">
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Full Name</label>
                                    <input type="text" name="name" value="${user.name}" ${isEditing ? '' : 'readonly'}>
                                </div>
                                <div class="form-group">
                                    <label>Job Title</label>
                                    <input type="text" name="title" value="${user.title || ''}" ${isEditing ? '' : 'readonly'}>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Department</label>
                                    <input type="text" name="department" value="${user.department || ''}" ${isEditing ? '' : 'readonly'}>
                                </div>
                                <div class="form-group">
                                    <label>Reporting Manager</label>
                                    <select name="managerId" ${isEditing ? '' : 'disabled'}>
                                        <option value="${user.managerId || ''}">${user.managerName || 'Select Manager'}</option>
                                        <!-- Will be populated dynamicall if editing -->
                                    </select>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Phone</label>
                                    <input type="text" name="phone" value="${user.phone || ''}" ${isEditing ? '' : 'readonly'}>
                                </div>
                                <div class="form-group">
                                    <label>Location</label>
                                    <input type="text" name="location" value="${user.location || ''}" ${isEditing ? '' : 'readonly'}>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Employee ID</label>
                                    <input type="text" name="employeeId" value="${user.employeeId || ''}" ${isEditing ? '' : 'readonly'}>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
             </div>
        </div>
    `;
}

function triggerFileInput(id) {
    if (!isEditing) {
        if (!confirm('Enter edit mode to change images?')) return;
        toggleEditProfile();
    }
    document.getElementById(id).click();
}

function previewImage(input, type) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            if (type === 'hero-bg') {
                document.querySelector('.profile-hero').style.backgroundImage = `url(${e.target.result})`;
            } else {
                document.getElementById('avatar-preview').src = e.target.result;
            }
        }
        reader.readAsDataURL(input.files[0]);
    }
}

async function toggleEditProfile() {
    isEditing = !isEditing;
    const form = document.getElementById('profile-form');
    const inputs = form.querySelectorAll('input, select');
    const btn = document.querySelector('.card-header .btn-primary');

    if (isEditing) {
        // Enabe inputs
        form.classList.remove('view-only');
        form.classList.add('editing');
        inputs.forEach(input => input.removeAttribute('readonly'));
        inputs.forEach(select => select.removeAttribute('disabled'));
        btn.textContent = 'Save Changes';

        // Load managers for select
        if (document.querySelector('select[name="managerId"]').children.length <= 1) {
            await loadManagers();
        }

    } else {
        // Save Changes
        await saveProfile();
    }
}

async function loadManagers() {
    try {
        const res = await fetch('/api/users');
        const users = await res.json();
        const select = document.querySelector('select[name="managerId"]');
        const currentManagerId = select.value;

        select.innerHTML = '<option value="">None</option>';
        users.forEach(u => {
            if (u.id !== userProfile.id) { // Can't report to self
                select.innerHTML += `<option value="${u.id}" ${u.id == currentManagerId ? 'selected' : ''}>${u.name}</option>`;
            }
        });
    } catch (e) {
        console.error('Error loading managers', e);
    }
}

async function saveProfile() {
    const form = document.getElementById('profile-form');
    const formData = new FormData(form);

    // Add files
    const avatarInput = document.getElementById('avatar-upload');
    const coverInput = document.getElementById('cover-upload');

    if (avatarInput.files[0]) formData.append('profilePicture', avatarInput.files[0]);
    if (coverInput.files[0]) formData.append('coverImage', coverInput.files[0]);

    // Add other fields manually if FormData doesn't pick them up from disabled inputs (wait, they are enabled now)
    // But we need to map names correctly to what API expects.
    // The inputs have name="title", etc which matches.

    try {
        const response = await fetch('/api/users/profile', {
            method: 'PUT',
            body: formData // Fetch handles Content-Type for FormData automatically
        });

        if (response.ok) {
            const updatedUser = await response.json();
            userProfile = updatedUser;
            isEditing = false;
            renderProfile(updatedUser); // Re-render to lock fields
            showToast('Profile updated successfully', 'success');
        } else {
            const err = await response.json();
            showError(err.error || 'Failed to update profile');
            // Revert state if failed?
            isEditing = true; // Keep editing
        }
    } catch (error) {
        console.error(error);
        showError('Server error updating profile');
    }
}

function switchProfileTab(tab) {
    // Determine content... for now just visual switch
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    // Future: Hide/Show different tab content divs
}
