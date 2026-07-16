package protocol

import "encoding/json"

// Message is the envelope for all WebSocket messages.
type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// TaskDispatchPayload is sent from server to daemon when a task is assigned.
type TaskDispatchPayload struct {
	TaskID      string `json:"task_id"`
	IssueID     string `json:"issue_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

// TaskProgressPayload is sent from daemon to server during task execution.
type TaskProgressPayload struct {
	TaskID  string `json:"task_id"`
	Summary string `json:"summary"`
	Step    int    `json:"step,omitempty"`
	Total   int    `json:"total,omitempty"`
}

// TaskCompletedPayload is sent from daemon to server when a task finishes.
type TaskCompletedPayload struct {
	TaskID string `json:"task_id"`
	PRURL  string `json:"pr_url,omitempty"`
	Output string `json:"output,omitempty"`
}

// TaskMessagePayload represents a single agent execution message (tool call, text, etc.)
type TaskMessagePayload struct {
	TaskID  string         `json:"task_id"`
	IssueID string         `json:"issue_id,omitempty"`
	Seq     int            `json:"seq"`
	Type    string         `json:"type"`              // "text", "tool_use", "tool_result", "error"
	Tool    string         `json:"tool,omitempty"`    // tool name for tool_use/tool_result
	Content string         `json:"content,omitempty"` // text content
	Input   map[string]any `json:"input,omitempty"`   // tool input (tool_use only)
	Output  string         `json:"output,omitempty"`  // tool output (tool_result only)
}

// DaemonRegisterPayload is sent from daemon to server on connection.
type DaemonRegisterPayload struct {
	DaemonID string        `json:"daemon_id"`
	AgentID  string        `json:"agent_id"`
	Runtimes []RuntimeInfo `json:"runtimes"`
}

// RuntimeInfo describes an available agent runtime on the daemon's machine.
type RuntimeInfo struct {
	Type    string `json:"type"`
	Version string `json:"version"`
	Status  string `json:"status"`
}

// ChatMessagePayload is broadcast when a new chat message is created.
type ChatMessagePayload struct {
	ChatSessionID string `json:"chat_session_id"`
	MessageID     string `json:"message_id"`
	Role          string `json:"role"`
	Content       string `json:"content"`
	TaskID        string `json:"task_id,omitempty"`
	CreatedAt     string `json:"created_at"`
}

// ChatDonePayload is broadcast when an agent finishes responding to a chat message.
type ChatDonePayload struct {
	ChatSessionID string `json:"chat_session_id"`
	TaskID        string `json:"task_id"`
	Content       string `json:"content"`
}

// HeartbeatPayload is sent periodically from daemon to server.
type HeartbeatPayload struct {
	DaemonID     string `json:"daemon_id"`
	AgentID      string `json:"agent_id"`
	CurrentTasks int    `json:"current_tasks"`
}

// GroupMessagePayload is broadcast when a new group message is created.
type GroupMessagePayload struct {
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

// GroupMessageAckPayload is sent to the sender after message persistence.
type GroupMessageAckPayload struct {
	ID      string `json:"id"`
	GroupID string `json:"group_id"`
	TempID  string `json:"temp_id"`
}

// GroupMessageErrorPayload is sent to the sender on message persistence failure.
type GroupMessageErrorPayload struct {
	TempID string `json:"temp_id"`
	Error  string `json:"error"`
}

// GroupTaskStatusPayload is broadcast when a group task changes state.
type GroupTaskStatusPayload struct {
	TaskID    string `json:"task_id"`
	GroupID   string `json:"group_id"`
	MessageID string `json:"message_id"`
	AgentID   string `json:"agent_id"`
	AgentName string `json:"agent_name"`
	Content   string `json:"content"`
	Status    string `json:"status"`
	Error     string `json:"error,omitempty"`
}

// GroupMemberJoinedPayload is broadcast when a member joins a group.
type GroupMemberJoinedPayload struct {
	GroupID    string `json:"group_id"`
	MemberType string `json:"member_type"`
	MemberID   string `json:"member_id"`
	MemberName string `json:"member_name"`
	Role       string `json:"role"`
}

// GroupMemberLeftPayload is broadcast when a member leaves a group.
type GroupMemberLeftPayload struct {
	GroupID  string `json:"group_id"`
	MemberID string `json:"member_id"`
}

// GroupDissolvedPayload is broadcast when a group is dissolved.
type GroupDissolvedPayload struct {
	GroupID string `json:"group_id"`
}

// GroupMessageRequest is the inbound WS message for sending a group message.
type GroupMessageRequest struct {
	GroupID string `json:"group_id"`
	Content string `json:"content"`
	TempID  string `json:"temp_id"`
}
