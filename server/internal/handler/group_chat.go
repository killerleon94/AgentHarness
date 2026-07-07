package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/realtime"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

// HandleInboundWSMessage routes incoming WebSocket messages to the appropriate handler.
func (h *Handler) HandleInboundWSMessage(ctx context.Context, client *realtime.Client, msgType string, payload json.RawMessage) ([]byte, bool) {
	switch msgType {
	case protocol.EventGroupMessage:
		return h.HandleGroupWSMessage(ctx, client.UserID(), client.WorkspaceID(), payload)
	case "group:register":
		var req struct {
			GroupID string `json:"group_id"`
		}
		if err := json.Unmarshal(payload, &req); err == nil && req.GroupID != "" {
			h.Hub.RegisterGroup(client, req.GroupID)
		}
		return nil, true
	case "group:unregister":
		var req struct {
			GroupID string `json:"group_id"`
		}
		if err := json.Unmarshal(payload, &req); err == nil && req.GroupID != "" {
			h.Hub.UnregisterGroup(client, req.GroupID)
		}
		return nil, true
	default:
		slog.Debug("unknown ws message type", "type", msgType)
		return nil, false
	}
}

// mentionRe matches @mentions including inside markdown and for Unicode (Chinese) names.
var mentionRe = regexp.MustCompile(`@([\p{L}\p{N}_-]+)`)

// mentionInfo holds parsed @mention data.
type mentionInfo struct {
	MemberType string
	MemberID   pgtype.UUID
	Name       string
	IsAgent    bool
}

// HandleGroupWSMessage processes inbound group WebSocket messages.
// It handles group:message type for sending messages.
func (h *Handler) HandleGroupWSMessage(ctx context.Context, userID, workspaceID string, payload json.RawMessage) ([]byte, bool) {
	var req protocol.GroupMessageRequest
	if err := json.Unmarshal(payload, &req); err != nil {
		return h.ackError("", "invalid request body"), false
	}

	if strings.TrimSpace(req.Content) == "" {
		return h.ackError(req.TempID, "message cannot be empty"), false
	}

	return h.sendGroupMessage(ctx, userID, workspaceID, req)
}

// ackError wraps an error into a valid WSMessage envelope.
func (h *Handler) ackError(tempID, errMsg string) []byte {
	b, _ := json.Marshal(map[string]any{
		"type": protocol.EventGroupMessageErr,
		"payload": protocol.GroupMessageErrorPayload{
			TempID: tempID,
			Error:  errMsg,
		},
	})
	return b
}

// sendGroupMessage handles the core logic of sending a group message.
func (h *Handler) sendGroupMessage(ctx context.Context, userID, workspaceID string, req protocol.GroupMessageRequest) ([]byte, bool) {
	// Verify group exists and is active
	group, err := h.Queries.GetGroupInWorkspace(ctx, db.GetGroupInWorkspaceParams{
		ID:          parseUUID(req.GroupID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		return h.ackError(req.TempID, "group not found"), false
	}
	if group.Status != "active" {
		return h.ackError(req.TempID, "group is dissolved"), false
	}

	// Verify sender is a group member
	isMember, err := h.Queries.IsGroupMember(ctx, db.IsGroupMemberParams{
		GroupID:    group.ID,
		MemberType: "member",
		MemberID:   parseUUID(userID),
	})
	if err != nil || !isMember {
		return h.ackError(req.TempID, "access denied"), false
	}

	// Parse @mentions from message content
	mentions := h.parseMentions(ctx, group.ID, req.Content)

	// Collect mention IDs
	mentionTypes := make([]string, len(mentions))
	mentionIDs := make([]pgtype.UUID, len(mentions))
	for i, m := range mentions {
		mentionTypes[i] = m.MemberType
		mentionIDs[i] = m.MemberID
	}

	// Create the message
	msg, err := h.Queries.CreateGroupMessage(ctx, db.CreateGroupMessageParams{
		GroupID:      group.ID,
		SenderType:   "member",
		SenderID:     parseUUID(userID),
		Content:      req.Content,
		MentionsType: mentionTypes,
		MentionsID:   mentionIDs,
	})
	if err != nil {
		slog.Error("failed to create group message", "error", err)
		return h.ackError(req.TempID, "failed to send message"), false
	}

	// Create tasks for @mentioned agents (EnqueueGroupTask re-reads mentions from msg)
	hasAgentMention := false
	for _, m := range mentions {
		if m.IsAgent {
			hasAgentMention = true
			break
		}
	}
	if hasAgentMention {
		if err := h.TaskService.EnqueueGroupTask(ctx, group, msg, 0); err != nil {
			slog.Error("failed to enqueue group task", "error", err)
		}
	}

	// Get sender name for broadcast
	senderName := userID
	if user, err := h.Queries.GetUser(ctx, parseUUID(userID)); err == nil {
		senderName = user.Name
	}

	// Broadcast message to group
	msgPayload := protocol.GroupMessagePayload{
		ID:           uuidToString(msg.ID),
		GroupID:      req.GroupID,
		SenderType:   "member",
		SenderID:     userID,
		SenderName:   senderName,
		Content:      req.Content,
		MentionsType: mentionTypes,
		MentionsID:   uuidSliceToString(mentionIDs),
		CreatedAt:    timestampToString(msg.CreatedAt),
	}

	h.publish(protocol.EventGroupMessage, workspaceID, "member", userID, msgPayload)

	// Return ack to sender (must be a valid WSMessage with type + payload)
	ackPayload, _ := json.Marshal(map[string]any{
		"type": protocol.EventGroupMessageAck,
		"payload": protocol.GroupMessageAckPayload{
			ID:      uuidToString(msg.ID),
			GroupID: req.GroupID,
			TempID:  req.TempID,
		},
		"actor_id": userID,
	})
	return ackPayload, true
}

// parseMentions extracts @mentions from message content and matches them against group members.
// @all and @everyone are treated specially: all members collected but NO tasks created.
func (h *Handler) parseMentions(ctx context.Context, groupID pgtype.UUID, content string) []mentionInfo {
	var mentions []mentionInfo

	// Check for @all or @everyone as whole words (not substring match)
	words := strings.Fields(content)
	for _, w := range words {
		lower := strings.ToLower(w)
		if lower == "@all" || lower == "@everyone" {
			members, err := h.Queries.ListGroupMembers(ctx, groupID)
			if err != nil {
				return nil
			}
			for _, m := range members {
				mentions = append(mentions, mentionInfo{
					MemberType: m.MemberType,
					MemberID:   m.MemberID,
					IsAgent:    false, // @all/@everyone should NOT create tasks
				})
			}
			return mentions
		}
		if lower == "@allagents" {
			members, err := h.Queries.ListGroupMembers(ctx, groupID)
			if err != nil {
				return nil
			}
			for _, m := range members {
				if m.MemberType == "agent" {
					mentions = append(mentions, mentionInfo{
						MemberType: "agent",
						MemberID:   m.MemberID,
						IsAgent:    true,
					})
				}
			}
			return mentions
		}
	}

	// Parse @name patterns (fetch member list once, then match in-memory)
	members, err := h.Queries.ListGroupMembers(ctx, groupID)
	if err != nil {
		return nil
	}

	// Build name→member info map (lowercase name for case-insensitive matching)
	type memberEntry struct {
		info      mentionInfo
		lowerName string
	}
	var memberList []memberEntry
	for _, m := range members {
		var memberName string
		if m.MemberType == "member" {
			if user, err := h.Queries.GetUser(ctx, m.MemberID); err == nil {
				memberName = user.Name
			}
		} else {
			if agent, err := h.Queries.GetAgent(ctx, m.MemberID); err == nil {
				memberName = agent.Name
			}
		}
		memberList = append(memberList, memberEntry{
			info: mentionInfo{
				MemberType: m.MemberType,
				MemberID:   m.MemberID,
				Name:       memberName,
				IsAgent:    m.MemberType == "agent",
			},
			lowerName: strings.ToLower(memberName),
		})
	}

	// Use regex to find @mentions (handles markdown wrapping and Unicode names)
	rawMatches := mentionRe.FindAllStringSubmatchIndex(content, -1)
	seen := make(map[string]bool) // dedup by "type:id"
	for _, loc := range rawMatches {
		mentionStart := loc[0]
		// Skip mentions that are just thank-yous / acknowledgments
		if isThankYouBefore(content, mentionStart) {
			continue
		}
		nameLower := strings.ToLower(content[loc[2]:loc[3]])

		for _, entry := range memberList {
			if entry.lowerName == nameLower {
				key := entry.info.MemberType + ":" + uuidToString(entry.info.MemberID)
				if !seen[key] {
					seen[key] = true
					mentions = append(mentions, entry.info)
				}
				break
			}
		}
	}

	return mentions
}

// isThankYouBefore checks whether text near an @mention is just acknowledgment.
var nonTaskWords = []string{
	"感谢", "谢谢", "辛苦了", "多谢", "好评",
	"收到", "收到了", "确认收到",
	"同意", "认可", "赞同",
	"不错的", "很好", "正确", "完成了",
	"答复后", "回复后再",
}

func isThankYouBefore(content string, mentionStart int) bool {
	start := mentionStart - 30
	if start < 0 {
		start = 0
	}
	before := strings.TrimSpace(content[start:mentionStart])
	for _, kw := range nonTaskWords {
		if strings.Contains(before, kw) {
			return true
		}
	}
	return false
}
