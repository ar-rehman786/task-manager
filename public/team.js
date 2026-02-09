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
      ${teamMembers.map(member => `
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.25rem;">${member.name}</h3>
              <p style="color: var(--text-secondary); font-size: 0.875rem;">${member.email}</p>
              <span style="display: inline-block; margin-top: 0.5rem; padding: 0.25rem 0.75rem; background: ${member.role === 'admin' ? 'var(--primary)' : 'var(--bg-tertiary)'}; border-radius: var(--radius-sm); font-size: 0.75rem; font-weight: 600;">
                ${member.role}
              </span>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              ${member.role !== 'admin' ? `
                <button class="btn btn-danger btn-sm" onclick="deactivateMember(${member.id}, '${member.name}')">
                  Deactivate
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function showAddMember() {
    const modalContent = `
    <div class="modal-header">
      <h3 class="modal-title">Add Team Member</h3>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
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
                const error = await response.json();
                showError(error.error || 'Failed to add member');
            }
        } catch (error) {
            console.error('Add member error:', error);
            showError('Failed to add member');
        }
    });
}

async function deactivateMember(memberId, memberName) {
    if (!confirm(`Are you sure you want to deactivate ${memberName}? Their tasks will become unassigned.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/users/${memberId}`, {
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
