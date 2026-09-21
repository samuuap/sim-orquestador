@echo off
REM Office Agents Simulator - Development Startup Script (Windows)
REM Starts both backend and frontend servers

echo ==========================================
echo Office Agents Simulator - Dev Environment
echo ==========================================
echo.

REM Check if we're in the project root
if not exist "backend" (
    echo Error: backend directory not found
    exit /b 1
)
if not exist "frontend" (
    echo Error: frontend directory not found
    exit /b 1
)

echo [1/4] Checking Python environment...
cd backend

if not exist "venv" (
    echo Virtual environment not found. Creating...
    python -m venv venv
)

echo [2/4] Installing Python dependencies...
call venv\Scripts\activate.bat
pip install -q -r requirements.txt

echo [3/4] Starting backend server (port 8000)...
start "Backend Server" cmd /k "call venv\Scripts\activate.bat && uvicorn main:app --reload --port 8000"

timeout /t 3 /nobreak >nul

cd ..\frontend

echo [4/4] Installing frontend dependencies and starting dev server...
if not exist "node_modules" (
    call npm install
)

start "Frontend Server" cmd /k "npm run dev"

echo.
echo ==========================================
echo Servers started successfully!
echo ==========================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo API Docs: http://localhost:8000/docs
echo.
echo Close the terminal windows to stop the servers
echo ==========================================
echo.

cd ..
