#!/usr/bin/env bash
#
# Storyroom — one-command deploy.
#
# After cloning the repo, run:   bash deploy.sh
#
# Builds and starts the whole app in Docker (Next.js web + Hocuspocus realtime
# server + Postgres), applies the database schema, waits until the app answers,
# and prints the URLs. Re-running it safely rebuilds and restarts.
set -euo pipefail

cd "$(dirname "$0")"

echo "▶ Storyroom deploy"

# --- Prerequisites -----------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  echo "✖ Docker is not installed. Install Docker Desktop or Docker Engine, then re-run." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "✖ The Docker daemon is not running. Start Docker, then re-run." >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "✖ Docker Compose is not available. Update Docker, then re-run." >&2
  exit 1
fi

# --- Build + start -----------------------------------------------------------
# Order is handled by docker-compose: postgres -> migrate (schema) -> web + realtime.
echo "▶ Building and starting containers (web + realtime + Postgres)…"
$COMPOSE up --build -d

# --- Wait for readiness ------------------------------------------------------
APP_URL="${STORYROOM_APP_URL:-http://localhost:3000}"
printf "▶ Waiting for the app to become ready"
for _ in $(seq 1 90); do
  if curl -fsS "$APP_URL" >/dev/null 2>&1; then
    echo ""
    echo ""
    echo "✔ Storyroom is live"
    echo "    App:      $APP_URL"
    echo "    Realtime: ws://localhost:1234"
    echo ""
    echo "  Logs:  $COMPOSE logs -f web realtime"
    echo "  Stop:  $COMPOSE down            (add -v to also delete the database)"
    exit 0
  fi
  printf "."
  sleep 2
done

echo ""
echo "✖ Timed out waiting for $APP_URL" >&2
echo "  Inspect logs with:  $COMPOSE logs --tail=50 web" >&2
exit 1
