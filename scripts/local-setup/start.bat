@echo off
echo Starting CS Skin Intelligence Platform (no Docker)...

REM Check if .env exists
if not exist backend\.env (
  echo ERROR: backend\.env not found.
  echo Copy scripts\local-setup\.env.local.example or .env.cloud.example to backend\.env
  exit /b 1
)

REM Install dependencies if needed
if not exist backend\node_modules (
  echo Installing backend dependencies...
  cd backend && call npm install && cd ..
)
if not exist frontend\node_modules (
  echo Installing frontend dependencies...
  cd frontend && call npm install && cd ..
)

echo Starting backend on port 5000...
start "CS-Backend" cmd /c "cd backend && npm run dev"

timeout /t 3 /nobreak >nul

echo Starting frontend on port 3000...
start "CS-Frontend" cmd /c "cd frontend && set VITE_API_URL=http://localhost:5000/api && npm run dev"

echo.
echo ============================================
echo   CS Skin Intelligence Platform Running
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:5000
echo ============================================
echo.
echo Close both terminal windows to stop.
