# Task + Project Manager

A clean, modern task and project management web application with Kanban boards, drag-and-drop functionality, and role-based access control.

## Features

✅ **Two Workspaces**: Tasks (Kanban boards) and Projects (milestone tracking)  
✅ **Role-Based Access**: Admin and Member roles with different permissions  
✅ **Drag-and-Drop**: Native HTML5 drag-and-drop for task management  
✅ **Team Management**: Add members, auto-create boards  
✅ **Project Tracking**: Milestones, checklists, progress logs  
✅ **Real Database**: SQLite for data persistence  
✅ **Modern UI**: Dark theme with responsive design

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

If you encounter installation errors, try:

```bash
npm cache clean --force
npm install --legacy-peer-deps
```

Or install packages individually:

```bash
npm install express
npm install better-sqlite3
npm install bcrypt
npm install express-session
npm install body-parser
```

### 2. Seed the Database

```bash
npm run seed
```

This creates sample data:
- 1 admin user + 3 team members
- 4 boards (All Tasks + 3 member boards)
- 10 sample tasks
- 2 projects with milestones

### 3. Start the Server

```bash
npm start
```

The app will be available at: **http://localhost:3000**

## Login Credentials

**Admin Account:**
- Email: `admin@taskmanager.com`
- Password: `admin123`

**Member Accounts:**
- Email: `abdul@taskmanager.com` / Password: `member123`
- Email: `ali@taskmanager.com` / Password: `member123`
- Email: `sarah@taskmanager.com` / Password: `member123`

## Project Structure

```
Task manager/
├── server.js              # Express server with REST API
├── database.js            # SQLite database initialization
├── seed.js                # Sample data generator
├── package.json           # Dependencies
├── public/                # Frontend files
│   ├── index.html         # Login page
│   ├── app.html           # Main application
│   ├── styles.css         # Design system
│   ├── app.js             # Core app logic
│   ├── tasks.js           # Tasks workspace
│   ├── projects.js        # Projects workspace
│   └── team.js            # Team management
└── taskmanager.db         # SQLite database (created on first run)
```

## Features by Workspace

### Tasks Workspace

- **All Tasks Board**: Master board showing all tasks
- **Member Boards**: Individual boards for each team member
- **Drag & Drop**: 
  - Drag within board to change status
  - Drag from All Tasks to Member Board to assign
  - Drag between Member Boards to reassign
- **Filters**: By member, status, priority
- **Search**: Real-time task search
- **Quick Add**: Fast task creation

### Projects Workspace

- **Projects List**: Grid view of all projects
- **Project Details**: 
  - Milestones with status tracking
  - Checklist items for deliverables
  - Progress logs (done/not done/blockers)
  - Overall progress percentage
- **Admin Controls**: Create/edit projects and milestones

### Team Members (Admin Only)

- Add new team members
- Auto-create member boards
- Deactivate members (tasks become unassigned)

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - List users
- `POST /api/users` - Create user (admin)
- `DELETE /api/users/:id` - Deactivate user (admin)

### Boards
- `GET /api/boards` - List boards

### Tasks
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `GET /api/tasks/:id/activity` - Get task activity
- `POST /api/tasks/:id/activity` - Add activity

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project (admin)
- `PUT /api/projects/:id` - Update project (admin)
- `DELETE /api/projects/:id` - Delete project (admin)

### Milestones
- `GET /api/projects/:projectId/milestones` - List milestones
- `POST /api/projects/:projectId/milestones` - Create milestone (admin)
- `PUT /api/milestones/:id` - Update milestone (admin)
- `DELETE /api/milestones/:id` - Delete milestone (admin)

### Checklist Items
- `GET /api/milestones/:milestoneId/checklist` - List items
- `POST /api/milestones/:milestoneId/checklist` - Create item (admin)
- `PUT /api/checklist/:id` - Update item (admin)
- `DELETE /api/checklist/:id` - Delete item (admin)

### Project Logs
- `GET /api/projects/:projectId/logs` - List logs
- `POST /api/projects/:projectId/logs` - Create log (admin)

## Technology Stack

- **Backend**: Node.js + Express
- **Database**: SQLite (better-sqlite3)
- **Authentication**: Session-based with bcrypt
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Drag & Drop**: Native HTML5 API

## Security Notes

⚠️ **Change default admin password in production!**

The default admin credentials (`admin@taskmanager.com` / `admin123`) should be changed immediately when deploying to production.

## Troubleshooting

### Database Issues

If you need to reset the database:

```bash
# Delete the database file
rm taskmanager.db  # or del taskmanager.db on Windows

# Re-seed
npm run seed
```

### Port Already in Use

If port 3000 is already in use, edit `server.js` and change the `PORT` constant.

### npm Installation Errors

If you're having trouble with `npm install`, try:

1. Update Node.js to the latest LTS version
2. Clear npm cache: `npm cache clean --force`
3. Delete `node_modules` and `package-lock.json`
4. Try again with `npm install --legacy-peer-deps`

## License

MIT
