"use client";

import { STATUS_CONFIG, PRIORITY_CONFIG } from "@multica/core/issues/config";
import { useActorName } from "@multica/core/workspace/hooks";
import { StatusIcon, PriorityIcon } from "../../issues/components";
import type { InboxItem, InboxItemType, IssueStatus, IssuePriority } from "@multica/core/types";

type TranslateFn = (key: string, fallback: string) => string;

const typeLabelsFallbacks: Record<InboxItemType, string> = {
  issue_assigned: "Assigned",
  unassigned: "Unassigned",
  assignee_changed: "Assignee changed",
  status_changed: "Status changed",
  priority_changed: "Priority changed",
  due_date_changed: "Due date changed",
  new_comment: "New comment",
  mentioned: "Mentioned",
  review_requested: "Review requested",
  task_completed: "Task completed",
  task_failed: "Task failed",
  agent_blocked: "Agent blocked",
  agent_completed: "Agent completed",
  reaction_added: "Reacted",
};

export { typeLabelsFallbacks };

function shortDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function getInboxDetailLabel(item: InboxItem, t?: TranslateFn): React.ReactNode {
  const { getActorName } = useActorName();
  const details = item.details ?? {};
  const defaultT = (key: string, fallback: string) => fallback;
  const translate = t || defaultT;

  switch (item.type) {
    case "status_changed": {
      if (!details.to) return <span>{translate(`inbox.types.${item.type}`, typeLabelsFallbacks[item.type])}</span>;
      const label = STATUS_CONFIG[details.to as IssueStatus]?.label ?? details.to;
      return (
        <span className="inline-flex items-center gap-1">
          {translate('inbox.detailLabels.setStatusTo', 'Set status to')}
          <StatusIcon status={details.to as IssueStatus} className="h-3 w-3" />
          {label}
        </span>
      );
    }
    case "priority_changed": {
      if (!details.to) return <span>{translate(`inbox.types.${item.type}`, typeLabelsFallbacks[item.type])}</span>;
      const label = PRIORITY_CONFIG[details.to as IssuePriority]?.label ?? details.to;
      return (
        <span className="inline-flex items-center gap-1">
          {translate('inbox.detailLabels.setPriorityTo', 'Set priority to')}
          <PriorityIcon priority={details.to as IssuePriority} className="h-3 w-3" />
          {label}
        </span>
      );
    }
    case "issue_assigned": {
      if (details.new_assignee_id) {
        return <span>{translate('inbox.detailLabels.assignedTo', 'Assigned to')} {getActorName(details.new_assignee_type ?? "member", details.new_assignee_id)}</span>;
      }
      return <span>{translate(`inbox.types.${item.type}`, typeLabelsFallbacks[item.type])}</span>;
    }
    case "unassigned":
      return <span>{translate('inbox.detailLabels.removedAssignee', 'Removed assignee')}</span>;
    case "assignee_changed": {
      if (details.new_assignee_id) {
        return <span>{translate('inbox.detailLabels.assignedTo', 'Assigned to')} {getActorName(details.new_assignee_type ?? "member", details.new_assignee_id)}</span>;
      }
      return <span>{translate(`inbox.types.${item.type}`, typeLabelsFallbacks[item.type])}</span>;
    }
    case "due_date_changed": {
      if (details.to) return <span>{translate('inbox.detailLabels.setDueDateTo', 'Set due date to')} {shortDate(details.to)}</span>;
      return <span>{translate('inbox.detailLabels.removedDueDate', 'Removed due date')}</span>;
    }
    case "new_comment": {
      if (item.body) return <span>{item.body}</span>;
      return <span>{translate(`inbox.types.${item.type}`, typeLabelsFallbacks[item.type])}</span>;
    }
    case "reaction_added": {
      const emoji = details.emoji;
      if (emoji) return <span>{translate('inbox.detailLabels.reactedTo', 'Reacted {emoji} to your comment').replace('{emoji}', emoji)}</span>;
      return <span>{translate(`inbox.types.${item.type}`, typeLabelsFallbacks[item.type])}</span>;
    }
    default:
      return <span>{translate(`inbox.types.${item.type}`, typeLabelsFallbacks[item.type] ?? item.type)}</span>;
  }
}
