#!/bin/bash
# Test script to compare Kimi vs OpenCode command execution
# Usage: bash test-kimi-vs-opencode.sh

set -e

# Configuration
SERVER_URL="http://localhost:8080"
WORKSPACE_ID="e36eef34-fc31-4591-8a55-0e955676e981"
TOKEN="mul_637abede6f98b0b3e5a2039258ed44610a397bab"

echo "============================================"
echo "Kimi Agent Execution Test"
echo "============================================"
echo ""

# Create a test issue
echo "=== Creating test issue ==="
ISSUE_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/workspaces/$WORKSPACE_ID/issues" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Kimi Issue - '$(date +%s)'",
    "description": "This is a test issue to verify Kimi agent execution"
  }')
echo "$ISSUE_RESPONSE" | head -c 500
echo ""

ISSUE_ID=$(echo "$ISSUE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo ""
echo "Created issue: $ISSUE_ID"
echo ""

# Get the Kimi agent ID
echo "=== Getting Kimi agent ID ==="
AGENTS_RESPONSE=$(curl -s "$SERVER_URL/api/workspaces/$WORKSPACE_ID/agents" \
  -H "Authorization: Bearer $TOKEN")
echo "$AGENTS_RESPONSE" | head -c 800
echo ""

KIMI_AGENT_ID=$(echo "$AGENTS_RESPONSE" | grep -o '"id":"[^"]*","name":"Kimi' | head -1 | cut -d'"' -f4)
echo ""
echo "Kimi agent ID: $KIMI_AGENT_ID"
echo ""

# Assign issue to Kimi
echo "=== Assigning issue to Kimi agent ==="
ASSIGN_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/issues/$ISSUE_ID/assign" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"assignee_id\": \"$KIMI_AGENT_ID\", \"assignee_type\": \"agent\"}")
echo "$ASSIGN_RESPONSE" | head -c 500
echo ""

# Wait for task to be picked up
echo "=== Waiting 20 seconds for task execution ==="
sleep 20

# Check issue comments
echo ""
echo "=== Checking issue comments after first execution ==="
curl -s "$SERVER_URL/api/issues/$ISSUE_ID/comments" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null | head -100
echo ""

# Get task history
echo ""
echo "=== Getting task history ==="
TASKS_RESPONSE=$(curl -s "$SERVER_URL/api/issues/$ISSUE_ID/tasks" \
  -H "Authorization: Bearer $TOKEN")
echo "$TASKS_RESPONSE" | python3 -m json.tool 2>/dev/null | head -100
echo ""

# Now add a comment to trigger follow-up
echo ""
echo "=== Adding a comment to trigger follow-up ==="
COMMENT_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/issues/$ISSUE_ID/comments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Kimi, can you please explain what you did?"}')
echo "$COMMENT_RESPONSE" | head -c 500
echo ""

COMMENT_ID=$(echo "$COMMENT_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo ""
echo "Created comment: $COMMENT_ID"
echo ""

# Wait for follow-up task
echo "=== Waiting 20 seconds for follow-up task ==="
sleep 20

# Check issue comments after follow-up
echo ""
echo "=== Checking issue comments after follow-up ==="
curl -s "$SERVER_URL/api/issues/$ISSUE_ID/comments" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null | head -100
echo ""

# Get task history
echo ""
echo "=== Getting task history after follow-up ==="
TASKS_RESPONSE=$(curl -s "$SERVER_URL/api/issues/$ISSUE_ID/tasks" \
  -H "Authorization: Bearer $TOKEN")
echo "$TASKS_RESPONSE" | python3 -m json.tool 2>/dev/null | head -100
echo ""

echo ""
echo "============================================"
echo "Test completed"
echo "============================================"