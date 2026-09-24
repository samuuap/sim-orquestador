/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** WebSocket endpoint of the backend, e.g. ws://localhost:8000/ws/office */
  readonly VITE_WS_URL?: string;
  /** Base URL for the backend REST API, e.g. http://localhost:8000 */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
