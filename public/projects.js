// Projects workspace state
let allProjects = [];
let currentProject = null;

console.log('Projects JS loaded');

async function loadProjectsWorkspace() {
  console.log('loadProjectsWorkspace called');
  const contentArea = document.getElementById('content-area');

  try {
    contentArea.innerHTML = `
    <div class="board-header">
      <h2 class="board-title">Projects</h2>
      <div class="board-actions">
        ${currentUser.role === 'admin' ? '<button class="btn btn-primary" id="create-project-btn">+ New Project</button>' : ''}
      </div>
    </div>
    <div class="projects-grid" id="projects-grid"></div>
  `;

    await loadProjects();
    renderProjects();

    if (currentUser.role === 'admin') {
      const createBtn = document.getElementById('create-project-btn');
      if (createBtn) createBtn.addEventListener('click', showCreateProject);
    }
  } catch (error) {
    console.error('Error loading projects workspace:', error);
    contentArea.innerHTML = '<div style="padding: 2rem; color: red;">Error loading projects. Check console.</div>';
  }
}

async function loadProjects() {
  const response = await fetch('/api/projects');
  allProjects = await response.json();
}

async function renderProjects() {
  const grid = document.getElementById('projects-grid');

  if (allProjects.length === 0) {
    grid.innerHTML = '<p style="color: var(--text-secondary);">No projects yet. Create one to get started!</p>';
    return;
  }

  // Load access items for all projects to show pending status
  const projectsWithAccess = await Promise.all(
    allProjects.map(async (project) => {
      const accessItems = await fetch(`/api/projects/${project.id}/access`).then(r => r.json());
      const totalAccess = accessItems.length;
      const grantedAccess = accessItems.filter(a => a.isGranted).length;
      return {
        ...project,
        accessPending: totalAccess > 0 && grantedAccess < totalAccess
      };
    })
  );

  grid.innerHTML = projectsWithAccess.map(project => `
    <div class="project-card" onclick="showProjectDetail(${project.id})">
      <div class="project-header">
        <div class="project-name">${project.name}</div>
        <span class="project-status ${project.status}">${project.status.replace('_', ' ')}</span>
      </div>
      ${project.accessPending ? '<div style="padding: 0.5rem; background: rgba(245, 158, 11, 0.1); border: 1px solid var(--warning); border-radius: var(--radius-sm); margin-top: 0.75rem; color: var(--warning); font-size: 0.75rem; font-weight: 600;">⚠️ Access Pending from Client</div>' : ''}
      ${project.client ? `<div class="project-client">Client: ${project.client}</div>` : ''}
      ${project.managerName ? `<div class="project-manager" style="font-size: 0.875rem; color: var(--text-muted); margin-top: 0.25rem;">Manager: 👤 ${project.managerName}</div>` : ''}
      ${project.description ? `<p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">${project.description}</p>` : ''}
      <div class="project-dates">
        <span>Start: ${formatDate(project.startDate)}</span>
        <span>End: ${formatDate(project.endDate)}</span>
      </div>
    </div>
  `).join('');
}

function filterProjects(query) {
  if (!query) {
    renderProjects();
    return;
  }

  const filtered = allProjects.filter(p =>
    p.name.toLowerCase().includes(query) ||
    (p.client && p.client.toLowerCase().includes(query)) ||
    (p.description && p.description.toLowerCase().includes(query))
  );

  const originalProjects = allProjects;
  allProjects = filtered;
  renderProjects();
  allProjects = originalProjects;
}

function showCreateProject() {
  const modalContent = `
    <div class="modal-header">
      <h3 class="modal-title">Create New Project</h3>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    <form id="create-project-form">
      <div class="form-group">
        <label class="form-label">Project Name *</label>
        <input type="text" class="form-input" id="project-name" required>
      </div>
      <div class="form-group">
        <label class="form-label">Client</label>
        <input type="text" class="form-input" id="project-client">
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" id="project-status">
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Project Manager</label>
        <select class="form-select" id="project-manager">
          <option value="">Unassigned</option>
          <!-- Users will be populated here -->
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Start Date</label>
        <input type="date" class="form-input" id="project-start-date">
      </div>
      <div class="form-group">
        <label class="form-label">Target End Date</label>
        <input type="date" class="form-input" id="project-end-date">
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="project-description"></textarea>
      </div>
      
      <div class="form-group" style="padding-top: 1rem; border-top: 1px solid var(--border-color);">
        <label class="form-label">Initial Tasks (Optional)</label>
        <div id="initial-tasks-container"></div>
        <button type="button" class="btn btn-secondary btn-sm" id="add-initial-task-btn" style="margin-top: 0.5rem;">+ Add Task</button>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create Project</button>
      </div>
    </form>
  `;

  const modal = showModal(modalContent);

  // Load users for manager dropdown
  fetch('/api/users')
    .then(r => r.json())
    .then(users => {
      const select = document.getElementById('project-manager');
      if (select) {
        select.innerHTML = '<option value="">Unassigned</option>' +
          users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
      }
    });

  // Handle Initial Tasks UI
  const tasksContainer = document.getElementById('initial-tasks-container');
  const addTaskBtn = document.getElementById('add-initial-task-btn');

  addTaskBtn.addEventListener('click', () => {
    const taskItem = document.createElement('div');
    taskItem.className = 'initial-task-item';
    taskItem.style.marginBottom = '0.5rem';
    taskItem.style.display = 'flex';
    taskItem.style.gap = '0.5rem';
    taskItem.innerHTML = `
      <input type="text" class="form-input task-title-input" placeholder="Task Title" required style="flex: 2;">
      <select class="form-select task-priority-input" style="flex: 1;">
        <option value="low">Low</option>
        <option value="medium" selected>Medium</option>
        <option value="high">High</option>
      </select>
      <button type="button" class="btn btn-danger btn-sm remove-task-btn">×</button>
    `;

    taskItem.querySelector('.remove-task-btn').addEventListener('click', () => {
      taskItem.remove();
    });

    tasksContainer.appendChild(taskItem);
  });

  document.getElementById('create-project-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Collect initial tasks
    const initialTasks = [];
    document.querySelectorAll('.initial-task-item').forEach(item => {
      const title = item.querySelector('.task-title-input').value;
      const priority = item.querySelector('.task-priority-input').value;
      if (title) {
        initialTasks.push({ title, priority });
      }
    });

    const projectData = {
      name: document.getElementById('project-name').value,
      client: document.getElementById('project-client').value,
      status: document.getElementById('project-status').value,
      startDate: document.getElementById('project-start-date').value,
      endDate: document.getElementById('project-end-date').value,
      description: document.getElementById('project-description').value,
      managerId: document.getElementById('project-manager').value || null,
      initialTasks: initialTasks
    };

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      });

      if (response.ok) {
        const newProject = await response.json();
        allProjects.unshift(newProject);
        renderProjects();
        closeModal(modal);
      }
    } catch (error) {
      console.error('Create project error:', error);
      showError('Failed to create project');
    }
  });
}

async function showProjectDetail(projectId) {
  currentProject = allProjects.find(p => p.id === projectId);
  if (!currentProject) return;

  // Load milestones, logs, and access items
  const [milestones, logs, accessItems] = await Promise.all([
    fetch(`/api/projects/${projectId}/milestones`).then(r => r.json()),
    fetch(`/api/projects/${projectId}/logs`).then(r => r.json()),
    fetch(`/api/projects/${projectId}/access`).then(r => r.json())
  ]);

  // Load checklist items for each milestone
  for (let milestone of milestones) {
    milestone.checklist = await fetch(`/api/milestones/${milestone.id}/checklist`).then(r => r.json());
  }

  // Calculate progress
  const totalMilestones = milestones.length;
  const completedMilestones = milestones.filter(m => m.status === 'done').length;
  const progress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  // Check access status
  const totalAccess = accessItems.length;
  const grantedAccess = accessItems.filter(a => a.isGranted).length;
  const accessPending = totalAccess > 0 && grantedAccess < totalAccess;

  const contentArea = document.getElementById('content-area');
  contentArea.innerHTML = `
    <div class="board-header">
      <button class="btn btn-secondary" onclick="loadProjectsWorkspace()">← Back to Projects</button>
      <div class="board-actions">
        ${currentUser.role === 'admin' ? '<button class="btn btn-primary" id="edit-project-btn">Edit Project</button>' : ''}
      </div>
    </div>

    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
        <div>
          <h2 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 0.5rem;">${currentProject.name}</h2>
          ${currentProject.client ? `<p style="color: var(--text-secondary);">Client: ${currentProject.client}</p>` : ''}
        </div>
        <span class="project-status ${currentProject.status}">${currentProject.status.replace('_', ' ')}</span>
      </div>
      
      ${currentProject.description ? `<p style="color: var(--text-secondary); margin-bottom: 1rem;">${currentProject.description}</p>` : ''}
      
      <div style="display: flex; gap: 2rem; font-size: 0.875rem; color: var(--text-muted);">
        <span>Start: ${formatDate(currentProject.startDate)}</span>
        <span>Target End: ${formatDate(currentProject.endDate)}</span>
      </div>

      <div style="margin-top: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <span style="font-weight: 600;">Overall Progress</span>
          <span style="color: var(--primary); font-weight: 600;">${progress}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
      </div>
    </div>

    <div class="card mt-2">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.25rem; font-weight: 700;">Milestones</h3>
        ${currentUser.role === 'admin' ? '<button class="btn btn-primary btn-sm" id="add-milestone-btn">+ Add Milestone</button>' : ''}
      </div>
      <div class="milestone-list" id="milestone-list"></div>
    </div>

    <div class="card mt-2">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.25rem; font-weight: 700;">Client Access Required</h3>
        ${currentUser.role === 'admin' ? '<button class="btn btn-primary btn-sm" id="add-access-btn">+ Add Access Item</button>' : ''}
      </div>
      ${accessPending ? '<div style="padding: 0.75rem; background: rgba(245, 158, 11, 0.1); border: 1px solid var(--warning); border-radius: var(--radius-md); margin-bottom: 1rem; color: var(--warning); font-weight: 600;">⚠️ Access Pending from Client (${grantedAccess}/${totalAccess} granted)</div>' : ''}
      <div id="access-list"></div>
    </div>

    <div class="card mt-2">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.25rem; font-weight: 700;">Progress Logs</h3>
        ${currentUser.role === 'admin' ? '<button class="btn btn-primary btn-sm" id="add-log-btn">+ Add Log</button>' : ''}
      </div>
      <div id="logs-list"></div>
    </div>
  `;

  renderMilestones(milestones);
  renderAccessItems(accessItems);
  renderLogs(logs);

  if (currentUser.role === 'admin') {
    document.getElementById('edit-project-btn')?.addEventListener('click', () => showEditProject(projectId));
    document.getElementById('add-milestone-btn')?.addEventListener('click', () => showAddMilestone(projectId));
    document.getElementById('add-access-btn')?.addEventListener('click', () => showAddAccessItem(projectId));
    document.getElementById('add-log-btn')?.addEventListener('click', () => showAddLog(projectId));
  }
}

function renderMilestones(milestones) {
  const container = document.getElementById('milestone-list');

  if (milestones.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary);">No milestones yet.</p>';
    return;
  }

  container.innerHTML = milestones.map(milestone => `
    <div class="milestone-item">
      <div class="milestone-header">
        <div class="milestone-title">${milestone.title}</div>
        <span class="milestone-status ${milestone.status}">${milestone.status.replace('_', ' ')}</span>
      </div>
      ${milestone.details ? `<p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">${milestone.details}</p>` : ''}
      ${milestone.dueDate ? `<p style="color: var(--text-muted); font-size: 0.75rem; margin-top: 0.5rem;">Due: ${formatDate(milestone.dueDate)}</p>` : ''}
      
      ${milestone.checklist && milestone.checklist.length > 0 ? `
        <div class="checklist">
          ${milestone.checklist.map(item => `
            <div class="checklist-item">
              <input type="checkbox" ${item.isDone ? 'checked' : ''} 
                ${currentUser.role === 'admin' ? `onchange="toggleChecklistItem(${item.id}, this.checked)"` : 'disabled'}>
              <span style="${item.isDone ? 'text-decoration: line-through; color: var(--text-muted);' : ''}">${item.text}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      ${currentUser.role === 'admin' ? `
        <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
          <button class="btn btn-secondary btn-sm" onclick="showEditMilestone(${milestone.id})">Edit</button>
          <button class="btn btn-secondary btn-sm" onclick="showAddChecklistItem(${milestone.id})">+ Checklist Item</button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

function renderLogs(logs) {
  const container = document.getElementById('logs-list');

  if (logs.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary);">No logs yet.</p>';
    return;
  }

  const logsByType = {
    done: logs.filter(l => l.type === 'done'),
    not_done: logs.filter(l => l.type === 'not_done'),
    blocker: logs.filter(l => l.type === 'blocker')
  };

  container.innerHTML = `
    <div style="display: grid; gap: 1rem;">
      <div>
        <h4 style="color: var(--success); font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">✅ What's Done</h4>
        ${logsByType.done.length > 0 ? logsByType.done.map(log => `
          <div style="padding: 0.5rem; background: var(--bg-tertiary); border-radius: var(--radius-sm); margin-bottom: 0.5rem;">
            <p style="font-size: 0.875rem;">${log.message}</p>
            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">${log.userName} • ${formatDate(log.createdAt)}</p>
          </div>
        `).join('') : '<p style="color: var(--text-muted); font-size: 0.875rem;">No completed items logged.</p>'}
      </div>

      <div>
        <h4 style="color: var(--warning); font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">⏳ What's Not Done</h4>
        ${logsByType.not_done.length > 0 ? logsByType.not_done.map(log => `
          <div style="padding: 0.5rem; background: var(--bg-tertiary); border-radius: var(--radius-sm); margin-bottom: 0.5rem;">
            <p style="font-size: 0.875rem;">${log.message}</p>
            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">${log.userName} • ${formatDate(log.createdAt)}</p>
          </div>
        `).join('') : '<p style="color: var(--text-muted); font-size: 0.875rem;">No pending items logged.</p>'}
      </div>

      <div>
        <h4 style="color: var(--error); font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">🚫 Blockers</h4>
        ${logsByType.blocker.length > 0 ? logsByType.blocker.map(log => `
          <div style="padding: 0.5rem; background: var(--bg-tertiary); border-radius: var(--radius-sm); margin-bottom: 0.5rem;">
            <p style="font-size: 0.875rem;">${log.message}</p>
            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">${log.userName} • ${formatDate(log.createdAt)}</p>
          </div>
        `).join('') : '<p style="color: var(--text-muted); font-size: 0.875rem;">No blockers logged.</p>'}
      </div>
    </div>
  `;
}

function showAddMilestone(projectId) {
  const modalContent = `
    <div class="modal-header">
      <h3 class="modal-title">Add Milestone</h3>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    <form id="add-milestone-form">
      <div class="form-group">
        <label class="form-label">Title *</label>
        <input type="text" class="form-input" id="milestone-title" required>
      </div>
      <div class="form-group">
        <label class="form-label">Details</label>
        <textarea class="form-textarea" id="milestone-details"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Due Date</label>
        <input type="date" class="form-input" id="milestone-due-date">
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" id="milestone-status">
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button type="submit" class="btn btn-primary">Add Milestone</button>
      </div>
    </form>
  `;

  const modal = showModal(modalContent);

  document.getElementById('add-milestone-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
      title: document.getElementById('milestone-title').value,
      details: document.getElementById('milestone-details').value,
      dueDate: document.getElementById('milestone-due-date').value,
      status: document.getElementById('milestone-status').value
    };

    try {
      const response = await fetch(`/api/projects/${projectId}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        closeModal(modal);
        showProjectDetail(projectId);
      }
    } catch (error) {
      console.error('Add milestone error:', error);
      showError('Failed to add milestone');
    }
  });
}

function showAddChecklistItem(milestoneId) {
  const text = prompt('Enter checklist item:');
  if (!text) return;

  fetch(`/api/milestones/${milestoneId}/checklist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  }).then(() => {
    showProjectDetail(currentProject.id);
  });
}

async function toggleChecklistItem(itemId, isDone) {
  try {
    await fetch(`/api/checklist/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDone: isDone ? 1 : 0 })
    });
  } catch (error) {
    console.error('Toggle checklist error:', error);
  }
}

function showAddLog(projectId) {
  const modalContent = `
    <div class="modal-header">
      <h3 class="modal-title">Add Progress Log</h3>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    <form id="add-log-form">
      <div class="form-group">
        <label class="form-label">Type</label>
        <select class="form-select" id="log-type">
          <option value="done">What's Done</option>
          <option value="not_done">What's Not Done</option>
          <option value="blocker">Blocker</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Message *</label>
        <textarea class="form-textarea" id="log-message" required></textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button type="submit" class="btn btn-primary">Add Log</button>
      </div>
    </form>
  `;

  const modal = showModal(modalContent);

  document.getElementById('add-log-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
      type: document.getElementById('log-type').value,
      message: document.getElementById('log-message').value
    };

    try {
      const response = await fetch(`/api/projects/${projectId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        closeModal(modal);
        showProjectDetail(projectId);
      }
    } catch (error) {
      console.error('Add log error:', error);
      showError('Failed to add log');
    }
  });
}

// Render access items
function renderAccessItems(accessItems) {
  const container = document.getElementById('access-list');

  if (accessItems.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary);">No access items requested yet.</p>';
    return;
  }

  container.innerHTML = accessItems.map(item => `
    <div class="access-item" style="padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius-md); margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: start;">
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
          <span style="font-weight: 600; font-size: 1rem;">${item.platform}</span>
          <span style="padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); font-size: 0.75rem; font-weight: 600; ${item.isGranted ? 'background: rgba(34, 197, 94, 0.2); color: var(--success);' : 'background: rgba(245, 158, 11, 0.2); color: var(--warning);'}">
            ${item.isGranted ? '✓ Granted' : '⏳ Pending'}
          </span>
        </div>
        ${item.description ? `<p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.5rem;">${item.description}</p>` : ''}
        ${item.grantedEmail ? `<p style="color: var(--success); font-size: 0.875rem; margin-bottom: 0.5rem;">✓ Access granted to: <strong>${item.grantedEmail}</strong></p>` : ''}
        ${item.notes ? `<p style="color: var(--text-muted); font-size: 0.75rem; font-style: italic;">Note: ${item.notes}</p>` : ''}
        <p style="color: var(--text-muted); font-size: 0.75rem; margin-top: 0.5rem;">
          Requested: ${formatDate(item.requestedAt)}
          ${item.grantedAt ? ` • Granted: ${formatDate(item.grantedAt)}` : ''}
        </p>
      </div>
      ${currentUser.role === 'admin' ? `
        <div style="display: flex; gap: 0.5rem;">
          ${!item.isGranted ? `<button class="btn btn-sm" style="background: var(--success); color: white;" onclick="markAccessGranted(${item.id})">Mark Granted</button>` : ''}
          <button class="btn btn-secondary btn-sm" onclick="editAccessItem(${item.id})">Edit</button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

// Show add access item modal
function showAddAccessItem(projectId) {
  const modalContent = `
    <div class="modal-header">
      <h3 class="modal-title">Add Client Access Requirement</h3>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    <form id="add-access-form">
      <div class="form-group">
        <label class="form-label">Platform / Service *</label>
        <input type="text" class="form-input" id="access-platform" placeholder="e.g., Slack, n8n, Vapi, Make.com" required>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="access-description" placeholder="What access is needed and why"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="access-notes" placeholder="Additional notes or instructions"></textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button type="submit" class="btn btn-primary">Add Access Item</button>
      </div>
    </form>
  `;

  const modal = showModal(modalContent);

  document.getElementById('add-access-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
      platform: document.getElementById('access-platform').value,
      description: document.getElementById('access-description').value,
      notes: document.getElementById('access-notes').value
    };

    try {
      const response = await fetch(`/api/projects/${projectId}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        closeModal(modal);
        showProjectDetail(projectId);
      }
    } catch (error) {
      console.error('Add access item error:', error);
      showError('Failed to add access item');
    }
  });
}

// Mark access as granted - show modal for details
async function markAccessGranted(accessId) {
  // Get current access item details
  const accessItem = await fetch(`/api/projects/${currentProject.id}/access`).then(r => r.json()).then(items => items.find(item => item.id === accessId));

  const modalContent = `
    <div class="modal-header">
      <h3 class="modal-title">Mark Access as Granted</h3>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    <form id="grant-access-form">
      <div class="form-group">
        <label class="form-label">Platform</label>
        <input type="text" class="form-input" value="${accessItem.platform}" disabled>
      </div>
      <div class="form-group">
        <label class="form-label">Email Where Access Was Granted *</label>
        <input type="email" class="form-input" id="granted-email" placeholder="e.g., admin@client.com" required>
      </div>
      <div class="form-group">
        <label class="form-label">Access Details / Description</label>
        <textarea class="form-textarea" id="granted-description" placeholder="Describe what access was granted and any important details">${accessItem.description || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Additional Notes</label>
        <textarea class="form-textarea" id="granted-notes" placeholder="Any additional notes or instructions">${accessItem.notes || ''}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button type="submit" class="btn btn-primary">Mark as Granted</button>
      </div>
    </form>
  `;

  const modal = showModal(modalContent);

  document.getElementById('grant-access-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
      platform: accessItem.platform,
      description: document.getElementById('granted-description').value,
      grantedEmail: document.getElementById('granted-email').value,
      notes: document.getElementById('granted-notes').value,
      isGranted: 1
    };

    try {
      const response = await fetch(`/api/access/${accessId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        closeModal(modal);
        showProjectDetail(currentProject.id);
      }
    } catch (error) {
      console.error('Mark access granted error:', error);
      showError('Failed to update access status');
    }
  });
}

// Edit access item
function editAccessItem(accessId) {
  // For now, just allow toggling granted status
  // You can expand this to a full edit modal if needed
  const confirmed = confirm('Toggle access granted status?');
  if (confirmed) {
    fetch(`/api/access/${accessId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isGranted: 0 })
    }).then(() => {
      showProjectDetail(currentProject.id);
    });
  }
}

// Edit Project (Added)
function showEditProject(projectId) {
  const project = allProjects.find(p => p.id === projectId);
  if (!project) return;

  const modalContent = `
    <div class="modal-header">
      <h3 class="modal-title">Edit Project</h3>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    <form id="edit-project-form">
      <div class="form-group">
        <label class="form-label">Project Name *</label>
        <input type="text" class="form-input" id="edit-project-name" value="${project.name}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Client</label>
        <input type="text" class="form-input" id="edit-project-client" value="${project.client || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" id="edit-project-status">
          <option value="active" ${project.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="on_hold" ${project.status === 'on_hold' ? 'selected' : ''}>On Hold</option>
          <option value="completed" ${project.status === 'completed' ? 'selected' : ''}>Completed</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Start Date</label>
        <input type="date" class="form-input" id="edit-project-start-date" value="${project.startDate.split('T')[0]}">
      </div>
      <div class="form-group">
        <label class="form-label">Target End Date</label>
        <input type="date" class="form-input" id="edit-project-end-date" value="${project.endDate.split('T')[0]}">
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="edit-project-description">${project.description || ''}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Changes</button>
      </div>
    </form>
  `;

  const modal = showModal(modalContent);

  document.getElementById('edit-project-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const updates = {
      name: document.getElementById('edit-project-name').value,
      client: document.getElementById('edit-project-client').value,
      status: document.getElementById('edit-project-status').value,
      startDate: document.getElementById('edit-project-start-date').value,
      endDate: document.getElementById('edit-project-end-date').value,
      description: document.getElementById('edit-project-description').value
    };

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const updatedProject = await response.json();
        const index = allProjects.findIndex(p => p.id === projectId);
        allProjects[index] = updatedProject;
        currentProject = updatedProject;

        closeModal(modal);
        showProjectDetail(projectId);
      }
    } catch (error) {
      console.error('Update project error:', error);
      showError('Failed to update project');
    }
  });
}

// Edit Milestone (Added)
function showEditMilestone(milestoneId) {
  if (!milestoneId) return;

  fetch(`/api/milestones/${milestoneId}`)
    .then(r => r.json())
    .then(milestone => {
      const modalContent = `
            <div class="modal-header">
            <h3 class="modal-title">Edit Milestone</h3>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <form id="edit-milestone-form">
            <div class="form-group">
                <label class="form-label">Title *</label>
                <input type="text" class="form-input" id="edit-milestone-title" value="${milestone.title}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Details</label>
                <textarea class="form-textarea" id="edit-milestone-details">${milestone.details || ''}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Due Date</label>
                <input type="date" class="form-input" id="edit-milestone-due-date" value="${milestone.dueDate ? milestone.dueDate.split('T')[0] : ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Status</label>
                <select class="form-select" id="edit-milestone-status">
                <option value="not_started" ${milestone.status === 'not_started' ? 'selected' : ''}>Not Started</option>
                <option value="in_progress" ${milestone.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                <option value="done" ${milestone.status === 'done' ? 'selected' : ''}>Done</option>
                </select>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Changes</button>
            </div>
            </form>
        `;

      const modal = showModal(modalContent);

      document.getElementById('edit-milestone-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const updates = {
          title: document.getElementById('edit-milestone-title').value,
          details: document.getElementById('edit-milestone-details').value,
          dueDate: document.getElementById('edit-milestone-due-date').value,
          status: document.getElementById('edit-milestone-status').value
        };

        try {
          const response = await fetch(`/api/milestones/${milestoneId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
          });

          if (response.ok) {
            closeModal(modal);
            showProjectDetail(currentProject.id);
          }
        } catch (error) {
          console.error('Update milestone error:', error);
          showError('Failed to update milestone');
        }
      });
    })
    .catch(err => {
      console.error('Error fetching milestone for edit:', err);
      showError('Failed to load milestone details');
    });
}
