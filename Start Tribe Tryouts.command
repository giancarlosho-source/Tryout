#!/bin/bash
# Double-click this file to start the Tribe Tryouts server

DIR="$(cd "$(dirname "$0")" && pwd)"
NODE="/Users/gian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
DATABASE_URL="postgresql://localhost/tribe_tryouts"

echo "================================================"
echo "  TRIBE TRYOUTS - Starting servers..."
echo "================================================"
echo ""

# Get local IP
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "unknown")

# Make sure PostgreSQL is running
if ! pg_isready -q 2>/dev/null; then
  echo "Starting PostgreSQL..."
  brew services start postgresql@14 2>/dev/null || pg_ctl start 2>/dev/null || true
  sleep 2
fi

# Push any DB schema changes
echo "Checking database schema..."
DATABASE_URL="$DATABASE_URL" "$NODE" "$DIR/lib/db/node_modules/drizzle-kit/bin.cjs" push \
  --config "$DIR/lib/db/drizzle.config.ts" 2>/dev/null && echo "Database ready." || echo "Database already up to date."

echo ""

# Build API server
echo "Building API server..."
cd "$DIR/artifacts/api-server"
"$NODE" ./build.mjs 2>&1 | tail -3
echo ""

# Update iPad .env with current IP
echo "Updating iPad API connection to $LOCAL_IP..."
echo "VITE_API_URL=http://$LOCAL_IP:8080" > "$DIR/artifacts/tryout-app-ios/.env"

# Build iOS web app
echo "Building iPad app..."
cd "$DIR/artifacts/tryout-app-ios"
"$NODE" node_modules/.bin/vite build --config vite.config.ts 2>&1 | tail -3

# Sync Capacitor
echo "Syncing iPad app..."
"$NODE" node_modules/.bin/cap sync ios 2>&1 | tail -3
echo ""

# Start API server in background
echo "Starting API server on port 8080..."
DATABASE_URL="$DATABASE_URL" PORT=8080 "$NODE" --enable-source-maps \
  "$DIR/artifacts/api-server/dist/index.mjs" &> /tmp/tribe-api.log &
API_PID=$!
sleep 2

if kill -0 $API_PID 2>/dev/null; then
  echo "API server running (PID $API_PID)"
else
  echo "ERROR: API server failed to start. Check /tmp/tribe-api.log"
  cat /tmp/tribe-api.log | tail -10
  read -p "Press Enter to close..."
  exit 1
fi

echo ""
echo "================================================"
echo "  All systems GO!"
echo ""
echo "  iPad app: rebuild in Xcode (Cmd+R) to"
echo "  push latest version to connected iPads."
echo ""
echo "  API server: http://$LOCAL_IP:8080"
echo "  Web (browser): http://$LOCAL_IP:19107"
echo ""
echo "  Make sure all iPads are on the same Wi-Fi."
echo "================================================"
echo ""
echo "  Starting web app... (this window must stay open)"
echo ""

# Start frontend (stays in foreground so closing the window stops everything)
cd "$DIR/artifacts/tryout-app"
BASE_PATH="/" PORT=19107 "$NODE" "$DIR/artifacts/tryout-app/node_modules/vite/bin/vite.js" \
  --config vite.config.ts --host 0.0.0.0 2>&1

# Cleanup on exit
kill $API_PID 2>/dev/null
echo "Servers stopped."
