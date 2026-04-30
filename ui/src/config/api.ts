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

export interface StartupCheck {
    name: string;
    status: "ok" | "warning" | "error";
    message: string;
}

export interface SystemConfig {
    version: string;
    features: Record<string, boolean>;
    checks?: StartupCheck[];
}

export interface SearchResults<T> {
    items: T[];
    totalCount: number;
    page: number;
    limit: number;
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
    eventId?: number;
    actionType: string;
    createdBy: string;
    assignedActor?: number;
    status: string;
    input?: string;
    output?: string;
    createdOn: string;
    completedOn?: string;
    sessionId?: string;
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

export async function fetchSystemConfig(): Promise<SystemConfig> {
    const response = await fetch(`${API}/system/config`);
    if (!response.ok) throw new Error(`Failed to fetch config: ${response.status}`);
    return response.json();
}

// ── Projects ──────────────────────────────────────────────────────

export async function fetchProjects(
    page = 1, limit = 20, filterName?: string, filterStatus?: string
): Promise<SearchResults<Project>> {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (filterName) params.set("filterName", filterName);
    if (filterStatus) params.set("filterStatus", filterStatus);
    const response = await fetch(`${API}/projects?${params}`);
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

export async function respondToTask(
    projectId: number,
    taskId: number,
    response: string
): Promise<void> {
    const res = await fetch(
        `${API}/projects/${projectId}/tasks/${taskId}/respond`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ response }),
        }
    );
    if (!res.ok) throw new Error(`Failed to respond to task: ${res.status}`);
}

export async function fetchTaskExecutionLog(
    projectId: number,
    taskId: number
): Promise<string> {
    const response = await fetch(
        `${API}/projects/${projectId}/tasks/${taskId}/log`
    );
    if (!response.ok) throw new Error(`Failed to fetch execution log: ${response.status}`);
    return response.text();
}

// ── Action Types ──────────────────────────────────────────────────

export interface ActionType {
    id: number;
    name: string;
    description?: string;
    executionMode: string;
    userTriggerable: boolean;
    inputSchema?: string;
    allowedTools?: string[];
    promptTemplate?: string;
    emitsEvent: boolean;
}

export type NewActionType = Omit<ActionType, "id">;

export async function fetchActionTypes(): Promise<ActionType[]> {
    const response = await fetch(`${API}/action-types`);
    if (!response.ok) throw new Error(`Failed to fetch action types: ${response.status}`);
    return response.json();
}

export async function fetchActionType(id: number): Promise<ActionType> {
    const response = await fetch(`${API}/action-types/${id}`);
    if (!response.ok) throw new Error(`Failed to fetch action type: ${response.status}`);
    return response.json();
}

export async function createActionType(at: NewActionType): Promise<ActionType> {
    const response = await fetch(`${API}/action-types`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(at),
    });
    if (!response.ok) throw new Error(`Failed to create action type: ${response.status}`);
    return response.json();
}

export async function updateActionType(id: number, at: NewActionType): Promise<ActionType> {
    const response = await fetch(`${API}/action-types/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(at),
    });
    if (!response.ok) throw new Error(`Failed to update action type: ${response.status}`);
    return response.json();
}

export async function deleteActionType(id: number): Promise<void> {
    const response = await fetch(`${API}/action-types/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error(`Failed to delete action type: ${response.status}`);
}

// ── Actors ────────────────────────────────────────────────────────

export interface Actor {
    id: number;
    name: string;
    description?: string;
    type: string;
    capabilities?: string[];
}

export type NewActor = Omit<Actor, "id">;

export async function fetchActors(): Promise<Actor[]> {
    const response = await fetch(`${API}/actors`);
    if (!response.ok) throw new Error(`Failed to fetch actors: ${response.status}`);
    return response.json();
}

export async function createActor(actor: NewActor): Promise<Actor> {
    const response = await fetch(`${API}/actors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actor),
    });
    if (!response.ok) throw new Error(`Failed to create actor: ${response.status}`);
    return response.json();
}

export async function updateActor(id: number, actor: NewActor): Promise<Actor> {
    const response = await fetch(`${API}/actors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actor),
    });
    if (!response.ok) throw new Error(`Failed to update actor: ${response.status}`);
    return response.json();
}

export async function deleteActor(id: number): Promise<void> {
    const response = await fetch(`${API}/actors/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error(`Failed to delete actor: ${response.status}`);
}

export async function fetchActor(id: number): Promise<Actor> {
    const response = await fetch(`${API}/actors/${id}`);
    if (!response.ok) throw new Error(`Failed to fetch actor: ${response.status}`);
    return response.json();
}

export async function fetchActorTasks(
    actorId: number, page = 1, limit = 20,
    filterActionType?: string, filterStatus?: string
): Promise<SearchResults<Task>> {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (filterActionType) params.set("filterActionType", filterActionType);
    if (filterStatus) params.set("filterStatus", filterStatus);
    const response = await fetch(`${API}/actors/${actorId}/tasks?${params}`);
    if (!response.ok) throw new Error(`Failed to fetch actor tasks: ${response.status}`);
    return response.json();
}

// ── Tool Definitions ──────────────────────────────────────────────

export interface ToolParameter {
    name: string;
    type: string;
    description?: string;
    required?: boolean;
}

export interface ToolDefinition {
    id: number;
    name: string;
    description?: string;
    type: string;
    parameters?: ToolParameter[];
    scriptTemplate?: string;
    serverCommand?: string;
    serverArgs?: string[];
    serverEnv?: Record<string, string>;
    serverUrl?: string;
}

export type NewToolDefinition = Omit<ToolDefinition, "id">;

export async function fetchTools(): Promise<ToolDefinition[]> {
    const response = await fetch(`${API}/tools`);
    if (!response.ok) throw new Error(`Failed to fetch tools: ${response.status}`);
    return response.json();
}

export async function fetchTool(id: number): Promise<ToolDefinition> {
    const response = await fetch(`${API}/tools/${id}`);
    if (!response.ok) throw new Error(`Failed to fetch tool: ${response.status}`);
    return response.json();
}

export async function createTool(tool: NewToolDefinition): Promise<ToolDefinition> {
    const response = await fetch(`${API}/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tool),
    });
    if (!response.ok) throw new Error(`Failed to create tool: ${response.status}`);
    return response.json();
}

export async function updateTool(id: number, tool: NewToolDefinition): Promise<ToolDefinition> {
    const response = await fetch(`${API}/tools/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tool),
    });
    if (!response.ok) throw new Error(`Failed to update tool: ${response.status}`);
    return response.json();
}

export async function deleteTool(id: number): Promise<void> {
    const response = await fetch(`${API}/tools/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error(`Failed to delete tool: ${response.status}`);
}

export interface ToolAiEditRequest {
    message: string;
    currentTool?: NewToolDefinition;
}

export interface ToolAiEditResponse {
    tool?: NewToolDefinition;
    explanation?: string;
}

export async function aiEditTool(request: ToolAiEditRequest): Promise<ToolAiEditResponse> {
    const response = await fetch(`${API}/tools/ai-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`Failed to AI edit tool: ${response.status}`);
    return response.json();
}

export async function fetchActionTypeTools(actionTypeId: number): Promise<ToolDefinition[]> {
    const response = await fetch(`${API}/action-types/${actionTypeId}/tools`);
    if (!response.ok) throw new Error(`Failed to fetch action type tools: ${response.status}`);
    return response.json();
}

// ── Manager Configuration ────────────────────────────────────────

export interface ManagerConfig {
    systemPrompt?: string;
    promptTemplate?: string;
}

export async function fetchManagerConfig(): Promise<ManagerConfig> {
    const response = await fetch(`${API}/manager/config`);
    if (!response.ok) throw new Error(`Failed to fetch manager config: ${response.status}`);
    return response.json();
}

export async function updateManagerConfig(config: ManagerConfig): Promise<ManagerConfig> {
    const response = await fetch(`${API}/manager/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
    });
    if (!response.ok) throw new Error(`Failed to update manager config: ${response.status}`);
    return response.json();
}

// ── Repositories ──────────────────────────────────────────────────

export interface Repository {
    id: number;
    name: string;
    owner: string;
    source: string;
    url: string;
    pollInterval?: number;
    webhookSecret?: string;
    pollingEnabled?: boolean;
}

export type NewRepository = Omit<Repository, "id">;

export async function fetchRepositories(): Promise<Repository[]> {
    const response = await fetch(`${API}/repositories`);
    if (!response.ok) throw new Error(`Failed to fetch repositories: ${response.status}`);
    return response.json();
}

export async function createRepository(repo: NewRepository): Promise<Repository> {
    const response = await fetch(`${API}/repositories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(repo),
    });
    if (!response.ok) throw new Error(`Failed to create repository: ${response.status}`);
    return response.json();
}

export async function updateRepository(id: number, repo: NewRepository): Promise<Repository> {
    const response = await fetch(`${API}/repositories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(repo),
    });
    if (!response.ok) throw new Error(`Failed to update repository: ${response.status}`);
    return response.json();
}

export async function deleteRepository(id: number): Promise<void> {
    const response = await fetch(`${API}/repositories/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error(`Failed to delete repository: ${response.status}`);
}

// ── Thread ────────────────────────────────────────────────────────

export async function fetchThreadEntries(projectId: number): Promise<ThreadEntry[]> {
    const response = await fetch(`${API}/projects/${projectId}/thread`);
    if (!response.ok) throw new Error(`Failed to fetch thread: ${response.status}`);
    return response.json();
}

// ── Reports ──────────────────────────────────────────────────────

export interface ReportDefinition {
    id: number;
    name: string;
    description?: string;
    schedule: string;
    scheduleTime?: string;
    timeWindow: string;
    repositories?: string[];
    promptTemplate: string;
    allowedTools?: string[];
    enabled: boolean;
    nextRunAt?: string;
    lastRunAt?: string;
    createdOn: string;
    updatedOn: string;
}

export type NewReportDefinition = Omit<ReportDefinition, "id" | "createdOn" | "updatedOn" | "nextRunAt" | "lastRunAt">;

export interface Report {
    id: number;
    definitionId: number;
    status: string;
    title?: string;
    content?: string;
    timeRangeStart?: string;
    timeRangeEnd?: string;
    costUsd?: number;
    createdOn: string;
    completedOn?: string;
}

export async function fetchReportDefinitions(): Promise<ReportDefinition[]> {
    const response = await fetch(`${API}/reports/definitions`);
    if (!response.ok) throw new Error(`Failed to fetch report definitions: ${response.status}`);
    return response.json();
}

export async function fetchReportDefinition(id: number): Promise<ReportDefinition> {
    const response = await fetch(`${API}/reports/definitions/${id}`);
    if (!response.ok) throw new Error(`Failed to fetch report definition: ${response.status}`);
    return response.json();
}

export async function createReportDefinition(def: NewReportDefinition): Promise<ReportDefinition> {
    const response = await fetch(`${API}/reports/definitions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(def),
    });
    if (!response.ok) throw new Error(`Failed to create report definition: ${response.status}`);
    return response.json();
}

export async function updateReportDefinition(id: number, def: NewReportDefinition): Promise<ReportDefinition> {
    const response = await fetch(`${API}/reports/definitions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(def),
    });
    if (!response.ok) throw new Error(`Failed to update report definition: ${response.status}`);
    return response.json();
}

export async function deleteReportDefinition(id: number): Promise<void> {
    const response = await fetch(`${API}/reports/definitions/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error(`Failed to delete report definition: ${response.status}`);
}

export async function runReportDefinition(id: number): Promise<Report> {
    const response = await fetch(`${API}/reports/definitions/${id}/run`, { method: "POST" });
    if (!response.ok) throw new Error(`Failed to run report: ${response.status}`);
    return response.json();
}

export async function fetchReports(
    page = 1, limit = 20,
    filterDefinitionId?: number, filterStatus?: string, filterTitle?: string
): Promise<SearchResults<Report>> {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (filterDefinitionId != null) params.set("filterDefinitionId", String(filterDefinitionId));
    if (filterStatus) params.set("filterStatus", filterStatus);
    if (filterTitle) params.set("filterTitle", filterTitle);
    const response = await fetch(`${API}/reports?${params}`);
    if (!response.ok) throw new Error(`Failed to fetch reports: ${response.status}`);
    return response.json();
}

export async function fetchReportExecutionLog(reportId: number): Promise<string> {
    const response = await fetch(`${API}/reports/${reportId}/log`);
    if (!response.ok) throw new Error(`Failed to fetch report log: ${response.status}`);
    return response.text();
}

export async function fetchReport(id: number): Promise<Report> {
    const response = await fetch(`${API}/reports/${id}`);
    if (!response.ok) throw new Error(`Failed to fetch report: ${response.status}`);
    return response.json();
}

// ── Metrics ──────────────────────────────────────────────────────

export interface ProjectMetrics {
    projectId: number;
    diskUsageBytes: number;
    totalCostUsd: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    invocationCount: number;
}

export interface ProjectMetricsSummary {
    projectId: number;
    projectName: string;
    diskUsageBytes: number;
    costUsd: number;
    invocationCount: number;
}

export interface MetricsSummary {
    totalDiskUsageBytes: number;
    totalCostUsd: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalInvocations: number;
    projectCount: number;
    projects: ProjectMetricsSummary[];
}

export async function fetchProjectMetrics(projectId: number): Promise<ProjectMetrics> {
    const response = await fetch(`${API}/projects/${projectId}/metrics`);
    if (!response.ok) throw new Error(`Failed to fetch project metrics: ${response.status}`);
    return response.json();
}

export async function fetchMetricsSummary(): Promise<MetricsSummary> {
    const response = await fetch(`${API}/metrics/summary`);
    if (!response.ok) throw new Error(`Failed to fetch metrics summary: ${response.status}`);
    return response.json();
}

export function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ── AI Usage ─────────────────────────────────────────────────────

export interface AiUsage {
    id: number;
    invocationType: string;
    taskId?: number;
    eventId?: number;
    projectId?: number;
    actorId?: number;
    actionType?: string;
    model?: string;
    costUsd?: number;
    inputTokens?: number;
    outputTokens?: number;
    durationMs?: number;
    createdOn: string;
}

export interface AiUsageSearchResults extends SearchResults<AiUsage> {
    totalCostUsd: number;
    totalInputTokens: number;
    totalOutputTokens: number;
}

export async function fetchUsage(
    page = 1, limit = 20,
    filterInvocationType?: string, filterProjectId?: number,
    filterActorId?: number, filterActionType?: string
): Promise<AiUsageSearchResults> {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (filterInvocationType) params.set("filterInvocationType", filterInvocationType);
    if (filterProjectId != null) params.set("filterProjectId", String(filterProjectId));
    if (filterActorId != null) params.set("filterActorId", String(filterActorId));
    if (filterActionType) params.set("filterActionType", filterActionType);
    const response = await fetch(`${API}/usage?${params}`);
    if (!response.ok) throw new Error(`Failed to fetch usage: ${response.status}`);
    return response.json();
}

// ── Events ───────────────────────────────────────────────────────

export interface AxiomEvent {
    id: number;
    source: string;
    eventType: string;
    issueRef?: string;
    repository?: string;
    projectId?: number;
    taskId?: number;
    receivedAt: string;
}

export async function fetchProjectEvents(projectId: number): Promise<AxiomEvent[]> {
    const response = await fetch(`${API}/projects/${projectId}/events`);
    if (!response.ok) throw new Error(`Failed to fetch project events: ${response.status}`);
    return response.json();
}

// ── Activity Log ──────────────────────────────────────────────────

export async function fetchActivityLog(
    page = 1, limit = 20,
    filterEventId?: number, filterSummary?: string,
    filterProjectId?: number, filterEntryType?: string
): Promise<SearchResults<ActivityLogEntry>> {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (filterEventId != null) params.set("filterEventId", String(filterEventId));
    if (filterSummary) params.set("filterSummary", filterSummary);
    if (filterProjectId != null) params.set("filterProjectId", String(filterProjectId));
    if (filterEntryType) params.set("filterEntryType", filterEntryType);
    const response = await fetch(`${API}/activity?${params}`);
    if (!response.ok) throw new Error(`Failed to fetch activity log: ${response.status}`);
    return response.json();
}

export async function fetchActivityLogDetails(activityId: number): Promise<string> {
    const response = await fetch(`${API}/activity/${activityId}/log`);
    if (!response.ok) throw new Error(`Failed to fetch activity log details: ${response.status}`);
    return response.text();
}
