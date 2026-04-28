"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useDefaultLayout } from "react-resizable-panels";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceId } from "@multica/core/hooks";
import {
  inboxListOptions,
} from "@multica/core/inbox/queries";
import {
  useMarkInboxRead,
  useArchiveInbox,
  useMarkAllInboxRead,
  useArchiveAllInbox,
  useArchiveAllReadInbox,
  useArchiveCompletedInbox,
} from "@multica/core/inbox/mutations";
import { IssueDetail } from "../../issues/components";
import { useNavigation } from "../../navigation";
import { useTranslation } from "@multica/core";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Inbox,
  CheckCheck,
  Archive,
  BookCheck,
  ListChecks,
  ArrowLeft,
  Bell,
  BellOff,
  Filter,
} from "lucide-react";
import type { InboxItem } from "@multica/core/types";
import { Button } from "@multica/ui/components/ui/button";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@multica/ui/components/ui/resizable";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@multica/ui/components/ui/dropdown-menu";
import { useIsMobile } from "@multica/ui/hooks/use-mobile";
import { InboxListItem, timeAgo } from "./inbox-list-item";

type TranslateFn = (key: string, fallback: string) => string;

interface InboxPageProps {
  t?: TranslateFn;
}

export function InboxPage({ t: tProp }: InboxPageProps) {
  const { t: defaultT } = useTranslation();
  const t = tProp || defaultT;
  
  const { searchParams, replace } = useNavigation();
  const urlIssue = searchParams.get("issue") ?? "";

  const [selectedKey, setSelectedKeyState] = useState(() => urlIssue);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  useEffect(() => {
    setSelectedKeyState(urlIssue);
  }, [urlIssue]);

  const setSelectedKey = useCallback((key: string) => {
    setSelectedKeyState(key);
    const url = key ? `/inbox?issue=${key}` : "/inbox";
    replace(url);
  }, [replace]);

  const wsId = useWorkspaceId();
  const { data: rawItems = [], isLoading: loading } = useQuery(inboxListOptions(wsId));
  const items = useMemo(() => rawItems.filter((i) => !i.archived), [rawItems]);

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "multica_inbox_layout",
  });

  const isMobile = useIsMobile();
  const selected = items.find((i) => i.id === selectedKey) ?? null;
  const unreadCount = items.filter((i) => !i.read).length;

  const markReadMutation = useMarkInboxRead();
  const archiveMutation = useArchiveInbox();
  const markAllReadMutation = useMarkAllInboxRead();
  const archiveAllMutation = useArchiveAllInbox();
  const archiveAllReadMutation = useArchiveAllReadInbox();
  const archiveCompletedMutation = useArchiveCompletedInbox();

  const handleSelect = (item: InboxItem) => {
    setSelectedKey(item.id);
    if (!item.read) {
      markReadMutation.mutate(item.id, {
        onError: () => toast.error(t('inbox.errors.markReadFailed', 'Failed to mark as read')),
      });
    }
  };

  const handleArchive = (id: string) => {
    const archived = items.find((i) => i.id === id);
    if (archived && archived.id === selectedKey) setSelectedKey("");
    archiveMutation.mutate(id, {
      onError: () => toast.error(t('inbox.errors.archiveFailed', 'Failed to archive')),
    });
  };

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate(undefined, {
      onError: () => toast.error(t('inbox.errors.markAllReadFailed', 'Failed to mark all as read')),
    });
  };

  const handleArchiveAll = () => {
    setSelectedKey("");
    archiveAllMutation.mutate(undefined, {
      onError: () => toast.error(t('inbox.errors.archiveAllFailed', 'Failed to archive all')),
    });
  };

  const handleArchiveAllRead = () => {
    const readKeys = items.filter((i) => i.read).map((i) => i.issue_id ?? i.id);
    if (readKeys.includes(selectedKey)) setSelectedKey("");
    archiveAllReadMutation.mutate(undefined, {
      onError: () => toast.error(t('inbox.errors.archiveAllReadFailed', 'Failed to archive read items')),
    });
  };

  const handleArchiveCompleted = () => {
    setSelectedKey("");
    archiveCompletedMutation.mutate(undefined, {
      onError: () => toast.error(t('inbox.errors.archiveCompletedFailed', 'Failed to archive completed')),
    });
  };

  const unreadItems = items.filter((i) => !i.read);
  const readItems = items.filter((i) => i.read);

  const listHeader = (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/50 bg-gradient-to-r from-background to-background/80 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Bell className="h-4 w-4 text-primary" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-sm font-semibold tracking-tight">{t('inbox.title', 'Inbox')}</h1>
          {unreadCount > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {unreadCount} {t('inbox.unread', 'unread')}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:bg-accent/80"
              />
            }
          >
            <Filter className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto">
            <DropdownMenuItem onClick={() => setFilter("all")} className="cursor-pointer gap-2">
              <div className={`h-1.5 w-1.5 rounded-full ${filter === "all" ? "bg-destructive" : "bg-muted-foreground/30"}`} />
              {t('inbox.filterAll', 'All')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("unread")} className="cursor-pointer gap-2">
              <div className={`h-1.5 w-1.5 rounded-full ${filter === "unread" ? "bg-destructive" : "bg-muted-foreground/30"}`} />
              {t('inbox.filterUnread', 'Unread')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("read")} className="cursor-pointer gap-2">
              <div className={`h-1.5 w-1.5 rounded-full ${filter === "read" ? "bg-destructive" : "bg-muted-foreground/30"}`} />
              {t('inbox.filterRead', 'Read')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:bg-accent/80"
              />
            }
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto">
            <DropdownMenuItem onClick={handleMarkAllRead} className="cursor-pointer">
              <CheckCheck className="h-4 w-4" />
              {t('inbox.actions.markAllRead', 'Mark all as read')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleArchiveAll} className="cursor-pointer">
              <Archive className="h-4 w-4" />
              {t('inbox.actions.archiveAll', 'Archive all')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleArchiveAllRead} className="cursor-pointer">
              <BookCheck className="h-4 w-4" />
              {t('inbox.actions.archiveAllRead', 'Archive all read')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleArchiveCompleted} className="cursor-pointer">
              <ListChecks className="h-4 w-4" />
              {t('inbox.actions.archiveCompleted', 'Archive completed')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  const SectionHeader = ({ title, count }: { title: string; count: number }) => (
    <div className="flex items-center gap-2 px-4 py-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
        {title}
      </span>
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground">
        {count}
      </span>
    </div>
  );

  const renderListContent = () => {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 shadow-sm">
            <BellOff className="h-10 w-10 text-primary/40" />
          </div>
          <h3 className="mb-1 text-base font-medium">{t('inbox.emptyState.title', 'No notifications')}</h3>
          <p className="text-sm text-muted-foreground">{t('inbox.detail.empty', 'Your inbox is empty')}</p>
        </div>
      );
    }

    const filteredUnread = filter === "all" || filter === "unread" ? unreadItems : [];
    const filteredRead = filter === "all" || filter === "read" ? readItems : [];

    if (filter !== "all" && filteredUnread.length === 0 && filteredRead.length === 0) {
      const emptyMessage = filter === "unread" 
        ? t('inbox.filterNoUnread', 'No unread notifications')
        : t('inbox.filterNoRead', 'No read notifications');
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 shadow-sm">
            <BellOff className="h-10 w-10 text-primary/40" />
          </div>
          <h3 className="mb-1 text-base font-medium">{emptyMessage}</h3>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {filteredUnread.length > 0 && (
          <>
            <SectionHeader title={t('inbox.sections.unread', 'Unread')} count={filteredUnread.length} />
            <div className="space-y-0.5 px-2">
              {filteredUnread.map((item) => (
                <InboxListItem
                  key={item.id}
                  item={item}
                  isSelected={item.id === selectedKey}
                  onClick={() => handleSelect(item)}
                  onArchive={() => handleArchive(item.id)}
                  variant="unread"
                  t={t}
                />
              ))}
            </div>
          </>
        )}
        {filteredRead.length > 0 && (
          <>
            <SectionHeader title={t('inbox.sections.read', 'Read')} count={filteredRead.length} />
            <div className="space-y-0.5 px-2">
              {filteredRead.map((item) => (
                <InboxListItem
                  key={item.id}
                  item={item}
                  isSelected={item.id === selectedKey}
                  onClick={() => handleSelect(item)}
                  onArchive={() => handleArchive(item.id)}
                  variant="read"
                  t={t}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const detailContent = selected?.issue_id ? (
    <IssueDetail
      key={selected.id}
      issueId={selected.issue_id}
      defaultSidebarOpen={false}
      layoutId="multica_inbox_issue_detail_layout"
      highlightCommentId={selected.details?.comment_id ?? undefined}
      onDelete={() => {
        handleArchive(selected.id);
      }}
      t={t}
    />
  ) : selected ? (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold leading-tight">{selected.title}</h2>
          <p className="text-xs text-muted-foreground">
            {t(`inbox.types.${selected.type}`, "Assigned")} · {timeAgo(selected.created_at, t)}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleArchive(selected.id)}
          className="gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Archive className="h-3.5 w-3.5" />
          {t('inbox.actions.archive', 'Archive')}
        </Button>
      </div>
      {selected.body && (
        <div className="rounded-lg bg-muted/30 p-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
          {selected.body}
        </div>
      )}
    </div>
  ) : null;

  if (isMobile) {
    if (loading) {
      return (
        <div className="flex flex-col min-h-0 bg-background">
          <div className="flex h-14 shrink-0 items-center border-b border-border/50 bg-gradient-to-r from-background to-background/80 px-4 backdrop-blur-sm">
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-card">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (selected) {
      return (
        <div className="flex flex-col min-h-0 bg-background">
          <div className="flex h-14 shrink-0 items-center border-b border-border/50 bg-gradient-to-r from-background to-background/80 px-4 backdrop-blur-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedKey("")}
              className="gap-1.5 text-muted-foreground hover:bg-accent/80"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('inbox.title', 'Inbox')}
            </Button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {detailContent}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col min-h-0 bg-background">
        {listHeader}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {renderListContent()}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0 bg-background" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
        <ResizablePanel id="list" defaultSize={380} minSize={280} maxSize={520} groupResizeBehavior="preserve-pixel-size">
          <div className="flex flex-col border-r border-border/50 h-full">
            <div className="flex h-14 shrink-0 items-center border-b border-border/50 bg-gradient-to-r from-background to-background/80 px-4 backdrop-blur-sm">
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border/30">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel id="detail" minSize="40%">
          <div className="p-8 flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <div className="mx-auto h-12 w-12 rounded-xl bg-muted/30 flex items-center justify-center">
                <Inbox className="h-6 w-6 text-muted-foreground/30" />
              </div>
              <Skeleton className="h-5 w-32 mx-auto" />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0 bg-background" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
      <ResizablePanel id="list" defaultSize={380} minSize={280} maxSize={520} groupResizeBehavior="preserve-pixel-size">
        <div className="flex flex-col border-r border-border/50 h-full bg-gradient-to-b from-background to-muted/5">
          {listHeader}
          <div className="flex-1 min-h-0 overflow-y-auto py-2">
            {renderListContent()}
          </div>
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel id="detail" minSize="40%">
        <div className="flex flex-col min-h-0 h-full bg-gradient-to-b from-background to-muted/5">
          {detailContent ?? (
            <div className="flex h-full flex-col items-center justify-center text-center p-8">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/5 to-primary/15 shadow-sm">
                <Bell className="h-10 w-10 text-primary/50" />
              </div>
              <h3 className="mb-2 text-lg font-medium">
                {items.length === 0
                  ? t('inbox.detail.empty', 'Your inbox is empty')
                  : t('inbox.detail.selectNotification', 'Select a notification')}
              </h3>
              <p className="text-sm text-muted-foreground max-w-[260px]">
                {items.length === 0
                  ? t('inbox.emptyState.title', 'No notifications')
                  : t('inbox.detail.selectNotification', 'Select a notification to view details')}
              </p>
            </div>
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
