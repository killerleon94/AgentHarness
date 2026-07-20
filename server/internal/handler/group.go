package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

// ---------------------------------------------------------------------------
// Request/Response types
// ---------------------------------------------------------------------------

type CreateGroupRequest struct {
	Name         string `json:"name"`
	Announcement string `json:"announcement"`
}

type UpdateGroupRequest struct {
	Name         *string `json:"name"`
	Announcement *string `json:"announcement"`
}

type InviteMemberRequest struct {
	MemberType string `json:"member_type"`
	MemberID   string `json:"member_id"`
}

type BatchInviteMembersRequest struct {
	Members []InviteMemberRequest `json:"members"`
}

type BatchInviteMemberResult struct {
	MemberType string               `json:"member_type"`
	MemberID   string               `json:"member_id"`
	Status     string               `json:"status"`
	Error      string               `json:"error,omitempty"`
	Member     *GroupMemberResponse `json:"member,omitempty"`
}

type GroupResponse struct {
	ID            string                `json:"id"`
	WorkspaceID   string                `json:"workspace_id"`
	Name          string                `json:"name"`
	AvatarURL     *string               `json:"avatar_url"`
	Announcement  string                `json:"announcement"`
	CreatedByType string                `json:"created_by_type"`
	CreatedByID   string                `json:"created_by_id"`
	Status        string                `json:"status"`
	MemberCount   int                   `json:"member_count"`
	Members       []GroupMemberResponse `json:"members,omitempty"`
	CreatedAt     string                `json:"created_at"`
	UpdatedAt     string                `json:"updated_at"`
}

type GroupMemberResponse struct {
	ID         string `json:"id"`
	GroupID    string `json:"group_id"`
	MemberType string `json:"member_type"`
	MemberID   string `json:"member_id"`
	Role       string `json:"role"`
	JoinedAt   string `json:"joined_at"`
	Name       string `json:"name,omitempty"`
	AvatarURL  string `json:"avatar_url,omitempty"`
}

type GroupMessageResponse struct {
	ID           string   `json:"id"`
	GroupID      string   `json:"group_id"`
	SenderType   string   `json:"sender_type"`
	SenderID     string   `json:"sender_id"`
	SenderName   string   `json:"sender_name"`
	Content      string   `json:"content"`
	MentionsType []string `json:"mentions_type"`
	MentionsID   []string `json:"mentions_id"`
	CreatedAt    string   `json:"created_at"`
}

type GroupTaskResponse struct {
	ID           string  `json:"id"`
	AgentID      string  `json:"agent_id"`
	AgentName    string  `json:"agent_name"`
	GroupID      string  `json:"group_id"`
	MessageID    string  `json:"message_id"`
	Status       string  `json:"status"`
	Context      *string `json:"context"`
	Error        *string `json:"error"`
	CreatedAt    string  `json:"created_at"`
	DispatchedAt *string `json:"dispatched_at"`
	StartedAt    *string `json:"started_at"`
	CompletedAt  *string `json:"completed_at"`
}

type ListMessagesResponse struct {
	Messages   []GroupMessageResponse `json:"messages"`
	NextCursor string                 `json:"next_cursor,omitempty"`
}

// ---------------------------------------------------------------------------
// CreateGroup
// ---------------------------------------------------------------------------

func (h *Handler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	workspaceID := resolveWorkspaceID(r)

	var req CreateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	group, err := h.Queries.CreateGroup(r.Context(), db.CreateGroupParams{
		WorkspaceID:   parseUUID(workspaceID),
		Name:          req.Name,
		AvatarUrl:     pgtype.Text{Valid: false},
		Announcement:  req.Announcement,
		CreatedByType: "member",
		CreatedByID:   parseUUID(userID),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create group")
		return
	}

	// Add creator as owner member
	member, err := h.Queries.CreateGroupMember(r.Context(), db.CreateGroupMemberParams{
		GroupID:    group.ID,
		MemberType: "member",
		MemberID:   parseUUID(userID),
		Role:       "owner",
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to add owner")
		return
	}

	resp := groupToResponse(group, 1, []GroupMemberResponse{h.groupMemberToResponse(r.Context(), member)})
	writeJSON(w, http.StatusCreated, resp)
}

// ---------------------------------------------------------------------------
// ListGroups
// ---------------------------------------------------------------------------

func (h *Handler) ListGroups(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	workspaceID := resolveWorkspaceID(r)

	userRole := requestUserRole(r)

	var groups []db.Group
	var err error

	if userRole == "admin" {
		groups, err = h.Queries.ListAllGroupsInWorkspace(r.Context(), parseUUID(workspaceID))
	} else {
		groups, err = h.Queries.ListGroupsByMember(r.Context(), db.ListGroupsByMemberParams{
			MemberType:  "member",
			MemberID:    parseUUID(userID),
			WorkspaceID: parseUUID(workspaceID),
		})
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list groups")
		return
	}

	resp := make([]GroupResponse, len(groups))
	for i, g := range groups {
		count, _ := h.Queries.CountGroupMembers(r.Context(), g.ID)
		resp[i] = groupToResponse(g, int(count), nil)
	}
	writeJSON(w, http.StatusOK, resp)
}

// ---------------------------------------------------------------------------
// GetGroup
// ---------------------------------------------------------------------------

func (h *Handler) GetGroup(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}
	workspaceID := resolveWorkspaceID(r)
	groupID := chi.URLParam(r, "id")

	group, err := h.Queries.GetGroupInWorkspace(r.Context(), db.GetGroupInWorkspaceParams{
		ID:          parseUUID(groupID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "group not found")
		return
	}
	if group.Status != "active" {
		writeError(w, http.StatusNotFound, "group not found")
		return
	}

	// Get members
	dbMembers, err := h.Queries.ListGroupMembers(r.Context(), group.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list members")
		return
	}

	count, _ := h.Queries.CountGroupMembers(r.Context(), group.ID)
	members := make([]GroupMemberResponse, len(dbMembers))
	for i, m := range dbMembers {
		members[i] = h.groupMemberToResponse(r.Context(), m)
	}

	resp := groupToResponse(group, int(count), members)
	writeJSON(w, http.StatusOK, resp)
}

// ---------------------------------------------------------------------------
// UpdateGroup
// ---------------------------------------------------------------------------

func (h *Handler) UpdateGroup(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	workspaceID := resolveWorkspaceID(r)
	groupID := chi.URLParam(r, "id")

	group, err := h.Queries.GetGroupInWorkspace(r.Context(), db.GetGroupInWorkspaceParams{
		ID:          parseUUID(groupID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "group not found")
		return
	}

	// Only owner, workspace admin, or system admin can update
	role := requestUserRole(r)
	if role != "admin" && uuidToString(group.CreatedByID) != userID {
		// Check if user is workspace owner/admin
		member, err := h.getWorkspaceMember(r.Context(), userID, workspaceID)
		if err != nil || (member.Role != "owner" && member.Role != "admin") {
			writeError(w, http.StatusForbidden, "only group owner can update group")
			return
		}
	}

	var req UpdateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name != nil && strings.TrimSpace(*req.Name) == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	updated, err := h.Queries.UpdateGroup(r.Context(), db.UpdateGroupParams{
		ID:           group.ID,
		Name:         ptrToText(req.Name),
		Announcement: ptrToText(req.Announcement),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update group")
		return
	}

	writeJSON(w, http.StatusOK, groupToResponse(updated, 0, nil))
}

// ---------------------------------------------------------------------------
// Invite member helpers
// ---------------------------------------------------------------------------

type inviteMemberResult struct {
	member     *db.GroupMember
	memberID   string
	memberType string
	memberName string
	err        error
}

func (h *Handler) inviteMemberInternal(ctx context.Context, group db.Group, workspaceID, userID string, req InviteMemberRequest) inviteMemberResult {
	if req.MemberType != "member" && req.MemberType != "agent" {
		return inviteMemberResult{err: fmt.Errorf("member_type must be 'member' or 'agent'")}
	}

	// Validate member exists and is not disabled
	resolvedID := req.MemberID
	if req.MemberType == "member" {
		var foundUser db.User
		u, err := h.Queries.GetUser(ctx, parseUUID(req.MemberID))
		if err != nil {
			u2, err2 := h.Queries.GetUserByEmail(ctx, req.MemberID)
			if err2 != nil {
				return inviteMemberResult{err: fmt.Errorf("user not found by id or email")}
			}
			foundUser = u2
			resolvedID = uuidToString(u2.ID)
		} else {
			foundUser = u
		}
		if foundUser.Disabled {
			return inviteMemberResult{err: fmt.Errorf("user is disabled")}
		}
		_, err = h.Queries.GetMemberByUserAndWorkspace(ctx, db.GetMemberByUserAndWorkspaceParams{
			UserID:      parseUUID(resolvedID),
			WorkspaceID: parseUUID(workspaceID),
		})
		if err != nil {
			return inviteMemberResult{err: fmt.Errorf("user is not a workspace member")}
		}
	} else {
		agent, err := h.Queries.GetAgentInWorkspace(ctx, db.GetAgentInWorkspaceParams{
			ID:          parseUUID(req.MemberID),
			WorkspaceID: parseUUID(workspaceID),
		})
		if err != nil {
			return inviteMemberResult{err: fmt.Errorf("agent not found in workspace")}
		}
		if agent.ArchivedAt.Valid {
			return inviteMemberResult{err: fmt.Errorf("agent is archived")}
		}
	}

	// Check for duplicate membership
	existing, err := h.Queries.GetGroupMemberByGroupAndMember(ctx, db.GetGroupMemberByGroupAndMemberParams{
		GroupID:    group.ID,
		MemberType: req.MemberType,
		MemberID:   parseUUID(resolvedID),
	})
	if err == nil && existing.ID.Valid {
		return inviteMemberResult{err: fmt.Errorf("already a member")}
	}

	member, err := h.Queries.CreateGroupMember(ctx, db.CreateGroupMemberParams{
		GroupID:    group.ID,
		MemberType: req.MemberType,
		MemberID:   parseUUID(resolvedID),
		Role:       "member",
	})
	if err != nil {
		return inviteMemberResult{err: fmt.Errorf("failed to add member")}
	}

	// Resolve member name for broadcast
	memberName := resolvedID
	if req.MemberType == "member" {
		if u, err := h.Queries.GetUser(ctx, parseUUID(resolvedID)); err == nil {
			memberName = u.Name
		}
	} else {
		if a, err := h.Queries.GetAgent(ctx, parseUUID(resolvedID)); err == nil {
			memberName = a.Name
		}
	}

	return inviteMemberResult{
		member:     &member,
		memberID:   resolvedID,
		memberType: req.MemberType,
		memberName: memberName,
	}
}

func (h *Handler) canInvite(r *http.Request, group db.Group, workspaceID, userID string) bool {
	role := requestUserRole(r)
	if role == "admin" {
		return true
	}
	gm, err := h.Queries.GetGroupMemberByGroupAndMember(r.Context(), db.GetGroupMemberByGroupAndMemberParams{
		GroupID:    group.ID,
		MemberType: "member",
		MemberID:   parseUUID(userID),
	})
	if err == nil && gm.Role == "owner" {
		return true
	}
	member, err := h.getWorkspaceMember(r.Context(), userID, workspaceID)
	if err == nil && (member.Role == "owner" || member.Role == "admin") {
		return true
	}
	return false
}

// ---------------------------------------------------------------------------
// InviteMember (single)
// ---------------------------------------------------------------------------

func (h *Handler) InviteMember(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	workspaceID := resolveWorkspaceID(r)
	groupID := chi.URLParam(r, "id")

	group, err := h.Queries.GetGroupInWorkspace(r.Context(), db.GetGroupInWorkspaceParams{
		ID:          parseUUID(groupID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "group not found")
		return
	}

	if !h.canInvite(r, group, workspaceID, userID) {
		writeError(w, http.StatusForbidden, "only group owners can invite members")
		return
	}

	var req InviteMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	result := h.inviteMemberInternal(r.Context(), group, workspaceID, userID, req)
	if result.err != nil {
		status := http.StatusBadRequest
		if result.err.Error() == "already a member" {
			status = http.StatusConflict
		}
		writeError(w, status, result.err.Error())
		return
	}

	h.publish(protocol.EventGroupMemberJoined, workspaceID, "member", userID, protocol.GroupMemberJoinedPayload{
		GroupID:    groupID,
		MemberType: result.memberType,
		MemberID:   result.memberID,
		MemberName: result.memberName,
		Role:       "member",
	})

	writeJSON(w, http.StatusCreated, h.groupMemberToResponse(r.Context(), *result.member))
}

// ---------------------------------------------------------------------------
// BatchInviteMember
// ---------------------------------------------------------------------------

func (h *Handler) BatchInviteMember(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	workspaceID := resolveWorkspaceID(r)
	groupID := chi.URLParam(r, "id")

	group, err := h.Queries.GetGroupInWorkspace(r.Context(), db.GetGroupInWorkspaceParams{
		ID:          parseUUID(groupID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "group not found")
		return
	}

	if !h.canInvite(r, group, workspaceID, userID) {
		writeError(w, http.StatusForbidden, "only group owners can invite members")
		return
	}

	var req BatchInviteMembersRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if len(req.Members) == 0 {
		writeError(w, http.StatusBadRequest, "no members specified")
		return
	}

	results := make([]BatchInviteMemberResult, 0, len(req.Members))
	for _, m := range req.Members {
		result := h.inviteMemberInternal(r.Context(), group, workspaceID, userID, m)
		if result.err != nil {
			results = append(results, BatchInviteMemberResult{
				MemberType: m.MemberType,
				MemberID:   m.MemberID,
				Status:     "error",
				Error:      result.err.Error(),
			})
			continue
		}

		h.publish(protocol.EventGroupMemberJoined, workspaceID, "member", userID, protocol.GroupMemberJoinedPayload{
			GroupID:    groupID,
			MemberType: result.memberType,
			MemberID:   result.memberID,
			MemberName: result.memberName,
			Role:       "member",
		})

		memberResp := h.groupMemberToResponse(r.Context(), *result.member)
		results = append(results, BatchInviteMemberResult{
			MemberType: result.memberType,
			MemberID:   result.memberID,
			Status:     "success",
			Member:     &memberResp,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{"results": results})
}

// ---------------------------------------------------------------------------
// RemoveMember
// ---------------------------------------------------------------------------

func (h *Handler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	workspaceID := resolveWorkspaceID(r)
	groupID := chi.URLParam(r, "id")
	memberID := chi.URLParam(r, "memberId")

	group, err := h.Queries.GetGroupInWorkspace(r.Context(), db.GetGroupInWorkspaceParams{
		ID:          parseUUID(groupID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "group not found")
		return
	}

	// Verify caller is owner or workspace admin
	role := requestUserRole(r)
	if role != "admin" {
		gm, err := h.Queries.GetGroupMemberByGroupAndMember(r.Context(), db.GetGroupMemberByGroupAndMemberParams{
			GroupID:    group.ID,
			MemberType: "member",
			MemberID:   parseUUID(userID),
		})
		if err != nil {
			writeError(w, http.StatusForbidden, "access denied")
			return
		}
		if gm.Role != "owner" {
			member, err := h.getWorkspaceMember(r.Context(), userID, workspaceID)
			if err != nil || (member.Role != "owner" && member.Role != "admin") {
				writeError(w, http.StatusForbidden, "only group owners can remove members")
				return
			}
		}
	}

	// Cannot remove the owner
	targetMember, err := h.Queries.GetGroupMember(r.Context(), parseUUID(memberID))
	if err != nil {
		writeError(w, http.StatusNotFound, "member not found")
		return
	}
	if targetMember.Role == "owner" {
		writeError(w, http.StatusBadRequest, "cannot remove group owner")
		return
	}

	if err := h.Queries.DeleteGroupMember(r.Context(), targetMember.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to remove member")
		return
	}

	// Broadcast member-left event
	h.publish(protocol.EventGroupMemberLeft, workspaceID, "member", userID, protocol.GroupMemberLeftPayload{
		GroupID:  groupID,
		MemberID: uuidToString(targetMember.MemberID),
	})

	w.WriteHeader(http.StatusNoContent)
}

// ---------------------------------------------------------------------------
// LeaveGroup
// ---------------------------------------------------------------------------

func (h *Handler) LeaveGroup(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	workspaceID := resolveWorkspaceID(r)
	groupID := chi.URLParam(r, "id")

	group, err := h.Queries.GetGroupInWorkspace(r.Context(), db.GetGroupInWorkspaceParams{
		ID:          parseUUID(groupID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "group not found")
		return
	}

	gm, err := h.Queries.GetGroupMemberByGroupAndMember(r.Context(), db.GetGroupMemberByGroupAndMemberParams{
		GroupID:    group.ID,
		MemberType: "member",
		MemberID:   parseUUID(userID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "not a member of this group")
		return
	}

	if gm.Role == "owner" {
		writeError(w, http.StatusBadRequest, "group owner cannot leave, transfer ownership or delete group first")
		return
	}

	if err := h.Queries.DeleteGroupMember(r.Context(), gm.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to leave group")
		return
	}

	h.publish(protocol.EventGroupMemberLeft, workspaceID, "member", userID, protocol.GroupMemberLeftPayload{
		GroupID:  groupID,
		MemberID: userID,
	})

	w.WriteHeader(http.StatusNoContent)
}

// ---------------------------------------------------------------------------
// DeleteGroup (Dissolve)
// ---------------------------------------------------------------------------

func (h *Handler) DeleteGroup(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	workspaceID := resolveWorkspaceID(r)
	groupID := chi.URLParam(r, "id")

	group, err := h.Queries.GetGroupInWorkspace(r.Context(), db.GetGroupInWorkspaceParams{
		ID:          parseUUID(groupID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "group not found")
		return
	}

	// Only owner or workspace admin can dissolve
	role := requestUserRole(r)
	canDissolve := false
	if role == "admin" {
		canDissolve = true
	} else {
		gm, err := h.Queries.GetGroupMemberByGroupAndMember(r.Context(), db.GetGroupMemberByGroupAndMemberParams{
			GroupID:    group.ID,
			MemberType: "member",
			MemberID:   parseUUID(userID),
		})
		if err == nil && gm.Role == "owner" {
			canDissolve = true
		}
		if !canDissolve {
			member, err := h.getWorkspaceMember(r.Context(), userID, workspaceID)
			if err == nil && (member.Role == "owner" || member.Role == "admin") {
				canDissolve = true
			}
		}
	}
	if !canDissolve {
		writeError(w, http.StatusForbidden, "only group owner can dissolve group")
		return
	}

	// Cancel all active tasks
	h.Queries.CancelGroupTasks(r.Context(), group.ID)

	// Dissolve the group
	if err := h.Queries.DissolveGroup(r.Context(), group.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to dissolve group")
		return
	}

	// Broadcast dissolved event
	h.publish(protocol.EventGroupDissolved, workspaceID, "member", userID, protocol.GroupDissolvedPayload{
		GroupID: groupID,
	})

	writeJSON(w, http.StatusOK, map[string]string{"status": "dissolved"})
}

// ---------------------------------------------------------------------------
// ListMessages
// ---------------------------------------------------------------------------

func (h *Handler) ListGroupMessages(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}
	groupID := chi.URLParam(r, "id")

	before := r.URL.Query().Get("before")
	after := r.URL.Query().Get("after")
	limitStr := r.URL.Query().Get("limit")
	limit := int32(50)
	if limitStr != "" {
		if l, err := parseInt32(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	var messages []db.GroupMessage
	var err error

	if after != "" {
		// Reconnect: fetch messages after timestamp
		var ts pgtype.Timestamptz
		if err := ts.Scan(after); err == nil {
			messages, err = h.Queries.ListGroupMessagesAfter(r.Context(), db.ListGroupMessagesAfterParams{
				GroupID:   parseUUID(groupID),
				CreatedAt: ts,
				Limit:     limit,
			})
		}
	} else if before != "" {
		// Pagination: fetch messages before cursor (UUID-based timestamp)
		var ts pgtype.Timestamptz
		if msg, lookupErr := h.Queries.GetGroupMessage(r.Context(), parseUUID(before)); lookupErr == nil {
			ts = msg.CreatedAt
		}
		if ts.Valid {
			messages, err = h.Queries.ListGroupMessagesBefore(r.Context(), db.ListGroupMessagesBeforeParams{
				GroupID:   parseUUID(groupID),
				CreatedAt: ts,
				Limit:     limit,
			})
		}
	} else {
		// Initial load
		messages, err = h.Queries.ListLatestGroupMessages(r.Context(), db.ListLatestGroupMessagesParams{
			GroupID: parseUUID(groupID),
			Limit:   limit,
		})
	}

	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list messages")
		return
	}

	resp := make([]GroupMessageResponse, len(messages))
	for i, m := range messages {
		resp[i] = groupMessageToResponse(m)
	}

	// Enrich sender names
	for i := range resp {
		if resp[i].SenderType == "member" {
			if user, err := h.Queries.GetUser(r.Context(), parseUUID(resp[i].SenderID)); err == nil {
				resp[i].SenderName = user.Name
			}
		} else if resp[i].SenderType == "agent" {
			if agent, err := h.Queries.GetAgent(r.Context(), parseUUID(resp[i].SenderID)); err == nil {
				resp[i].SenderName = agent.Name
			}
		}
	}

	var nextCursor string
	if len(messages) > 0 {
		nextCursor = uuidToString(messages[len(messages)-1].ID)
	}

	writeJSON(w, http.StatusOK, ListMessagesResponse{
		Messages:   resp,
		NextCursor: nextCursor,
	})
}

// ---------------------------------------------------------------------------
// ListTasks
// ---------------------------------------------------------------------------

func (h *Handler) ListGroupTasks(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}
	groupID := chi.URLParam(r, "id")

	rows, err := h.Queries.ListGroupTasks(r.Context(), parseUUID(groupID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list tasks")
		return
	}

	resp := make([]GroupTaskResponse, len(rows))
	for i, row := range rows {
		var ctxStr *string
		if row.Context != nil {
			s := string(row.Context)
			ctxStr = &s
		}
		var errStr *string
		if row.Error.Valid {
			errStr = &row.Error.String
		}
		resp[i] = GroupTaskResponse{
			ID:           uuidToString(row.ID),
			AgentID:      uuidToString(row.AgentID),
			AgentName:    row.AgentName,
			GroupID:      groupID,
			MessageID:    uuidToString(row.GroupMessageID),
			Status:       row.Status,
			Context:      ctxStr,
			Error:        errStr,
			CreatedAt:    timestampToString(row.CreatedAt),
			DispatchedAt: timestampToPtr(row.DispatchedAt),
			StartedAt:    timestampToPtr(row.StartedAt),
			CompletedAt:  timestampToPtr(row.CompletedAt),
		}
	}

	writeJSON(w, http.StatusOK, resp)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func groupToResponse(g db.Group, memberCount int, members []GroupMemberResponse) GroupResponse {
	resp := GroupResponse{
		ID:            uuidToString(g.ID),
		WorkspaceID:   uuidToString(g.WorkspaceID),
		Name:          g.Name,
		AvatarURL:     textToPtr(g.AvatarUrl),
		Announcement:  g.Announcement,
		CreatedByType: g.CreatedByType,
		CreatedByID:   uuidToString(g.CreatedByID),
		Status:        g.Status,
		MemberCount:   memberCount,
		Members:       members,
		CreatedAt:     timestampToString(g.CreatedAt),
		UpdatedAt:     timestampToString(g.UpdatedAt),
	}
	return resp
}

func (h *Handler) groupMemberToResponse(ctx context.Context, m db.GroupMember) GroupMemberResponse {
	resp := GroupMemberResponse{
		ID:         uuidToString(m.ID),
		GroupID:    uuidToString(m.GroupID),
		MemberType: m.MemberType,
		MemberID:   uuidToString(m.MemberID),
		Role:       m.Role,
		JoinedAt:   timestampToString(m.JoinedAt),
	}
	if m.MemberType == "member" {
		if user, err := h.Queries.GetUser(ctx, m.MemberID); err == nil {
			resp.Name = user.Name
			resp.AvatarURL = user.AvatarUrl.String
		} else {
			resp.Name = "Unknown User"
		}
	} else if m.MemberType == "agent" {
		if agent, err := h.Queries.GetAgent(ctx, m.MemberID); err == nil {
			resp.Name = agent.Name
			resp.AvatarURL = agent.AvatarUrl.String
		} else {
			resp.Name = "Unknown Agent"
		}
	}
	return resp
}

func groupMessageToResponse(m db.GroupMessage) GroupMessageResponse {
	return GroupMessageResponse{
		ID:           uuidToString(m.ID),
		GroupID:      uuidToString(m.GroupID),
		SenderType:   m.SenderType,
		SenderID:     uuidToString(m.SenderID),
		Content:      m.Content,
		MentionsType: m.MentionsType,
		MentionsID:   uuidSliceToString(m.MentionsID),
		CreatedAt:    timestampToString(m.CreatedAt),
	}
}

func parseInt32(s string) (int32, error) {
	var n int32
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, fmt.Errorf("not a number")
		}
		n = n*10 + int32(c-'0')
	}
	return n, nil
}

func uuidSliceToString(ids []pgtype.UUID) []string {
	result := make([]string, len(ids))
	for i, id := range ids {
		result[i] = uuidToString(id)
	}
	return result
}
