// Tasks workspace state
let allTasks = [];
let allBoards = [];
let allUsers = [];
let currentBoard = null;
let taskFilters = {
  assignee: 'all',
  status: 'all',
  priority: 'all'
};

async function loadTasksWorkspace() {
  const contentArea = document.getElementById('content-area');

  contentArea.innerHTML = `
    <div class="board-header">
      <h2 class="board-title">Tasks</h2>
      <div class="board-actions">
        <button class="btn btn-primary" id="quick-add-task">+ Quick Add Task</button>
      </div>
    </div>

    <div class="filters-container">
      <select class="filter-select" id="filter-assignee">
        <option value="all">All Members</option>
      </select>
      <select class="filter-select" id="filter-status">
        <option value="all">All Statuses</option>
        <option value="todo">To Do</option>
        <option value="in_progress">In Progress</option>
        <option value="blocked">Blocked</option>
        <option value="done">Done</option>
      </select>
      <select class="filter-select" id="filter-priority">
        <option value="all">All Priorities</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
    </div>

    <div class="board-tabs" id="board-tabs"></div>
    <div class="kanban-board" id="kanban-board"></div>
  `;

  // Load data
  await Promise.all([
    loadTasks(),
    loadBoards(),
    loadUsers()
  ]);

  // Setup event listeners
  document.getElementById('quick-add-task').addEventListener('click', showQuickAddTask);
  document.getElementById('filter-assignee').addEventListener('change', handleFilterChange);
  document.getElementById('filter-status').addEventListener('change', handleFilterChange);
  document.getElementById('filter-priority').addEventListener('change', handleFilterChange);

  // Populate filters
  populateUserFilter();

  // Render boards tabs
  renderBoardTabs();

  // Load first board
  if (allBoards.length > 0) {
    // If a task ID is pending, find which board it belongs to (if possible) or just switch to the first/relevant board
    // Ideally update switchBoard to handle this but for now just load defaults
    switchBoard(allBoards[0].id);
  }

  // Check for pending task to open (from dashboard)
  const pendingTaskId = sessionStorage.getItem('openTaskId');
  if (pendingTaskId) {
    sessionStorage.removeItem('openTaskId');
    // Give UI a moment to render
    setTimeout(() => {
      showTaskDetails(pendingTaskId); // Function found in view_file of tasks.js lower half
    }, 500);
  }
}

async function loadTasks() {
  const response = await fetch('/api/tasks');
  allTasks = await response.json();
}

async function loadBoards() {
  const response = await fetch('/api/boards');
  allBoards = await response.json();
}

async function loadUsers() {
  const response = await fetch('/api/users');
  allUsers = await response.json();
}

function populateUserFilter() {
  const filterSelect = document.getElementById('filter-assignee');
  allUsers.forEach(user => {
    const option = document.createElement('option');
    option.value = user.id;
    option.textContent = user.name;
    filterSelect.appendChild(option);
  });
}

function renderBoardTabs() {
  const tabsContainer = document.getElementById('board-tabs');
  if (!tabsContainer) return;

  tabsContainer.innerHTML = '';

  allBoards.forEach(board => {
    const tab = document.createElement('button');
    tab.className = 'board-tab';
    tab.textContent = board.name;
    tab.dataset.boardId = board.id;
    tab.addEventListener('click', () => switchBoard(board.id));
    tabsContainer.appendChild(tab);
  });
}

function switchBoard(boardId) {
  currentBoard = allBoards.find(b => b.id === boardId);

  // Update active tab
  document.querySelectorAll('.board-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.boardId == boardId);
  });

  renderKanbanBoard();
}

function renderKanbanBoard() {
  const board = document.getElementById('kanban-board');

  const columns = [
    { id: 'todo', title: 'To Do', color: '#6366f1' },
    { id: 'in_progress', title: 'In Progress', color: '#f59e0b' },
    { id: 'blocked', title: 'Blocked', color: '#ef4444' },
    { id: 'done', title: 'Done', color: '#10b981' }
  ];

  board.innerHTML = columns.map(col => `
    <div class="kanban-column" data-status="${col.id}" ondrop="handleDrop(event)" ondragover="handleDragOver(event)">
      <div class="column-header">
        <span class="column-title" style="color: ${col.color}">${col.title}</span>
        <span class="column-count" id="count-${col.id}">0</span>
      </div>
      <div class="column-tasks" id="tasks-${col.id}"></div>
    </div>
  `).join('');

  renderTasks();
}

function renderTasks() {
  // Filter tasks based on current board and filters
  let filteredTasks = allTasks.filter(task => {
    // Board filtering
    if (currentBoard.type === 'MEMBER_BOARD') {
      if (task.assignedUserId !== currentBoard.ownerUserId) {
        return false;
      }
    }

    // User filters
    if (taskFilters.assignee !== 'all' && task.assignedUserId != taskFilters.assignee) {
      return false;
    }
    if (taskFilters.status !== 'all' && task.status !== taskFilters.status) {
      return false;
    }
    if (taskFilters.priority !== 'all' && task.priority !== taskFilters.priority) {
      return false;
    }

    return true;
  });

  // Clear columns
  ['todo', 'in_progress', 'blocked', 'done'].forEach(status => {
    document.getElementById(`tasks-${status}`).innerHTML = '';
  });

  // Render tasks
  filteredTasks.forEach(task => {
    const taskCard = createTaskCard(task);
    document.getElementById(`tasks-${task.status}`).appendChild(taskCard);
  });

  // Update counts
  ['todo', 'in_progress', 'blocked', 'done'].forEach(status => {
    const count = filteredTasks.filter(t => t.status === status).length;
    document.getElementById(`count-${status}`).textContent = count;
  });
}

function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.draggable = true;
  card.dataset.taskId = task.id;
  card.dataset.assignedUserId = task.assignedUserId || '';

  card.addEventListener('dragstart', handleDragStart);
  card.addEventListener('dragend', handleDragEnd);
  card.addEventListener('click', () => showTaskDetails(task.id));

  const labels = task.labels ? task.labels.split(',').map(l =>
    `<span class="task-label">${l.trim()}</span>`
  ).join('') : '';

  card.innerHTML = `
    <div class="task-card-header">
      <div class="task-title">${task.title}</div>
      <span class="task-priority ${task.priority}">${task.priority}</span>
    </div>
    ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
    ${labels ? `<div class="task-labels">${labels}</div>` : ''}
    <div class="task-meta">
      <div class="task-assignee">
        ${task.assignedUserName ? `👤 ${task.assignedUserName}` : '👤 Unassigned'}
      </div>
      ${task.projectName ? `<div class="task-project" style="font-size: 0.75rem; color: var(--primary); background: rgba(99, 102, 241, 0.1); padding: 2px 6px; border-radius: 4px;">📂 ${task.projectName}</div>` : ''}
      ${task.dueDate ? `<div class="task-due-date">📅 ${formatDate(task.dueDate)}</div>` : ''}
    </div>
  `;

  return card;
}

// Drag and drop handlers
function handleDragStart(e) {
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', e.target.innerHTML);
  e.dataTransfer.setData('taskId', e.target.dataset.taskId);
  e.dataTransfer.setData('currentAssignedUserId', e.target.dataset.assignedUserId);
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  return false;
}

async function handleDrop(e) {
  e.stopPropagation();
  e.preventDefault();

  const taskId = e.dataTransfer.getData('taskId');
  const currentAssignedUserId = e.dataTransfer.getData('currentAssignedUserId');

  // Get the column where task was dropped
  let dropTarget = e.target;
  while (dropTarget && !dropTarget.classList.contains('kanban-column')) {
    dropTarget = dropTarget.parentElement;
  }

  if (!dropTarget) return;

  const newStatus = dropTarget.dataset.status;
  const task = allTasks.find(t => t.id == taskId);

  if (!task) return;

  let updates = { ...task, status: newStatus };

  // Handle assignment logic based on board type
  if (currentBoard.type === 'MEMBER_BOARD' && currentBoard.ownerUserId) {
    // Dropped on a member board - assign to that member
    if (task.assignedUserId != currentBoard.ownerUserId) {
      updates.assignedUserId = currentBoard.ownerUserId;
    }
  }

  // Update task
  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    if (response.ok) {
      const updatedTask = await response.json();
      const index = allTasks.findIndex(t => t.id == taskId);
      allTasks[index] = updatedTask;
      renderTasks();
    }
  } catch (error) {
    console.error('Update task error:', error);
    showError('Failed to update task');
  }
}

function handleFilterChange() {
  taskFilters.assignee = document.getElementById('filter-assignee').value;
  taskFilters.status = document.getElementById('filter-status').value;
  taskFilters.priority = document.getElementById('filter-priority').value;
  renderTasks();
}

function filterTasks(query) {
  if (!query) {
    renderTasks();
    return;
  }

  const filtered = allTasks.filter(task =>
    task.title.toLowerCase().includes(query) ||
    (task.description && task.description.toLowerCase().includes(query))
  );

  // Temporarily replace allTasks for rendering
  const originalTasks = allTasks;
  allTasks = filtered;
  renderTasks();
  allTasks = originalTasks;
}

function showQuickAddTask() {
  const modalContent = `
    <div class="modal-header">
      <h3 class="modal-title">Quick Add Task</h3>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    <form id="quick-add-form">
      <div class="form-group">
        <label class="form-label">Title *</label>
        <input type="text" class="form-input" id="task-title" required>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="task-description"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Priority</label>
        <select class="form-select" id="task-priority">
          <option value="low">Low</option>
          <option value="medium" selected>Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Assign To</label>
        <select class="form-select" id="task-assignee">
          <option value="">Unassigned</option>
          ${allUsers.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Project</label>
        <select class="form-select" id="task-project">
          <option value="">No Project</option>
          ${allBoards.filter(b => b.workspace === 'projects' || b.projectId).map(p => `<option value="${p.id}">${p.name}</option>`).join('')} 
          <!-- Note: allBoards might not have projects. Need to fetch projects or use allProjects if available globally -->
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Due Date</label>
        <input type="date" class="form-input" id="task-due-date">
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create Task</button>
      </div>
    </form>
  `;

  // We need to populate projects. Check if we have access to them.
  // If not, we might need to fetch them.
  const projectSelect = new DOMParser().parseFromString(modalContent, 'text/html').getElementById('task-project'); // Just for logic check

  // Real implementation:
  const modal = showModal(modalContent);

  // Fetch projects and populate
  fetch('/api/projects')
    .then(res => res.json())
    .then(projects => {
      const select = document.getElementById('task-project');
      if (select) {
        select.innerHTML = '<option value="">No Project</option>' +
          projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
      }
    });

  document.getElementById('quick-add-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const taskData = {
      title: document.getElementById('task-title').value,
      description: document.getElementById('task-description').value,
      priority: document.getElementById('task-priority').value,
      assignedUserId: document.getElementById('task-assignee').value || null,
      projectId: document.getElementById('task-project').value || null,
      dueDate: document.getElementById('task-due-date').value || null,
      status: 'todo'
    };

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });

      if (response.ok) {
        const newTask = await response.json();
        allTasks.unshift(newTask);

        // Only render kanban if retrieving the board
        if (document.getElementById('kanban-board')) {
          renderTasks();
        } else if (typeof loadDashboardStats === 'function') {
          // Update dashboard if we're there
          loadDashboardStats();
        }

        closeModal(modal);
      }
    } catch (error) {
      console.error('Create task error:', error);
      showError('Failed to create task');
    }
  });
}

function showTaskDetails(taskId) {
  const task = allTasks.find(t => t.id == taskId);
  if (!task) return;

  const modalContent = `
    <div class="modal-header">
      <h3 class="modal-title">Task Details</h3>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    <form id="edit-task-form">
      <div class="form-group">
        <label class="form-label">Title *</label>
        <input type="text" class="form-input" id="edit-task-title" value="${task.title}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="edit-task-description">${task.description || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" id="edit-task-status">
          <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
          <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
          <option value="blocked" ${task.status === 'blocked' ? 'selected' : ''}>Blocked</option>
          <option value="done" ${task.status === 'done' ? 'selected' : ''}>Done</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Priority</label>
        <select class="form-select" id="edit-task-priority">
          <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
          <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
          <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Assign To</label>
        <select class="form-select" id="edit-task-assignee">
          <option value="">Unassigned</option>
          ${allUsers.map(u => `<option value="${u.id}" ${task.assignedUserId == u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Project</label>
        <select class="form-select" id="edit-task-project">
          <option value="">Loading projects...</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Due Date</label>
        <input type="date" class="form-input" id="edit-task-due-date" value="${task.dueDate || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Labels (comma-separated)</label>
        <input type="text" class="form-input" id="edit-task-labels" value="${task.labels || ''}">
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-danger" id="delete-task-btn">Delete</button>
        <div style="flex: 1"></div>
        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Changes</button>
      </div>
    </form>
  `;

  const modal = showModal(modalContent);

  // Fetch projects and populate
  fetch('/api/projects')
    .then(res => res.json())
    .then(projects => {
      const select = document.getElementById('edit-task-project');
      if (select) {
        select.innerHTML = '<option value="">No Project</option>' +
          projects.map(p => `<option value="${p.id}" ${task.projectId == p.id ? 'selected' : ''}>${p.name}</option>`).join('');
      }
    });

  document.getElementById('edit-task-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const updates = {
      title: document.getElementById('edit-task-title').value,
      description: document.getElementById('edit-task-description').value,
      status: document.getElementById('edit-task-status').value,
      priority: document.getElementById('edit-task-priority').value,
      assignedUserId: document.getElementById('edit-task-assignee').value || null,
      projectId: document.getElementById('edit-task-project').value || null,
      dueDate: document.getElementById('edit-task-due-date').value || null,
      labels: document.getElementById('edit-task-labels').value
    };

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const updatedTask = await response.json();
        const index = allTasks.findIndex(t => t.id == taskId);
        allTasks[index] = updatedTask;
        renderTasks();
        closeModal(modal);
      }
    } catch (error) {
      console.error('Update task error:', error);
      showError('Failed to update task');
    }
  });

  document.getElementById('delete-task-btn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (response.ok) {
        allTasks = allTasks.filter(t => t.id != taskId);
        renderTasks();
        closeModal(modal);
      }
    } catch (error) {
      console.error('Delete task error:', error);
      showError('Failed to delete task');
    }
  });
}
