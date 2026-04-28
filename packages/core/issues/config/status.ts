import type { IssueStatus } from "../../types";

export const STATUS_ORDER: IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "blocked",
  "cancelled",
];

export const ALL_STATUSES: IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "blocked",
  "cancelled",
];

/** Statuses shown as board columns (excludes cancelled). */
export const BOARD_STATUSES: IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "blocked",
];

export const STATUS_CONFIG: Record<
  IssueStatus,
  {
    label: string;
    iconColor: string;
    hoverBg: string;
    dividerColor: string;
    badgeBg: string;
    badgeText: string;
    columnBg: string;
    accentBg: string;
    glowBg: string;
  }
> = {
  backlog: {
    label: "Backlog",
    iconColor: "text-slate-400 dark:text-slate-500",
    hoverBg: "hover:bg-slate-100 dark:hover:bg-slate-800",
    dividerColor: "bg-slate-300 dark:bg-slate-600",
    badgeBg: "bg-slate-100 dark:bg-slate-800",
    badgeText: "text-slate-600 dark:text-slate-300",
    columnBg: "bg-slate-50/80 dark:bg-slate-900/60",
    accentBg: "border-slate-200 dark:border-slate-700",
    glowBg: "shadow-slate-200/30 dark:shadow-slate-800/30"
  },
  todo: {
    label: "Todo",
    iconColor: "text-slate-500 dark:text-slate-400",
    hoverBg: "hover:bg-slate-100 dark:hover:bg-slate-800",
    dividerColor: "bg-slate-400 dark:bg-slate-500",
    badgeBg: "bg-slate-100 dark:bg-slate-800",
    badgeText: "text-slate-600 dark:text-slate-300",
    columnBg: "bg-slate-50/80 dark:bg-slate-900/60",
    accentBg: "border-slate-200 dark:border-slate-700",
    glowBg: "shadow-slate-200/30 dark:shadow-slate-800/30"
  },
  in_progress: {
    label: "In Progress",
    iconColor: "text-blue-500 dark:text-blue-400",
    hoverBg: "hover:bg-blue-50 dark:hover:bg-blue-950/40",
    dividerColor: "bg-blue-500 dark:bg-blue-400",
    badgeBg: "bg-blue-100 dark:bg-blue-900/50",
    badgeText: "text-blue-700 dark:text-blue-300",
    columnBg: "bg-blue-50/60 dark:bg-blue-950/30",
    accentBg: "border-blue-200 dark:border-blue-800",
    glowBg: "shadow-blue-200/40 dark:shadow-blue-900/40"
  },
  in_review: {
    label: "In Review",
    iconColor: "text-purple-500 dark:text-purple-400",
    hoverBg: "hover:bg-purple-50 dark:hover:bg-purple-950/40",
    dividerColor: "bg-purple-500 dark:bg-purple-400",
    badgeBg: "bg-purple-100 dark:bg-purple-900/50",
    badgeText: "text-purple-700 dark:text-purple-300",
    columnBg: "bg-purple-50/60 dark:bg-purple-950/30",
    accentBg: "border-purple-200 dark:border-purple-800",
    glowBg: "shadow-purple-200/40 dark:shadow-purple-900/40"
  },
  done: {
    label: "Done",
    iconColor: "text-emerald-500 dark:text-emerald-400",
    hoverBg: "hover:bg-emerald-50 dark:hover:bg-emerald-950/40",
    dividerColor: "bg-emerald-500 dark:bg-emerald-400",
    badgeBg: "bg-emerald-100 dark:bg-emerald-900/50",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    columnBg: "bg-emerald-50/60 dark:bg-emerald-950/30",
    accentBg: "border-emerald-200 dark:border-emerald-800",
    glowBg: "shadow-emerald-200/40 dark:shadow-emerald-900/40"
  },
  blocked: {
    label: "Blocked",
    iconColor: "text-rose-500 dark:text-rose-400",
    hoverBg: "hover:bg-rose-50 dark:hover:bg-rose-950/40",
    dividerColor: "bg-rose-500 dark:bg-rose-400",
    badgeBg: "bg-rose-100 dark:bg-rose-900/50",
    badgeText: "text-rose-700 dark:text-rose-300",
    columnBg: "bg-rose-50/60 dark:bg-rose-950/30",
    accentBg: "border-rose-200 dark:border-rose-800",
    glowBg: "shadow-rose-200/40 dark:shadow-rose-900/40"
  },
  cancelled: {
    label: "Cancelled",
    iconColor: "text-slate-400 dark:text-slate-500",
    hoverBg: "hover:bg-slate-100 dark:hover:bg-slate-800",
    dividerColor: "bg-slate-300 dark:bg-slate-600",
    badgeBg: "bg-slate-100 dark:bg-slate-800",
    badgeText: "text-slate-500 dark:text-slate-400",
    columnBg: "bg-slate-50/50 dark:bg-slate-900/40",
    accentBg: "border-slate-200 dark:border-slate-700",
    glowBg: "shadow-slate-200/20 dark:shadow-slate-800/20"
  },
};
