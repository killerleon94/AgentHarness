"use client";

import { Check, FolderKanban, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { projectListOptions } from "@multica/core/projects/queries";
import { useWorkspaceId } from "@multica/core/hooks";
import type { UpdateIssueRequest } from "@multica/core/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@multica/ui/components/ui/dropdown-menu";

type TranslateFn = (key: string, fallback: string) => string;

export function ProjectPicker({
  projectId,
  onUpdate,
  triggerRender,
  align = "start",
  t,
}: {
  projectId: string | null;
  onUpdate: (updates: Partial<UpdateIssueRequest>) => void;
  triggerRender?: React.ReactElement;
  align?: "start" | "center" | "end";
  t?: TranslateFn;
}) {
  const wsId = useWorkspaceId();
  const { data: projects = [] } = useQuery(projectListOptions(wsId));
  const current = projects.find((p) => p.id === projectId);
  const defaultT = (_key: string, fallback: string) => fallback;
  const translate = t || defaultT;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={triggerRender ? undefined : "flex items-center gap-1.5 cursor-pointer rounded-lg px-2 py-1 -mx-2 hover:bg-muted/50 transition-all duration-200"}
        render={triggerRender}
      >
        <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm">{current ? current.title : translate('common.noProject', 'No project')}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56 p-1.5 shadow-xl shadow-slate-200/20 dark:shadow-slate-950/40 rounded-xl border-border/60">
        {projects.map((p) => (
          <DropdownMenuItem key={p.id} onClick={() => onUpdate({ project_id: p.id })} className="cursor-pointer rounded-lg px-2.5 py-2 text-sm">
            <span className="mr-2">{p.icon || <FolderKanban className="h-3.5 w-3.5" />}</span>
            <span className="truncate">{p.title}</span>
            {p.id === projectId && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
          </DropdownMenuItem>
        ))}
        {projects.length > 0 && projectId && <DropdownMenuSeparator />}
        {projectId && (
          <DropdownMenuItem onClick={() => onUpdate({ project_id: null })} className="cursor-pointer rounded-lg px-2.5 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30">
            <X className="h-4 w-4 mr-2 text-rose-500" />
            {translate('common.removeFromProject', 'Remove from project')}
          </DropdownMenuItem>
        )}
        {projects.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground/50">{translate('projects.emptyState.title', 'No projects yet')}</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
