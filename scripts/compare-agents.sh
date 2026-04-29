#!/bin/bash
# Simple Kimi vs OpenCode command comparison
# Run this to see what the actual agent commands look like

echo "============================================"
echo "Agent Command Comparison Test"
echo "============================================"
echo ""

echo "=== Check available agents ==="
multica agent list --output json 2>/dev/null | python3 -m json.tool | grep -E '"id"|"name"|"provider"'
echo ""

echo "=== Check daemon status ==="
ps aux | grep -E "multica.*daemon" | grep -v grep | head -3
echo ""

echo "=== Check kimi version ==="
kimi --version 2>&1 || echo "kimi not found"
echo ""

echo "=== Check opencode version ==="
opencode --version 2>&1 || echo "opencode not found"
echo ""

# Create a minimal test issue
echo "=== Creating test issue ==="
ISSUE=$(multica issue create --title "Simple Test $(date +%s)" --description "Testing" --output json 2>/dev/null)
ISSUE_ID=$(echo "$ISSUE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Issue ID: $ISSUE_ID"
echo ""

# Get agents
AGENTS=$(multica agent list --output json 2>/dev/null)
echo "=== Available agents ==="
echo "$AGENTS" | python3 -m json.tool | grep -E '"id"|"name"|"provider"'
echo ""

# Find Kimi agent
KIMI_ID=$(echo "$AGENTS" | python3 -c "import json,sys; data=json.load(sys.stdin); agents=[a for a in data if 'kimi' in a.get('name','').lower()]; print(agents[0]['id'] if agents else '')" 2>/dev/null)
echo "Kimi agent ID: $KIMI_ID"
echo ""

if [ -n "$KIMI_ID" ]; then
    echo "=== Assigning issue to Kimi ==="
    multica issue assign "$ISSUE_ID" --to "$KIMI_ID" --output json 2>/dev/null
    echo ""
    
    echo "=== Waiting 20 seconds ==="
    sleep 20
    echo ""
    
    echo "=== Checking comments ==="
    multica issue comment list "$ISSUE_ID" --output json 2>/dev/null | python3 -m json.tool
    echo ""
    
    echo "=== Adding follow-up comment ==="
    multica issue comment add "$ISSUE_ID" --content "Please explain what you did" --output json 2>/dev/null
    echo ""
    
    echo "=== Waiting 20 seconds ==="
    sleep 20
    echo ""
    
    echo "=== Checking comments after follow-up ==="
    multica issue comment list "$ISSUE_ID" --output json 2>/dev/null | python3 -m json.tool
    echo ""
fi

echo "============================================"
echo "Test completed"
echo "============================================"