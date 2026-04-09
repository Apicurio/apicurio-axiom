/**
 * Returns the base URL for the Axiom API.
 *
 * In development, the Vite proxy handles routing /api requests to the backend.
 * In production, the API URL is injected via the AXIOM_API_URL environment variable
 * into a global config object on window.
 */
export function getApiBaseUrl(): string {
    const win = window as unknown as Record<string, unknown>;
    if (win.AXIOM_API_URL && typeof win.AXIOM_API_URL === "string") {
        return win.AXIOM_API_URL;
    }
    return "";
}

const API = `${getApiBaseUrl()}/api/v1`;

// ── Types ─────────────────────────────────────────────────────────

export interface SystemHealth {
    status: string;
    version: string;
    timestamp: string;
}

export interface Project {
    id: number;
    name: string;
    description?: string;
    type: string;
    status: string;
    issueSource: string;
    issueRef: string;
    repository: string;
    createdOn: string;
    updatedOn: string;
    metadata?: Record<string, string>;
}

export interface NewProject {
    name: string;
    description?: string;
    type: string;
    issueSource: string;
    issueRef: string;
    repository: string;
}

export interface Task {
    id: number;
    projectId: number;
    actionType: string;
    createdBy: string;
    assignedActor?: number;
    status: string;
    input?: string;
    output?: string;
    createdOn: string;
    completedOn?: string;
    sessionId?: string;
    costUsd?: number;
    inputTokens?: number;
    outputTokens?: number;
}

export interface ThreadEntry {
    id: number;
    projectId: number;
    authorType: string;
    authorId?: string;
    entryType: string;
    content: string;
    createdOn: string;
}

export interface ActivityLogEntry {
    id: number;
    projectId?: number;
    taskId?: number;
    eventId?: number;
    entryType: string;
    summary: string;
    details?: string;
    createdOn: string;
}

// ── System ────────────────────────────────────────────────────────

export async function fetchSystemHealth(): Promise<SystemHealth> {
    const response = await fetch(`${API}/system/health`);
    if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
    return response.json();
}

// ── Projects ──────────────────────────────────────────────────────

export async function fetchProjects(): Promise<Project[]> {
    const response = await fetch(`${API}/projects`);
    if (!response.ok) throw new Error(`Failed to fetch projects: ${response.status}`);
    return response.json();
}

export async function fetchProject(id: number): Promise<Project> {
    const response = await fetch(`${API}/projects/${id}`);
    if (!response.ok) throw new Error(`Failed to fetch project: ${response.status}`);
    return response.json();
}

export async function createProject(project: NewProject): Promise<Project> {
    const response = await fetch(`${API}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
    });
    if (!response.ok) throw new Error(`Failed to create project: ${response.status}`);
    return response.json();
}

export async function deleteProject(id: number): Promise<void> {
    const response = await fetch(`${API}/projects/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error(`Failed to delete project: ${response.status}`);
}

// ── Tasks ─────────────────────────────────────────────────────────

export async function fetchProjectTasks(projectId: number): Promise<Task[]> {
    const response = await fetch(`${API}/projects/${projectId}/tasks`);
    if (!response.ok) throw new Error(`Failed to fetch tasks: ${response.status}`);
    return response.json();
}

export interface NewTask {
    actionType: string;
    assignedActor?: number;
    input?: string;
}

export async function createTask(projectId: number, task: NewTask): Promise<Task> {
    const response = await fetch(`${API}/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
    });
    if (!response.ok) throw new Error(`Failed to create task: ${response.status}`);
    return response.json();
}

// ── Action Types ──────────────────────────────────────────────────

export interface ActionType {
    id: number;
    name: string;
    description?: string;
    executionMode: string;
    userTriggerable: boolean;
    inputSchema?: string;
    toolConstraints?: string;
    emitsEvent: boolean;
}

export async function fetchActionTypes(): Promise<ActionType[]> {
    const response = await fetch(`${API}/action-types`);
    if (!response.ok) throw new Error(`Failed to fetch action types: ${response.status}`);
    return response.json();
}

// ── Thread ────────────────────────────────────────────────────────

export async function fetchThreadEntries(projectId: number): Promise<ThreadEntry[]> {
    const response = await fetch(`${API}/projects/${projectId}/thread`);
    if (!response.ok) throw new Error(`Failed to fetch thread: ${response.status}`);
    return response.json();
}

// ── Activity Log ──────────────────────────────────────────────────

export async function fetchActivityLog(): Promise<ActivityLogEntry[]> {
    const response = await fetch(`${API}/activity`);
    if (!response.ok) throw new Error(`Failed to fetch activity log: ${response.status}`);
    return response.json();
}
