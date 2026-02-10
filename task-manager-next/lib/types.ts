export interface User {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'member';
    position?: string;
    department?: string;
    phone?: string;
    avatar?: string;
    cover?: string;
    createdAt?: string;
}

export interface Task {
    id: number;
    title: string;
    description?: string;
    status: 'todo' | 'in_progress' | 'done' | 'blocked';
    priority: 'low' | 'medium' | 'high';
    assignedUserId?: number;
    assignedUserName?: string;
    projectId?: number;
    projectName?: string;
    milestoneId?: number;
    milestoneTitle?: string;
    loomVideo?: string;
    workflowLink?: string;
    workflowStatus?: string;
    dueDate?: string;
    labels?: string;
    createdBy?: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface Board {
    id: number;
    name: string;
    type: string;
    workspace?: string;
    ownerUserId?: number;
    projectId?: number;
    createdAt?: string;
}

export interface Project {
    id: number;
    name: string;
    client?: string;
    description?: string;
    status: 'active' | 'on_hold' | 'completed';
    startDate?: string;
    endDate?: string;
    budget?: number;
    spent?: number;
    managerId?: number;
    managerName?: string;
    assignedUserId?: number;
    assignedUserName?: string;
    pendingAccessCount?: number;
    milestones?: Milestone[];
    accessItems?: AccessItem[];
    createdBy?: number;
    createdAt?: string;
}

export interface Milestone {
    id: number;
    projectId: number;
    title: string;
    details?: string;
    status: 'not_started' | 'in_progress' | 'done';
    dueDate?: string;
    orderIndex?: number;
    createdAt?: string;
}

export interface ChecklistItem {
    id: number | string;
    text: string;
    completed: boolean;
}

export interface AccessItem {
    id: number;
    projectId: number;
    platform: string;
    description?: string;
    notes?: string;
    isGranted?: number; // 0 or 1
    grantedAt?: string;
    grantedEmail?: string;
    createdAt?: string;
    requestedAt?: string; // or createdAt
}

export interface ProjectLog {
    id: number;
    projectId: number;
    type: string; // 'project_update', 'milestone_update', 'access_update'
    message: string;
    createdBy: number;
    userName?: string;
    createdAt: string;
}

export interface Attendance {
    id: number;
    userId: number;
    userName?: string;
    clockIn: string;
    clockOut?: string;
    duration?: number;
    notes?: string;
    createdAt?: string;
}

export interface Notification {
    id: number;
    userId: number;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    read: boolean;
    relatedTaskId?: number;
    data?: any;
    createdAt: string;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface AuthResponse {
    success: boolean;
    user?: User;
    message?: string;
}

export interface Transcription {
    id: number;
    projectId: number;
    title: string;
    content: string;
    createdBy: number;
    createdAt: string;
}
