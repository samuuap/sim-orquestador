#!/bin/bash

# Office Agents Simulator - Development Startup Script
# Starts both backend and frontend servers concurrently

echo "=========================================="
echo "Office Agents Simulator - Dev Environment"
echo "=========================================="
echo ""

# Check if we're in the project root
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "Error: Must run from project root directory"
    exit 1
fi

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo "Shutting down servers..."
    kill $(jobs -p) 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

echo "[1/4] Checking Python environment..."
cd backend
if [ ! -d "venv" ]; then
    echo "Virtual environment not found. Creating..."
    python -m venv venv
fi

# Activate virtual environment
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi

echo "[2/4] Installing Python dependencies..."
pip install -q -r requirements.txt

echo "[3/4] Starting backend server (port 8000)..."
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

cd ../frontend

echo "[4/4] Installing frontend dependencies and starting dev server..."
if [ ! -d "node_modules" ]; then
    npm install
fi

npm run dev &
FRONTEND_PID=$!

echo ""
echo "=========================================="
echo "Servers started successfully!"
echo "=========================================="
echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo "API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "=========================================="
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
