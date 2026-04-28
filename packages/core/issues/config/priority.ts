import type { IssuePriority } from "../../types";

export const PRIORITY_ORDER: IssuePriority[] = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
];

export const PRIORITY_CONFIG: Record<
  IssuePriority,
  { label: string; bars: number; color: string; badgeBg: string; badgeText: string; dotColor: string }
> = {
  urgent: {
    label: "Urgent",
    bars: 4,
    color: "text-rose-600 dark:text-rose-400",
    badgeBg: "bg-rose-100 dark:bg-rose-900/50",
    badgeText: "text-rose-700 dark:text-rose-300",
    dotColor: "bg-rose-500 dark:bg-rose-400"
  },
  high: {
    label: "High",
    bars: 3,
    color: "text-orange-600 dark:text-orange-400",
    badgeBg: "bg-orange-100 dark:bg-orange-900/50",
    badgeText: "text-orange-700 dark:text-orange-300",
    dotColor: "bg-orange-500 dark:bg-orange-400"
  },
  medium: {
    label: "Medium",
    bars: 2,
    color: "text-amber-600 dark:text-amber-400",
    badgeBg: "bg-amber-100 dark:bg-amber-900/50",
    badgeText: "text-amber-700 dark:text-amber-300",
    dotColor: "bg-amber-500 dark:bg-amber-400"
  },
  low: {
    label: "Low",
    bars: 1,
    color: "text-teal-600 dark:text-teal-400",
    badgeBg: "bg-teal-100 dark:bg-teal-900/50",
    badgeText: "text-teal-700 dark:text-teal-300",
    dotColor: "bg-teal-500 dark:bg-teal-400"
  },
  none: {
    label: "No priority",
    bars: 0,
    color: "text-slate-400 dark:text-slate-500",
    badgeBg: "bg-slate-100 dark:bg-slate-800",
    badgeText: "text-slate-500 dark:text-slate-400",
    dotColor: "bg-slate-300 dark:bg-slate-600"
  },
};
