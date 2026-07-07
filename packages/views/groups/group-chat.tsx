"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { groupKeys } from "@multica/core/groups/queries";
import { useUpdateGroup, useLeaveGroup, useBatchInviteMember, useRemoveMember } from "@multica/core/groups/mutations";
import { api } from "@multica/core/api";
import { useNavigation } from "@multica/views/navigation";
import { useWS, useWSEvent, useWSReconnect } from "@multica/core/realtime";
import { useState, useRef, useEffect, useCallback, useMemo, Fragment } from "react";
import { useTranslation } from "@multica/core";
import { Button } from "@multica/ui/components/ui/button";
import { Input } from "@multica/ui/components/ui/input";
import { Checkbox } from "@multica/ui/components/ui/checkbox";
import { Textarea } from "@multica/ui/components/ui/textarea";
import { Card, CardContent } from "@multica/ui/components/ui/card";
import { Badge } from "@multica/ui/components/ui/badge";
import { ScrollArea } from "@multica/ui/components/ui/scroll-area";
import type { GroupMessage, GroupMember, GroupTask } from "@multica/core/types";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@multica/ui/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@multica/ui/components/ui/alert-dialog";
import {
  ArrowLeft, Send, UserPlus, LogOut, MessageCircle,
  Bot, Users, Shield, Check, X, Loader2, Search, XCircle, AtSign,
} from "lucide-react";

interface GroupChatProps {
  groupId: string;
  wsId: string;
  currentUserId: string;
}

export function GroupChat({ groupId, wsId, currentUserId }: GroupChatProps) {
  const { data: group, isLoading } = useQuery({
    queryKey: groupKeys.detail(wsId, groupId),
    queryFn: () => api.getGroup(groupId),
    enabled: !!groupId,
  });
  const { data: messagesData, refetch: refetchMessages } = useQuery({
    queryKey: groupKeys.messages(groupId),
    queryFn: () => api.listGroupMessages(groupId),
    enabled: !!groupId,
  });
  const { data: tasks } = useQuery({
    queryKey: groupKeys.tasks(groupId),
    queryFn: () => api.listGroupTasks(groupId),
    enabled: !!groupId,
  });
  const qc = useQueryClient();
  const { push } = useNavigation();
  const updateGroup = useUpdateGroup();
  const leaveGroup = useLeaveGroup();
  const removeMember = useRemoveMember();

  const [input, setInput] = useState("");
  const [editingAnnouncement, setEditingAnnouncement] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteTab, setInviteTab] = useState<"member" | "agent">("member");
  const [inviteSearch, setInviteSearch] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmRemoveMemberId, setConfirmRemoveMemberId] = useState<string | null>(null);
  const batchInvite = useBatchInviteMember();
  const { t } = useTranslation();
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cancellingTaskId, setCancellingTaskId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingTempIdRef = useRef<string | null>(null);
  const sentContentRef = useRef<string>("");

  // @mention navigation: which mentioned messages have been seen
  const readMentionRef = useRef<Set<string>>(new Set());
  const [, forceRender] = useState(0);

  const ws = useWS();

  // Re-register on reconnect
  useWSReconnect(() => {
    ws.send({ type: "group:register", payload: { group_id: groupId } });
    refetchMessages();
    // Retry pending send if ack hasn't arrived
    if (pendingTempIdRef.current && sentContentRef.current) {
      const tempId = crypto.randomUUID();
      pendingTempIdRef.current = tempId;
      ws.send({
        type: "group:message",
        payload: { group_id: groupId, content: sentContentRef.current, temp_id: tempId },
      });
    }
  });

  const isOwner = group?.members?.some(
    (m) => m.member_id === currentUserId && m.role === "owner"
  ) ?? false;
  const isAdmin = false; // TODO: check workspace admin role
  const currentUserName = group?.members?.find((m) => m.member_id === currentUserId)?.name;

  const members = group?.members ?? [];
  const specialMentions: { key: string; label: string; icon: React.ReactNode }[] = [
    { key: "all", label: "@all", icon: <AtSign className="size-3" /> },
    { key: "allAgents", label: "@allAgents", icon: <Bot className="size-3 text-primary" /> },
  ];
  const showMentions = mentionQuery !== null;
  const filteredMembers = showMentions
    ? members.filter((m: { name?: string; member_id: string }) => {
        if (mentionQuery === "") return true;
        const name = (m.name || m.member_id).toLowerCase();
        return name.includes((mentionQuery ?? "").toLowerCase());
      })
    : [];
  const filteredSpecials = showMentions
    ? specialMentions.filter((s) => {
        if (mentionQuery === "") return true;
        return s.key.toLowerCase().includes((mentionQuery ?? "").toLowerCase());
      })
    : [];
  const mentionSuggestions = [...filteredSpecials, ...filteredMembers];

  const insertMention = (item: (typeof mentionSuggestions)[number]) => {
    let name: string;
    if ("key" in item) {
      name = (item as (typeof specialMentions)[number]).key;
    } else {
      name = (item as NonNullable<(typeof members)[0]>).name || (item as NonNullable<(typeof members)[0]>).member_id;
    }
    const lastAtIndex = input.lastIndexOf("@", inputRef.current?.selectionStart ?? input.length);
    if (lastAtIndex === -1) return;
    const before = input.slice(0, lastAtIndex);
    const queryLen = (mentionQuery ?? "").length;
    const after = input.slice(lastAtIndex + queryLen + 1);
    setInput(`${before}@${name} ${after}`);
    setMentionQuery(null);
    setMentionIndex(0);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    const cursor = e.target.selectionStart ?? val.length;
    const beforeCursor = val.slice(0, cursor);
    const lastAtIndex = beforeCursor.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const afterAt = beforeCursor.slice(lastAtIndex + 1);
      if (afterAt.length <= 30 && !afterAt.includes(" ")) {
        setMentionQuery(afterAt);
        setMentionIndex(0);
        return;
      }
    }
    setMentionQuery(null);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      if (mentionQuery && mentionSuggestions.length > 0) {
        e.preventDefault();
        insertMention(mentionSuggestions[mentionIndex]!);
        return;
      }
      e.preventDefault();
      handleSend();
      return;
    }
    if (!showMentions || mentionSuggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIndex((i) => (i + 1) % mentionSuggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIndex((i) => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMentionQuery("");
    } else if (e.key === "Tab") {
      e.preventDefault();
      insertMention(mentionSuggestions[mentionIndex]!);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesData?.messages]);

  useWSEvent("group:message", useCallback((payload: any) => {
    if (payload.group_id === groupId) {
      qc.invalidateQueries({ queryKey: groupKeys.messages(groupId) });
      if (payload.mentions_type?.includes("agent")) {
        qc.invalidateQueries({ queryKey: groupKeys.tasks(groupId) });
      }
    }
  }, [groupId, qc]));

  useWSEvent("group:message-ack", useCallback((payload: any) => {
    if (payload.temp_id === pendingTempIdRef.current) {
      pendingTempIdRef.current = null;
      sentContentRef.current = "";
      setInput("");
    }
  }, []));

  useWSEvent("group:task-status", useCallback((payload: any) => {
    if (payload.group_id === groupId) {
      qc.invalidateQueries({ queryKey: groupKeys.tasks(groupId) });
    }
  }, [groupId, qc]));

  useWSEvent("group:member-joined", useCallback(() => {
    qc.invalidateQueries({ queryKey: groupKeys.detail(wsId, groupId) });
  }, [wsId, groupId, qc]));

  useWSEvent("group:member-left", useCallback(() => {
    qc.invalidateQueries({ queryKey: groupKeys.detail(wsId, groupId) });
  }, [wsId, groupId, qc]));

  useWSEvent("group:dissolved", useCallback((payload: any) => {
    if (payload.group_id === groupId) {
      push("/groups");
    }
  }, [groupId, push]));

  const handleCancelTask = useCallback(async (taskId: string) => {
    setCancellingTaskId(taskId);
    try {
      await api.cancelTaskById(taskId);
      qc.invalidateQueries({ queryKey: groupKeys.tasks(groupId) });
    } catch {
      // silent
    } finally {
      setCancellingTaskId(null);
    }
  }, [groupId, qc]);

  const handleSend = () => {
    if (!input.trim() || pendingTempIdRef.current) return;
    const tempId = crypto.randomUUID();
    pendingTempIdRef.current = tempId;
    sentContentRef.current = input.trim();
    ws.send({
      type: "group:message",
      payload: {
        group_id: groupId,
        content: sentContentRef.current,
        temp_id: tempId,
      },
    });
  };

  const handleUpdateAnnouncement = async () => {
    await updateGroup.mutateAsync({ id: groupId, announcement: announcementText });
    setEditingAnnouncement(false);
  };

  const existingMemberIds = new Set(
    members.filter((m) => m.member_type === "member").map((m) => m.member_id)
  );
  const existingAgentIds = new Set(
    members.filter((m) => m.member_type === "agent").map((m) => m.member_id)
  );

  const { data: workspaceMembers } = useQuery({
    queryKey: ["workspace-members", wsId],
    queryFn: () => api.listMembers(wsId),
    enabled: showInviteDialog,
  });

  const { data: agents } = useQuery({
    queryKey: ["agents", wsId],
    queryFn: () => api.listAgents({ workspace_id: wsId }),
    enabled: showInviteDialog,
  });

  const availableMembers = (workspaceMembers ?? [])
    .filter((m) => !existingMemberIds.has(m.user_id))
    .map((m) => ({
      id: m.user_id,
      name: m.name || m.email,
      subtitle: m.email,
      avatar_url: m.avatar_url,
    }));

  const availableAgents = (agents ?? [])
    .filter((a) => !existingAgentIds.has(a.id))
    .map((a) => ({
      id: a.id,
      name: a.name,
      subtitle: a.description,
      avatar_url: a.avatar_url,
    }));

  const inviteItems = inviteTab === "member" ? availableMembers : availableAgents;
  const filteredInviteItems = inviteItems.filter((item) => {
    if (!inviteSearch) return true;
    const q = inviteSearch.toLowerCase();
    return item.name.toLowerCase().includes(q) || item.subtitle?.toLowerCase().includes(q);
  });

  const toggleInviteItem = (id: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBatchInvite = async () => {
    if (selectedMemberIds.size === 0) return;
    const members = Array.from(selectedMemberIds).map((id) => ({
      member_type: inviteTab as "member" | "agent",
      member_id: id,
    }));
    await batchInvite.mutateAsync({ groupId, members });
    setSelectedMemberIds(new Set());
    setInviteSearch("");
    setShowInviteDialog(false);
  };

  const handleOpenInviteDialog = () => {
    setInviteTab("member");
    setInviteSearch("");
    setSelectedMemberIds(new Set());
    setShowInviteDialog(true);
  };

  // Register to group on mount, unregister on unmount
  useEffect(() => {
    ws.send({ type: "group:register", payload: { group_id: groupId } });
    return () => {
      ws.send({ type: "group:unregister", payload: { group_id: groupId } });
    };
  }, [groupId, ws]);

  const timeline = useMemo(() => {
    const msgs = (messagesData?.messages ?? []).slice().reverse();
    // Only show active tasks in the timeline; completed/failed/cancelled
    // tasks are already visible through the agent's reply message.
    const activeTasks = (tasks ?? []).filter(
      (t) => !["completed", "failed", "cancelled"].includes(t.status)
    ).slice().reverse();
    const items: Array<{ type: "message"; data: GroupMessage } | { type: "task"; data: GroupTask }> = [];
    for (const m of msgs) items.push({ type: "message", data: m });
    for (const t of activeTasks) items.push({ type: "task", data: t });
    items.sort((a, b) => new Date(a.data.created_at).getTime() - new Date(b.data.created_at).getTime());
    return items;
  }, [messagesData?.messages, tasks]);

  // Messages that @mention the current user (sorted oldest first)
  const mentionMsgs = useMemo(() => {
    return (messagesData?.messages ?? []).filter(
      (m) => m.mentions_id?.includes(currentUserId) && m.sender_id !== currentUserId,
    ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messagesData?.messages, currentUserId]);

  // First mention not yet scrolled to
  const nextMention = useMemo(() => {
    return mentionMsgs.find((m) => !readMentionRef.current.has(m.id)) ?? null;
  }, [mentionMsgs, readMentionRef.current.size]);

  const jumpToNextMention = useCallback(() => {
    if (!nextMention) return;
    readMentionRef.current = new Set([...readMentionRef.current, nextMention.id]);
    forceRender((n) => n + 1);
    const el = document.querySelector(`[data-msg-id="${nextMention.id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [nextMention]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        {t("groups.groupNotFound")}
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0">
      {/* Message area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Button variant="ghost" size="icon" onClick={() => push("/groups")}>
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex-1">
            <h2 className="font-semibold">{group.name}</h2>
            <p className="text-xs text-muted-foreground">
              {t("groups.memberCount", { count: group.member_count })}
            </p>
          </div>
          {(isOwner || isAdmin) && (
            <Button variant="outline" size="sm" onClick={handleOpenInviteDialog}>
              <UserPlus className="size-4 mr-2" />
              {t("groups.inviteMember")}
            </Button>
          )}
          {!isOwner && (
            <Button variant="ghost" size="sm" onClick={() => setConfirmLeave(true)}>
              <LogOut className="size-4" />
            </Button>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 min-h-0 p-4">
          <div className="space-y-4">
            {timeline.map((item) => {
              if (item.type === "message") {
                const msg = item.data;
                return (
                  <div
                    key={msg.id}
                    data-msg-id={msg.id}
                    className={`flex gap-3 ${msg.sender_id === currentUserId ? "justify-end" : ""}`}
                  >
                    <div
                     className={`max-w-[70%] rounded-lg px-4 py-2 ${
                       msg.sender_id === currentUserId
                         ? "bg-primary text-primary-foreground"
                         : "bg-accent"
                     }`}
                    >
                       <p className="flex items-center gap-1.5 mb-1">
                         {msg.sender_id !== currentUserId ? (
                           <>
                             <span className="text-sm font-semibold">{msg.sender_name}</span>
                             {msg.sender_type === "agent" && <Bot className="size-3.5 text-primary" />}
                             <span className="text-xs text-muted-foreground">
                               {new Date(msg.created_at).toLocaleTimeString()}
                             </span>
                           </>
                         ) : (
                           <>
                             <span className="text-sm font-semibold">{t("groups.you")}</span>
                             <span className="text-xs text-muted-foreground">
                               {new Date(msg.created_at).toLocaleTimeString()}
                             </span>
                           </>
                         )}
                      </p>
                       <p className="text-sm whitespace-pre-wrap break-words mt-1">
                         <HighlightedContent
                           content={msg.content}
                           currentUserName={currentUserName}
                           mentioned={msg.mentions_id?.includes(currentUserId) ?? false}
                         />
                       </p>
                    </div>
                  </div>
                );
              }
               const task = item.data;
               const startStr = task.status === "running" ? task.started_at
                 : task.status === "dispatched" ? task.dispatched_at
                 : task.status === "queued" ? task.created_at
                 : null;
               const canCancel = ["queued", "dispatched", "running"].includes(task.status);
              const isCancelling = cancellingTaskId === task.id;
              return (
                <Card key={`task-${task.id}`} className="border-l-4 border-l-primary">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Bot className="size-4 text-primary shrink-0" />
                        <span className="font-medium text-sm truncate">{task.agent_name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {startStr && (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            <ElapsedTimer startStr={startStr} />
                          </span>
                        )}
                        <TaskStatusBadge status={task.status} />
                        {canCancel && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-destructive"
                            onClick={() => handleCancelTask(task.id)}
                            disabled={isCancelling}
                          >
                            {isCancelling ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <XCircle className="size-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                    {task.error && (
                      <p className="text-xs text-destructive mt-1 line-clamp-3">
                        {task.error}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* @mention navigation */}
        {mentionMsgs.length > 0 && (
          <div className="border-t px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={jumpToNextMention}
            >
              <AtSign className="size-4 mr-2" />
              {nextMention ? (
                `${readMentionRef.current.size + 1}/${mentionMsgs.length} mentions`
              ) : (
                "All mentions seen ✓"
              )}
            </Button>
          </div>
        )}

        {/* Input */}
        <div className="border-t p-4 relative">
          {showMentions && mentionSuggestions.length > 0 && (
            <div className="absolute bottom-full left-4 right-4 mb-1 bg-popover border rounded-lg shadow-lg overflow-hidden z-50">
              {mentionSuggestions.map((item, i) => {
                const isSpecial = "key" in item;
                if (isSpecial) {
                  const s = item as (typeof specialMentions)[number];
                  return (
                    <button
                      key={s.key}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors ${
                        i === mentionIndex ? "bg-accent" : ""
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertMention(item);
                      }}
                    >
                      <div className="size-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                        {s.icon}
                      </div>
                      <span className="font-medium">{s.label}</span>
                      <span className="text-xs text-muted-foreground ml-auto">@</span>
                    </button>
                  );
                }
                const member = item as NonNullable<(typeof members)[0]>;
                return (
                  <button
                    key={member.id}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors ${
                      i === mentionIndex ? "bg-accent" : ""
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(item);
                    }}
                  >
                    <div className="size-6 rounded-full bg-accent flex items-center justify-center shrink-0">
                      {member.member_type === "agent" ? (
                        <Bot className="size-3 text-primary" />
                      ) : (
                        <Users className="size-3" />
                      )}
                    </div>
                    <span className="font-medium">{member.name || member.member_id}</span>
                    {member.role === "owner" && (
                      <Shield className="size-3 text-amber-500 ml-auto" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex gap-2 items-end">
            <Input
              ref={inputRef}
              placeholder={t("groups.messagePlaceholder")}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={!input.trim() || !!pendingTempIdRef.current} className="shrink-0">
              {pendingTempIdRef.current ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Right panel: Announcement + Members */}
      <div className="w-72 border-l hidden lg:flex flex-col min-h-0">
        {/* Announcement */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <MessageCircle className="size-4" />
              {t("groups.announcement")}
            </h3>
            {isOwner && !editingAnnouncement && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => {
                  setAnnouncementText(group.announcement);
                  setEditingAnnouncement(true);
                }}
              >
                <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              </Button>
            )}
          </div>
          {editingAnnouncement ? (
            <div className="space-y-2">
              <Textarea
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                rows={3}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleUpdateAnnouncement}>
                  <Check className="size-3 mr-1" /> {t("groups.save")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingAnnouncement(false)}>
                  <X className="size-3" />
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {group.announcement || t("groups.noAnnouncement")}
            </p>
          )}
        </div>

        {/* Agents & Members */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {group.members?.some((m) => m.member_type === "agent") && (
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <Bot className="size-4" />
                {t("layout.agents")} ({group.members?.filter((m) => m.member_type === "agent").length ?? 0})
              </h3>
              <div className="space-y-2">
                {group.members
                  ?.filter((m) => m.member_type === "agent")
                  .map((member) => (
                    <MemberItem
                      key={member.id}
                      member={member}
                      isOwner={isOwner}
                      currentUserId={currentUserId}
                      onRemove={setConfirmRemoveMemberId}
                    />
                  ))}
              </div>
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <Users className="size-4" />
              {t("groups.members")} ({group.members?.filter((m) => m.member_type === "member").length ?? 0})
            </h3>
            <div className="space-y-2">
              {group.members
                ?.filter((m) => m.member_type === "member")
                .map((member) => (
                  <MemberItem
                    key={member.id}
                    member={member}
                    isOwner={isOwner}
                    currentUserId={currentUserId}
                    onRemove={setConfirmRemoveMemberId}
                  />
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Invite dialog */}
      <Dialog open={showInviteDialog} onOpenChange={(open) => {
        if (!open) {
          setInviteTab("member");
          setInviteSearch("");
          setSelectedMemberIds(new Set());
        }
        setShowInviteDialog(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("groups.inviteMember")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-4 max-h-[70vh]">
            {/* Tab toggle */}
            <div className="flex gap-2 shrink-0">
              <Button
                variant={inviteTab === "member" ? "default" : "outline"}
                size="sm"
                onClick={() => { setInviteTab("member"); setInviteSearch(""); }}
              >
                <Users className="size-4 mr-1" /> {t("common.members")}
              </Button>
              <Button
                variant={inviteTab === "agent" ? "default" : "outline"}
                size="sm"
                onClick={() => { setInviteTab("agent"); setInviteSearch(""); }}
              >
                <Bot className="size-4 mr-1" /> {t("common.agents")}
              </Button>
            </div>

            {/* Search */}
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={inviteTab === "member" ? t("groups.inviteSearchPlaceholder") : t("groups.inviteAgentSearchPlaceholder")}
                value={inviteSearch}
                onChange={(e) => setInviteSearch(e.target.value)}
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
              {filteredInviteItems.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 p-2 rounded hover:bg-accent cursor-pointer"
                >
                  <Checkbox
                    checked={selectedMemberIds.has(item.id)}
                    onCheckedChange={() => toggleInviteItem(item.id)}
                  />
                  <div className="size-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                    {inviteTab === "agent" ? (
                      <Bot className="size-4 text-primary" />
                    ) : (
                      <Users className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    {item.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                    )}
                  </div>
                </label>
              ))}
              {filteredInviteItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {inviteTab === "member"
                    ? t("groups.noMembersToInvite")
                    : t("groups.noAgentsToInvite")}
                </p>
              )}
            </div>

            {/* Submit */}
            <Button
              onClick={handleBatchInvite}
              disabled={selectedMemberIds.size === 0 || batchInvite.isPending}
              className="w-full shrink-0"
            >
              {batchInvite.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
              {t("groups.inviteSelected", { count: selectedMemberIds.size })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm leave group */}
      <AlertDialog open={confirmLeave} onOpenChange={(v) => { if (!v) setConfirmLeave(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("groups.leaveGroup")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("groups.leaveWarning")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("groups.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                leaveGroup.mutate(groupId);
                setConfirmLeave(false);
              }}
            >
              {t("groups.leaveGroup")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm remove member */}
      <AlertDialog open={!!confirmRemoveMemberId} onOpenChange={(v) => { if (!v) setConfirmRemoveMemberId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("groups.removeMember")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("groups.removeMemberWarning")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("groups.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirmRemoveMemberId) {
                  removeMember.mutate({ groupId, memberId: confirmRemoveMemberId });
                }
                setConfirmRemoveMemberId(null);
              }}
            >
              {t("groups.removeMember")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// mentionSplitRe matches @mentions including markdown links and Unicode names.
const mentionSplitRe = /(@[\p{L}\p{N}_-]+)/gu;

function HighlightedContent({ content, currentUserName, mentioned }: { content: string; currentUserName?: string; mentioned: boolean }) {
  if (!mentioned || !currentUserName) return <>{content}</>;

  const userMentionRe = new RegExp(`^@${currentUserName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "iu");

  const parts = content.split(mentionSplitRe);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("@") && userMentionRe.test(part) ? (
          <span key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5 font-medium">{part}</span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}

function ElapsedTimer({ startStr }: { startStr: string | null }) {
  const [, setTick] = useState(0);
  const start = startStr ? new Date(startStr).getTime() : null;

  useEffect(() => {
    if (!start) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [start]);

  if (!start) return null;
  const ms = Date.now() - start;
  if (ms < 0) return null;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return <>{seconds}s</>;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return <>{minutes}m {seconds % 60}s</>;
  const hours = Math.floor(minutes / 60);
  return <>{hours}h {minutes % 60}m</>;
}

function TaskStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const variants: Record<string, string> = {
    queued: "bg-yellow-100 text-yellow-800",
    dispatched: "bg-blue-100 text-blue-800",
    running: "bg-purple-100 text-purple-800",
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    cancelled: "bg-gray-100 text-gray-800",
  };
  return (
    <Badge className={variants[status] || "bg-gray-100"}>
      {t(`groups.taskStatus.${status}`, status)}
    </Badge>
  );
}

function MemberItem({
  member,
  isOwner,
  currentUserId,
  onRemove,
}: {
  member: GroupMember;
  isOwner: boolean;
  currentUserId: string | null;
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <div className="size-7 rounded-full bg-accent flex items-center justify-center shrink-0">
          {member.member_type === "agent" ? (
            <Bot className="size-4 text-primary" />
          ) : (
            <Users className="size-4" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm truncate">{member.name || member.member_id}</p>
          {member.role === "owner" && (
            <div className="flex items-center gap-1">
              <Shield className="size-3 text-amber-500" />
              <span className="text-[10px] text-amber-500">{t("groups.owner")}</span>
            </div>
          )}
        </div>
      </div>
      {isOwner && member.member_id !== currentUserId && (
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          onClick={() => onRemove(member.id)}
        >
          <X className="size-3" />
        </Button>
      )}
    </div>
  );
}


