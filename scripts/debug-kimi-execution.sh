#!/bin/bash
# Debug Kimi execution - shows exact commands being executed
# Usage: bash debug-kimi-execution.sh

# Configuration
PROFILE="user-ffd8723e"
DAEMON_LOG="$HOME/.multica/profiles/$PROFILE/daemon.log"
WORKDIR="$HOME/multica_workspaces_${PROFILE}"

echo "============================================"
echo "Kimi Execution Debug Script"
echo "============================================"
echo ""

# 1. Show daemon configuration
echo "=== Daemon Profile Config ==="
cat "$HOME/.multica/profiles/$PROFILE/config.json" 2>/dev/null
echo ""

# 2. Show recent daemon logs with kimi-related entries
echo "=== Recent Kimi-related daemon logs ==="
tail -200 "$DAEMON_LOG" 2>/dev/null | grep -E "(kimi|task|issue|agent)" | tail -50
echo ""

# 3. Show workdir structure
echo "=== Workdir Structure ==="
ls -la "$WORKDIR" 2>/dev/null | head -20
echo ""

# 4. Check if AGENTS.md exists (for OpenCode/Claude)
echo "=== Checking for AGENTS.md / CLAUDE.md ==="
find "$WORKDIR" -name "AGENTS.md" -o -name "CLAUDE.md" 2>/dev/null | head -10
echo ""

# 5. Create a test issue and assign to Kimi
echo "=== Creating test issue ==="
ISSUE=$(multica issue create --title "Debug Kimi $(date +%s)" --description "Testing Kimi execution" --output json 2>/dev/null)
ISSUE_ID=$(echo "$ISSUE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created issue: $ISSUE_ID"
echo ""

# 6. Get agent list
echo "=== Agent List ==="
multica agent list --output json 2>/dev/null | python3 -m json.tool | grep -E '"id"|"name"|"provider"'
echo ""

# 7. Find and assign to Kimi
KIMI_ID=$(multica agent list --output json 2>/dev/null | python3 -c "import json,sys; data=json.load(sys.stdin); agents=[a for a in data if 'kimi' in a.get('name','').lower()]; print(agents[0]['id'] if agents else '')" 2>/dev/null)
echo "Kimi ID: $KIMI_ID"
echo ""

if [ -n "$KIMI_ID" ]; then
    echo "=== Assigning issue to Kimi ==="
    multica issue assign "$ISSUE_ID" --to "$KIMI_ID" --output json 2>/dev/null
    echo ""
    
    echo "=== Monitoring daemon logs for 30 seconds ==="
    tail -f "$DAEMON_LOG" 2>/dev/null | grep -E "(kimi|task|started|completed)" &
    TAIL_PID=$!
    
    sleep 30
    kill $TAIL_PID 2>/dev/null || true
    
    echo ""
    echo "=== Issue comments after first execution ==="
    multica issue comment list "$ISSUE_ID" --output json 2>/dev/null | python3 -m json.tool
    echo ""
    
    echo "=== Task list ==="
    multica issue runs "$ISSUE_ID" --output json 2>/dev/null | python3 -m json.tool
    echo ""
    
    echo "=== Adding follow-up comment ==="
    COMMENT=$(multica issue comment add "$ISSUE_ID" --content "Please provide more details" --output json 2>/dev/null)
    COMMENT_ID=$(echo "$COMMENT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "Comment ID: $COMMENT_ID"
    echo ""
    
    echo "=== Monitoring daemon logs for follow-up ==="
    tail -f "$DAEMON_LOG" 2>/dev/null | grep -E "(kimi|task|started|completed)" &
    TAIL_PID=$!
    
    sleep 30
    kill $TAIL_PID 2>/dev/null || true
    
    echo ""
    echo "=== Issue comments after follow-up ==="
    multica issue comment list "$ISSUE_ID" --output json 2>/dev/null | python3 -m json.tool
    echo ""
fi

echo "============================================"
echo "Debug completed"
echo "============================================"