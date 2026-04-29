#!/bin/bash
# Fix Garage key ID issue
# Run this locally, do NOT commit to repo

LOG_FILE="/opt/agentharness/logs/garage-fix-$(date +%Y%m%d-%H%M%S).log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

echo ""
log "=== Key Info ==="
garage -c /home/ubuntu/garage/garage.toml key info GK7baeabb48b49ab3c2839af949cdc2235 2>&1 | tee -a "$LOG_FILE"

echo ""
log "=== Current .env.production AWS_ACCESS_KEY_ID ==="
grep AWS_ACCESS_KEY_ID /opt/agentharness/.env.production

echo ""
log "=== Update .env.production - use Key ID instead of Key Name ==="
sudo sed -i 's/AWS_ACCESS_KEY_ID=GK7baeabb48b49ab3c2839af949cdc2235/AWS_ACCESS_KEY_ID=GK8626ce1d5082d1862cecb1d8/' /opt/agentharness/.env.production

log "=== Updated .env.production ==="
grep AWS_ACCESS_KEY_ID /opt/agentharness/.env.production

echo ""
log "=== Restart Backend ==="
kill $(cat /opt/agentharness/run/backend.pid) 2>/dev/null || true
nohup /opt/agentharness/run/backend.sh > /opt/agentharness/logs/backend.log 2>&1 &
echo $! > /opt/agentharness/run/backend.pid

sleep 3
log "=== Backend Health ==="
curl http://127.0.0.1:8080/health 2>&1 | tee -a "$LOG_FILE"

log "=== Complete ==="