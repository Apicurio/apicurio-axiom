/**
 * Returns the base URL for the Axiom API.
 *
 * In development, the Vite proxy handles routing /api requests to the backend.
 * In production, the API URL is injected via the AXIOM_API_URL environment variable
 * into a global config object on window.
 */
export function getApiBaseUrl(): string {
    const win = window as Record<string, unknown>;
    if (win.AXIOM_API_URL && typeof win.AXIOM_API_URL === "string") {
        return win.AXIOM_API_URL;
    }
    return "";
}

export interface SystemHealth {
    status: string;
    version: string;
    timestamp: string;
}

export async function fetchSystemHealth(): Promise<SystemHealth> {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/system/health`);
    if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
    }
    return response.json();
}
