"use client";

import { StatusIcon } from "../../issues/components";
import { ActorAvatar } from "../../common/actor-avatar";
import { Archive } from "lucide-react";
import type { InboxItem } from "@multica/core/types";
import { getInboxDetailLabel } from "./inbox-detail-label";

import { withT, type TranslateFn } from "@multica/core";

function timeAgo(dateStr: string, t?: TranslateFn): string {
  const trans = withT(t);
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return trans("chat.justNow", "just now");
  if (minutes < 60) return `${minutes}${trans("chat.minutesAgo", "m ago")}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${trans("chat.hoursAgo", "h ago")}`;
  const days = Math.floor(hours / 24);
  return `${days}${trans("chat.daysAgo", "d ago")}`;
}

export { timeAgo };

type ItemVariant = "unread" | "read";

export function InboxListItem({
  item,
  isSelected,
  onClick,
  onArchive,
  variant = "read",
  t,
}: {
  item: InboxItem;
  isSelected: boolean;
  onClick: () => void;
  onArchive: () => void;
  variant?: ItemVariant;
  t?: TranslateFn;
}) {
  const isUnread = variant === "unread";

  return (
    <button
      onClick={onClick}
      className={`
        group relative w-full text-left rounded-xl p-3 transition-all duration-200 cursor-pointer
        ${isSelected 
          ? isUnread 
            ? "bg-destructive/5 border border-destructive/20 shadow-sm" 
            : "bg-accent border border-accent/50 shadow-sm"
          : isUnread 
            ? "bg-card hover:bg-card/80 border border-transparent hover:border-border/50 shadow-[0_1px_2px_rgba(0,0,0,0.04)]" 
            : "bg-transparent hover:bg-muted/30 border border-transparent"
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0 pt-0.5">
          <ActorAvatar
            actorType={item.actor_type ?? item.recipient_type}
            actorId={item.actor_id ?? item.recipient_id}
            size={36}
          />
          {isUnread && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75 animate-ping" style={{ animationDuration: '2s' }} />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className={`truncate text-sm leading-tight ${isUnread ? "font-semibold text-foreground" : "text-foreground/80"}`}>
              {item.title}
            </p>
            <span className={`shrink-0 text-[11px] ${isUnread ? "text-destructive/70" : "text-muted-foreground/60"}`}>
              {timeAgo(item.created_at, t)}
            </span>
          </div>

          <p className={`min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-snug ${isUnread ? "text-foreground/60" : "text-muted-foreground"}`}>
            {getInboxDetailLabel(item, t)}
          </p>

          {item.issue_status && (
            <div className="flex items-center gap-1.5 pt-0.5">
              <StatusIcon status={item.issue_status} className="h-3 w-3" />
            </div>
          )}
        </div>

        <div className={`shrink-0 transition-opacity duration-150 ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          <span
            role="button"
            tabIndex={0}
            title={t ? t('inbox.actions.archive', 'Archive') : 'Archive'}
            onClick={(e) => {
              e.stopPropagation();
              onArchive();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onArchive();
              }
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
          >
            <Archive className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>

      {isUnread && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-gradient-to-b from-destructive via-destructive to-destructive/50 rounded-r" />
      )}
    </button>
  );
}
