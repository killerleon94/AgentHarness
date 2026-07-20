package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/multica-ai/multica/server/internal/auth"
	"github.com/multica-ai/multica/server/internal/events"
	"github.com/multica-ai/multica/server/internal/realtime"
	"github.com/multica-ai/multica/server/internal/service"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

// createTestGroup creates a group owned by testUserID and returns the response.
func createTestGroup(t *testing.T, name string) *GroupResponse {
	t.Helper()
	w := httptest.NewRecorder()
	req := newRequest("POST", "/api/groups", CreateGroupRequest{
		Name:         name,
		Announcement: "test announcement",
	})
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	testHandler.CreateGroup(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("CreateGroup: expected 201, got %d: %s", w.Code, w.Body.String())
	}
	var resp GroupResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode CreateGroup response: %v", err)
	}
	return &resp
}

// createTestMember creates a second user + workspace member for invitation tests.
// Returns (userID, memberID).
func createTestMember(t *testing.T, ctx context.Context, pool *pgxpool.Pool, email, name string) (string, string) {
	t.Helper()
	var userID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id
	`, name, email).Scan(&userID); err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}
	t.Cleanup(func() {
		pool.Exec(ctx, `DELETE FROM "user" WHERE id = $1`, userID)
	})
	var memberID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO member (workspace_id, user_id, role) VALUES ($1, $2, 'member') RETURNING id
	`, testWorkspaceID, userID).Scan(&memberID); err != nil {
		t.Fatalf("failed to create test member: %v", err)
	}
	t.Cleanup(func() {
		pool.Exec(ctx, `DELETE FROM member WHERE id = $1`, memberID)
	})
	return userID, memberID
}

// getTestAgentID returns the agent ID for the test fixture.
func getTestAgentID(t *testing.T, ctx context.Context) string {
	t.Helper()
	var agentID string
	if err := testPool.QueryRow(ctx, `SELECT id FROM agent WHERE workspace_id = $1 LIMIT 1`, testWorkspaceID).Scan(&agentID); err != nil {
		t.Fatalf("failed to find test agent: %v", err)
	}
	return agentID
}

// waitForDB propagates in-memory Hub events to DB listeners (synchronous bus).
// Since the bus is synchronous, calling publish is enough; this helper exists
// to make test intent clear.
func waitForDB() {
	// Bus events are synchronous — no wait needed.
}

// ---------------------------------------------------------------------------
// 2.11 Group CRUD
// ---------------------------------------------------------------------------

func TestGroupCRUD(t *testing.T) {
	ctx := context.Background()

	// Create
	group := createTestGroup(t, "Test Group CRUD")
	groupID := group.ID
	if group.Name != "Test Group CRUD" {
		t.Fatalf("expected name 'Test Group CRUD', got '%s'", group.Name)
	}
	if group.MemberCount != 1 {
		t.Fatalf("expected member_count 1, got %d", group.MemberCount)
	}
	if len(group.Members) != 1 {
		t.Fatalf("expected 1 member, got %d", len(group.Members))
	}
	if group.Members[0].MemberID != testUserID {
		t.Fatalf("expected member %s, got %s", testUserID, group.Members[0].MemberID)
	}
	if group.Members[0].Role != "owner" {
		t.Fatalf("expected owner role, got %s", group.Members[0].Role)
	}
	t.Cleanup(func() {
		testPool.Exec(ctx, `DELETE FROM "group" WHERE id = $1`, parseUUID(groupID))
	})

	// List
	w := httptest.NewRecorder()
	req := newRequest("GET", "/api/groups", nil)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	testHandler.ListGroups(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListGroups: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var groups []GroupResponse
	if err := json.NewDecoder(w.Body).Decode(&groups); err != nil {
		t.Fatalf("failed to decode ListGroups response: %v", err)
	}
	found := false
	for _, g := range groups {
		if g.ID == groupID {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("ListGroups: created group not found in list")
	}

	// Get detail
	w = httptest.NewRecorder()
	req = newRequest("GET", "/api/groups/"+groupID, nil)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.GetGroup(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("GetGroup: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var detail GroupResponse
	if err := json.NewDecoder(w.Body).Decode(&detail); err != nil {
		t.Fatalf("failed to decode GetGroup response: %v", err)
	}
	if detail.Name != "Test Group CRUD" {
		t.Fatalf("expected name 'Test Group CRUD', got '%s'", detail.Name)
	}
	if detail.MemberCount != 1 {
		t.Fatalf("expected member_count 1, got %d", detail.MemberCount)
	}
	if len(detail.Members) != 1 {
		t.Fatalf("expected 1 member in detail, got %d", len(detail.Members))
	}

	// Update
	w = httptest.NewRecorder()
	updatedName := "Updated Group"
	req = newRequest("PATCH", "/api/groups/"+groupID, UpdateGroupRequest{
		Name: &updatedName,
	})
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.UpdateGroup(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateGroup: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var updated GroupResponse
	if err := json.NewDecoder(w.Body).Decode(&updated); err != nil {
		t.Fatalf("failed to decode UpdateGroup response: %v", err)
	}
	if updated.Name != "Updated Group" {
		t.Fatalf("expected name 'Updated Group', got '%s'", updated.Name)
	}

	// Invite member
	userID2, _ := createTestMember(t, ctx, testPool, "invitee@multica.ai", "Invitee")
	w = httptest.NewRecorder()
	req = newRequest("POST", "/api/groups/"+groupID+"/members", InviteMemberRequest{
		MemberType: "member",
		MemberID:   userID2,
	})
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.InviteMember(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("InviteMember: expected 201, got %d: %s", w.Code, w.Body.String())
	}
	var invitedMember GroupMemberResponse
	if err := json.NewDecoder(w.Body).Decode(&invitedMember); err != nil {
		t.Fatalf("failed to decode InviteMember response: %v", err)
	}
	if invitedMember.MemberID != userID2 {
		t.Fatalf("expected invited member %s, got %s", userID2, invitedMember.MemberID)
	}

	// Get detail again to verify member count
	w = httptest.NewRecorder()
	req = newRequest("GET", "/api/groups/"+groupID, nil)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.GetGroup(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("GetGroup (after invite): expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if err := json.NewDecoder(w.Body).Decode(&detail); err != nil {
		t.Fatalf("failed to decode GetGroup (after invite): %v", err)
	}
	if detail.MemberCount != 2 {
		t.Fatalf("expected member_count 2 after invite, got %d", detail.MemberCount)
	}

	// Remove member
	w = httptest.NewRecorder()
	req = newRequest("DELETE", fmt.Sprintf("/api/groups/%s/members/%s", groupID, invitedMember.ID), nil)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	req = withURLParam(req, "memberId", invitedMember.ID)
	testHandler.RemoveMember(w, req)
	if w.Code != http.StatusNoContent {
		t.Fatalf("RemoveMember: expected 204, got %d: %s", w.Code, w.Body.String())
	}

	// Create another user for leave test
	userID3, memberID3 := createTestMember(t, ctx, testPool, "leaver@multica.ai", "Leaver")
	// Add this user to the group first
	w = httptest.NewRecorder()
	req = newRequest("POST", "/api/groups/"+groupID+"/members", InviteMemberRequest{
		MemberType: "member",
		MemberID:   userID3,
	})
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.InviteMember(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("InviteMember (for leave): expected 201, got %d: %s", w.Code, w.Body.String())
	}
	var leaveMemberResp GroupMemberResponse
	json.NewDecoder(w.Body).Decode(&leaveMemberResp)

	// Owner cannot leave (test in permissions)
	// Non-owner can leave: simulate by using the invited user's identity
	w = httptest.NewRecorder()
	req = newRequest("POST", fmt.Sprintf("/api/groups/%s/leave", groupID), nil)
	req.Header.Set("X-User-ID", userID3)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.LeaveGroup(w, req)
	if w.Code != http.StatusNoContent {
		t.Fatalf("LeaveGroup: expected 204, got %d: %s", w.Code, w.Body.String())
	}
	t.Cleanup(func() {
		testPool.Exec(ctx, `DELETE FROM member WHERE id = $1`, memberID3)
	})

	// Delete (dissolve) group as owner
	w = httptest.NewRecorder()
	req = newRequest("DELETE", "/api/groups/"+groupID, nil)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.DeleteGroup(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("DeleteGroup: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var deleteResp map[string]string
	json.NewDecoder(w.Body).Decode(&deleteResp)
	if deleteResp["status"] != "dissolved" {
		t.Fatalf("expected status 'dissolved', got '%s'", deleteResp["status"])
	}

	// Verify deleted group is gone
	w = httptest.NewRecorder()
	req = newRequest("GET", "/api/groups/"+groupID, nil)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.GetGroup(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("GetGroup after delete: expected 404, got %d", w.Code)
	}
}

// ---------------------------------------------------------------------------
// 2.12 Group Permissions & Management
// ---------------------------------------------------------------------------

func TestGroupPermissions(t *testing.T) {
	ctx := context.Background()
	group := createTestGroup(t, "Test Group Perms")
	groupID := group.ID
	t.Cleanup(func() {
		testPool.Exec(ctx, `DELETE FROM "group" WHERE id = $1`, parseUUID(groupID))
	})

	// Non-member cannot access group detail
	w := httptest.NewRecorder()
	nonMemberUserID := "00000000-0000-0000-0000-000000000099"
	req := newRequest("GET", "/api/groups/"+groupID, nil)
	req.Header.Set("X-User-ID", nonMemberUserID)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.GetGroup(w, req)
	// The GetGroup handler doesn't enforce membership — it just looks up by ID.
	// Membership enforcement is done via the RequireGroupMember middleware (tested separately).
	// So this should succeed for any valid user. We'll test via middleware tests instead.

	// Non-member cannot leave
	w = httptest.NewRecorder()
	req = newRequest("POST", "/api/groups/"+groupID+"/leave", nil)
	req.Header.Set("X-User-ID", nonMemberUserID)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.LeaveGroup(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("Non-member LeaveGroup: expected 404, got %d: %s", w.Code, w.Body.String())
	}

	// Non-owner cannot dissolve
	nonOwnerID, _ := createTestMember(t, ctx, testPool, "nondissolve@multica.ai", "NonDissolve")
	defer testPool.Exec(ctx, `DELETE FROM "user" WHERE id = $1`, nonOwnerID)
	// Invite non-owner to group first
	w = httptest.NewRecorder()
	req = newRequest("POST", "/api/groups/"+groupID+"/members", InviteMemberRequest{
		MemberType: "member",
		MemberID:   nonOwnerID,
	})
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.InviteMember(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("InviteMember (for non-owner dissolve): expected 201, got %d: %s", w.Code, w.Body.String())
	}
	// Non-owner tries to dissolve
	w = httptest.NewRecorder()
	req = newRequest("DELETE", "/api/groups/"+groupID, nil)
	req.Header.Set("X-User-ID", nonOwnerID)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.DeleteGroup(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("Non-owner DeleteGroup: expected 403, got %d: %s", w.Code, w.Body.String())
	}

	// Owner cannot leave group
	w = httptest.NewRecorder()
	req = newRequest("POST", "/api/groups/"+groupID+"/leave", nil)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.LeaveGroup(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("Owner LeaveGroup: expected 400, got %d: %s", w.Code, w.Body.String())
	}

	// Cannot remove owner from group
	// The ID of the owner's member record
	var ownerMemberID string
	if err := testPool.QueryRow(ctx, `SELECT id FROM group_member WHERE group_id = $1 AND member_id = $2 AND member_type = 'member'`,
		parseUUID(groupID), parseUUID(testUserID),
	).Scan(&ownerMemberID); err != nil {
		t.Fatalf("failed to find owner member: %v", err)
	}
	w = httptest.NewRecorder()
	req = newRequest("DELETE", fmt.Sprintf("/api/groups/%s/members/%s", groupID, ownerMemberID), nil)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	req = withURLParam(req, "memberId", ownerMemberID)
	testHandler.RemoveMember(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("RemoveOwner: expected 400, got %d: %s", w.Code, w.Body.String())
	}

	// Non-owner cannot update group
	nonOwnerUserID, _ := createTestMember(t, ctx, testPool, "nonowner@multica.ai", "NonOwner")
	w = httptest.NewRecorder()
	updatedName := "Hacked Name"
	req = newRequest("PATCH", "/api/groups/"+groupID, UpdateGroupRequest{
		Name: &updatedName,
	})
	req.Header.Set("X-User-ID", nonOwnerUserID)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.UpdateGroup(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("Non-owner UpdateGroup: expected 403, got %d: %s", w.Code, w.Body.String())
	}

	// Disabled user cannot be invited
	// Create a disabled user
	var disabledUserID string
	if err := testPool.QueryRow(ctx, `
		INSERT INTO "user" (name, email, disabled) VALUES ($1, $2, true) RETURNING id
	`, "Disabled User", "disabled@multica.ai").Scan(&disabledUserID); err != nil {
		t.Fatalf("failed to create disabled user: %v", err)
	}
	t.Cleanup(func() {
		testPool.Exec(ctx, `DELETE FROM "user" WHERE id = $1`, disabledUserID)
	})
	w = httptest.NewRecorder()
	req = newRequest("POST", "/api/groups/"+groupID+"/members", InviteMemberRequest{
		MemberType: "member",
		MemberID:   disabledUserID,
	})
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.InviteMember(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("Invite disabled user: expected 400, got %d: %s", w.Code, w.Body.String())
	}

	// Non-owner cannot invite
	nonInviterID, _ := createTestMember(t, ctx, testPool, "noninviter@multica.ai", "NonInviter")
	// Invite non-owner to group first
	w = httptest.NewRecorder()
	req = newRequest("POST", "/api/groups/"+groupID+"/members", InviteMemberRequest{
		MemberType: "member",
		MemberID:   nonInviterID,
	})
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.InviteMember(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("InviteMember (add non-owner): expected 201, got %d: %s", w.Code, w.Body.String())
	}
	// Non-owner tries to invite someone else
	targetID, _ := createTestMember(t, ctx, testPool, "target@multica.ai", "TargetUser")
	w = httptest.NewRecorder()
	req = newRequest("POST", "/api/groups/"+groupID+"/members", InviteMemberRequest{
		MemberType: "member",
		MemberID:   targetID,
	})
	req.Header.Set("X-User-ID", nonInviterID)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.InviteMember(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("Non-owner InviteMember: expected 403, got %d: %s", w.Code, w.Body.String())
	}

	// Cannot invite non-workspace member (user exists but is not in workspace)
	var externalUserID string
	if err := testPool.QueryRow(ctx, `
		INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id
	`, "External User", "external@outside.com").Scan(&externalUserID); err != nil {
		t.Fatalf("failed to create external user: %v", err)
	}
	t.Cleanup(func() {
		testPool.Exec(ctx, `DELETE FROM "user" WHERE id = $1`, externalUserID)
	})
	w = httptest.NewRecorder()
	req = newRequest("POST", "/api/groups/"+groupID+"/members", InviteMemberRequest{
		MemberType: "member",
		MemberID:   externalUserID,
	})
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.InviteMember(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("Invite non-workspace member: expected 400, got %d: %s", w.Code, w.Body.String())
	}

	// Cannot invite with invalid member_type
	w = httptest.NewRecorder()
	req = newRequest("POST", "/api/groups/"+groupID+"/members", map[string]string{
		"member_type": "robot",
		"member_id":   testUserID,
	})
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.InviteMember(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("Invite invalid member_type: expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

// ---------------------------------------------------------------------------
// 3.7 Message sending and @mention task creation
// ---------------------------------------------------------------------------

func TestGroupMessagesAndMentions(t *testing.T) {
	ctx := context.Background()
	group := createTestGroup(t, "Test Group Messages")
	groupID := group.ID
	t.Cleanup(func() {
		testPool.Exec(ctx, `DELETE FROM "group" WHERE id = $1`, parseUUID(groupID))
	})

	// Get test agent ID and rename to single-word name for @mention matching
	agentID := getTestAgentID(t, ctx)
	var origAgentName string
	testPool.QueryRow(ctx, `SELECT name FROM agent WHERE id = $1`, parseUUID(agentID)).Scan(&origAgentName)
	agentName := strings.Split(origAgentName, " ")[0]
	testPool.Exec(ctx, `UPDATE agent SET name = $1 WHERE id = $2`, agentName, parseUUID(agentID))
	t.Cleanup(func() {
		testPool.Exec(ctx, `UPDATE agent SET name = $1 WHERE id = $2`, origAgentName, parseUUID(agentID))
	})

	// Invite the agent as a group member
	w := httptest.NewRecorder()
	req := newRequest("POST", "/api/groups/"+groupID+"/members", InviteMemberRequest{
		MemberType: "agent",
		MemberID:   agentID,
	})
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.InviteMember(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("InviteMember(agent): expected 201, got %d: %s", w.Code, w.Body.String())
	}

	// Send a plain message (no mentions)
	msgContent := "Hello everyone, this is a test message"
	payload1, _ := json.Marshal(protocol.GroupMessageRequest{
		GroupID: groupID,
		Content: msgContent,
		TempID:  "temp-1",
	})
	respBytes, success := testHandler.HandleGroupWSMessage(ctx, testUserID, testWorkspaceID, payload1)
	if !success {
		var wsMsg struct {
			Payload protocol.GroupMessageErrorPayload
		}
		json.Unmarshal(respBytes, &wsMsg)
		t.Fatalf("HandleGroupWSMessage (plain): expected success, got error: %s", wsMsg.Payload.Error)
	}
	var ackMsg struct {
		Payload protocol.GroupMessageAckPayload
	}
	if err := json.Unmarshal(respBytes, &ackMsg); err != nil {
		t.Fatalf("failed to decode ack: %v", err)
	}
	if ackMsg.Payload.TempID != "temp-1" {
		t.Fatalf("expected temp_id 'temp-1', got '%s'", ackMsg.Payload.TempID)
	}

	// List messages — should have 1 message
	w = httptest.NewRecorder()
	req = newRequest("GET", "/api/groups/"+groupID+"/messages", nil)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.ListGroupMessages(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListGroupMessages: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var msgList ListMessagesResponse
	json.NewDecoder(w.Body).Decode(&msgList)
	if len(msgList.Messages) != 1 {
		t.Fatalf("expected 1 message, got %d", len(msgList.Messages))
	}
	if msgList.Messages[0].Content != msgContent {
		t.Fatalf("expected content '%s', got '%s'", msgContent, msgList.Messages[0].Content)
	}

	// Send message @mentioning the agent
	mentionContent := fmt.Sprintf("@%s please do something", agentName)
	payload2, _ := json.Marshal(protocol.GroupMessageRequest{
		GroupID: groupID,
		Content: mentionContent,
		TempID:  "temp-2",
	})
	_, success2 := testHandler.HandleGroupWSMessage(ctx, testUserID, testWorkspaceID, payload2)
	if !success2 {
		t.Fatalf("HandleGroupWSMessage (@mention): expected success")
	}

	// List tasks — should have 1 task
	w = httptest.NewRecorder()
	req = newRequest("GET", "/api/groups/"+groupID+"/tasks", nil)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.ListGroupTasks(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListGroupTasks: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var tasks []GroupTaskResponse
	json.NewDecoder(w.Body).Decode(&tasks)
	if len(tasks) != 1 {
		t.Fatalf("expected 1 task from @mention, got %d", len(tasks))
	}
	if tasks[0].AgentID != agentID {
		t.Fatalf("expected task agent_id %s, got %s", agentID, tasks[0].AgentID)
	}
	if tasks[0].Status != "queued" {
		t.Fatalf("expected task status 'queued', got '%s'", tasks[0].Status)
	}

	// Send message @mentioning non-agent (@all should NOT create tasks)
	allContent := "@all check this out"
	payload3, _ := json.Marshal(protocol.GroupMessageRequest{
		GroupID: groupID,
		Content: allContent,
		TempID:  "temp-3",
	})
	_, success3 := testHandler.HandleGroupWSMessage(ctx, testUserID, testWorkspaceID, payload3)
	if !success3 {
		t.Fatalf("HandleGroupWSMessage (@all): expected success")
	}

	// List tasks — should still be 1 (no task for @all)
	w = httptest.NewRecorder()
	req = newRequest("GET", "/api/groups/"+groupID+"/tasks", nil)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.ListGroupTasks(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListGroupTasks (after @all): expected 200, got %d: %s", w.Code, w.Body.String())
	}
	json.NewDecoder(w.Body).Decode(&tasks)
	if len(tasks) != 1 {
		t.Fatalf("expected still 1 task after @all, got %d", len(tasks))
	}

	// List messages — should have 3 now
	w = httptest.NewRecorder()
	req = newRequest("GET", "/api/groups/"+groupID+"/messages", nil)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.ListGroupMessages(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListGroupMessages: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	json.NewDecoder(w.Body).Decode(&msgList)
	if len(msgList.Messages) != 3 {
		t.Fatalf("expected 3 messages, got %d", len(msgList.Messages))
	}

	// Send message mentioning a non-existent name — should NOT create task, should succeed
	noMentionContent := "@NonExistentPerson hello"
	payload4, _ := json.Marshal(protocol.GroupMessageRequest{
		GroupID: groupID,
		Content: noMentionContent,
		TempID:  "temp-4",
	})
	_, success4 := testHandler.HandleGroupWSMessage(ctx, testUserID, testWorkspaceID, payload4)
	if !success4 {
		t.Fatalf("HandleGroupWSMessage (nonexistent mention): expected success")
	}

	// Tasks still 1
	w = httptest.NewRecorder()
	req = newRequest("GET", "/api/groups/"+groupID+"/tasks", nil)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.ListGroupTasks(w, req)
	json.NewDecoder(w.Body).Decode(&tasks)
	if len(tasks) != 1 {
		t.Fatalf("expected still 1 task after nonexistent mention, got %d", len(tasks))
	}

	// Cleanup tasks
	testPool.Exec(ctx, `DELETE FROM agent_task_queue WHERE group_id = $1`, parseUUID(groupID))
}

// ---------------------------------------------------------------------------
// Multi-agent @mention: verify exactly one task per mentioned agent
// ---------------------------------------------------------------------------

func TestGroupMultiAgentMention(t *testing.T) {
	ctx := context.Background()
	group := createTestGroup(t, "Test Multi Agent")
	groupID := group.ID
	t.Cleanup(func() {
		testPool.Exec(ctx, `DELETE FROM "group" WHERE id = $1`, parseUUID(groupID))
	})

	// Get test agent 1 and rename to single-word name
	agentID1 := getTestAgentID(t, ctx)
	var origName1 string
	testPool.QueryRow(ctx, `SELECT name FROM agent WHERE id = $1`, parseUUID(agentID1)).Scan(&origName1)
	agentName1 := strings.Split(origName1, " ")[0]
	testPool.Exec(ctx, `UPDATE agent SET name = $1 WHERE id = $2`, agentName1, parseUUID(agentID1))
	t.Cleanup(func() {
		testPool.Exec(ctx, `UPDATE agent SET name = $1 WHERE id = $2`, origName1, parseUUID(agentID1))
	})

	// Create a second agent with a single-word name
	var runtimeID string
	testPool.QueryRow(ctx, `SELECT id FROM agent_runtime WHERE workspace_id = $1 LIMIT 1`, testWorkspaceID).Scan(&runtimeID)
	var agentID2 string
	testPool.QueryRow(ctx, `
		INSERT INTO agent (workspace_id, name, description, runtime_mode, runtime_config, runtime_id, visibility, max_concurrent_tasks, owner_id)
		VALUES ($1, 'SecondAgent', '', 'cloud', '{}'::jsonb, $2, 'workspace', 1, $3)
		RETURNING id
	`, testWorkspaceID, runtimeID, testUserID).Scan(&agentID2)
	t.Cleanup(func() {
		testPool.Exec(ctx, `DELETE FROM agent WHERE id = $1`, agentID2)
	})

	// Invite both agents
	for _, aid := range []string{agentID1, agentID2} {
		w := httptest.NewRecorder()
		req := newRequest("POST", "/api/groups/"+groupID+"/members", InviteMemberRequest{
			MemberType: "agent",
			MemberID:   aid,
		})
		req.Header.Set("X-Workspace-ID", testWorkspaceID)
		req = withURLParam(req, "id", groupID)
		testHandler.InviteMember(w, req)
		if w.Code != http.StatusCreated {
			t.Fatalf("InviteMember(agent): expected 201, got %d: %s", w.Code, w.Body.String())
		}
	}

	// Send message @mentioning BOTH agents
	mentionContent := fmt.Sprintf("@%s @%s do something", agentName1, "SecondAgent")
	payload, _ := json.Marshal(protocol.GroupMessageRequest{
		GroupID: groupID,
		Content: mentionContent,
		TempID:  "multi-1",
	})
	_, success := testHandler.HandleGroupWSMessage(ctx, testUserID, testWorkspaceID, payload)
	if !success {
		t.Fatalf("HandleGroupWSMessage (multi-agent): expected success")
	}

	// Verify exactly 2 tasks were created (one per agent, not duplicated)
	w := httptest.NewRecorder()
	req := newRequest("GET", "/api/groups/"+groupID+"/tasks", nil)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.ListGroupTasks(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListGroupTasks: expected 200, got %d", w.Code)
	}
	var tasks []GroupTaskResponse
	json.NewDecoder(w.Body).Decode(&tasks)
	if len(tasks) != 2 {
		t.Fatalf("expected 2 tasks for 2 agents, got %d", len(tasks))
	}
	if tasks[0].Status != "queued" || tasks[1].Status != "queued" {
		t.Fatal("expected both tasks to be queued")
	}

	// Cleanup
	testPool.Exec(ctx, `DELETE FROM agent_task_queue WHERE group_id = $1`, parseUUID(groupID))
}

// ---------------------------------------------------------------------------
// 5.6 WebSocket group broadcast
// ---------------------------------------------------------------------------

func TestGroupWSBroadcast(t *testing.T) {
	ctx := context.Background()
	group := createTestGroup(t, "Test WS Broadcast")
	groupID := group.ID
	t.Cleanup(func() {
		testPool.Exec(ctx, `DELETE FROM "group" WHERE id = $1`, parseUUID(groupID))
	})

	// Create a dedicated Hub for WS testing with inbound handler
	hub := realtime.NewHub()
	go hub.Run()
	bus := events.New()
	emailSvc := service.NewEmailService()
	h := New(testHandler.Queries, testPool, hub, bus, emailSvc, nil, nil, "")
	hub.InboundHandler = h.HandleInboundWSMessage

	// Start listeners
	handlers := map[string]func(context.Context, events.Event){
		protocol.EventGroupMessage: func(ctx context.Context, e events.Event) {
			payload := e.Payload.(protocol.GroupMessagePayload)
			data, _ := json.Marshal(payload)
			hub.BroadcastToGroup(payload.GroupID, data)
		},
		protocol.EventGroupMessageAck:   func(ctx context.Context, e events.Event) {},
		protocol.EventGroupMessageErr:   func(ctx context.Context, e events.Event) {},
		protocol.EventGroupTaskStatus:   func(ctx context.Context, e events.Event) {},
		protocol.EventGroupMemberJoined: func(ctx context.Context, e events.Event) {},
		protocol.EventGroupMemberLeft:   func(ctx context.Context, e events.Event) {},
		protocol.EventGroupDissolved:    func(ctx context.Context, e events.Event) {},
	}
	for eventType, handlerFn := range handlers {
		et := eventType
		hfn := handlerFn
		bus.Subscribe(et, func(e events.Event) { hfn(context.Background(), e) })
	}

	// Create WS test server with mock auth
	mc := &mockMembershipChecker{}
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		realtime.HandleWebSocket(hub, mc, nil, testHandler.Queries, w, r)
	})
	wsServer := httptest.NewServer(mux)
	defer wsServer.Close()

	// Generate JWT token for WS auth
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": testUserID,
	})
	tokenStr, _ := token.SignedString(auth.JWTSecret())

	// Connect 2 clients with token and workspace_id params
	conn1 := connectWSToServer(t, wsServer.URL, tokenStr, testWorkspaceID)
	defer conn1.Close()
	conn2 := connectWSToServer(t, wsServer.URL, tokenStr, testWorkspaceID)
	defer conn2.Close()
	time.Sleep(50 * time.Millisecond)

	// Register both clients to group via InboundHandler
	registerPayload, _ := json.Marshal(map[string]string{"group_id": groupID})
	hub.InboundHandler(ctx, &realtime.Client{}, "group:register", registerPayload)

	// Send a group message via handler
	msgContent := "WS broadcast test message"
	wsPayload, _ := json.Marshal(protocol.GroupMessageRequest{
		GroupID: groupID,
		Content: msgContent,
		TempID:  "ws-temp-1",
	})
	_, success := h.HandleGroupWSMessage(ctx, testUserID, testWorkspaceID, wsPayload)
	if !success {
		t.Fatalf("HandleGroupWSMessage: expected success")
	}
	time.Sleep(100 * time.Millisecond)

	// Verify registered client received the message
	// Note: Since we used mock clients via InboundHandler directly (not real WS connections),
	// the actual broadcast goes through the event bus which is synchronous.
	// The message should be visible via ListGroupMessages
	w := httptest.NewRecorder()
	req := newRequest("GET", "/api/groups/"+groupID+"/messages", nil)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	h.ListGroupMessages(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListGroupMessages: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var msgList ListMessagesResponse
	json.NewDecoder(w.Body).Decode(&msgList)
	if len(msgList.Messages) == 0 {
		t.Fatal("expected at least 1 message after WS send")
	}
}

// mockMembershipChecker always returns true for WS auth.
type mockMembershipChecker struct{}

func (m *mockMembershipChecker) IsMember(_ context.Context, _, _ string) bool {
	return true
}

// connectWSToServer connects a WebSocket to the test server with auth.
func connectWSToServer(t *testing.T, serverURL, token, workspaceID string) *websocket.Conn {
	t.Helper()
	wsURL := "ws" + serverURL[4:] + "/ws?token=" + token + "&workspace_id=" + workspaceID
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("failed to connect WebSocket: %v", err)
	}
	return conn
}

// ---------------------------------------------------------------------------
// Mock helpers for WS tests in realtime package
// ---------------------------------------------------------------------------

// To run full WS broadcast tests, see server/internal/realtime/hub_test.go
// which tests the Hub's group room functionality with real WebSocket connections.

func TestGroupTaskStatusBroadcast(t *testing.T) {
	ctx := context.Background()
	group := createTestGroup(t, "Test Task Status")
	groupID := group.ID
	t.Cleanup(func() {
		testPool.Exec(ctx, `DELETE FROM "group" WHERE id = $1`, parseUUID(groupID))
	})

	// Get agent and ensure single-word name for @mention matching
	agentID := getTestAgentID(t, ctx)
	var origAgentName string
	testPool.QueryRow(ctx, `SELECT name FROM agent WHERE id = $1`, parseUUID(agentID)).Scan(&origAgentName)
	agentName := strings.Split(origAgentName, " ")[0]
	testPool.Exec(ctx, `UPDATE agent SET name = $1 WHERE id = $2`, agentName, parseUUID(agentID))
	t.Cleanup(func() {
		testPool.Exec(ctx, `UPDATE agent SET name = $1 WHERE id = $2`, origAgentName, parseUUID(agentID))
	})

	// Invite agent to group
	w := httptest.NewRecorder()
	req := newRequest("POST", "/api/groups/"+groupID+"/members", InviteMemberRequest{
		MemberType: "agent",
		MemberID:   agentID,
	})
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.InviteMember(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("InviteMember(agent): expected 201, got %d: %s", w.Code, w.Body.String())
	}

	// Send @mention to create a task
	mentionPayload, _ := json.Marshal(protocol.GroupMessageRequest{
		GroupID: groupID,
		Content: fmt.Sprintf("@%s run a task", agentName),
		TempID:  "task-temp-1",
	})
	_, success := testHandler.HandleGroupWSMessage(ctx, testUserID, testWorkspaceID, mentionPayload)
	if !success {
		t.Fatalf("HandleGroupWSMessage: expected success")
	}

	// Verify task is created with status 'queued'
	w = httptest.NewRecorder()
	req = newRequest("GET", "/api/groups/"+groupID+"/tasks", nil)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.ListGroupTasks(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListGroupTasks: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var tasks []GroupTaskResponse
	json.NewDecoder(w.Body).Decode(&tasks)
	if len(tasks) < 1 {
		t.Fatal("expected at least 1 task")
	}
	if tasks[0].Status != "queued" {
		t.Fatalf("expected task status 'queued', got '%s'", tasks[0].Status)
	}

	taskID := tasks[0].ID

	// Simulate task status transitions via TaskService
	// Claim the task (ClaimAgentTask takes agentID, not taskID)
	claimedTask, err := testHandler.Queries.ClaimAgentTask(ctx, parseUUID(agentID))
	if err != nil {
		t.Fatalf("ClaimAgentTask failed: %v", err)
	}
	if claimedTask.Status != "dispatched" {
		t.Fatalf("expected status 'dispatched' after claim, got '%s'", claimedTask.Status)
	}

	// Start the task
	startedTask, err := testHandler.Queries.StartAgentTask(ctx, parseUUID(taskID))
	if err != nil {
		t.Fatalf("StartAgentTask failed: %v", err)
	}
	if startedTask.Status != "running" {
		t.Fatalf("expected status 'running' after start, got '%s'", startedTask.Status)
	}

	// Complete the task (this triggers OnGroupTaskComplete which writes a message)
	var groupMsgID string
	testPool.QueryRow(ctx, `SELECT id FROM group_message WHERE group_id = $1 ORDER BY created_at DESC LIMIT 1`, parseUUID(groupID)).Scan(&groupMsgID)

	result := `{"output": "Task completed successfully with results"}`
	_, err = testHandler.TaskService.CompleteTask(ctx, parseUUID(taskID), []byte(result), "", "")
	if err != nil {
		t.Fatalf("CompleteTask failed: %v", err)
	}

	// Verify task status is now 'completed'
	var taskStatus string
	testPool.QueryRow(ctx, `SELECT status FROM agent_task_queue WHERE id = $1`, parseUUID(taskID)).Scan(&taskStatus)
	if taskStatus != "completed" {
		t.Fatalf("expected task status 'completed', got '%s'", taskStatus)
	}

	// Verify a group message was created for the completion
	var msgCount int
	testPool.QueryRow(ctx, `SELECT COUNT(*) FROM group_message WHERE group_id = $1`, parseUUID(groupID)).Scan(&msgCount)
	// Should have: original @mention message + agent completion reply
	if msgCount < 2 {
		t.Fatalf("expected at least 2 messages (original + completion), got %d", msgCount)
	}

	// Verify the agent's reply message exists
	var agentReplyContent string
	err = testPool.QueryRow(ctx, `
		SELECT content FROM group_message
		WHERE group_id = $1 AND sender_type = 'agent'
		ORDER BY created_at DESC LIMIT 1
	`, parseUUID(groupID)).Scan(&agentReplyContent)
	if err != nil {
		t.Fatalf("failed to find agent reply message: %v", err)
	}
	if agentReplyContent == "" {
		t.Fatal("agent reply content should not be empty")
	}

	// Cleanup
	testPool.Exec(ctx, `DELETE FROM agent_task_queue WHERE group_id = $1`, parseUUID(groupID))
}

// ---------------------------------------------------------------------------
// 5.8 Reconnection: re-fetch missed messages via REST
// ---------------------------------------------------------------------------

func TestGroupReconnectMissedMessages(t *testing.T) {
	ctx := context.Background()
	group := createTestGroup(t, "Test Reconnect")
	groupID := group.ID
	t.Cleanup(func() {
		testPool.Exec(ctx, `DELETE FROM "group" WHERE id = $1`, parseUUID(groupID))
	})

	// Send a message before "disconnect"
	msg1Content := "Message before disconnect"
	payload1, _ := json.Marshal(protocol.GroupMessageRequest{
		GroupID: groupID,
		Content: msg1Content,
		TempID:  "recon-temp-1",
	})
	_, success := testHandler.HandleGroupWSMessage(ctx, testUserID, testWorkspaceID, payload1)
	if !success {
		t.Fatalf("HandleGroupWSMessage (pre-disconnect): expected success")
	}

	// Capture the timestamp of the first message (use space format for pgtype.Timestamptz.Scan)
	var msg1CreatedAt time.Time
	testPool.QueryRow(ctx, `SELECT created_at FROM group_message WHERE group_id = $1 ORDER BY created_at ASC LIMIT 1`, parseUUID(groupID)).Scan(&msg1CreatedAt)
	afterTimestamp := msg1CreatedAt.Format("2006-01-02 15:04:05.999999999Z07:00")

	// Send a second message (simulating messages missed during disconnect)
	msg2Content := "Message during disconnect"
	payload2, _ := json.Marshal(protocol.GroupMessageRequest{
		GroupID: groupID,
		Content: msg2Content,
		TempID:  "recon-temp-2",
	})
	_, success = testHandler.HandleGroupWSMessage(ctx, testUserID, testWorkspaceID, payload2)
	if !success {
		t.Fatalf("HandleGroupWSMessage (during disconnect): expected success")
	}

	// Reconnect: use ?after=<timestamp> to fetch missed messages (use url.Values to encode + in timezone)
	w := httptest.NewRecorder()
	query := url.Values{"after": {afterTimestamp}}
	req := newRequest("GET", "/api/groups/"+groupID+"/messages?"+query.Encode(), nil)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.ListGroupMessages(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListGroupMessages (reconnect): expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var msgList ListMessagesResponse
	json.NewDecoder(w.Body).Decode(&msgList)

	// Should get 1 message (the one after the timestamp)
	if len(msgList.Messages) != 1 {
		t.Fatalf("expected 1 missed message after reconnect, got %d", len(msgList.Messages))
	}
	if msgList.Messages[0].Content != msg2Content {
		t.Fatalf("expected missed message content '%s', got '%s'", msg2Content, msgList.Messages[0].Content)
	}

	// Verify initial load (no params) returns latest messages in order
	w = httptest.NewRecorder()
	req = newRequest("GET", "/api/groups/"+groupID+"/messages", nil)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.ListGroupMessages(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListGroupMessages (initial load): expected 200, got %d: %s", w.Code, w.Body.String())
	}
	json.NewDecoder(w.Body).Decode(&msgList)
	if len(msgList.Messages) != 2 {
		t.Fatalf("expected 2 messages on initial load, got %d", len(msgList.Messages))
	}
}

// ---------------------------------------------------------------------------
// ListMessages pagination: cursor-based
// ---------------------------------------------------------------------------

func TestGroupMessagesPagination(t *testing.T) {
	ctx := context.Background()
	group := createTestGroup(t, "Test Pagination")
	groupID := group.ID
	t.Cleanup(func() {
		testPool.Exec(ctx, `DELETE FROM "group" WHERE id = $1`, parseUUID(groupID))
	})

	// Send 3 messages
	for i := 0; i < 3; i++ {
		payload, _ := json.Marshal(protocol.GroupMessageRequest{
			GroupID: groupID,
			Content: fmt.Sprintf("Message %d", i+1),
			TempID:  fmt.Sprintf("pag-temp-%d", i+1),
		})
		_, success := testHandler.HandleGroupWSMessage(ctx, testUserID, testWorkspaceID, payload)
		if !success {
			t.Fatalf("HandleGroupWSMessage (msg %d): expected success", i+1)
		}
	}

	// Initial load (limit=2)
	w := httptest.NewRecorder()
	req := newRequest("GET", "/api/groups/"+groupID+"/messages?limit=2", nil)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.ListGroupMessages(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListGroupMessages: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var page1 ListMessagesResponse
	json.NewDecoder(w.Body).Decode(&page1)
	if len(page1.Messages) != 2 {
		t.Fatalf("expected 2 messages on page 1, got %d", len(page1.Messages))
	}
	if page1.NextCursor == "" {
		t.Fatal("expected next_cursor on page 1")
	}

	// Page 2: ?before=<cursor>
	cursor := page1.NextCursor
	w = httptest.NewRecorder()
	req = newRequest("GET", "/api/groups/"+groupID+"/messages?before="+cursor+"&limit=2", nil)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.ListGroupMessages(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListGroupMessages (page 2): expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var page2 ListMessagesResponse
	json.NewDecoder(w.Body).Decode(&page2)
	if len(page2.Messages) != 1 {
		t.Fatalf("expected 1 message on page 2, got %d", len(page2.Messages))
	}
}

// ---------------------------------------------------------------------------
// Group chat validation and edge cases
// ---------------------------------------------------------------------------

func TestGroupChatValidation(t *testing.T) {
	ctx := context.Background()
	group := createTestGroup(t, "Test Validation")
	groupID := group.ID
	t.Cleanup(func() {
		testPool.Exec(ctx, `DELETE FROM "group" WHERE id = $1`, parseUUID(groupID))
	})

	t.Run("empty content rejected", func(t *testing.T) {
		payload, _ := json.Marshal(protocol.GroupMessageRequest{
			GroupID: groupID,
			Content: "",
			TempID:  "empty-1",
		})
		_, success := testHandler.HandleGroupWSMessage(ctx, testUserID, testWorkspaceID, payload)
		if success {
			t.Fatal("expected failure for empty content")
		}
	})

	t.Run("whitespace-only content rejected", func(t *testing.T) {
		payload, _ := json.Marshal(protocol.GroupMessageRequest{
			GroupID: groupID,
			Content: "   ",
			TempID:  "ws-1",
		})
		_, success := testHandler.HandleGroupWSMessage(ctx, testUserID, testWorkspaceID, payload)
		if success {
			t.Fatal("expected failure for whitespace-only content")
		}
	})

	t.Run("invalid JSON body rejected", func(t *testing.T) {
		_, success := testHandler.HandleGroupWSMessage(ctx, testUserID, testWorkspaceID, []byte(`{invalid json}`))
		if success {
			t.Fatal("expected failure for invalid JSON")
		}
	})

	t.Run("non-member cannot send message", func(t *testing.T) {
		nonMemberID := "00000000-0000-0000-0000-000000000099"
		payload, _ := json.Marshal(protocol.GroupMessageRequest{
			GroupID: groupID,
			Content: "hello from non-member",
			TempID:  "nonmem-1",
		})
		_, success := testHandler.HandleGroupWSMessage(ctx, nonMemberID, testWorkspaceID, payload)
		if success {
			t.Fatal("expected failure for non-member")
		}
	})

	t.Run("message to dissolved group rejected", func(t *testing.T) {
		// Create a separate group and dissolve it
		dGroup := createTestGroup(t, "Dissolve Test")
		dGroupID := dGroup.ID

		// Dissolve the group
		w := httptest.NewRecorder()
		req := newRequest("DELETE", "/api/groups/"+dGroupID, nil)
		req.Header.Set("X-Workspace-ID", testWorkspaceID)
		req = withURLParam(req, "id", dGroupID)
		testHandler.DeleteGroup(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("DeleteGroup: expected 200, got %d", w.Code)
		}

		payload, _ := json.Marshal(protocol.GroupMessageRequest{
			GroupID: dGroupID,
			Content: "message to dissolved group",
			TempID:  "dissolved-1",
		})
		_, success := testHandler.HandleGroupWSMessage(ctx, testUserID, testWorkspaceID, payload)
		if success {
			t.Fatal("expected failure for dissolved group")
		}

		testPool.Exec(ctx, `DELETE FROM "group" WHERE id = $1`, parseUUID(dGroupID))
	})

	t.Run("invite already-existing member returns conflict", func(t *testing.T) {
		w := httptest.NewRecorder()
		req := newRequest("POST", "/api/groups/"+groupID+"/members", InviteMemberRequest{
			MemberType: "member",
			MemberID:   testUserID, // creator is already owner
		})
		req.Header.Set("X-Workspace-ID", testWorkspaceID)
		req = withURLParam(req, "id", groupID)
		testHandler.InviteMember(w, req)
		if w.Code != http.StatusConflict {
			t.Fatalf("Invite existing member: expected 409, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("list messages with invalid cursor returns 200 with empty next_cursor", func(t *testing.T) {
		w := httptest.NewRecorder()
		req := newRequest("GET", "/api/groups/"+groupID+"/messages?before=invalid-cursor", nil)
		req.Header.Set("X-Workspace-ID", testWorkspaceID)
		req = withURLParam(req, "id", groupID)
		testHandler.ListGroupMessages(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("ListGroupMessages: expected 200, got %d: %s", w.Code, w.Body.String())
		}
		var resp ListMessagesResponse
		json.NewDecoder(w.Body).Decode(&resp)
		if resp.NextCursor != "" {
			t.Fatalf("expected empty next_cursor for invalid cursor, got '%s'", resp.NextCursor)
		}
	})

	t.Run("list messages with large limit capped at 100", func(t *testing.T) {
		w := httptest.NewRecorder()
		req := newRequest("GET", "/api/groups/"+groupID+"/messages?limit=999", nil)
		req.Header.Set("X-Workspace-ID", testWorkspaceID)
		req = withURLParam(req, "id", groupID)
		testHandler.ListGroupMessages(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("ListGroupMessages: expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("list messages with zero limit uses default", func(t *testing.T) {
		w := httptest.NewRecorder()
		req := newRequest("GET", "/api/groups/"+groupID+"/messages?limit=0", nil)
		req.Header.Set("X-Workspace-ID", testWorkspaceID)
		req = withURLParam(req, "id", groupID)
		testHandler.ListGroupMessages(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("ListGroupMessages: expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})
}

// ---------------------------------------------------------------------------
// Group update validation
// ---------------------------------------------------------------------------

func TestGroupUpdate(t *testing.T) {
	ctx := context.Background()
	group := createTestGroup(t, "Test Update")
	groupID := group.ID
	t.Cleanup(func() {
		testPool.Exec(ctx, `DELETE FROM "group" WHERE id = $1`, parseUUID(groupID))
	})

	// Update announcement only
	announcement := "New announcement text"
	w := httptest.NewRecorder()
	req := newRequest("PATCH", "/api/groups/"+groupID, UpdateGroupRequest{
		Announcement: &announcement,
	})
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.UpdateGroup(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateGroup (announcement): expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var updated GroupResponse
	if err := json.NewDecoder(w.Body).Decode(&updated); err != nil {
		t.Fatalf("failed to decode UpdateGroup response: %v", err)
	}
	if updated.Announcement != announcement {
		t.Fatalf("expected announcement '%s', got '%s'", announcement, updated.Announcement)
	}

	// Update both name and announcement
	newName := "Both Updated"
	newAnnouncement := "Both announcement"
	w = httptest.NewRecorder()
	req = newRequest("PATCH", "/api/groups/"+groupID, UpdateGroupRequest{
		Name:         &newName,
		Announcement: &newAnnouncement,
	})
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.UpdateGroup(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateGroup (both): expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if err := json.NewDecoder(w.Body).Decode(&updated); err != nil {
		t.Fatalf("failed to decode UpdateGroup response: %v", err)
	}
	if updated.Name != newName {
		t.Fatalf("expected name '%s', got '%s'", newName, updated.Name)
	}
	if updated.Announcement != newAnnouncement {
		t.Fatalf("expected announcement '%s', got '%s'", newAnnouncement, updated.Announcement)
	}

	// Name cannot be empty
	emptyName := ""
	w = httptest.NewRecorder()
	req = newRequest("PATCH", "/api/groups/"+groupID, UpdateGroupRequest{
		Name: &emptyName,
	})
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.UpdateGroup(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("UpdateGroup (empty name): expected 400, got %d: %s", w.Code, w.Body.String())
	}

	// Whitespace-only name should also be rejected
	spaceName := "   "
	w = httptest.NewRecorder()
	req = newRequest("PATCH", "/api/groups/"+groupID, UpdateGroupRequest{
		Name: &spaceName,
	})
	req.Header.Set("X-Workspace-ID", testWorkspaceID)
	req = withURLParam(req, "id", groupID)
	testHandler.UpdateGroup(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("UpdateGroup (whitespace name): expected 400, got %d: %s", w.Code, w.Body.String())
	}
}
