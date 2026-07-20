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
	if task.GroupContext != nil {
		return buildGroupPrompt(task)
	}
	var b strings.Builder
	b.WriteString("You are running as a local coding agent for a Multica workspace.\n\n")
	fmt.Fprintf(&b, "Your assigned issue ID is: %s\n\n", task.IssueID)
	if task.TriggerCommentID != "" {
		b.WriteString("**CRITICAL: This task is a REPLY to a follow-up comment.**\n\n")
		fmt.Fprintf(&b, "You MUST answer the triggering comment (ID: %s), NOT repeat your self-introduction.\n\n", task.TriggerCommentID)
		fmt.Fprintf(&b, "Step 1: Run `multica issue comment get %s --output json` to read the exact question asked.\n\n", task.TriggerCommentID)
		fmt.Fprintf(&b, "Step 2: Run `multica issue comment list %s --limit 5 --output json` to see recent conversation.\n\n", task.IssueID)
		fmt.Fprint(&b, "Step 3: Answer the triggering comment directly.\n\n")
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

// buildGroupPrompt constructs a prompt for group chat tasks.
func buildGroupPrompt(task Task) string {
	var b strings.Builder
	b.WriteString("You are a member of a Multica group chat and have been mentioned.\n\n")
	fmt.Fprintf(&b, "Group: %s\n\n", task.GroupContext.GroupName)
	if task.GroupContext.Announcement != "" {
		fmt.Fprintf(&b, "Group announcement: %s\n\n", task.GroupContext.Announcement)
	}

	// List members first so the agent knows who is available.
	if len(task.GroupContext.Members) > 0 {
		b.WriteString("--- Group members (the ONLY people you can @mention) ---\n")
		for _, m := range task.GroupContext.Members {
			label := "human"
			if m.Type == "agent" {
				label = "agent"
			}
			fmt.Fprintf(&b, "@%s (%s)", m.Name, label)
			if m.Instructions != "" {
				fmt.Fprintf(&b, " — %s", m.Instructions)
			}
			b.WriteString("\n")
		}
		b.WriteString("\n")
	}

	// Show recent conversation history so the agent understands the flow.
	if len(task.GroupContext.History) > 0 {
		b.WriteString("--- Recent conversation (oldest → newest) ---\n")
		for i := len(task.GroupContext.History) - 1; i >= 0; i-- {
			h := task.GroupContext.History[i]
			fmt.Fprintf(&b, "[%s] %s: %s\n", h.SenderType, h.SenderName, h.Content)
		}
		b.WriteString("\n")
	}

	fmt.Fprintf(&b, "--- YOUR TASK (message that mentioned you) ---\n%s\n\n", task.GroupContext.Content)

	b.WriteString("--- HARD RULE: When to @mention ---\n\n")
	b.WriteString("@ creates a new task IMMEDIATELY. Use @ ONLY when you are handing off finished work.\n")
	b.WriteString("If your reply asks questions or waits for the user → NO @mentions at all.\n")
	b.WriteString("If your reply delivers a result → @mention the NEXT person.\n\n")
	b.WriteString("Do NOT write plans like \"之后 @Agent X 做 Y\". The @ fires NOW, creating an empty task.\n")
	b.WriteString("Right: Reply 1 = ask. Reply 2 (after answer) = \"@Agent 审核\".\n\n")

	b.WriteString("--- Workflow ---\n\n")
	b.WriteString("1. If the task is unclear: ask ALL questions at once. Do NOT @mention anyone in that reply.\n")
	b.WriteString("2. After user answers: do your work. If it needs human confirmation, @mention them and WAIT.\n")
	b.WriteString("3. When your deliverable is ready: @mention the NEXT agent who should work on it.\n")
	b.WriteString("4. Names: always use EXACT full names from the member list. NEVER say \"其他Agent/运营同学\".\n")
	b.WriteString("5. Do NOT loop. Clear plan → produce it. Max 3 rounds of back-and-forth total, then stop.\n\n")

	b.WriteString("Respond naturally.\n")
	return b.String()
}
