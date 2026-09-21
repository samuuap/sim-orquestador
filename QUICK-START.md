# Quick Start Guide 🚀

## Fastest Way to Run (Windows)

```bash
# 1. Navigate to project
cd C:\Users\samuel\Documents\sim-orquestador

# 2. Run both servers
dev.bat
```

That's it! The script will:
- Create Python virtual environment if needed
- Install backend dependencies
- Start backend on http://localhost:8000
- Install frontend dependencies
- Start frontend on http://localhost:5173

## Manual Setup (If dev.bat doesn't work)

### Terminal 1 - Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# Edit .env and set: LLM_PROVIDER=mock
uvicorn main:app --reload --port 8000
```

### Terminal 2 - Frontend
```bash
cd frontend
npm install
npm run dev
```

## Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

## First Time Use

1. Open http://localhost:5173 in your browser
2. Wait for "Connected" status (green indicator)
3. Type a project proposal in the input box:
   ```
   Build a real-time chat application with authentication
   ```
4. Click "Send"
5. Watch the agents work in the 3D office!

## What You'll See

### 3D Office View
- **CEO** (red avatar, center desk) - Evaluates your proposal
- **Designer** (purple avatar, left desk) - Creates UI/UX designs
- **Developer** (blue avatar, right desk) - Plans implementation

### Agent States (colors)
- **Gray** - IDLE (waiting for tasks)
- **Amber** - THINKING (processing)
- **Green** - WORKING (executing tasks)
- **Purple** - WAITING (pending dependencies)
- **Red** - ERROR (something went wrong)

### Agent Animations
- **IDLE**: Static position
- **THINKING**: Slow rotation
- **WORKING**: Bobbing up and down
- **COMPLETED**: Quick spin
- **ERROR**: Shaking

### UI Panels
- **Left**: Event log with real-time activity
- **Right**: Metrics (tasks, tokens, cost, response times)
- **Bottom**: Proposal input form

## Testing Without API Costs

The default configuration uses a **Mock LLM Provider** that:
- ✅ Generates realistic responses instantly
- ✅ Costs $0.00 (no API calls)
- ✅ Works offline
- ✅ Returns structured Pydantic-validated data

Perfect for testing and development!

## Using Real LLM Providers

Edit `backend/.env`:

```env
# Change from mock to real provider
LLM_PROVIDER=openai  # or anthropic, deepseek, etc.

# Add your API key
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
```

Supported providers:
- openai (GPT-4, GPT-3.5)
- anthropic (Claude 3.5 Sonnet)
- deepseek (DeepSeek Chat)
- nvidia (Nemotron)
- minimax
- glm
- custom (any OpenAI-compatible API)

## Troubleshooting

### Backend won't start
- Check Python version: `python --version` (need 3.11+)
- Check if port 8000 is already in use
- Make sure .env file exists in backend/

### Frontend won't start
- Check Node version: `node --version` (need 18+)
- Delete `node_modules` and run `npm install` again
- Check if port 5173 is already in use

### WebSocket won't connect
- Make sure backend is running first
- Check backend logs for errors
- Try refreshing the browser page

### Agents not appearing in 3D scene
- Check browser console for errors (F12)
- Verify WebSocket connection status (should show "Connected")
- Try submitting a proposal to trigger agent initialization

## Sample Proposals to Try

```
Build a real-time chat application with authentication

Create a task management dashboard with drag-and-drop

Design an e-commerce platform with shopping cart

Develop a social media feed with infinite scroll

Build a video streaming platform like YouTube

Create a collaborative document editor like Google Docs

Design a fitness tracking mobile app

Build a restaurant ordering system with payment integration
```

## Camera Controls

- **Rotate**: Left-click and drag
- **Zoom**: Mouse wheel
- **Pan**: Right-click and drag

## Next Steps

1. Submit different proposals and watch agents collaborate
2. Check the metrics panel to see token usage and costs
3. Review the event log to see the workflow
4. Click on agents to select them
5. Try different LLM providers in .env

## Running Tests

```bash
cd backend
pytest -v

# Expected output:
# test_ceo.py::test_ceo_initialization PASSED
# test_ceo.py::test_ceo_evaluate_proposal PASSED
# ... (16 tests total)
# ======================== 16 passed ========================
```

## Project Structure

```
sim-orquestador/
├── backend/          # Python FastAPI server
├── frontend/         # React + Three.js app
├── prompts/          # Agent system prompts
├── dev.bat           # Windows quick start
├── dev.sh            # Linux/Mac quick start
└── *.md              # Documentation
```

## Learn More

- Backend README: `backend/README.md`
- Frontend README: `frontend/README.md`
- Full Documentation: `PROJECT-COMPLETE.md`
- Implementation Checklist: `FINAL-CHECKLIST.md`

## Support

Check the documentation files for detailed information:
- Architecture: `CLAUDE.md`
- API Documentation: http://localhost:8000/docs
- GitHub Issues: (add your repo URL)

---

**Enjoy your Office Agents Simulator!** 🎉

Built with FastAPI, React, Three.js, LangGraph, and Claude Code.
