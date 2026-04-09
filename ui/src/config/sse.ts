import { getApiBaseUrl } from "./api";

/**
 * SSE event received from the backend.
 */
export interface AxiomSseEvent {
    type: string;
    data: Record<string, unknown>;
}

/**
 * Callback type for SSE event listeners.
 */
export type SseListener = (event: AxiomSseEvent) => void;

/**
 * Manages a Server-Sent Events connection to the Axiom backend.
 * Automatically reconnects on disconnection with exponential backoff.
 */
export class SseClient {
    private eventSource: EventSource | null = null;
    private listeners: SseListener[] = [];
    private reconnectDelay = 1000;
    private maxReconnectDelay = 30000;
    private closed = false;

    /**
     * Connects to the SSE endpoint and starts receiving events.
     */
    connect(): void {
        if (this.eventSource) {
            this.eventSource.close();
        }

        this.closed = false;
        const url = `${getApiBaseUrl()}/api/v1/sse`;
        this.eventSource = new EventSource(url);

        this.eventSource.onopen = () => {
            console.log("SSE connected");
            this.reconnectDelay = 1000;
        };

        this.eventSource.onmessage = (event) => {
            try {
                const parsed: AxiomSseEvent = JSON.parse(event.data);
                this.listeners.forEach((listener) => listener(parsed));
            } catch (e) {
                console.warn("Failed to parse SSE event:", event.data);
            }
        };

        this.eventSource.onerror = () => {
            if (this.closed) return;
            console.warn(`SSE disconnected, reconnecting in ${this.reconnectDelay}ms`);
            this.eventSource?.close();
            this.eventSource = null;
            setTimeout(() => {
                if (!this.closed) this.connect();
            }, this.reconnectDelay);
            this.reconnectDelay = Math.min(
                this.reconnectDelay * 2,
                this.maxReconnectDelay
            );
        };
    }

    /**
     * Adds a listener that will be called for every SSE event.
     *
     * @param listener the callback function
     * @returns an unsubscribe function
     */
    subscribe(listener: SseListener): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        };
    }

    /**
     * Disconnects from the SSE endpoint.
     */
    disconnect(): void {
        this.closed = true;
        this.eventSource?.close();
        this.eventSource = null;
    }
}

/**
 * Singleton SSE client instance.
 */
export const sseClient = new SseClient();
