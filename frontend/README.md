# Office Agents Simulator - Frontend

3D isometric office visualization powered by React, Three.js, and WebSockets.

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Three.js** - 3D graphics engine
- **React Three Fiber (R3F)** - React renderer for Three.js
- **Drei** - Helper components for R3F
- **Zustand** - Lightweight state management
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── AgentAvatar.tsx      # 3D agent representation
│   │   ├── Office.tsx            # 3D office environment
│   │   ├── OfficeScene.tsx       # Main 3D canvas
│   │   ├── ProposalInput.tsx     # User input form
│   │   ├── MetricsPanel.tsx      # Agent metrics display
│   │   └── EventLog.tsx          # Real-time event feed
│   ├── hooks/
│   │   └── useWebSocket.ts       # WebSocket connection hook
│   ├── services/
│   │   └── websocket.ts          # WebSocket service class
│   ├── store/
│   │   └── index.ts              # Zustand global state
│   ├── types/
│   │   └── index.ts              # TypeScript definitions
│   ├── App.tsx                   # Root component
│   ├── main.tsx                  # Entry point
│   └── index.css                 # Global styles
├── index.html                    # HTML template
├── package.json                  # Dependencies
├── vite.config.ts                # Vite configuration
├── tsconfig.json                 # TypeScript config
└── tailwind.config.js            # Tailwind config
```

## Development

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Features

### 3D Visualization

- **Isometric camera** at [10, 10, 10] for optimal office view
- **Agent avatars** with state-based animations:
  - IDLE: Static position
  - THINKING: Slow rotation
  - WORKING: Bobbing animation
  - COMPLETED: Quick spin
  - ERROR: Shake effect
- **Office environment** with desks, walls, lighting, and decorations
- **Real-time updates** via WebSocket events

### UI Overlays

- **Proposal Input**: Submit project ideas to the CEO
- **Metrics Panel**: Track agent performance, tokens, cost, and tasks
- **Event Log**: Real-time stream of agent events and system messages

### WebSocket Communication

- **Auto-reconnection** with exponential backoff
- **Event handling** for all agent state transitions
- **Bi-directional** communication with backend

## WebSocket Events

The frontend listens for these event types from the backend:

- `PROPOSAL_RECEIVED` - User submitted a proposal
- `CEO_EVALUATING` - CEO is evaluating feasibility
- `CEO_PLANNING` - CEO is creating task breakdown
- `DESIGNER_ANALYZING` - Designer is analyzing requirements
- `DESIGNER_WORKING` - Designer is creating mockups
- `DEVELOPER_ANALYZING` - Developer is analyzing tech requirements
- `DEVELOPER_WORKING` - Developer is implementing features
- `TASK_COMPLETED` - Agent finished a task
- `TASK_FAILED` - Agent encountered an error
- `SYSTEM_MESSAGE` - General system notification

## State Management

The app uses Zustand for global state with the following structure:

```typescript
{
  agents: Record<string, Agent>,      // Agent states and metrics
  tasks: Task[],                      // Active and completed tasks
  events: WSEvent[],                  // Event log history
  selectedAgent: string | null,       // Currently selected agent
  connectionInfo: {                   // WebSocket connection status
    connected: boolean,
    error: string | null,
    reconnectAttempts: number
  }
}
```

## Camera Controls

- **Orbit**: Left-click and drag
- **Zoom**: Mouse wheel
- **Pan**: Right-click and drag

Constraints:
- Polar angle: 0° to 80° (prevents flipping)
- Distance: 5 to 30 units

## Styling

Uses Tailwind CSS with a dark theme:
- Background: `gray-950`
- Panels: `gray-900/95` with backdrop blur
- Borders: `gray-700`
- Text: `white`, `gray-300`, `gray-400`

## Performance

- **React.memo** on expensive components
- **useFrame** for efficient animations
- **Canvas shadows** enabled for realistic lighting
- **Instance rendering** for repeated geometries (future optimization)

## Browser Support

Requires a modern browser with WebGL 2.0 support:
- Chrome 56+
- Firefox 51+
- Safari 15+
- Edge 79+

## Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_WS_URL=ws://localhost:8000/ws/office
```

Default WebSocket URL is `ws://localhost:8000/ws/office` if not specified.

## Troubleshooting

### WebSocket Connection Issues

1. Ensure backend is running on port 8000
2. Check browser console for connection errors
3. Verify WebSocket URL in `websocket.ts`

### 3D Rendering Issues

1. Check browser WebGL support at `https://get.webgl.org/`
2. Update graphics drivers
3. Disable browser extensions that might block WebGL

### Performance Issues

1. Reduce shadow quality in `OfficeScene.tsx`
2. Lower particle count for effects
3. Disable post-processing effects
