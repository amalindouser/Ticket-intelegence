#!/bin/bash
# Start all services after reboot
set -e

PROJECT_DIR="/home/amldv/lab_amld/project_ticket_intelegence"
PGDATA="$PROJECT_DIR/pgdata"
PG_BIN="/usr/lib/postgresql/16/bin"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "=== Starting PostgreSQL on port 5433 ==="
if ! $PG_BIN/pg_isready -h localhost -p 5433 -q 2>/dev/null; then
  $PG_BIN/pg_ctl -D "$PGDATA" -l "$PGDATA/logfile" -o "-p 5433 -k /tmp" start
  sleep 2
  echo "PostgreSQL started on port 5433"
else
  echo "PostgreSQL already running"
fi

echo "=== Starting Ollama ==="
if ! curl -s http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  ollama serve &
  sleep 2
  echo "Ollama started"
else
  echo "Ollama already running"
fi

echo "=== Starting Backend (port 3001) ==="
if lsof -ti:3001 >/dev/null 2>&1; then
  echo "Backend already running"
else
  nohup sh -c "cd $BACKEND_DIR && node src/app.js" > /tmp/backend.log 2>&1 &
  sleep 3
  echo "Backend started"
fi

echo "=== Starting Frontend (port 5173) ==="
if lsof -ti:5173 >/dev/null 2>&1; then
  echo "Frontend already running"
else
  nohup sh -c "cd $FRONTEND_DIR && npx vite --host" > /tmp/frontend.log 2>&1 &
  sleep 3
  echo "Frontend started"
fi

echo ""
echo "=== All services started ==="
echo "  DB:      localhost:5433"
echo "  Backend: http://localhost:3001"
echo "  Frontend: http://localhost:5173"
echo "  Ollama:  http://127.0.0.1:11434"
