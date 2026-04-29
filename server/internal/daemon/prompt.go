package daemon

import (
	"fmt"
	"strings"
)

// BuildPrompt constructs the task prompt for an agent CLI.
// Keep this minimal — detailed instructions live in CLAUDE.md / AGENTS.md
// injected by execenv.InjectRuntimeConfig.
func BuildPrompt(task Task) string {
	if task.ChatSessionID != "" {
		return buildChatPrompt(task)
	}
	var b strings.Builder
	b.WriteString("You are running as a local coding agent for a Multica workspace.\n\n")
	fmt.Fprintf(&b, "Your assigned issue ID is: %s\n\n", task.IssueID)
	if task.TriggerCommentID != "" {
		b.WriteString("**CRITICAL: This task is a REPLY to a follow-up comment.**\n\n")
		fmt.Fprintf(&b, "You MUST answer the triggering comment (ID: %s), NOT repeat your self-introduction.\n\n", task.TriggerCommentID)
		fmt.Fprintf(&b, "Step 1: Run `multica issue comment get %s --output json` to read the exact question asked.\n\n", task.TriggerCommentID)
		fmt.Fprintf(&b, "Step 2: Run `multica issue comment list %s --limit 5 --output json` to see recent conversation.\n\n", task.IssueID)
		fmt.Fprintf(&b, "Step 3: Answer the triggering comment directly.\n\n", task.TriggerCommentID)
		fmt.Fprintf(&b, "Step 4: Post your answer with: `multica issue comment add %s --parent %s --content \"你的回答\"`\n\n", task.IssueID, task.TriggerCommentID)
		b.WriteString("Do NOT give a self-introduction. Do NOT talk about your capabilities. Answer the question directly.\n\n")
	}
	fmt.Fprintf(&b, "Start by running `multica issue get %s --output json` to understand your task.\n", task.IssueID)
	return b.String()
}

// buildChatPrompt constructs a prompt for interactive chat tasks.
func buildChatPrompt(task Task) string {
	var b strings.Builder
	b.WriteString("You are running as a chat assistant for a Multica workspace.\n")
	b.WriteString("A user is chatting with you directly. Respond to their message.\n\n")
	fmt.Fprintf(&b, "User message:\n%s\n", task.ChatMessage)
	return b.String()
}
