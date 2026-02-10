# Task + Project Manager (Next.js Version)

A clean, modern task and project management web application with Kanban boards, real-time tracking, and role-based access control.

## Project Structure

This project has been migrated to Next.js. The main application code is located in the `task-manager-next` directory.

```
Task manager/
├── task-manager-next/     # Next.js Application
│   ├── app/               # Page routes and layouts
│   ├── components/        # UI components
│   ├── lib/               # API clients, store, and utilities
│   ├── public/            # Static assets
│   └── server.js          # Express backend (running within Next.js)
├── nixpacks.toml          # Deployment configuration
├── package.json           # Root delegation package
└── README.md              # Root documentation
```

## Quick Start (Local Development)

### 1. Install Dependencies

```bash
cd task-manager-next
npm install
```

### 2. Configure Environment

Create a `.env.local` file in the `task-manager-next` directory with the following variables:
- `DATABASE_URL`: Your PostgreSQL connection string
- `SESSION_SECRET`: A secret for session management

### 3. Start the Server

```bash
npm run dev
```

The app will be available at: **http://localhost:3000**

## Features

✅ **Kanban Boards**: Manage tasks with drag-and-drop functionality  
✅ **Project Management**: Track milestones, checklists, and progress  
✅ **Role-Based Access**: Specialized views for Admin and Member roles  
✅ **PostgreSQL**: Robust data persistence  
✅ **Modern UI**: Built with Next.js, Tailwind CSS, and Framer Motion

## License

MIT
