#!/bin/bash
echo "Starting CS Skin Intelligence Platform (no Docker)..."

# Check if .env exists
if [ ! -f backend/.env ]; then
  echo "ERROR: backend/.env not found."
  echo "Copy scripts/local-setup/.env.local.example or .env.cloud.example to backend/.env"
  exit 1
fi

# Install dependencies if needed
if [ ! -d backend/node_modules ]; then
  echo "Installing backend dependencies..."
  cd backend && npm install && cd ..
fi
if [ ! -d frontend/node_modules ]; then
  echo "Installing frontend dependencies..."
  cd frontend && npm install && cd ..
fi

# Start backend
echo "Starting backend on port 5000..."
cd backend && npm run dev &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend
echo "Starting frontend on port 3000..."
cd ../frontend && VITE_API_URL=http://localhost:5000/api npm run dev &
FRONTEND_PID=$!

echo ""
echo "============================================"
echo "  CS Skin Intelligence Platform Running"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:5000"
echo "============================================"
echo ""
echo "Press Ctrl+C to stop both services"

# Handle Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
