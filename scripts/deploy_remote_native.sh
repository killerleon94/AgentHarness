#!/usr/bin/env bash

set -Eeuo pipefail

APP_DIR=${APP_DIR:-$(pwd)}
RELEASE_DIR=${RELEASE_DIR:-}
ENV_FILE=${ENV_FILE:-.env.production}
APP_PORT=${APP_PORT:-9997}
BACKEND_PORT=${BACKEND_PORT:-8080}
APP_VERSION=${APP_VERSION:-0.2.2}
GIT_COMMIT=${GIT_COMMIT:-unknown}
LOG_DIR=${LOG_DIR:-$APP_DIR/logs}
RUN_DIR=${RUN_DIR:-$APP_DIR/run}

log() {
  printf '[deploy-native] %s\n' "$*"
}

collect_matching_pids() {
  local pattern=$1
  pgrep -f "$pattern" 2>/dev/null || true
}

kill_pids() {
  local label=$1
  shift
  local pids=("$@")

  if [ ${#pids[@]} -eq 0 ]; then
    return
  fi

  log "Stopping ${label}: ${pids[*]}"
  sudo kill -9 "${pids[@]}" 2>/dev/null || true
}

wait_for_port_to_clear() {
  local port=$1
  local attempt

  for attempt in $(seq 1 20); do
    if ! sudo lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  log "Port $port is still occupied after stop attempt"
  sudo lsof -iTCP:"$port" -sTCP:LISTEN || true
  return 1
}

kill_frontend_processes() {
  local frontend_dir="$APP_DIR/apps/web"
  local pid
  local collected=()

  while IFS= read -r pid; do
    [ -n "$pid" ] && collected+=("$pid")
  done < <(sudo lsof -tiTCP:"$APP_PORT" -sTCP:LISTEN 2>/dev/null || true)

  while IFS= read -r pid; do
    [ -n "$pid" ] && collected+=("$pid")
  done < <(collect_matching_pids "pnpm exec next start -p $APP_PORT -H 127.0.0.1")

  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    local cwd
    cwd=$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)
    case "$cwd" in
      "$frontend_dir"|"$frontend_dir (deleted)")
        collected+=("$pid")
        ;;
    esac
  done < <(collect_matching_pids "next-server")

  if [ ${#collected[@]} -eq 0 ]; then
    return
  fi

  mapfile -t collected < <(printf '%s\n' "${collected[@]}" | awk 'NF { print }' | sort -u)
  kill_pids "frontend process(es)" "${collected[@]}"
  wait_for_port_to_clear "$APP_PORT"
}

ensure_pid_running() {
  local label=$1
  local pid_file=$2
  local pid

  if [ ! -f "$pid_file" ]; then
    log "$label pid file is missing: $pid_file"
    return 1
  fi

  pid=$(cat "$pid_file")
  if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    log "$label process is not running (pid: ${pid:-missing})"
    return 1
  fi

  return 0
}

set_or_append() {
  local key=$1
  local value=$2

  if grep -q "^${key}=" "$ENV_FILE"; then
    python3 - "$ENV_FILE" "$key" "$value" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
key = sys.argv[2]
value = sys.argv[3]
lines = path.read_text().splitlines()
for index, line in enumerate(lines):
    if line.startswith(f"{key}="):
        lines[index] = f"{key}={value}"
        break
path.write_text("\n".join(lines) + "\n")
PY
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

promote_release_dir() {
  if [ -z "$RELEASE_DIR" ] || [ "$RELEASE_DIR" = "$APP_DIR" ]; then
    return
  fi

  log "Promoting release payload from $RELEASE_DIR to $APP_DIR"
  mkdir -p "$APP_DIR"
  find "$APP_DIR" -mindepth 1 -maxdepth 1 \
    ! -name '.env.production' \
    ! -name '.env.production.local' \
    -exec rm -rf {} +
  cp -a "$RELEASE_DIR"/. "$APP_DIR"/
}

ensure_runtime_tools() {
  export DEBIAN_FRONTEND=noninteractive
  export NEEDRESTART_MODE=a

  if ! command -v curl >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y curl
  fi

  if ! command -v lsof >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y lsof
  fi

  if ! command -v node >/dev/null 2>&1; then
    log "Installing Node.js 22"
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    log "Enabling pnpm via corepack"
    corepack enable
    corepack prepare pnpm@10.28.2 --activate
  fi

  if ! command -v go >/dev/null 2>&1; then
    log "Installing Go 1.26.1"
    curl -fsSL https://go.dev/dl/go1.26.1.linux-amd64.tar.gz -o /tmp/go1.26.1.linux-amd64.tar.gz
    sudo rm -rf /usr/local/go
    sudo tar -C /usr/local -xzf /tmp/go1.26.1.linux-amd64.tar.gz
    sudo ln -sf /usr/local/go/bin/go /usr/local/bin/go
  fi
}

ensure_env_file() {
  if [ ! -f "$ENV_FILE" ]; then
    log "Creating $ENV_FILE from template"
    cp .env.production.example "$ENV_FILE"
  fi

  if ! grep -q '^JWT_SECRET=' "$ENV_FILE" || [ -z "$(sed -n 's/^JWT_SECRET=//p' "$ENV_FILE")" ]; then
    set_or_append JWT_SECRET "$(openssl rand -hex 32)"
  fi

  if ! grep -q '^FRONTEND_ORIGIN=' "$ENV_FILE" || [ -z "$(sed -n 's/^FRONTEND_ORIGIN=//p' "$ENV_FILE")" ]; then
    set_or_append FRONTEND_ORIGIN "http://127.0.0.1:${APP_PORT}"
  fi

  if ! grep -q '^MULTICA_APP_URL=' "$ENV_FILE" || [ -z "$(sed -n 's/^MULTICA_APP_URL=//p' "$ENV_FILE")" ]; then
    set_or_append MULTICA_APP_URL "http://127.0.0.1:${APP_PORT}"
  fi

  if ! grep -q '^CORS_ALLOWED_ORIGINS=' "$ENV_FILE" || [ -z "$(sed -n 's/^CORS_ALLOWED_ORIGINS=//p' "$ENV_FILE")" ]; then
    set_or_append CORS_ALLOWED_ORIGINS "http://127.0.0.1:${APP_PORT}"
  fi

  if ! grep -q '^DATABASE_URL=' "$ENV_FILE" || [ -z "$(sed -n 's/^DATABASE_URL=//p' "$ENV_FILE")" ]; then
    log "DATABASE_URL is required for native deployment"
    log "Set DATABASE_URL in $ENV_FILE to a reachable PostgreSQL 17 + pgvector instance"
    exit 1
  fi

  # S3-compatible storage (MinIO/Garage) - optional
  if ! grep -q '^S3_BUCKET=' "$ENV_FILE" || [ -z "$(sed -n 's/^S3_BUCKET=//p' "$ENV_FILE")" ]; then
    set_or_append S3_BUCKET "multica-uploads"
  fi

  if ! grep -q '^S3_REGION=' "$ENV_FILE" || [ -z "$(sed -n 's/^S3_REGION=//p' "$ENV_FILE")" ]; then
    set_or_append S3_REGION "us-east-1"
  fi

  if ! grep -q '^AWS_ENDPOINT_URL=' "$ENV_FILE" || [ -z "$(sed -n 's/^AWS_ENDPOINT_URL=//p' "$ENV_FILE")" ]; then
    set_or_append AWS_ENDPOINT_URL ""
  fi

  if ! grep -q '^AWS_ACCESS_KEY_ID=' "$ENV_FILE" || [ -z "$(sed -n 's/^AWS_ACCESS_KEY_ID=//p' "$ENV_FILE")" ]; then
    set_or_append AWS_ACCESS_KEY_ID ""
  fi

  if ! grep -q '^AWS_SECRET_ACCESS_KEY=' "$ENV_FILE" || [ -z "$(sed -n 's/^AWS_SECRET_ACCESS_KEY=//p' "$ENV_FILE")" ]; then
    set_or_append AWS_SECRET_ACCESS_KEY ""
  fi
}

stop_docker_stack() {
  if command -v docker >/dev/null 2>&1; then
    log "Stopping Docker deployment stack"
    sudo docker compose --env-file "$ENV_FILE" -f docker-compose.deploy.yml down --remove-orphans || true
  fi
}

kill_listener() {
  local port=$1
  local pids
  pids=$(sudo lsof -tiTCP:"$port" -sTCP:LISTEN || true)
  if [ -n "$pids" ]; then
    log "Stopping existing listener(s) on 127.0.0.1:$port: $pids"
    sudo kill -9 $pids || true
  fi

  wait_for_port_to_clear "$port"
}

build_release() {
  log "Installing dependencies"
  ELECTRON_SKIP_BINARY_DOWNLOAD=1 \
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
  pnpm install --frozen-lockfile

  log "Building web app"
  pnpm --filter @multica/web build

  log "Building Go binaries"
  make build
}

run_migrations() {
  log "Running database migrations"
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
  (cd server && ./bin/migrate up)
}

write_launchers() {
  mkdir -p "$LOG_DIR" "$RUN_DIR"

  cat > "$RUN_DIR/backend.sh" <<EOF
#!/usr/bin/env bash
set -Eeuo pipefail
cd "$APP_DIR"
set -a
. "$APP_DIR/$ENV_FILE"
set +a
export PORT="$BACKEND_PORT"
exec ./server/bin/server
EOF
  chmod +x "$RUN_DIR/backend.sh"

  cat > "$RUN_DIR/frontend.sh" <<EOF
#!/usr/bin/env bash
set -Eeuo pipefail
cd "$APP_DIR/apps/web"
set -a
. "$APP_DIR/$ENV_FILE"
set +a
export REMOTE_API_URL="\${REMOTE_API_URL:-http://127.0.0.1:${BACKEND_PORT}}"
exec pnpm exec next start -p "$APP_PORT" -H 127.0.0.1
EOF
  chmod +x "$RUN_DIR/frontend.sh"
}

start_services() {
  log "Starting backend"
  nohup "$RUN_DIR/backend.sh" > "$LOG_DIR/backend.log" 2>&1 < /dev/null &
  echo $! > "$RUN_DIR/backend.pid"

  log "Starting frontend"
  nohup "$RUN_DIR/frontend.sh" > "$LOG_DIR/frontend.log" 2>&1 < /dev/null &
  echo $! > "$RUN_DIR/frontend.pid"
}

healthcheck() {
  local frontend_url="http://127.0.0.1:${APP_PORT}"
  local backend_url="http://127.0.0.1:${BACKEND_PORT}/health"
  local attempt

  for attempt in $(seq 1 60); do
    if ! ensure_pid_running "Backend" "$RUN_DIR/backend.pid"; then
      tail -n 50 "$LOG_DIR/backend.log" || true
      return 1
    fi

    if ! ensure_pid_running "Frontend" "$RUN_DIR/frontend.pid"; then
      tail -n 50 "$LOG_DIR/frontend.log" || true
      return 1
    fi

    if curl --silent --fail "$backend_url" >/dev/null && curl --silent --fail "$frontend_url" >/dev/null; then
      log "Frontend is reachable at $frontend_url"
      log "Backend healthcheck passed at $backend_url"
      return 0
    fi
    sleep 2
  done

  log "Healthcheck failed"
  tail -n 50 "$LOG_DIR/backend.log" || true
  tail -n 50 "$LOG_DIR/frontend.log" || true
  return 1
}

main() {
  promote_release_dir
  cd "$APP_DIR"
  ensure_runtime_tools
  ensure_env_file
  stop_docker_stack
  kill_frontend_processes
  kill_listener "$BACKEND_PORT"
  kill_listener "$APP_PORT"
  build_release
  run_migrations
  write_launchers
  start_services
  healthcheck
}

main "$@"