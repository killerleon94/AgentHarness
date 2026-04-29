#!/bin/bash
# Garage S3-compatible storage connection script
# Detects and connects to existing Garage installation
#
# Usage:
#   ./start-garage.sh detect          - Detect existing Garage
#   ./start-garage.sh connect ENDPOINT - Connect to remote Garage
#   ./start-garage.sh status           - Check connection status
#   ./start-garage.sh env             - Print environment variables

set -Eeuo pipefail

GARAGE_HOST="${GARAGE_HOST:-127.0.0.1}"
GARAGE_PORT="${GARAGE_PORT:-9000}"
GARAGE_ADMIN_PORT="${GARAGE_ADMIN_PORT:-3903}"
BUCKET_NAME="${BUCKET_NAME:-multica-uploads}"
GARAGE_DIR="${GARAGE_DIR:-$HOME/garage}"
GARAGE_CREDENTIALS="${GARAGE_CREDENTIALS:-$GARAGE_DIR/.credentials}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

detect_local_garage() {
    log "Detecting local Garage installation..."

    local pid_file="$GARAGE_DIR/garage.pid"
    local pid
    local detected_endpoint=""
    local detected_admin=""

    if [ -f "$pid_file" ]; then
        pid=$(cat "$pid_file" 2>/dev/null || echo "")
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            log "Found running Garage (PID: $pid)"
            detected_endpoint="http://127.0.0.1:$GARAGE_PORT"
            detected_admin="http://127.0.0.1:$GARAGE_ADMIN_PORT"
        fi
    fi

    if [ -z "$detected_endpoint" ]; then
        if curl -sf "http://127.0.0.1:$GARAGE_PORT/" > /dev/null 2>&1; then
            log "Garage is running on port $GARAGE_PORT"
            detected_endpoint="http://127.0.0.1:$GARAGE_PORT"
            detected_admin="http://127.0.0.1:$GARAGE_ADMIN_PORT"
        fi
    fi

    if [ -z "$detected_endpoint" ]; then
        local garage_bin=""
        if command -v garage >/dev/null 2>&1; then
            garage_bin="garage"
        elif [ -x "/usr/local/bin/garage" ]; then
            garage_bin="/usr/local/bin/garage"
        elif [ -x "$HOME/garage/bin/garage" ]; then
            garage_bin="$HOME/garage/bin/garage"
        fi

        if [ -n "$garage_bin" ] && [ -f "$GARAGE_DIR/garage.toml" ]; then
            log "Found Garage binary and config"
        fi
    fi

    if [ -n "$detected_endpoint" ]; then
        echo "ENDPOINT=$detected_endpoint"
        echo "ADMIN=$detected_admin"
        return 0
    fi

    return 1
}

read_credentials() {
    local access_key=""
    local secret_key=""

    if [ -f "$GARAGE_CREDENTIALS" ]; then
        log "Reading credentials from $GARAGE_CREDENTIALS"
        while IFS= read -r line; do
            case "$line" in
                AWS_ACCESS_KEY_ID=*) access_key="${line#*=}" ;;
                AWS_SECRET_ACCESS_KEY=*) secret_key="${line#*=}" ;;
                GARAGE_ACCESS_KEY=*) access_key="${line#*=}" ;;
                GARAGE_SECRET_KEY=*) secret_key="${line#*=}" ;;
            esac
        done < "$GARAGE_CREDENTIALS"

        if [ -n "$access_key" ] && [ -n "$secret_key" ]; then
            echo "ACCESS_KEY=$access_key"
            echo "SECRET_KEY=$secret_key"
            return 0
        fi
    fi

    if [ -f "$GARAGE_DIR/garage.toml" ]; then
        log "Reading from Garage config..."
        local admin_token
        admin_token=$(grep 'admin_token' "$GARAGE_DIR/garage.toml" 2>/dev/null | head -1 | sed 's/.*= *//' | tr -d '"' || echo "")
        if [ -n "$admin_token" ]; then
            log "Admin token found in config"
            local keys_json
            keys_json=$(curl -sf "http://${GARAGE_HOST}:${GARAGE_ADMIN_PORT}/v0/key/list" \
                -H "Authorization: Bearer $admin_token" 2>/dev/null || echo "")
            if [ -n "$keys_json" ]; then
                access_key=$(echo "$keys_json" | python3 -c "import sys,json; keys=json.load(sys.stdin).get('keys',[]); print(keys[0]['access_key_id'] if keys else '')" 2>/dev/null || echo "")
                secret_key=$(echo "$keys_json" | python3 -c "import sys,json; keys=json.load(sys.stdin).get('keys',[]); print(keys[0]['secret_access_key'] if keys else '')" 2>/dev/null || echo "")
                if [ -n "$access_key" ]; then
                    echo "ACCESS_KEY=$access_key"
                    echo "SECRET_KEY=$secret_key"
                    return 0
                fi
            fi
        fi
    fi

    return 1
}

validate_connection() {
    local endpoint=$1
    local access_key=$2
    local secret_key=$3

    log "Validating S3 connection to $endpoint..."

    local test_file="/tmp/garage_connect_test_$$"
    echo "test" > "$test_file"

    if AWS_ACCESS_KEY_ID="$access_key" \
       AWS_SECRET_ACCESS_KEY="$secret_key" \
       AWS_ENDPOINT_URL="$endpoint" \
       aws s3 --region=garage cp "$test_file" "s3://$BUCKET_NAME/.healthcheck" >/dev/null 2>&1; then
        AWS_ACCESS_KEY_ID="$access_key" \
        AWS_SECRET_ACCESS_KEY="$secret_key" \
        AWS_ENDPOINT_URL="$endpoint" \
        aws s3 --region=garage rm "s3://$BUCKET_NAME/.healthcheck" >/dev/null 2>&1 || true
        rm -f "$test_file"
        log "Connection validation successful"
        return 0
    fi

    rm -f "$test_file"
    log "Connection validation failed - aws cli not available or credentials invalid"
    return 1
}

print_env() {
    local endpoint=$1
    local access_key=$2
    local secret_key=$3

    echo ""
    log "Add these to your .env.production:"
    echo ""
    echo "S3_BUCKET=$BUCKET_NAME"
    echo "S3_REGION=garage"
    echo "AWS_ENDPOINT_URL=$endpoint"
    echo "AWS_ACCESS_KEY_ID=$access_key"
    echo "AWS_SECRET_ACCESS_KEY=$secret_key"
    echo ""
}

detect() {
    local garage_output
    local endpoint=""
    local admin=""
    local access_key=""
    local secret_key=""

    garage_output=$(detect_local_garage 2>&1) || {
        log "No local Garage detected"
        log ""
        log "To connect to a remote Garage, run:"
        log "  AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=xxx ./start-garage.sh connect http://YOUR_GARAGE_HOST:9000"
        return 1
    }

    while IFS= read -r line; do
        case "$line" in
            ENDPOINT=*) endpoint="${line#*=}" ;;
            ADMIN=*) admin="${line#*=}" ;;
        esac
    done <<< "$garage_output"

    if [ -z "$endpoint" ]; then
        log "Garage detection failed"
        return 1
    fi

    log "Local Garage detected:"
    log "  S3 API: $endpoint"
    log "  Admin API: $admin"

    local creds_output
    creds_output=$(read_credentials 2>&1) || {
        log "Garage is running but credentials could not be read"
        log "Please ensure $GARAGE_CREDENTIALS exists or provide credentials manually"
        return 1
    }

    while IFS= read -r line; do
        case "$line" in
            ACCESS_KEY=*) access_key="${line#*=}" ;;
            SECRET_KEY=*) secret_key="${line#*=}" ;;
        esac
    done <<< "$creds_output"

    if [ -z "$access_key" ] || [ -z "$secret_key" ]; then
        log "Credentials not found"
        return 1
    fi

    log "Credentials found"
    log "Access Key: ${access_key:0:8}..."

    validate_connection "$endpoint" "$access_key" "$secret_key" || {
        log "Connection validation failed"
        return 1
    }

    print_env "$endpoint" "$access_key" "$secret_key"
}

connect() {
    local remote_endpoint=$1

    if [ -z "$remote_endpoint" ]; then
        error "Usage: $0 connect ENDPOINT"
        error "Example: $0 connect http://192.168.1.100:9000"
        return 1
    fi

    log "Connecting to Garage at $remote_endpoint"

    if ! curl -sf "$remote_endpoint/" > /dev/null 2>&1; then
        error "Cannot reach Garage at $remote_endpoint"
        error "Please check the endpoint URL and ensure Garage is running"
        return 1
    fi

    if [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ]; then
        error "Credentials required: set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables"
        error ""
        error "Example:"
        error "  AWS_ACCESS_KEY_ID=your_key AWS_SECRET_ACCESS_KEY=your_secret ./start-garage.sh connect $remote_endpoint"
        return 1
    fi

    if validate_connection "$remote_endpoint" "$AWS_ACCESS_KEY_ID" "$AWS_SECRET_ACCESS_KEY"; then
        print_env "$remote_endpoint" "$AWS_ACCESS_KEY_ID" "$AWS_SECRET_ACCESS_KEY"
        return 0
    else
        error "Connection failed - please verify credentials"
        return 1
    fi
}

status() {
    local garage_output
    local endpoint=""
    local admin=""
    local access_key=""
    local secret_key=""

    garage_output=$(detect_local_garage 2>&1) || {
        echo "Local Garage: not running"
        echo ""
        echo "To check a remote Garage:"
        echo "  AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=xxx ./start-garage.sh status http://remote:9000"
        return 0
    }

    while IFS= read -r line; do
        case "$line" in
            ENDPOINT=*) endpoint="${line#*=}" ;;
            ADMIN=*) admin="${line#*=}" ;;
        esac
    done <<< "$garage_output"

    echo "Local Garage: running"
    echo "S3 API: $endpoint"

    if [ -n "$admin" ]; then
        if curl -sf "$admin/" > /dev/null 2>&1; then
            echo "Admin API: $admin (healthy)"
        else
            echo "Admin API: $admin (unreachable)"
        fi
    fi

    local creds_output
    creds_output=$(read_credentials 2>&1) || {
        echo "Credentials: not found"
        return 0
    }

    while IFS= read -r line; do
        case "$line" in
            ACCESS_KEY=*) access_key="${line#*=}" ;;
            SECRET_KEY=*) secret_key="${line#*=}" ;;
        esac
    done <<< "$creds_output"

    if [ -n "$access_key" ]; then
        echo "Credentials: found"
        echo "Access Key: ${access_key:0:8}..."
    fi
}

env_cmd() {
    local endpoint="${AWS_ENDPOINT_URL:-http://127.0.0.1:9000}"
    local access_key="${AWS_ACCESS_KEY_ID:-}"
    local secret_key="${AWS_SECRET_ACCESS_KEY:-}"

    local creds_output
    creds_output=$(read_credentials 2>&1) || true

    while IFS= read -r line; do
        case "$line" in
            ACCESS_KEY=*) access_key="${line#*=}" ;;
            SECRET_KEY=*) secret_key="${line#*=}" ;;
        esac
    done <<< "$creds_output"

    if [ -n "$access_key" ] && [ -n "$secret_key" ]; then
        print_env "$endpoint" "$access_key" "$secret_key"
    else
        error "No credentials available"
        error "Run './start-garage.sh detect' or set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY"
        return 1
    fi
}

case "${1:-detect}" in
    detect)
        detect
        ;;
    connect)
        connect "${2:-}"
        ;;
    status)
        status
        ;;
    env)
        env_cmd
        ;;
    help|--help|-h)
        echo "Usage: $0 {detect|connect|status|env}"
        echo ""
        echo "Commands:"
        echo "  detect           - Detect and connect to local Garage"
        echo "  connect ENDPOINT - Connect to remote Garage (requires AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)"
        echo "  status           - Show connection status"
        echo "  env              - Print environment variables for backend"
        echo ""
        echo "Environment variables:"
        echo "  GARAGE_HOST      - Garage host (default: 127.0.0.1)"
        echo "  GARAGE_PORT      - Garage S3 port (default: 9000)"
        echo "  GARAGE_ADMIN_PORT - Garage admin port (default: 3903)"
        echo "  BUCKET_NAME     - Bucket name (default: multica-uploads)"
        echo "  AWS_ACCESS_KEY_ID     - S3 access key (for remote connections)"
        echo "  AWS_SECRET_ACCESS_KEY - S3 secret key (for remote connections)"
        ;;
    *)
        error "Unknown command: $1"
        error "Run '$0 help' for usage"
        exit 1
        ;;
esac