"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Plus, FolderKanban, ChevronRight, Maximize2, Minimize2, X as XIcon, UserMinus, LayoutGrid, List, ArrowUpDown, CalendarDays, TrendingUp, CheckCircle2, Clock, Pause, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { projectListOptions } from "@multica/core/projects/queries";
import { useCreateProject } from "@multica/core/projects/mutations";
import { PROJECT_STATUS_CONFIG, PROJECT_STATUS_ORDER, PROJECT_PRIORITY_CONFIG, PROJECT_PRIORITY_ORDER } from "@multica/core/projects/config";
import { useWorkspaceId } from "@multica/core/hooks";
import { useWorkspaceStore } from "@multica/core/workspace";
import { memberListOptions, agentListOptions } from "@multica/core/workspace/queries";
import { AppLink, useNavigation } from "../../navigation";
import { ActorAvatar } from "../../common/actor-avatar";
import { useActorName } from "@multica/core/workspace/hooks";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { Button } from "@multica/ui/components/ui/button";
import { cn } from "@multica/ui/lib/utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@multica/ui/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@multica/ui/components/ui/dropdown-menu";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@multica/ui/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent } from "@multica/ui/components/ui/tooltip";
import { ContentEditor, type ContentEditorRef } from "../../editor";
import { TitleEditor } from "../../editor";
import { EmojiPicker } from "@multica/ui/components/common/emoji-picker";
import type { Project, ProjectStatus, ProjectPriority } from "@multica/core/types";
import { PriorityIcon } from "../../issues/components/priority-icon";
import { useTranslation } from "@multica/core";

type TranslateFn = (key: string, fallback: string) => string;

type ViewMode = "grid" | "list";

function getStatusDictKey(status: ProjectStatus): string {
  const map: Record<string, string> = {
    'planned': 'planned',
    'in_progress': 'inProgress',
    'paused': 'paused',
    'completed': 'completed',
    'cancelled': 'cancelled',
  };
  return map[status] || status;
}

function getPriorityDictKey(priority: ProjectPriority): string {
  const map: Record<string, string> = {
    'urgent': 'urgent',
    'high': 'high',
    'medium': 'medium',
    'low': 'low',
    'none': 'noPriority',
  };
  return map[priority] || priority;
}

const StatusIcon = ({ status, className }: { status: ProjectStatus; className?: string }) => {
  const icons: Record<ProjectStatus, React.ReactNode> = {
    planned: <Clock className={cn("size-3.5", className)} />,
    in_progress: <TrendingUp className={cn("size-3.5", className)} />,
    paused: <Pause className={cn("size-3.5", className)} />,
    completed: <CheckCircle2 className={cn("size-3.5", className)} />,
    cancelled: <XCircle className={cn("size-3.5", className)} />,
  };
  return icons[status] || null;
};

function ProjectCard({ project, t }: { project: Project; t?: TranslateFn }) {
  const defaultT = (_key: string, fallback: string) => fallback;
  const translate = t || defaultT;
  
  const formatRelativeDate = (date: string): string => {
    const diff = Date.now() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 1) return translate('projects.relativeTime.today', 'Today');
    if (days === 1) return translate('projects.relativeTime.daysAgo', '1d ago').replace('{days}', '1');
    if (days < 30) return translate('projects.relativeTime.daysAgo', '{days}d ago').replace('{days}', String(days));
    const months = Math.floor(days / 30);
    return translate('projects.relativeTime.monthsAgo', '{months}mo ago').replace('{months}', String(months));
  };
  
  const statusCfg = PROJECT_STATUS_CONFIG[project.status];
  const priorityCfg = PROJECT_PRIORITY_CONFIG[project.priority];
  const progress = project.issue_count > 0 ? Math.round((project.done_count / project.issue_count) * 100) : 0;

  return (
    <AppLink
      href={`/projects/${project.id}`}
      className="group/card relative flex flex-col p-5 rounded-2xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer overflow-hidden"
    >
      {/* Background gradient accent */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />
      
      {/* Content */}
      <div className="relative flex items-start gap-4">
        {/* Icon */}
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 group-hover/card:border-primary/30 group-hover/card:bg-primary/15 transition-all duration-300">
          {project.icon ? (
            <span className="text-xl">{project.icon}</span>
          ) : (
            <FolderKanban className="size-6 text-primary/60" />
          )}
        </div>
        
        {/* Title and meta */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base truncate group-hover/card:text-primary transition-colors duration-200">{project.title}</h3>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3" />
              {formatRelativeDate(project.created_at)}
            </span>
            {project.lead_type && project.lead_id && (
              <ActorAvatar actorType={project.lead_type} actorId={project.lead_id} size={16} className="ring-1 ring-background" />
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="relative flex items-center gap-4 mt-4 pt-4 border-t border-border/40">
        {/* Priority */}
        <div className="flex items-center gap-1.5">
          <PriorityIcon priority={project.priority} />
          <span className={cn("text-xs font-medium", priorityCfg.color)}>
            {translate(`projects.priorities.${getPriorityDictKey(project.priority)}`, priorityCfg.label)}
          </span>
        </div>

        {/* Status */}
        <div className={cn(
          "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
          statusCfg.badgeBg, statusCfg.badgeText
        )}>
          <StatusIcon status={project.status} className="size-3" />
          {translate(`projects.statuses.${getStatusDictKey(project.status)}`, statusCfg.label)}
        </div>

        {/* Progress */}
        {project.issue_count > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums font-medium">
              {project.done_count}/{project.issue_count}
            </span>
          </div>
        )}
      </div>

      {/* Lead avatar (bottom right) */}
      {project.lead_type && project.lead_id && (
        <div className="absolute bottom-4 right-4 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300">
          <ActorAvatar actorType={project.lead_type} actorId={project.lead_id} size={24} className="ring-2 ring-background" />
        </div>
      )}
    </AppLink>
  );
}

function ProjectRow({ project, t }: { project: Project; t?: TranslateFn }) {
  const defaultT = (_key: string, fallback: string) => fallback;
  const translate = t || defaultT;
  
  const formatRelativeDate = (date: string): string => {
    const diff = Date.now() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 1) return translate('projects.relativeTime.today', 'Today');
    if (days === 1) return translate('projects.relativeTime.daysAgo', '1d ago').replace('{days}', '1');
    if (days < 30) return translate('projects.relativeTime.daysAgo', '{days}d ago').replace('{days}', String(days));
    const months = Math.floor(days / 30);
    return translate('projects.relativeTime.monthsAgo', '{months}mo ago').replace('{months}', String(months));
  };
  
  const statusCfg = PROJECT_STATUS_CONFIG[project.status];
  const priorityCfg = PROJECT_PRIORITY_CONFIG[project.priority];
  
  return (
    <AppLink
      href={`/projects/${project.id}`}
      className="group/row flex items-center gap-4 px-5 py-4 border-b border-border/30 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent transition-all duration-200 cursor-pointer"
    >
      {/* Icon + Name */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 group-hover/row:border-primary/30 group-hover/row:bg-primary/10 transition-all duration-200">
          {project.icon ? (
            <span className="text-base">{project.icon}</span>
          ) : (
            <FolderKanban className="size-5 text-primary/60" />
          )}
        </div>
        <span className="font-medium truncate group-hover/row:text-primary transition-colors duration-200">{project.title}</span>
      </div>

      {/* Priority */}
      <div className="flex items-center gap-1.5 w-28 shrink-0">
        <PriorityIcon priority={project.priority} />
        <span className={cn("text-xs font-medium", priorityCfg.color)}>
          {translate(`projects.priorities.${getPriorityDictKey(project.priority)}`, priorityCfg.label)}
        </span>
      </div>

      {/* Status */}
      <div className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium w-32 shrink-0",
        statusCfg.badgeBg, statusCfg.badgeText
      )}>
        <StatusIcon status={project.status} />
        {translate(`projects.statuses.${getStatusDictKey(project.status)}`, statusCfg.label)}
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 w-32 shrink-0">
        {project.issue_count > 0 ? (
          <>
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${Math.round((project.done_count / project.issue_count) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums font-medium w-12 text-right">
              {project.done_count}/{project.issue_count}
            </span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">--</span>
        )}
      </div>

      {/* Lead */}
      <div className="w-10 shrink-0 flex items-center justify-center">
        {project.lead_type && project.lead_id ? (
          <ActorAvatar actorType={project.lead_type} actorId={project.lead_id} size={24} className="group-hover/row:ring-2 group-hover/row:ring-primary/20 transition-all duration-200" />
        ) : (
          <div className="size-6 rounded-full border border-dashed border-muted-foreground/20" />
        )}
      </div>

      {/* Created */}
      <div className="w-24 shrink-0 text-right">
        <span className="text-xs text-muted-foreground tabular-nums">{formatRelativeDate(project.created_at)}</span>
      </div>
    </AppLink>
  );
}

function PillButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
        "hover:bg-accent/60 transition-colors cursor-pointer",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function CreateProjectDialog({ open, onOpenChange, t: tProp }: { open: boolean; onOpenChange: (open: boolean) => void; t?: TranslateFn }) {
  const defaultT = (_key: string, fallback: string) => fallback;
  const t = tProp || defaultT;
  
  const router = useNavigation();
  const workspaceName = useWorkspaceStore((s) => s.workspace?.name);
  const wsId = useWorkspaceId();
  const { data: members = [] } = useQuery(memberListOptions(wsId));
  const { data: agents = [] } = useQuery(agentListOptions(wsId));
  const { getActorName } = useActorName();

  const [title, setTitle] = useState("");
  const titleRef = useRef(title);
  const descEditorRef = useRef<ContentEditorRef>(null);
  
  // Keep titleRef in sync with title state
  useEffect(() => {
    titleRef.current = title;
  }, [title]);
  const [status, setStatus] = useState<ProjectStatus>("planned");
  const [priority, setPriority] = useState<ProjectPriority>("none");
  const [leadType, setLeadType] = useState<"member" | "agent" | undefined>();
  const [leadId, setLeadId] = useState<string | undefined>();
  const [icon, setIcon] = useState<string | undefined>();
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Lead popover
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadFilter, setLeadFilter] = useState("");

  const leadQuery = leadFilter.toLowerCase();
  const filteredMembers = members.filter((m) => m.name.toLowerCase().includes(leadQuery));
  const filteredAgents = agents.filter((a) => !a.archived_at && a.name.toLowerCase().includes(leadQuery));

  const leadLabel =
    leadType && leadId ? getActorName(leadType, leadId) : t('projects.createDialog.lead', 'Lead');

  const createProject = useCreateProject();

  const handleSubmit = async () => {
    const titleText = titleRef.current;
    if (!titleText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const project = await createProject.mutateAsync({
        title: titleText.trim(),
        description: descEditorRef.current?.getMarkdown()?.trim() || undefined,
        icon,
        status,
        priority,
        lead_type: leadType,
        lead_id: leadId,
      });
      onOpenChange(false);
      setTitle("");
      setIcon(undefined);
      setStatus("planned");
      setPriority("none");
      setLeadType(undefined);
      setLeadId(undefined);
      toast.success(t('projects.toast.created', 'Project created'));
      router.push(`/projects/${project.id}`);
    } catch {
      toast.error(t('projects.errors.createFailed', 'Failed to create project'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "p-0 gap-0 flex flex-col overflow-hidden",
          "!top-1/2 !left-1/2 !-translate-x-1/2",
          "!transition-all !duration-300 !ease-out",
          isExpanded
            ? "!max-w-4xl !w-full !h-5/6 !-translate-y-1/2"
            : "!max-w-2xl !w-full !h-96 !-translate-y-1/2",
        )}
      >
        <DialogTitle className="sr-only">{t('projects.createDialog.title', 'New Project')}</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">{workspaceName}</span>
            <ChevronRight className="size-3 text-muted-foreground/50" />
            <span className="font-medium">{t('projects.newProject', 'New project')}</span>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="rounded-sm p-1.5 opacity-70 hover:opacity-100 hover:bg-accent/60 transition-all cursor-pointer"
                  >
                    {isExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                  </button>
                }
              />
              <TooltipContent side="bottom">{isExpanded ? t('projects.createDialog.collapse', 'Collapse') : t('projects.createDialog.expand', 'Expand')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={() => onOpenChange(false)}
                    className="rounded-sm p-1.5 opacity-70 hover:opacity-100 hover:bg-accent/60 transition-all cursor-pointer"
                  >
                    <XIcon className="size-4" />
                  </button>
                }
              />
              <TooltipContent side="bottom">{t('projects.createDialog.close', 'Close')}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Icon + Title */}
        <div className="px-5 pb-2 shrink-0">
          <Popover open={iconPickerOpen} onOpenChange={setIconPickerOpen}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className="text-2xl cursor-pointer rounded-lg p-1 -ml-1 hover:bg-accent/60 transition-colors"
                  title={t('projects.createDialog.chooseIcon', 'Choose icon')}
                >
                  {icon || "📁"}
                </button>
              }
            />
            <PopoverContent align="start" className="w-auto p-0">
              <EmojiPicker
                onSelect={(emoji) => {
                  setIcon(emoji);
                  setIconPickerOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
          <TitleEditor
            autoFocus
            defaultValue=""
            placeholder={t('projects.createDialog.titlePlaceholder', 'Project title')}
            className="text-lg font-semibold"
            onChange={(v) => setTitle(v)}
            onSubmit={handleSubmit}
          />
        </div>

        {/* Description */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5">
          <ContentEditor
            ref={descEditorRef}
            defaultValue=""
            placeholder={t('projects.createDialog.descriptionPlaceholder', 'Add description...')}
            debounceMs={500}
          />
        </div>

        {/* Property toolbar */}
        <div className="flex items-center gap-1.5 px-4 py-2 shrink-0 flex-wrap">
          {/* Status */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <PillButton>
                  <span className={cn("size-2 rounded-full", PROJECT_STATUS_CONFIG[status].dotColor)} />
                  <span>{t(`projects.statuses.${getStatusDictKey(status)}`, PROJECT_STATUS_CONFIG[status].label)}</span>
                </PillButton>
              }
            />
            <DropdownMenuContent align="start" className="w-44">
              {PROJECT_STATUS_ORDER.map((s) => (
                <DropdownMenuItem key={s} onClick={() => setStatus(s)}>
                  <span className={cn("size-2 rounded-full", PROJECT_STATUS_CONFIG[s].dotColor)} />
                  <span>{t(`projects.statuses.${getStatusDictKey(s)}`, PROJECT_STATUS_CONFIG[s].label)}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Priority */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <PillButton>
                  <PriorityIcon priority={priority} />
                  <span>{t(`projects.priorities.${getPriorityDictKey(priority)}`, PROJECT_PRIORITY_CONFIG[priority].label)}</span>
                </PillButton>
              }
            />
            <DropdownMenuContent align="start" className="w-44">
              {PROJECT_PRIORITY_ORDER.map((p) => (
                <DropdownMenuItem key={p} onClick={() => setPriority(p)}>
                  <PriorityIcon priority={p} />
                  <span>{t(`projects.priorities.${getPriorityDictKey(p)}`, PROJECT_PRIORITY_CONFIG[p].label)}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Lead */}
          <Popover open={leadOpen} onOpenChange={(v) => { setLeadOpen(v); if (!v) setLeadFilter(""); }}>
            <PopoverTrigger
              render={
                <PillButton>
                  {leadType && leadId ? (
                    <>
                      <ActorAvatar actorType={leadType} actorId={leadId} size={16} />
                      <span>{leadLabel}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">{t('projects.createDialog.lead', 'Lead')}</span>
                  )}
                </PillButton>
              }
            />
            <PopoverContent align="start" className="w-52 p-0">
              <div className="px-2 py-1.5 border-b">
                <input
                  type="text"
                  value={leadFilter}
                  onChange={(e) => setLeadFilter(e.target.value)}
                  placeholder={t('projects.createDialog.lead', 'Lead') + "..."}
                  className="w-full bg-transparent text-sm placeholder:text-muted-foreground outline-none"
                />
              </div>
              <div className="p-1 max-h-60 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => { setLeadType(undefined); setLeadId(undefined); setLeadOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                >
                  <UserMinus className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{t('projects.createDialog.noLead', 'No lead')}</span>
                </button>
                {filteredMembers.length > 0 && (
                  <>
                    <div className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('projects.createDialog.members', 'Members')}</div>
                    {filteredMembers.map((m) => (
                      <button
                        type="button"
                        key={m.user_id}
                        onClick={() => { setLeadType("member"); setLeadId(m.user_id); setLeadOpen(false); }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                      >
                        <ActorAvatar actorType="member" actorId={m.user_id} size={16} />
                        <span>{m.name}</span>
                      </button>
                    ))}
                  </>
                )}
                {filteredAgents.length > 0 && (
                  <>
                    <div className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('projects.createDialog.agents', 'Agents')}</div>
                    {filteredAgents.map((a) => (
                      <button
                        type="button"
                        key={a.id}
                        onClick={() => { setLeadType("agent"); setLeadId(a.id); setLeadOpen(false); }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                      >
                        <ActorAvatar actorType="agent" actorId={a.id} size={16} />
                        <span>{a.name}</span>
                      </button>
                    ))}
                  </>
                )}
                {filteredMembers.length === 0 && filteredAgents.length === 0 && leadFilter && (
                  <div className="px-2 py-3 text-center text-sm text-muted-foreground">{t('projects.createDialog.noResults', 'No results')}</div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-4 py-3 border-t shrink-0">
          <Button 
            size="sm" 
            onClick={handleSubmit} 
            disabled={!titleRef.current.trim() || submitting}
          >
            {submitting ? t('projects.createDialog.creating', 'Creating...') : t('projects.createDialog.create', 'Create Project')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectsPage({ t: tProp }: { t?: TranslateFn }) {
  const { t: defaultT } = useTranslation();
  const t = tProp || defaultT;
  
  const wsId = useWorkspaceId();
  const { data: projects = [], isLoading } = useQuery(projectListOptions(wsId));
  const [createOpen, setCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<"newest" | "progress" | "name">("newest");

  const sortedProjects = useMemo(() => {
    const sorted = [...projects];
    switch (sortBy) {
      case "name":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "progress":
        sorted.sort((a, b) => {
          const aProgress = a.issue_count > 0 ? a.done_count / a.issue_count : 0;
          const bProgress = b.issue_count > 0 ? b.done_count / b.issue_count : 0;
          return bProgress - aProgress;
        });
        break;
      case "newest":
      default:
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }
    return sorted;
  }, [projects, sortBy]);

  const stats = {
    total: sortedProjects.length,
    inProgress: sortedProjects.filter(p => p.status === 'in_progress').length,
    completed: sortedProjects.filter(p => p.status === 'completed').length,
    totalIssues: sortedProjects.reduce((acc, p) => acc + p.issue_count, 0),
    totalDone: sortedProjects.reduce((acc, p) => acc + p.done_count, 0),
  };

  return (
    <div className="flex h-full flex-col bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header bar - modern design */}
      <div className="shrink-0 border-b border-border/60 bg-card/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 py-4">
          {/* Left: Title + Stats */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                <FolderKanban className="size-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">{t('projects.title', 'Projects')}</h1>
                <p className="text-xs text-muted-foreground">
                  {stats.total} {t('projects.stats.projects', 'projects')}
                </p>
              </div>
            </div>
            
            {/* Stats pills */}
            {!isLoading && projects.length > 0 && (
              <div className="hidden md:flex items-center gap-2 ml-4 pl-4 border-l border-border/40">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20">
                  <TrendingUp className="size-3.5 text-blue-500" />
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{stats.inProgress}</span>
                  <span className="text-xs text-blue-500/70">{t('projects.stats.inProgress', 'In Progress')}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{stats.completed}</span>
                  <span className="text-xs text-emerald-500/70">{t('projects.stats.completed', 'Completed')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex items-center gap-0.5 p-1 rounded-xl bg-muted/40 border border-border/40">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      onClick={() => setViewMode("grid")}
                      className={cn(
                        "p-1.5 rounded-lg transition-all duration-200 cursor-pointer",
                        viewMode === "grid"
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      )}
                    >
                      <LayoutGrid className="size-4" />
                    </button>
                  }
                />
                <TooltipContent side="bottom">{t('projects.view.grid', 'Grid view')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      onClick={() => setViewMode("list")}
                      className={cn(
                        "p-1.5 rounded-lg transition-all duration-200 cursor-pointer",
                        viewMode === "list"
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      )}
                    >
                      <List className="size-4" />
                    </button>
                  }
                />
                <TooltipContent side="bottom">{t('projects.view.list', 'List view')}</TooltipContent>
              </Tooltip>
            </div>

            {/* Sort dropdown */}
            <DropdownMenu>
              <Tooltip>
                <DropdownMenuTrigger
                  render={
                    <TooltipTrigger
                      render={
                        <Button variant="outline" size="sm" className="h-8 gap-2 text-xs font-medium">
                          <ArrowUpDown className="size-3.5" />
                          <span className="hidden sm:inline">{t('projects.sort', 'Sort')}</span>
                        </Button>
                      }
                    />
                  }
                />
                <TooltipContent side="bottom">{t('projects.sort', 'Sort')}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setSortBy("newest")} className={cn("cursor-pointer text-xs", sortBy === "newest" && "bg-accent")}>
                  <CalendarDays className="size-3.5 mr-2" />
                  {t('projects.sortOptions.newest', 'Newest')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("progress")} className={cn("cursor-pointer text-xs", sortBy === "progress" && "bg-accent")}>
                  <TrendingUp className="size-3.5 mr-2" />
                  {t('projects.sortOptions.progress', 'Progress')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("name")} className={cn("cursor-pointer text-xs", sortBy === "name" && "bg-accent")}>
                  <span className="mr-2">🔤</span>
                  {t('projects.sortOptions.name', 'Name')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Create button */}
            <Button 
              size="sm" 
              className="h-8 bg-gradient-to-r from-primary to-primary/90 hover:opacity-90 shadow-sm font-medium cursor-pointer"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4 mr-1.5" />
              {t('projects.createProject', 'New project')}
            </Button>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-6">
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-48 rounded-2xl" >
                    <Skeleton className="h-full w-full rounded-2xl" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            )}
          </div>
        ) : projects.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 px-4">
            <div className="relative mb-6">
              <div className="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                <FolderKanban className="size-10 text-primary/60" />
              </div>
              <div className="absolute -bottom-1 -right-1 size-8 items-center justify-center rounded-full bg-primary/10 border border-primary/20 flex">
                <Plus className="size-4 text-primary" />
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-2">{t('projects.emptyState.title', 'No projects yet')}</h3>
            <p className="text-sm text-muted-foreground text-center max-w-xs mb-6">
              {t('projects.emptyState.subtitle', 'Create your first project to get started organizing your work.')}
            </p>
            <Button 
              className="bg-gradient-to-r from-primary to-primary/90 hover:opacity-90 shadow-sm cursor-pointer"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4 mr-2" />
              {t('projects.emptyState.action', 'Create your first project')}
            </Button>
          </div>
        ) : (
          <>
            {viewMode === "grid" ? (
              /* Grid view */
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {sortedProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} t={t} />
                  ))}
                </div>
              </div>
            ) : (
              /* List view */
              <div className="px-6 py-4">
                {/* Column headers */}
                <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-muted/30 border border-border/40 mb-4 text-xs font-medium text-muted-foreground">
                  <div className="flex-1">{t('projects.columns.name', 'Name')}</div>
                  <div className="w-28">{t('projects.columns.priority', 'Priority')}</div>
                  <div className="w-32">{t('projects.columns.status', 'Status')}</div>
                  <div className="w-32">{t('projects.columns.progress', 'Progress')}</div>
                  <div className="w-10">{t('projects.columns.lead', 'Lead')}</div>
                  <div className="w-24 text-right">{t('projects.columns.created', 'Created')}</div>
                </div>
                {/* Rows */}
                <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
                  {sortedProjects.map((project) => (
                    <ProjectRow key={project.id} project={project} t={t} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} t={t} />
    </div>
  );
}
