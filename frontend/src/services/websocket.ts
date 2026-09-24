/**
 * WebSocket service for real-time communication with backend
 */

import type { WSEvent } from '@/types';

type WSEventHandler = (event: WSEvent) => void;
type ConnectionHandler = (connected: boolean) => void;

/**
 * Backend WebSocket URL.
 *
 * Comes from VITE_WS_URL when set; otherwise it is derived from the page
 * origin so the app also works behind the Vite dev proxy and in production
 * builds served from the same host as the API.
 */
export function resolveWsUrl(): string {
  const configured = import.meta.env.VITE_WS_URL;
  if (configured) return configured;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/office`;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimeout: number | null = null;
  private intentionallyClosed = false;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private eventHandlers: Set<WSEventHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();

  connect(url: string = resolveWsUrl()) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected');
      return;
    }

    console.log('[WS] Connecting to', url);
    this.intentionallyClosed = false;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WS] Connected');
        this.reconnectDelay = 1000; // Reset reconnect delay
        this.notifyConnectionHandlers(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WSEvent = JSON.parse(event.data);
          console.log('[WS] Event received:', data.event_type, data);
          this.notifyEventHandlers(data);
        } catch (error) {
          console.error('[WS] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);
      };

      this.ws.onclose = () => {
        console.log('[WS] Disconnected');
        this.notifyConnectionHandlers(false);
        if (!this.intentionallyClosed) {
          this.scheduleReconnect(url);
        }
      };
    } catch (error) {
      console.error('[WS] Connection failed:', error);
      this.scheduleReconnect(url);
    }
  }

  disconnect() {
    console.log('[WS] Disconnecting...');
    this.intentionallyClosed = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(data: unknown): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    console.warn('[WS] Cannot send, not connected');
    return false;
  }

  /** Submit a project proposal to the CEO agent. */
  submitProposal(proposal: string): boolean {
    return this.send({
      type: 'SUBMIT_PROPOSAL',
      payload: { proposal },
    });
  }

  onEvent(handler: WSEventHandler) {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  onConnection(handler: ConnectionHandler) {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  private notifyEventHandlers(event: WSEvent) {
    this.eventHandlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error('[WS] Event handler error:', error);
      }
    });
  }

  private notifyConnectionHandlers(connected: boolean) {
    this.connectionHandlers.forEach((handler) => {
      try {
        handler(connected);
      } catch (error) {
        console.error('[WS] Connection handler error:', error);
      }
    });
  }

  private scheduleReconnect(url: string) {
    if (this.reconnectTimeout) {
      return; // Already scheduled
    }

    console.log(`[WS] Reconnecting in ${this.reconnectDelay}ms...`);

    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect(url);
    }, this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2,
      this.maxReconnectDelay
    );
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsService = new WebSocketService();
export const websocketService = wsService; // Alias for compatibility
