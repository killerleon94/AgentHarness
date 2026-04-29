#!/bin/bash
# Install claw-code on production server
# Run this locally, do NOT commit to repo

mkdir -p /opt/agentharness/logs

LOG_FILE="/opt/agentharness/logs/claw-install-$(date +%Y%m%d-%H%M%S).log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" | tee -a "$LOG_FILE" >&2
}

log "=== Starting claw-code installation ==="
log "Log file: $LOG_FILE"

# Check Rust
log "=== Checking Rust installation ==="
if command -v cargo &>/dev/null; then
    log "Rust found: $(cargo --version)"
else
    log "Rust not found, installing..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y 2>&1 | tee -a "$LOG_FILE"
    source "$HOME/.cargo/env" 2>/dev/null || true
    cargo --version | tee -a "$LOG_FILE"
fi

# Clone claw-code
CLAW_DIR="$HOME/claw-code"
if [ -d "$CLAW_DIR/.git" ]; then
    log "claw-code directory is a git repo, pulling latest..."
    cd "$CLAW_DIR"
    git pull 2>&1 | tee -a "$LOG_FILE"
elif [ -d "$CLAW_DIR/rust" ]; then
    log "claw-code directory exists but not a git repo, checking rust subdir..."
else
    log "Cloning claw-code..."
    git clone https://github.com/ultraworkers/claw-code "$CLAW_DIR" 2>&1 | tee -a "$LOG_FILE"
fi

cd "$CLAW_DIR/rust"

# Build
log "=== Building claw-code ==="
source "$HOME/.cargo/env" 2>/dev/null || true
cargo build --workspace 2>&1 | tee -a "$LOG_FILE"

# Verify
log "=== Verifying installation ==="
CLAW_BIN="$CLAW_DIR/rust/target/debug/claw"
if [ -x "$CLAW_BIN" ]; then
    log "claw binary found at $CLAW_BIN"
    chmod +x "$CLAW_BIN"
    
    log "=== Testing claw --help ==="
    "$CLAW_BIN" --help 2>&1 | head -20 | tee -a "$LOG_FILE"
    
    log "=== Creating symlink in /usr/local/bin ==="
    sudo ln -sf "$CLAW_BIN" /usr/local/bin/claw
    sudo chmod +x /usr/local/bin/claw
    
    log "=== Verify claw command ==="
    /usr/local/bin/claw --version 2>&1 | head -5 | tee -a "$LOG_FILE" || /usr/local/bin/claw --help 2>&1 | head -10 | tee -a "$LOG_FILE"
else
    error "claw binary not found after build"
    ls -la "$CLAW_DIR/rust/target/debug/" 2>&1 | tee -a "$LOG_FILE"
    exit 1
fi

log "=== Installation complete ==="
log "Binary: $CLAW_BIN"
log "Symlink: /usr/local/bin/claw"