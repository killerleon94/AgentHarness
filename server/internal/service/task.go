package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/events"
	"github.com/multica-ai/multica/server/internal/mention"
	"github.com/multica-ai/multica/server/internal/realtime"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
	"github.com/multica-ai/multica/server/pkg/redact"
	"github.com/multica-ai/multica/server/pkg/util"
)

type TaskService struct {
	Queries *db.Queries
	Hub     *realtime.Hub
	Bus     *events.Bus
}

func NewTaskService(q *db.Queries, hub *realtime.Hub, bus *events.Bus) *TaskService {
	return &TaskService{Queries: q, Hub: hub, Bus: bus}
}

// maxDelegationDepth limits how many levels of agent→agent task delegation are
// allowed in group chat chains. User-triggered tasks start at depth 0; each
// subsequent agent→agent mention increments by 1.
const maxDelegationDepth = 10

// mentionRe matches @mentions anywhere in text, including inside markdown
// formatting like **@Agent** or _@Agent_. Uses \p{L} for Unicode letters
// (Chinese, Japanese, etc.) since agent names can contain non-ASCII characters.
var mentionRe = regexp.MustCompile(`@([\p{L}\p{N}_-]+)`)

// EnqueueTaskForIssue creates a queued task for an agent-assigned issue.
// No context snapshot is stored — the agent fetches all data it needs at
// runtime via the multica CLI.
func (s *TaskService) EnqueueTaskForIssue(ctx context.Context, issue db.Issue, triggerCommentID ...pgtype.UUID) (db.AgentTaskQueue, error) {
	if !issue.AssigneeID.Valid {
		slog.Error("task enqueue failed", "issue_id", util.UUIDToString(issue.ID), "error", "issue has no assignee")
		return db.AgentTaskQueue{}, fmt.Errorf("issue has no assignee")
	}

	agent, err := s.Queries.GetAgent(ctx, issue.AssigneeID)
	if err != nil {
		slog.Error("task enqueue failed", "issue_id", util.UUIDToString(issue.ID), "error", err)
		return db.AgentTaskQueue{}, fmt.Errorf("load agent: %w", err)
	}
	if agent.ArchivedAt.Valid {
		slog.Debug("task enqueue skipped: agent is archived", "issue_id", util.UUIDToString(issue.ID), "agent_id", util.UUIDToString(agent.ID))
		return db.AgentTaskQueue{}, fmt.Errorf("agent is archived")
	}
	if !agent.RuntimeID.Valid {
		slog.Error("task enqueue failed", "issue_id", util.UUIDToString(issue.ID), "error", "agent has no runtime")
		return db.AgentTaskQueue{}, fmt.Errorf("agent has no runtime")
	}

	var commentID pgtype.UUID
	if len(triggerCommentID) > 0 {
		commentID = triggerCommentID[0]
	}

	task, err := s.Queries.CreateAgentTask(ctx, db.CreateAgentTaskParams{
		AgentID:          issue.AssigneeID,
		RuntimeID:        agent.RuntimeID,
		IssueID:          issue.ID,
		Priority:         priorityToInt(issue.Priority),
		TriggerCommentID: commentID,
	})
	if err != nil {
		slog.Error("task enqueue failed", "issue_id", util.UUIDToString(issue.ID), "error", err)
		return db.AgentTaskQueue{}, fmt.Errorf("create task: %w", err)
	}

	slog.Info("task enqueued", "task_id", util.UUIDToString(task.ID), "issue_id", util.UUIDToString(issue.ID), "agent_id", util.UUIDToString(issue.AssigneeID))
	return task, nil
}

// EnqueueTaskForMention creates a queued task for a mentioned agent on an issue.
// Unlike EnqueueTaskForIssue, this takes an explicit agent ID rather than
// deriving it from the issue assignee.
func (s *TaskService) EnqueueTaskForMention(ctx context.Context, issue db.Issue, agentID pgtype.UUID, triggerCommentID pgtype.UUID) (db.AgentTaskQueue, error) {
	agent, err := s.Queries.GetAgent(ctx, agentID)
	if err != nil {
		slog.Error("mention task enqueue failed: agent not found", "issue_id", util.UUIDToString(issue.ID), "agent_id", util.UUIDToString(agentID), "error", err)
		return db.AgentTaskQueue{}, fmt.Errorf("load agent: %w", err)
	}
	if agent.ArchivedAt.Valid {
		slog.Debug("mention task enqueue skipped: agent is archived", "issue_id", util.UUIDToString(issue.ID), "agent_id", util.UUIDToString(agentID))
		return db.AgentTaskQueue{}, fmt.Errorf("agent is archived")
	}
	if !agent.RuntimeID.Valid {
		slog.Error("mention task enqueue failed: agent has no runtime", "issue_id", util.UUIDToString(issue.ID), "agent_id", util.UUIDToString(agentID))
		return db.AgentTaskQueue{}, fmt.Errorf("agent has no runtime")
	}

	task, err := s.Queries.CreateAgentTask(ctx, db.CreateAgentTaskParams{
		AgentID:          agentID,
		RuntimeID:        agent.RuntimeID,
		IssueID:          issue.ID,
		Priority:         priorityToInt(issue.Priority),
		TriggerCommentID: triggerCommentID,
	})
	if err != nil {
		slog.Error("mention task enqueue failed", "issue_id", util.UUIDToString(issue.ID), "agent_id", util.UUIDToString(agentID), "error", err)
		return db.AgentTaskQueue{}, fmt.Errorf("create task: %w", err)
	}

	slog.Info("mention task enqueued", "task_id", util.UUIDToString(task.ID), "issue_id", util.UUIDToString(issue.ID), "agent_id", util.UUIDToString(agentID))
	return task, nil
}

// EnqueueChatTask creates a queued task for a chat session.
// Unlike issue tasks, chat tasks have no issue_id.
func (s *TaskService) EnqueueChatTask(ctx context.Context, chatSession db.ChatSession) (db.AgentTaskQueue, error) {
	agent, err := s.Queries.GetAgent(ctx, chatSession.AgentID)
	if err != nil {
		slog.Error("chat task enqueue failed", "chat_session_id", util.UUIDToString(chatSession.ID), "error", err)
		return db.AgentTaskQueue{}, fmt.Errorf("load agent: %w", err)
	}
	if agent.ArchivedAt.Valid {
		return db.AgentTaskQueue{}, fmt.Errorf("agent is archived")
	}
	if !agent.RuntimeID.Valid {
		return db.AgentTaskQueue{}, fmt.Errorf("agent has no runtime")
	}

	task, err := s.Queries.CreateChatTask(ctx, db.CreateChatTaskParams{
		AgentID:       chatSession.AgentID,
		RuntimeID:     agent.RuntimeID,
		Priority:      2, // medium priority for chat
		ChatSessionID: chatSession.ID,
	})
	if err != nil {
		slog.Error("chat task enqueue failed", "chat_session_id", util.UUIDToString(chatSession.ID), "error", err)
		return db.AgentTaskQueue{}, fmt.Errorf("create chat task: %w", err)
	}

	slog.Info("chat task enqueued", "task_id", util.UUIDToString(task.ID), "chat_session_id", util.UUIDToString(chatSession.ID), "agent_id", util.UUIDToString(chatSession.AgentID))
	return task, nil
}

// EnqueueGroupTask creates a queued task for an agent mentioned in a group message.
// parentDepth is the delegation depth of the triggering message: 0 for user messages,
// increasing by 1 for each agent→agent chain level. Tasks are skipped when
// parentDepth exceeds maxDelegationDepth.
func (s *TaskService) EnqueueGroupTask(ctx context.Context, group db.Group, msg db.GroupMessage, parentDepth int32) error {
	// Check depth limit
	childDepth := parentDepth + 1
	if childDepth > maxDelegationDepth {
		slog.Debug("group task enqueue skipped: max delegation depth reached", "depth", parentDepth)
		return nil
	}

	// Parse mentions to find agents
	var agentIDs []pgtype.UUID
	for i, mt := range msg.MentionsType {
		if mt == "agent" {
			agentIDs = append(agentIDs, msg.MentionsID[i])
		}
	}

	// Fetch recent messages once for all agents in this batch.
	history, _ := s.buildGroupHistory(ctx, group.ID, msg.CreatedAt, 8)

	for _, agentID := range agentIDs {
		agent, err := s.Queries.GetAgent(ctx, agentID)
		if err != nil {
			slog.Error("group task enqueue: agent not found", "agent_id", util.UUIDToString(agentID), "error", err)
			continue
		}
		if agent.ArchivedAt.Valid {
			slog.Debug("group task enqueue skipped: agent is archived", "agent_id", util.UUIDToString(agentID))
			continue
		}
		if !agent.RuntimeID.Valid {
			slog.Error("group task enqueue failed: agent has no runtime", "agent_id", util.UUIDToString(agentID))
			continue
		}

		// Warn if the agent already has a pending task, but still enqueue — tasks
		// will be processed sequentially by the daemon.
		if hasPending, err := s.Queries.HasPendingGroupTask(ctx, db.HasPendingGroupTaskParams{
			GroupID: group.ID,
			AgentID: agentID,
		}); err != nil {
			slog.Warn("group task enqueue: failed to check pending tasks", "agent_id", util.UUIDToString(agentID), "error", err)
		} else if hasPending {
			slog.Info("group task enqueued while agent has pending tasks", "agent_id", util.UUIDToString(agentID), "group_id", util.UUIDToString(group.ID))
		}

		// Build context with message content, recent history, and group info.
		contextMap := map[string]any{
			"content":      msg.Content,
			"group_name":   group.Name,
			"announcement": group.Announcement,
		}
		if len(history) > 0 {
			contextMap["history"] = history
		}
		contextJSON, _ := json.Marshal(contextMap)

		_, err = s.Queries.CreateGroupTask(ctx, db.CreateGroupTaskParams{
			AgentID:         agentID,
			RuntimeID:       agent.RuntimeID,
			Priority:        2,
			Context:         contextJSON,
			GroupID:         group.ID,
			GroupMessageID:  msg.ID,
			DelegationDepth: childDepth,
		})
		if err != nil {
			slog.Error("group task enqueue failed", "agent_id", util.UUIDToString(agentID), "error", err)
			continue
		}

		slog.Info("group task enqueued", "task_id", util.UUIDToString(agentID), "group_id", util.UUIDToString(group.ID), "agent_id", util.UUIDToString(agentID))
	}

	return nil
}

// historyEntry represents a recent group message for context injection.
type historyEntry struct {
	SenderName string `json:"sender_name"`
	SenderType string `json:"sender_type"`
	Content    string `json:"content"`
}

// buildGroupHistory fetches recent messages before the given timestamp and
// resolves sender names. Used to give agents conversational context.
func (s *TaskService) buildGroupHistory(ctx context.Context, groupID pgtype.UUID, before pgtype.Timestamptz, limit int32) ([]historyEntry, error) {
	msgs, err := s.Queries.ListGroupMessagesBefore(ctx, db.ListGroupMessagesBeforeParams{
		GroupID:   groupID,
		CreatedAt: before,
		Limit:     limit,
	})
	if err != nil {
		return nil, err
	}

	var history []historyEntry
	for _, m := range msgs {
		var senderName string
		if m.SenderType == "member" {
			if user, err := s.Queries.GetUser(ctx, m.SenderID); err == nil {
				senderName = user.Name
			}
		} else if m.SenderType == "agent" {
			if agent, err := s.Queries.GetAgent(ctx, m.SenderID); err == nil {
				senderName = agent.Name
			}
		}
		if senderName == "" {
			senderName = m.SenderType
		}
		history = append(history, historyEntry{
			SenderName: senderName,
			SenderType: m.SenderType,
			Content:    m.Content,
		})
	}

	return history, nil
}

// OnGroupTaskComplete handles completion of a group task by posting the result
// as a group_message and broadcasting status updates.
func (s *TaskService) OnGroupTaskComplete(ctx context.Context, task db.AgentTaskQueue, result []byte) {
	if !task.GroupID.Valid {
		return
	}

	var payload protocol.TaskCompletedPayload
	output := ""
	if err := json.Unmarshal(result, &payload); err == nil {
		output = payload.Output
	}
	if output == "" {
		return
	}

	// Get agent name
	agent, err := s.Queries.GetAgent(ctx, task.AgentID)
	if err != nil {
		return
	}

	// Get group for task context
	group, groupErr := s.Queries.GetGroup(ctx, task.GroupID)
	if groupErr != nil {
		slog.Error("failed to fetch group for task completion", "group_id", util.UUIDToString(task.GroupID), "error", groupErr)
	}

	content := redact.Text(output)

	// Parse @mentions from agent output, excluding self-mentions
	mentionTypes, mentionIDs := s.parseGroupMentions(ctx, task.GroupID, content, task.AgentID)

	// Create a group message with the agent's response
	msg, err := s.Queries.CreateGroupMessage(ctx, db.CreateGroupMessageParams{
		GroupID:      task.GroupID,
		SenderType:   "agent",
		SenderID:     task.AgentID,
		Content:      content,
		MentionsType: mentionTypes,
		MentionsID:   mentionIDs,
	})
	if err != nil {
		slog.Error("failed to create agent reply message", "task_id", util.UUIDToString(task.ID), "error", err)
		return
	}

	// Enqueue tasks for @mentioned agents. Delegation depth starts at 0 for
	// user-triggered tasks and increments with each agent→agent chain level.
	// Max depth is enforced inside EnqueueGroupTask.
	if groupErr == nil {
		if err := s.EnqueueGroupTask(ctx, group, msg, task.DelegationDepth); err != nil {
			slog.Error("failed to enqueue group tasks from agent reply", "error", err)
		}
	}

	// Resolve workspace for broadcasting
	workspaceID := s.resolveTaskWorkspaceID(ctx, task)
	if workspaceID == "" {
		return
	}

	mentionIDStrs := make([]string, len(mentionIDs))
	for i, id := range mentionIDs {
		mentionIDStrs[i] = util.UUIDToString(id)
	}

	// Broadcast agent message
	s.Bus.Publish(events.Event{
		Type:        protocol.EventGroupMessage,
		WorkspaceID: workspaceID,
		ActorType:   "agent",
		ActorID:     util.UUIDToString(task.AgentID),
		Payload: protocol.GroupMessagePayload{
			ID:           util.UUIDToString(msg.ID),
			GroupID:      util.UUIDToString(task.GroupID),
			SenderType:   "agent",
			SenderID:     util.UUIDToString(task.AgentID),
			SenderName:   agent.Name,
			Content:      content,
			MentionsType: mentionTypes,
			MentionsID:   mentionIDStrs,
			CreatedAt:    util.TimestampToString(msg.CreatedAt),
		},
	})

	// Broadcast task completed status
	s.broadcastGroupTaskStatus(ctx, task, content, "")
}

// CancelTasksForIssue cancels all active tasks for an issue.
func (s *TaskService) CancelTasksForIssue(ctx context.Context, issueID pgtype.UUID) error {
	return s.Queries.CancelAgentTasksByIssue(ctx, issueID)
}

// CancelTask cancels a single task by ID. It broadcasts a task:cancelled event
// so frontends can update immediately.
func (s *TaskService) CancelTask(ctx context.Context, taskID pgtype.UUID) (*db.AgentTaskQueue, error) {
	task, err := s.Queries.CancelAgentTask(ctx, taskID)
	if err != nil {
		return nil, fmt.Errorf("cancel task: %w", err)
	}

	slog.Info("task cancelled", "task_id", util.UUIDToString(task.ID), "issue_id", util.UUIDToString(task.IssueID))

	// Reconcile agent status
	s.ReconcileAgentStatus(ctx, task.AgentID)

	// Broadcast cancellation as a task:failed event so frontends clear the live card
	s.broadcastTaskEvent(ctx, protocol.EventTaskCancelled, task)

	return &task, nil
}

// ClaimTask atomically claims the next queued task for an agent,
// respecting max_concurrent_tasks.
func (s *TaskService) ClaimTask(ctx context.Context, agentID pgtype.UUID) (*db.AgentTaskQueue, error) {
	agent, err := s.Queries.GetAgent(ctx, agentID)
	if err != nil {
		return nil, fmt.Errorf("agent not found: %w", err)
	}

	running, err := s.Queries.CountRunningTasks(ctx, agentID)
	if err != nil {
		return nil, fmt.Errorf("count running tasks: %w", err)
	}
	if running >= int64(agent.MaxConcurrentTasks) {
		slog.Debug("task claim: no capacity", "agent_id", util.UUIDToString(agentID), "running", running, "max", agent.MaxConcurrentTasks)
		return nil, nil // No capacity
	}

	task, err := s.Queries.ClaimAgentTask(ctx, agentID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			slog.Debug("task claim: no tasks available", "agent_id", util.UUIDToString(agentID))
			return nil, nil // No tasks available
		}
		return nil, fmt.Errorf("claim task: %w", err)
	}

	slog.Info("task claimed", "task_id", util.UUIDToString(task.ID), "agent_id", util.UUIDToString(agentID))

	// Update agent status to working
	s.updateAgentStatus(ctx, agentID, "working")

	// Broadcast task:dispatch
	s.broadcastTaskDispatch(ctx, task)

	// Broadcast group:task-status for group tasks
	s.broadcastGroupTaskStatus(ctx, task, "", "")

	return &task, nil
}

// ClaimTaskForRuntime claims the next runnable task for a runtime while
// still respecting each agent's max_concurrent_tasks limit.
func (s *TaskService) ClaimTaskForRuntime(ctx context.Context, runtimeID pgtype.UUID) (*db.AgentTaskQueue, error) {
	tasks, err := s.Queries.ListPendingTasksByRuntime(ctx, runtimeID)
	if err != nil {
		return nil, fmt.Errorf("list pending tasks: %w", err)
	}

	triedAgents := map[string]struct{}{}
	for _, candidate := range tasks {
		agentKey := util.UUIDToString(candidate.AgentID)
		if _, seen := triedAgents[agentKey]; seen {
			continue
		}
		triedAgents[agentKey] = struct{}{}

		task, err := s.ClaimTask(ctx, candidate.AgentID)
		if err != nil {
			return nil, err
		}
		if task != nil && task.RuntimeID == runtimeID {
			return task, nil
		}
	}

	return nil, nil
}

// StartTask transitions a dispatched task to running.
// Issue status is NOT changed here — the agent manages it via the CLI.
func (s *TaskService) StartTask(ctx context.Context, taskID pgtype.UUID) (*db.AgentTaskQueue, error) {
	task, err := s.Queries.StartAgentTask(ctx, taskID)
	if err != nil {
		return nil, fmt.Errorf("start task: %w", err)
	}

	slog.Info("task started", "task_id", util.UUIDToString(task.ID), "issue_id", util.UUIDToString(task.IssueID))

	// Broadcast group:task-status for group tasks
	s.broadcastGroupTaskStatus(ctx, task, "", "")

	return &task, nil
}

// CompleteTask marks a task as completed.
// Issue status is NOT changed here — the agent manages it via the CLI.
func (s *TaskService) CompleteTask(ctx context.Context, taskID pgtype.UUID, result []byte, sessionID, workDir string) (*db.AgentTaskQueue, error) {
	task, err := s.Queries.CompleteAgentTask(ctx, db.CompleteAgentTaskParams{
		ID:        taskID,
		Result:    result,
		SessionID: pgtype.Text{String: sessionID, Valid: sessionID != ""},
		WorkDir:   pgtype.Text{String: workDir, Valid: workDir != ""},
	})
	if err != nil {
		// Log the current task state to help debug why the update matched no rows.
		if existing, lookupErr := s.Queries.GetAgentTask(ctx, taskID); lookupErr == nil {
			slog.Warn("complete task failed: task not in running state",
				"task_id", util.UUIDToString(taskID),
				"current_status", existing.Status,
				"issue_id", util.UUIDToString(existing.IssueID),
				"agent_id", util.UUIDToString(existing.AgentID),
			)
		} else {
			slog.Warn("complete task failed: task not found",
				"task_id", util.UUIDToString(taskID),
				"lookup_error", lookupErr,
			)
		}
		return nil, fmt.Errorf("complete task: %w", err)
	}

	slog.Info("task completed", "task_id", util.UUIDToString(task.ID), "issue_id", util.UUIDToString(task.IssueID))

	// Post agent output as a comment.
	// For assignment-triggered tasks: create comment if agent didn't post one via CLI.
	// For Comment Reply tasks: create top-level comment as fallback if agent didn't reply via CLI.
	if task.IssueID.Valid {
		agentCommented, _ := s.Queries.HasAgentCommentedSince(ctx, db.HasAgentCommentedSinceParams{
			IssueID:  task.IssueID,
			AuthorID: task.AgentID,
			Since:    task.StartedAt,
		})
		if !agentCommented {
			var payload protocol.TaskCompletedPayload
			if err := json.Unmarshal(result, &payload); err == nil {
				if payload.Output != "" {
					s.createAgentComment(ctx, task.IssueID, task.AgentID, redact.Text(payload.Output), "comment", task.TriggerCommentID)
				}
			}
		}
	}

	// For chat tasks, save assistant reply, update session, and broadcast chat:done.
	if task.ChatSessionID.Valid {
		var payload protocol.TaskCompletedPayload
		if err := json.Unmarshal(result, &payload); err == nil && payload.Output != "" {
			if _, err := s.Queries.CreateChatMessage(ctx, db.CreateChatMessageParams{
				ChatSessionID: task.ChatSessionID,
				Role:          "assistant",
				Content:       redact.Text(payload.Output),
				TaskID:        task.ID,
			}); err != nil {
				slog.Error("failed to save assistant chat message", "task_id", util.UUIDToString(task.ID), "error", err)
			}
		}
		s.Queries.UpdateChatSessionSession(ctx, db.UpdateChatSessionSessionParams{
			ID:        task.ChatSessionID,
			SessionID: pgtype.Text{String: sessionID, Valid: sessionID != ""},
			WorkDir:   pgtype.Text{String: workDir, Valid: workDir != ""},
		})
		s.broadcastChatDone(ctx, task)
	}

	// For group tasks, post result as agent message and broadcast status.
	if task.GroupID.Valid {
		s.OnGroupTaskComplete(ctx, task, result)
	}

	// Reconcile agent status
	s.ReconcileAgentStatus(ctx, task.AgentID)

	// Broadcast
	s.broadcastTaskEvent(ctx, protocol.EventTaskCompleted, task)

	return &task, nil
}

// FailTask marks a task as failed.
// Issue status is NOT changed here — the agent manages it via the CLI.
func (s *TaskService) FailTask(ctx context.Context, taskID pgtype.UUID, errMsg string) (*db.AgentTaskQueue, error) {
	task, err := s.Queries.FailAgentTask(ctx, db.FailAgentTaskParams{
		ID:    taskID,
		Error: pgtype.Text{String: errMsg, Valid: true},
	})
	if err != nil {
		if existing, lookupErr := s.Queries.GetAgentTask(ctx, taskID); lookupErr == nil {
			slog.Warn("fail task failed: task not in dispatched/running state",
				"task_id", util.UUIDToString(taskID),
				"current_status", existing.Status,
				"issue_id", util.UUIDToString(existing.IssueID),
				"agent_id", util.UUIDToString(existing.AgentID),
			)
		} else {
			slog.Warn("fail task failed: task not found",
				"task_id", util.UUIDToString(taskID),
				"lookup_error", lookupErr,
			)
		}
		return nil, fmt.Errorf("fail task: %w", err)
	}

	slog.Warn("task failed", "task_id", util.UUIDToString(task.ID), "issue_id", util.UUIDToString(task.IssueID), "error", errMsg)

	if errMsg != "" && task.IssueID.Valid {
		s.createAgentComment(ctx, task.IssueID, task.AgentID, redact.Text(errMsg), "system", task.TriggerCommentID)
	}

	// Broadcast group:task-status for group tasks
	s.broadcastGroupTaskStatus(ctx, task, "", errMsg)

	// Reconcile agent status
	s.ReconcileAgentStatus(ctx, task.AgentID)

	// Broadcast
	s.broadcastTaskEvent(ctx, protocol.EventTaskFailed, task)

	return &task, nil
}

// ReportProgress broadcasts a progress update via the event bus.
func (s *TaskService) ReportProgress(ctx context.Context, taskID string, workspaceID string, summary string, step, total int) {
	s.Bus.Publish(events.Event{
		Type:        protocol.EventTaskProgress,
		WorkspaceID: workspaceID,
		ActorType:   "system",
		ActorID:     "",
		Payload: protocol.TaskProgressPayload{
			TaskID:  taskID,
			Summary: summary,
			Step:    step,
			Total:   total,
		},
	})
}

// ReconcileAgentStatus checks running task count and sets agent status accordingly.
func (s *TaskService) ReconcileAgentStatus(ctx context.Context, agentID pgtype.UUID) {
	running, err := s.Queries.CountRunningTasks(ctx, agentID)
	if err != nil {
		return
	}
	newStatus := "idle"
	if running > 0 {
		newStatus = "working"
	}
	slog.Debug("agent status reconciled", "agent_id", util.UUIDToString(agentID), "status", newStatus, "running_tasks", running)
	s.updateAgentStatus(ctx, agentID, newStatus)
}

func (s *TaskService) updateAgentStatus(ctx context.Context, agentID pgtype.UUID, status string) {
	agent, err := s.Queries.UpdateAgentStatus(ctx, db.UpdateAgentStatusParams{
		ID:     agentID,
		Status: status,
	})
	if err != nil {
		return
	}
	s.Bus.Publish(events.Event{
		Type:        protocol.EventAgentStatus,
		WorkspaceID: util.UUIDToString(agent.WorkspaceID),
		ActorType:   "system",
		ActorID:     "",
		Payload:     map[string]any{"agent": agentToMap(agent)},
	})
}

// LoadAgentSkills loads an agent's skills with their files for task execution.
func (s *TaskService) LoadAgentSkills(ctx context.Context, agentID pgtype.UUID) []AgentSkillData {
	skills, err := s.Queries.ListAgentSkills(ctx, agentID)
	if err != nil || len(skills) == 0 {
		return nil
	}

	result := make([]AgentSkillData, 0, len(skills))
	for _, sk := range skills {
		data := AgentSkillData{Name: sk.Name, Content: sk.Content}
		files, _ := s.Queries.ListSkillFiles(ctx, sk.ID)
		for _, f := range files {
			data.Files = append(data.Files, AgentSkillFileData{Path: f.Path, Content: f.Content})
		}
		result = append(result, data)
	}
	return result
}

// AgentSkillData represents a skill for task execution responses.
type AgentSkillData struct {
	Name    string               `json:"name"`
	Content string               `json:"content"`
	Files   []AgentSkillFileData `json:"files,omitempty"`
}

// AgentSkillFileData represents a supporting file within a skill.
type AgentSkillFileData struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

func priorityToInt(p string) int32 {
	switch p {
	case "urgent":
		return 4
	case "high":
		return 3
	case "medium":
		return 2
	case "low":
		return 1
	default:
		return 0
	}
}

func (s *TaskService) broadcastTaskDispatch(ctx context.Context, task db.AgentTaskQueue) {
	var payload map[string]any
	if task.Context != nil {
		json.Unmarshal(task.Context, &payload)
	}
	if payload == nil {
		payload = map[string]any{}
	}
	payload["task_id"] = util.UUIDToString(task.ID)
	payload["runtime_id"] = util.UUIDToString(task.RuntimeID)

	workspaceID := s.resolveTaskWorkspaceID(ctx, task)
	if workspaceID == "" {
		return
	}
	s.Bus.Publish(events.Event{
		Type:        protocol.EventTaskDispatch,
		WorkspaceID: workspaceID,
		ActorType:   "system",
		ActorID:     "",
		Payload:     payload,
	})
}

func (s *TaskService) broadcastGroupTaskStatus(ctx context.Context, task db.AgentTaskQueue, content, errorMsg string) {
	if !task.GroupID.Valid {
		return
	}
	workspaceID := s.resolveTaskWorkspaceID(ctx, task)
	if workspaceID == "" {
		return
	}
	agentName := ""
	if agent, err := s.Queries.GetAgent(ctx, task.AgentID); err == nil {
		agentName = agent.Name
	}
	s.Bus.Publish(events.Event{
		Type:        protocol.EventGroupTaskStatus,
		WorkspaceID: workspaceID,
		ActorType:   "system",
		ActorID:     "",
		Payload: protocol.GroupTaskStatusPayload{
			TaskID:    util.UUIDToString(task.ID),
			GroupID:   util.UUIDToString(task.GroupID),
			MessageID: util.UUIDToString(task.GroupMessageID),
			AgentID:   util.UUIDToString(task.AgentID),
			AgentName: agentName,
			Content:   content,
			Status:    task.Status,
			Error:     errorMsg,
		},
	})
}

func (s *TaskService) broadcastTaskEvent(ctx context.Context, eventType string, task db.AgentTaskQueue) {
	workspaceID := s.resolveTaskWorkspaceID(ctx, task)
	if workspaceID == "" {
		return
	}
	payload := map[string]any{
		"task_id":  util.UUIDToString(task.ID),
		"agent_id": util.UUIDToString(task.AgentID),
		"issue_id": util.UUIDToString(task.IssueID),
		"status":   task.Status,
	}
	if task.ChatSessionID.Valid {
		payload["chat_session_id"] = util.UUIDToString(task.ChatSessionID)
	}
	if task.GroupID.Valid {
		payload["group_id"] = util.UUIDToString(task.GroupID)
	}
	if task.GroupMessageID.Valid {
		payload["group_message_id"] = util.UUIDToString(task.GroupMessageID)
	}
	s.Bus.Publish(events.Event{
		Type:        eventType,
		WorkspaceID: workspaceID,
		ActorType:   "system",
		ActorID:     "",
		Payload:     payload,
	})
}

// resolveTaskWorkspaceID determines the workspace ID for a task.
// For issue tasks, it comes from the issue. For chat tasks, from the chat session.
// For group tasks, from the group.
func (s *TaskService) resolveTaskWorkspaceID(ctx context.Context, task db.AgentTaskQueue) string {
	if task.IssueID.Valid {
		if issue, err := s.Queries.GetIssue(ctx, task.IssueID); err == nil {
			return util.UUIDToString(issue.WorkspaceID)
		}
	}
	if task.ChatSessionID.Valid {
		if cs, err := s.Queries.GetChatSession(ctx, task.ChatSessionID); err == nil {
			return util.UUIDToString(cs.WorkspaceID)
		}
	}
	if task.GroupID.Valid {
		if g, err := s.Queries.GetGroup(ctx, task.GroupID); err == nil {
			return util.UUIDToString(g.WorkspaceID)
		}
	}
	return ""
}

func (s *TaskService) broadcastChatDone(ctx context.Context, task db.AgentTaskQueue) {
	workspaceID := s.resolveTaskWorkspaceID(ctx, task)
	if workspaceID == "" {
		return
	}
	s.Bus.Publish(events.Event{
		Type:        protocol.EventChatDone,
		WorkspaceID: workspaceID,
		ActorType:   "system",
		ActorID:     "",
		Payload: protocol.ChatDonePayload{
			ChatSessionID: util.UUIDToString(task.ChatSessionID),
			TaskID:        util.UUIDToString(task.ID),
		},
	})
}

func (s *TaskService) broadcastIssueUpdated(issue db.Issue) {
	prefix := s.getIssuePrefix(issue.WorkspaceID)
	s.Bus.Publish(events.Event{
		Type:        protocol.EventIssueUpdated,
		WorkspaceID: util.UUIDToString(issue.WorkspaceID),
		ActorType:   "system",
		ActorID:     "",
		Payload:     map[string]any{"issue": issueToMap(issue, prefix)},
	})
}

func (s *TaskService) getIssuePrefix(workspaceID pgtype.UUID) string {
	ws, err := s.Queries.GetWorkspace(context.Background(), workspaceID)
	if err != nil {
		return ""
	}
	return ws.IssuePrefix
}

func (s *TaskService) createAgentComment(ctx context.Context, issueID, agentID pgtype.UUID, content, commentType string, parentID pgtype.UUID) {
	if content == "" {
		return
	}
	// Look up issue to get workspace ID for mention expansion and broadcasting.
	issue, err := s.Queries.GetIssue(ctx, issueID)
	if err != nil {
		return
	}
	// Expand bare issue identifiers (e.g. MUL-117) into mention links.
	content = mention.ExpandIssueIdentifiers(ctx, s.Queries, issue.WorkspaceID, content)
	comment, err := s.Queries.CreateComment(ctx, db.CreateCommentParams{
		IssueID:     issueID,
		WorkspaceID: issue.WorkspaceID,
		AuthorType:  "agent",
		AuthorID:    agentID,
		Content:     content,
		Type:        commentType,
		ParentID:    parentID,
	})
	if err != nil {
		return
	}
	s.Bus.Publish(events.Event{
		Type:        protocol.EventCommentCreated,
		WorkspaceID: util.UUIDToString(issue.WorkspaceID),
		ActorType:   "agent",
		ActorID:     util.UUIDToString(agentID),
		Payload: map[string]any{
			"comment": map[string]any{
				"id":          util.UUIDToString(comment.ID),
				"issue_id":    util.UUIDToString(comment.IssueID),
				"author_type": comment.AuthorType,
				"author_id":   util.UUIDToString(comment.AuthorID),
				"content":     comment.Content,
				"type":        comment.Type,
				"parent_id":   util.UUIDToPtr(comment.ParentID),
				"created_at":  comment.CreatedAt.Time.Format("2006-01-02T15:04:05Z"),
			},
			"issue_title":  issue.Title,
			"issue_status": issue.Status,
		},
	})
}

func issueToMap(issue db.Issue, issuePrefix string) map[string]any {
	return map[string]any{
		"id":              util.UUIDToString(issue.ID),
		"workspace_id":    util.UUIDToString(issue.WorkspaceID),
		"number":          issue.Number,
		"identifier":      issuePrefix + "-" + strconv.Itoa(int(issue.Number)),
		"title":           issue.Title,
		"description":     util.TextToPtr(issue.Description),
		"status":          issue.Status,
		"priority":        issue.Priority,
		"assignee_type":   util.TextToPtr(issue.AssigneeType),
		"assignee_id":     util.UUIDToPtr(issue.AssigneeID),
		"creator_type":    issue.CreatorType,
		"creator_id":      util.UUIDToString(issue.CreatorID),
		"parent_issue_id": util.UUIDToPtr(issue.ParentIssueID),
		"position":        issue.Position,
		"due_date":        util.TimestampToPtr(issue.DueDate),
		"created_at":      util.TimestampToString(issue.CreatedAt),
		"updated_at":      util.TimestampToString(issue.UpdatedAt),
	}
}

// agentToMap builds a simple map for broadcasting agent status updates.
func agentToMap(a db.Agent) map[string]any {
	var rc any
	if a.RuntimeConfig != nil {
		json.Unmarshal(a.RuntimeConfig, &rc)
	}
	return map[string]any{
		"id":                   util.UUIDToString(a.ID),
		"workspace_id":         util.UUIDToString(a.WorkspaceID),
		"runtime_id":           util.UUIDToString(a.RuntimeID),
		"name":                 a.Name,
		"description":          a.Description,
		"avatar_url":           util.TextToPtr(a.AvatarUrl),
		"runtime_mode":         a.RuntimeMode,
		"runtime_config":       rc,
		"visibility":           a.Visibility,
		"status":               a.Status,
		"max_concurrent_tasks": a.MaxConcurrentTasks,
		"owner_id":             util.UUIDToPtr(a.OwnerID),
		"skills":               []any{},
		"created_at":           util.TimestampToString(a.CreatedAt),
		"updated_at":           util.TimestampToString(a.UpdatedAt),
		"archived_at":          util.TimestampToPtr(a.ArchivedAt),
		"archived_by":          util.UUIDToPtr(a.ArchivedBy),
	}
}

// parseGroupMentions extracts @mentions from content, excluding self-mentions
// by the given agentID. Returns parallel slices suitable for CreateGroupMessage.
// Uses regex matching so mentions wrapped in markdown (e.g. **@Agent**, _@Agent_)
// are still found. Skips mentions that are just thank-you/acknowledgment (e.g. "感谢 @Agent")
// rather than task requests.
func (s *TaskService) parseGroupMentions(ctx context.Context, groupID pgtype.UUID, content string, agentID pgtype.UUID) ([]string, []pgtype.UUID) {
	members, err := s.Queries.ListGroupMembers(ctx, groupID)
	if err != nil {
		return []string{}, []pgtype.UUID{}
	}

	rawMatches := mentionRe.FindAllStringSubmatchIndex(content, -1)
	if len(rawMatches) == 0 {
		return []string{}, []pgtype.UUID{}
	}

	// Filter: remove non-task @mentions BEFORE dedup, so a legitimate @mention
	// later in the message (e.g. "收到 @Agent ... 请 @Agent 修改") isn't lost.
	seenWords := make(map[string]bool)
	type indexedMention struct {
		word  string
		start int
	}
	var mentions []indexedMention
	for _, m := range rawMatches {
		if isThankYouContext(content, m[0]) {
			continue
		}
		word := strings.ToLower(content[m[0]:m[1]])
		if seenWords[word] {
			continue
		}
		seenWords[word] = true
		mentions = append(mentions, indexedMention{word: word, start: m[0]})
	}

	// Check for special mentions
	for _, m := range mentions {
		if m.word == "@all" || m.word == "@everyone" {
			types := make([]string, 0, len(members))
			ids := make([]pgtype.UUID, 0, len(members))
			for _, mb := range members {
				types = append(types, "member")
				ids = append(ids, mb.MemberID)
			}
			return types, ids
		}
		if m.word == "@allagents" {
			types := make([]string, 0, len(members))
			ids := make([]pgtype.UUID, 0, len(members))
			for _, mb := range members {
				if mb.MemberType == "agent" && util.UUIDToString(mb.MemberID) != util.UUIDToString(agentID) {
					types = append(types, "agent")
					ids = append(ids, mb.MemberID)
				}
			}
			return types, ids
		}
	}

	type entry struct {
		memberType string
		memberID   pgtype.UUID
		lowerName  string
	}
	var memberList []entry
	for _, m := range members {
		var name string
		if m.MemberType == "member" {
			if user, err := s.Queries.GetUser(ctx, m.MemberID); err == nil {
				name = user.Name
			}
		} else {
			if agent, err := s.Queries.GetAgent(ctx, m.MemberID); err == nil {
				name = agent.Name
			}
		}
		memberList = append(memberList, entry{
			memberType: m.MemberType,
			memberID:   m.MemberID,
			lowerName:  strings.ToLower(name),
		})
	}

	seen := make(map[string]bool)
	types := make([]string, 0)
	ids := make([]pgtype.UUID, 0)
	for _, m := range mentions {
		name := strings.TrimPrefix(m.word, "@")
		for _, e := range memberList {
			if e.lowerName != name {
				continue
			}
			if e.memberType == "agent" && util.UUIDToString(e.memberID) == util.UUIDToString(agentID) {
				continue
			}
			key := e.memberType + ":" + util.UUIDToString(e.memberID)
			if seen[key] {
				continue
			}
			seen[key] = true
			types = append(types, e.memberType)
			ids = append(ids, e.memberID)
			break
		}
	}
	return types, ids
}

// isThankYouContext checks whether the text before an @mention position
// indicates acknowledgment/agreement rather than a task request.
// e.g. "感谢 @Agent", "收到 @Agent 的回复", "同意 @Agent" should NOT create tasks.
var nonTaskKeywords = []string{
	// Thanks / acknowledgment
	"感谢", "谢谢", "辛苦了", "多谢", "好评",
	"收到", "收到了", "确认收到",
	"同意", "认可", "赞同",
	"不错的", "很好", "正确", "完成了",
	// Future delegation: "收到答复后我来 @Agent"
	"答复后", "回复后再",
}

func isThankYouContext(content string, mentionStart int) bool {
	start := mentionStart - 30
	if start < 0 {
		start = 0
	}
	before := strings.TrimSpace(content[start:mentionStart])
	for _, kw := range nonTaskKeywords {
		if strings.Contains(before, kw) {
			return true
		}
	}
	return false
}
