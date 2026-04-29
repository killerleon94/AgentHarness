#!/bin/bash
# Test script to debug Kimi agent command execution
# This captures the exact commands and output for analysis

set -e

echo "============================================"
echo "Kimi Agent Command Debug Test"
echo "============================================"
echo ""

# Check if kimi is available
if ! command -v kimi &> /dev/null; then
    echo "ERROR: kimi command not found"
    exit 1
fi

# Check if multica is available
if ! command -v multica &> /dev/null; then
    echo "ERROR: multica command not found"
    exit 1
fi

# Get workspace info
echo "=== Getting workspace info ==="
WORKSPACE=$(multica workspace get --output json 2>/dev/null)
WORKSPACE_ID=$(echo "$WORKSPACE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Workspace ID: $WORKSPACE_ID"
echo ""

# Create test issue
echo "=== Creating test issue ==="
ISSUE=$(multica issue create --title "Kimi Debug Test $(date +%s)" --description "Testing Kimi command execution" --output json 2>/dev/null)
ISSUE_ID=$(echo "$ISSUE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Issue ID: $ISSUE_ID"
echo ""

# Get agent info
echo "=== Getting agent list ==="
AGENTS=$(multica agent list --output json 2>/dev/null)
echo "$AGENTS" | head -c 800
echo ""

KIMI_AGENT=$(echo "$AGENTS" | grep -i kimi | head -1)
KIMI_AGENT_ID=$(echo "$KIMI_AGENT" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo ""
echo "Kimi Agent ID: $KIMI_AGENT_ID"
echo ""

# Assign to Kimi
echo "=== Assigning issue to Kimi ==="
multica issue assign "$ISSUE_ID" --to "$KIMI_AGENT_ID" --output json 2>/dev/null || true
echo ""

# Wait for task
echo "=== Waiting 30 seconds for task execution ==="
sleep 30
echo ""

# Check issue details
echo "=== Issue details after waiting ==="
multica issue get "$ISSUE_ID" --output json 2>/dev/null | python3 -m json.tool 2>/dev/null | head -50
echo ""

# Check comments
echo "=== Issue comments ==="
multica issue comment list "$ISSUE_ID" --output json 2>/dev/null | python3 -m json.tool 2>/dev/null | head -50
echo ""

# Add a follow-up comment
echo "=== Adding follow-up comment ==="
COMMENT=$(multica issue comment add "$ISSUE_ID" --content "Can you elaborate on your previous response?" --output json 2>/dev/null)
COMMENT_ID=$(echo "$COMMENT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Comment ID: $COMMENT_ID"
echo ""

# Wait for follow-up task
echo "=== Waiting 30 seconds for follow-up task ==="
sleep 30
echo ""

# Check comments again
echo "=== Issue comments after follow-up ==="
multica issue comment list "$ISSUE_ID" --output json 2>/dev/null | python3 -m json.tool 2>/dev/null | head -80
echo ""

# Check daemon logs
echo "=== Recent daemon logs ==="
tail -100 ~/.multica/profiles/user-ffd8723e/daemon.log 2>/dev/null | grep -E "(kimi|task|issue)" | tail -30
echo ""

echo "============================================"
echo "Test completed"
echo "============================================"