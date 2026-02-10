// Team members management (admin only)
let teamMembers = [];

async function loadTeamWorkspace() {
  if (currentUser.role !== 'admin') {
    showError('Access denied');
    return;
  }

  const contentArea = document.getElementById('content-area');

  contentArea.innerHTML = `
    <div class="board-header">
      <h2 class="board-title">Team Members</h2>
      <div class="board-actions">
        <button class="btn btn-primary" id="add-member-btn">+ Add Member</button>
      </div>
    </div>
    <div id="team-members-list"></div>
  `;

  await loadTeamMembers();
  renderTeamMembers();

  document.getElementById('add-member-btn').addEventListener('click', showAddMember);
}

async function loadTeamMembers() {
  const response = await fetch('/api/users');
  teamMembers = await response.json();
}

function renderTeamMembers() {
  const container = document.getElementById('team-members-list');

  container.innerHTML = `
    <div style="display: grid; gap: 1rem;">
// Render team members
function renderTeamMembers(users) {
    const tbody = document.getElementById('team-table-body');
    if (!tbody) return; // Guard clause

    tbody.innerHTML = users.map(user => `
    < tr >
            <td>
                <div class="user-info">
                    <div class="user-avatar">${user.name.charAt(0)}</div>
                    <div>
                        <div class="user-name">${user.name}</div>
                        <div class="user-email">${user.email}</div>
                    </div>
                </div>
            </td>
            <td><span class="badge badge-${user.role === 'admin' ? 'primary' : 'secondary'}">${user.role}</span></td>
            <td><span class="badge badge-${user.active ? 'success' : 'danger'}">${user.active ? 'Active' : 'Inactive'}</span></td>
            <td>${new Date(user.createdAt).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editUser(${user.id})">Edit</button>
            </td>
        </tr >
    `).join('');
}

function showAddMember() {
  const modalContent = `
    < div class="modal-header" >
      <h3 class="modal-title">Add Team Member</h3>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div >
    <form id="add-member-form">
      <div class="form-group">
        <label class="form-label">Name *</label>
        <input type="text" class="form-input" id="member-name" required>
      </div>
      <div class="form-group">
        <label class="form-label">Email *</label>
        <input type="email" class="form-input" id="member-email" required>
      </div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <input type="password" class="form-input" id="member-password" placeholder="Default: member123">
          <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
            Leave blank to use default password: member123
          </p>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button type="submit" class="btn btn-primary">Add Member</button>
      </div>
    </form>
  `;

  const modal = showModal(modalContent);

  document.getElementById('add-member-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const memberData = {
      name: document.getElementById('member-name').value,
      email: document.getElementById('member-email').value,
      password: document.getElementById('member-password').value || 'member123'
    };

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberData)
      });

      if (response.ok) {
        const newMember = await response.json();
        teamMembers.push(newMember);
        renderTeamMembers();
        closeModal(modal);

        // Reload boards to show new member board
        if (currentWorkspace === 'tasks') {
          await loadBoards();
          renderBoardTabs();
        }
      } else {
        let errorMessage = 'Failed to add member';
        try {
          const error = await response.json();
          errorMessage = error.error || error.message || errorMessage;
        } catch (e) {
          console.error('Non-JSON response');
          errorMessage += ' (Server Error)';
        }
        showError(errorMessage);
      }
    } catch (error) {
      console.error('Add member error:', error);
      showError('Error: ' + error.message);
    }
  });
}

async function deactivateMember(memberId, memberName) {
  if (!confirm(`Are you sure you want to deactivate ${ memberName }? Their tasks will become unassigned.`)) {
    return;
  }

  try {
    const response = await fetch(`/ api / users / ${ memberId } `, {
      method: 'DELETE'
    });

    if (response.ok) {
      teamMembers = teamMembers.filter(m => m.id !== memberId);
      renderTeamMembers();

      // Reload tasks if in tasks workspace
      if (currentWorkspace === 'tasks') {
        await loadTasks();
        renderTasks();
      }
    }
  } catch (error) {
    console.error('Deactivate member error:', error);
    showError('Failed to deactivate member');
  }
}
