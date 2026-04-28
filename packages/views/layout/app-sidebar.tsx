"use client";

import React, { useCallback, useEffect } from "react";
import { cn } from "@multica/ui/lib/utils";
import { useNavigation } from "../navigation";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Inbox,
  ListTodo,
  Bot,
  Monitor,
  Settings,
  LogOut,
  Plus,
  Check,
  BookOpenText,
  SquarePen,
  CircleUser,
  FolderKanban,
  PinOff,
  Search,
  ChevronRight,
  Zap,
  Ellipsis,
} from "lucide-react";
import { WorkspaceAvatar } from "../workspace/workspace-avatar";
import { ActorAvatar } from "@multica/ui/components/common/actor-avatar";
import { useIssueDraftStore } from "@multica/core/issues/stores/draft-store";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@multica/ui/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@multica/ui/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@multica/ui/components/ui/tooltip";
import { Button } from "@multica/ui/components/ui/button";
import { Input } from "@multica/ui/components/ui/input";
import { useAuthStore } from "@multica/core/auth";
import { useWorkspaceStore } from "@multica/core/workspace";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { inboxKeys, deduplicateInboxItems } from "@multica/core/inbox/queries";
import { api } from "@multica/core/api";
import { useModalStore } from "@multica/core/modals";
import { useMyRuntimesNeedUpdate } from "@multica/core/runtimes/hooks";
import { pinKeys } from "@multica/core/pins/queries";
import { useDeletePin, useReorderPins } from "@multica/core/pins/mutations";
import type { PinnedItem } from "@multica/core/types";

type TranslateFn = (key: string, fallback: string) => string;

interface AppSidebarProps {
  topSlot?: React.ReactNode;
  searchSlot?: React.ReactNode;
  headerClassName?: string;
  headerStyle?: React.CSSProperties;
  t?: TranslateFn;
}

function DraftDot() {
  const hasDraft = useIssueDraftStore((s) => !!(s.draft.title || s.draft.description));
  if (!hasDraft) return null;
  return <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-brand animate-pulse" />;
}

function NavSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <span className="text-[11px] font-semibold text-sidebar-foreground/50">{title}</span>
        <div className="flex-1 h-px bg-gradient-to-r from-sidebar-border to-transparent" />
      </div>
      {children}
    </div>
  );
}

function GridNavItem({
  icon: Icon,
  label,
  badge,
  isActive,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  badge?: number | boolean;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <div
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClick?.();
            }
          }}
          className={cn(
            "flex flex-col items-center justify-start gap-2 py-3 px-2 rounded-xl w-full",
            "transition-all duration-200 cursor-pointer",
            "hover:bg-sidebar-accent",
            isActive
              ? "bg-gradient-to-b from-brand/20 to-brand/10 shadow-lg shadow-brand/20"
              : "bg-transparent"
          )}
        >
          {badge === true && (
            <span className="absolute right-0 top-0 size-2 rounded-full bg-destructive animate-pulse" />
          )}
          {typeof badge === "number" && badge > 0 && (
            <span className="absolute -top-1 -right-1 flex size-5 min-w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
          <Icon
            className={cn(
              "size-7 shrink-0 transition-colors duration-200",
              isActive ? "text-brand" : "text-sidebar-foreground/60"
            )}
          />
          <span
            className={cn(
              "text-[10px] font-medium transition-colors duration-200 text-center leading-tight w-full truncate",
              isActive ? "text-brand" : "text-sidebar-foreground/50"
            )}
          >
            {label}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function SortablePinItem({
  pin,
  pathname,
  onUnpin,
  t,
}: {
  pin: PinnedItem;
  pathname: string;
  onUnpin: () => void;
  t: TranslateFn;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pin.id });
  const { push } = useNavigation();

  const style = { transform: CSS.Transform.toString(transform), transition };
  const href = pin.item_type === "issue" ? `/issues/${pin.item_id}` : `/projects/${pin.item_id}`;
  const isActive = pathname === href;
  const label = pin.item_type === "issue" && pin.identifier ? `${pin.identifier} ${pin.title}` : pin.title;

  return (
    <SidebarMenuItem
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/pin relative rounded-md transition-all duration-200",
        isDragging && "opacity-40 scale-95 bg-sidebar-accent"
      )}
      {...attributes}
      {...listeners}
    >
      <SidebarMenuButton
        isActive={isActive}
        onClick={() => push(href)}
        className={cn(
          "cursor-pointer w-full h-9 px-2 rounded-md",
          "transition-all duration-200 ease-out",
          "hover:bg-sidebar-accent text-sidebar-foreground/80 text-[12px]",
          isActive
            ? "bg-gradient-to-r from-brand/15 to-transparent border-l-2 border-brand"
            : "border-l-2 border-transparent"
        )}
      >
        {pin.item_type === "issue" ? (
          <ListTodo className="size-3 shrink-0 text-brand" />
        ) : (
          <FolderKanban className="size-3 shrink-0 text-info" />
        )}
        <span className="truncate flex-1">{label}</span>
        <button
          className="ml-auto cursor-pointer opacity-0 group-hover/pin:opacity-100 transition-all duration-150 hover:bg-destructive/20 hover:text-destructive p-1 rounded"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onUnpin();
          }}
          aria-label={t("sidebar.unpin", "Unpin")}
        >
          <PinOff className="size-2.5" />
        </button>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar({
  topSlot,
  searchSlot,
  headerClassName,
  headerStyle,
  t = (_, fallback) => fallback,
}: AppSidebarProps = {}) {
  const { pathname, push } = useNavigation();
  const user = useAuthStore((s) => s.user);
  const authLogout = useAuthStore((s) => s.logout);
  const workspace = useWorkspaceStore((s) => s.workspace);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);

  const wsId = workspace?.id;
  const { data: inboxItems = [] } = useQuery({
    queryKey: wsId ? inboxKeys.list(wsId) : ["inbox", "disabled"],
    queryFn: () => api.listInbox(),
    enabled: !!wsId,
  });
  const unreadCount = React.useMemo(
    () => deduplicateInboxItems(inboxItems).filter((i) => !i.read).length,
    [inboxItems],
  );
  const hasRuntimeUpdates = useMyRuntimesNeedUpdate(wsId);
  const { data: pinnedItems = [] } = useQuery<PinnedItem[]>({
    queryKey: wsId ? pinKeys.list(wsId) : ["pins", "disabled"],
    queryFn: () => api.listPins(),
    enabled: !!wsId,
  });
  const deletePin = useDeletePin();
  const reorderPins = useReorderPins();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = pinnedItems.findIndex((p) => p.id === active.id);
      const newIndex = pinnedItems.findIndex((p) => p.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(pinnedItems, oldIndex, newIndex);
      reorderPins.mutate(reordered);
    },
    [pinnedItems, reorderPins],
  );

  const queryClient = useQueryClient();
  const logout = () => {
    queryClient.clear();
    authLogout();
    useWorkspaceStore.getState().clearWorkspace();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "c" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        const isEditable =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          (e.target as HTMLElement)?.isContentEditable;
        if (isEditable) return;
        if (useModalStore.getState().modal) return;
        e.preventDefault();
        const projectMatch = pathname.match(/^\/projects\/([^/]+)$/);
        const data = projectMatch ? { project_id: projectMatch[1] } : undefined;
        useModalStore.getState().open("create-issue", data);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pathname]);

  const navItems = [
    { href: "/inbox", labelKey: "sidebar.inbox", defaultLabel: "Inbox", icon: Inbox, badge: unreadCount },
    { href: "/my-issues", labelKey: "sidebar.myIssues", defaultLabel: "My Issues", icon: CircleUser },
    { href: "/issues", labelKey: "sidebar.issues", defaultLabel: "Issues", icon: ListTodo },
    { href: "/projects", labelKey: "sidebar.projects", defaultLabel: "Projects", icon: FolderKanban },
    { href: "/agents", labelKey: "sidebar.agents", defaultLabel: "Agents", icon: Bot },
    { href: "/runtimes", labelKey: "sidebar.runtimes", defaultLabel: "Runtimes", icon: Monitor, badge: hasRuntimeUpdates },
    { href: "/skills", labelKey: "sidebar.skills", defaultLabel: "Skills", icon: BookOpenText },
    { href: "/settings", labelKey: "sidebar.settings", defaultLabel: "Settings", icon: Settings },
  ];

  return (
    <Sidebar variant="sidebar" className="border-r border-sidebar-border">
      {topSlot}

      <SidebarHeader className={cn("px-3 pb-3", headerClassName)} style={headerStyle}>
        <div className="flex items-center gap-3 p-2 rounded-xl bg-sidebar-accent/50 border border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity duration-200 flex-1 min-w-0">
              <div className="relative shrink-0">
                <WorkspaceAvatar name={workspace?.name ?? "M"} size="sm" />
                <div className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-gradient-to-br from-brand to-info border-2 border-sidebar" />
              </div>
              <div className="flex flex-col items-start min-w-0 flex-1">
                <span className="font-semibold text-[13px] text-sidebar-foreground truncate max-w-[100px]">
                  {workspace?.name ?? t("common.workspace", "Harness")}
                </span>
              </div>
              <ChevronRight className="size-3 text-sidebar-foreground/30 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="start" side="bottom" sideOffset={8}>
              <div className="p-3 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-gradient-to-br from-brand to-info flex items-center justify-center">
                    <Zap className="size-4 text-brand-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{user?.name}</p>
                    <p className="text-[11px] text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
              </div>
              <DropdownMenuGroup className="pt-2">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {t("sidebar.workspaces", "Workspaces")}
                </DropdownMenuLabel>
                {workspaces.map((ws) => (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={() => {
                      if (ws.id !== workspace?.id) {
                        push("/issues");
                        switchWorkspace(ws.id);
                      }
                    }}
                    className="cursor-pointer h-12 rounded-xl my-0.5"
                  >
                    <WorkspaceAvatar name={ws.name} size="sm" />
                    <span className="flex-1 truncate font-medium">{ws.name}</span>
                    {ws.id === workspace?.id && (
                      <div className="size-6 rounded-md bg-gradient-to-br from-brand to-info flex items-center justify-center">
                        <Check className="size-3.5 text-brand-foreground" />
                      </div>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => useModalStore.getState().open("create-workspace")}
                className="cursor-pointer h-12 rounded-xl text-brand hover:bg-brand/10"
              >
                <Plus className="size-4" />
                <span className="font-medium">{t("sidebar.createWorkspace", "Create workspace")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {searchSlot ? (
          <div className="mt-2">{searchSlot}</div>
        ) : (
          <div className="mt-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-sidebar-foreground/30" />
            <Input
              placeholder="Search..."
              className="h-9 pl-9 pr-3 rounded-lg bg-sidebar-accent/30 border-0 text-[12px] placeholder:text-sidebar-foreground/30 text-sidebar-foreground focus-visible:ring-1 focus-visible:ring-brand/50"
            />
          </div>
        )}

        <Button
          onClick={() => useModalStore.getState().open("create-issue")}
          className={cn(
            "mt-2 w-full h-10 cursor-pointer transition-all duration-200",
            "bg-gradient-to-r from-brand to-info hover:opacity-90",
            "text-brand-foreground font-semibold shadow-sm",
            "flex items-center gap-2 text-[12px]",
            "rounded-lg border border-sidebar-border"
          )}
        >
          <span className="relative">
            <SquarePen className="size-[14px]" />
            <DraftDot />
          </span>
          <span>{t("sidebar.newIssue", "New Issue")}</span>
          <kbd className="pointer-events-none ml-auto inline-flex h-5 shrink-0 select-none items-center gap-1 rounded border border-brand-foreground/20 bg-brand-foreground/10 px-1.5 font-mono text-[9px] font-semibold">
            C
          </kbd>
        </Button>
      </SidebarHeader>

      <SidebarContent className="px-3">
        <NavSection title={t("sidebar.workspace", "Workspace")}>
          <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-sidebar-accent/30 border border-sidebar-border">
            {navItems.slice(0, 4).map((item) => {
              const isActive = pathname === item.href;
              const label = t(item.labelKey, item.defaultLabel);
              return (
                <GridNavItem
                  key={item.href}
                  icon={item.icon}
                  label={label}
                  badge={item.badge}
                  isActive={isActive}
                  onClick={() => push(item.href)}
                />
              );
            })}
          </div>
        </NavSection>

        <NavSection title={t("sidebar.configure", "Configure")}>
          <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-sidebar-accent/30 border border-sidebar-border">
            {navItems.slice(4, 8).map((item) => {
              const isActive = pathname === item.href;
              const label = t(item.labelKey, item.defaultLabel);
              return (
                <GridNavItem
                  key={item.href}
                  icon={item.icon}
                  label={label}
                  badge={item.badge}
                  isActive={isActive}
                  onClick={() => push(item.href)}
                />
              );
            })}
          </div>
        </NavSection>

        {pinnedItems.length > 0 && (
          <NavSection title={t("sidebar.pinned", "Pinned")}>
            <div className="rounded-xl bg-sidebar-accent/30 border border-sidebar-border p-2">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={pinnedItems.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  <SidebarMenu className="gap-0.5">
                    {pinnedItems.map((pin: PinnedItem) => (
                      <SortablePinItem
                        key={pin.id}
                        pin={pin}
                        pathname={pathname}
                        onUnpin={() => deletePin.mutate({ itemType: pin.item_type, itemId: pin.item_id })}
                        t={t}
                      />
                    ))}
                  </SidebarMenu>
                </SortableContext>
              </DndContext>
            </div>
          </NavSection>
        )}
      </SidebarContent>

      <SidebarFooter className="px-3 py-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <ActorAvatar
              name={user?.name ?? ""}
              initials={(user?.name ?? "U").charAt(0).toUpperCase()}
              avatarUrl={user?.avatar_url}
              size={32}
              className="ring-2 ring-gradient-to-br from-brand to-info p-0.5"
            />
            <div className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-success border-2 border-sidebar flex items-center justify-center">
              <div className="size-1 rounded-full bg-white" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-sidebar-foreground leading-tight">
              {user?.name}
            </p>
            <p className="truncate text-[10px] text-sidebar-foreground/40 leading-tight">
              {user?.email}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="cursor-pointer flex size-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200">
              <Ellipsis className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" sideOffset={8} className="w-48">
              <DropdownMenuItem
                variant="destructive"
                onClick={logout}
                className="cursor-pointer h-11 rounded-xl"
              >
                <LogOut className="size-4" />
                <span>{t("sidebar.logout", "Log out")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
