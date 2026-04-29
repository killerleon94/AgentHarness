"use client";

import { useState } from "react";
import {
  Cloud,
  Monitor,
  FileText,
  BookOpenText,
  ListTodo,
  Trash2,
  AlertCircle,
  MoreHorizontal,
  Settings,
} from "lucide-react";
import type { Agent, RuntimeDevice } from "@multica/core/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@multica/ui/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@multica/ui/components/ui/dropdown-menu";
import { Button } from "@multica/ui/components/ui/button";
import { ActorAvatar } from "../../common/actor-avatar";
import { statusConfig } from "../config";
import { InstructionsTab } from "./tabs/instructions-tab";
import { SkillsTab } from "./tabs/skills-tab";
import { TasksTab } from "./tabs/tasks-tab";
import { SettingsTab } from "./tabs/settings-tab";
import { useTranslation } from "@multica/core";
import { cn } from "@multica/ui/lib/utils";

function getRuntimeDevice(agent: Agent, runtimes: RuntimeDevice[]): RuntimeDevice | undefined {
  return runtimes.find((runtime) => runtime.id === agent.runtime_id);
}

type DetailTab = "instructions" | "skills" | "tasks" | "settings";

const detailTabs: { id: DetailTab; labelKey: string; defaultLabel: string; icon: typeof FileText }[] = [
  { id: "instructions", labelKey: "agents.instructions", defaultLabel: "Instructions", icon: FileText },
  { id: "skills", labelKey: "common.skills", defaultLabel: "Skills", icon: BookOpenText },
  { id: "tasks", labelKey: "common.tasks", defaultLabel: "Tasks", icon: ListTodo },
  { id: "settings", labelKey: "common.settings", defaultLabel: "Settings", icon: Settings },
];

export function AgentDetail({
  agent,
  runtimes,
  onUpdate,
  onArchive,
  onRestore,
}: {
  agent: Agent;
  runtimes: RuntimeDevice[];
  onUpdate: (id: string, data: Partial<Agent>) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const st = statusConfig[agent.status];
  const runtimeDevice = getRuntimeDevice(agent, runtimes);
  const [activeTab, setActiveTab] = useState<DetailTab>("instructions");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const isArchived = !!agent.archived_at;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Main Header Card */}
      <div className={cn(
        "shrink-0 border-b p-6",
        isArchived ? "bg-muted/30" : "bg-gradient-to-b from-muted/20 to-transparent"
      )}>
        {/* Archive Banner */}
        {isArchived && (
          <div className="flex items-center gap-2 bg-warning/10 border border-warning/20 rounded-lg px-4 py-2.5 mb-4 -mt-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
            <span className="flex-1 text-sm text-warning">{t("agents.archivedBanner", "This agent is archived. It cannot be assigned or mentioned.")}</span>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 text-xs border-warning/30 text-warning hover:bg-warning/10"
              onClick={() => onRestore(agent.id)}
            >
              {t("common.restore", "Restore")}
            </Button>
          </div>
        )}

        {/* Agent Info Card */}
        <div className="flex items-start gap-4">
          <ActorAvatar 
            actorType="agent" 
            actorId={agent.id} 
            size={64} 
            className={cn(
              "rounded-2xl shrink-0",
              isArchived ? "opacity-60 grayscale" : ""
            )} 
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h2 className={cn(
                "text-xl font-bold truncate",
                isArchived ? "text-muted-foreground" : ""
              )}>
                {agent.name}
              </h2>
              {isArchived ? (
                <span className="shrink-0 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {t("common.archive", "Archived")}
                </span>
              ) : (
                <span className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium",
                  agent.status === "working" ? "bg-success/10 text-success" :
                  agent.status === "blocked" ? "bg-warning/10 text-warning" :
                  agent.status === "error" ? "bg-destructive/10 text-destructive" :
                  agent.status === "offline" ? "bg-muted text-muted-foreground" :
                  "bg-muted text-muted-foreground"
                )}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
                  {t(st.labelKey, st.defaultLabel)}
                </span>
              )}
              <span className={cn(
                "shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
              )}>
                {agent.runtime_mode === "cloud" ? (
                  <Cloud className="h-3.5 w-3.5" />
                ) : (
                  <Monitor className="h-3.5 w-3.5" />
                )}
                {runtimeDevice?.name ?? (agent.runtime_mode === "cloud" ? t("common.cloud", "Cloud") : t("common.local", "Local"))}
              </span>
            </div>
            
            {agent.description && (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{agent.description}</p>
            )}

            {/* Quick Stats */}
            <div className="mt-3 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <BookOpenText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{agent.skills.length}</span>
                <span className="text-xs text-muted-foreground">{t("agents.skillsCount", "skills")}</span>
              </div>
              <div className={cn(
                "flex items-center gap-1.5",
                agent.max_concurrent_tasks > 1 && "text-success"
              )}>
                <ListTodo className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{agent.max_concurrent_tasks}</span>
                <span className="text-xs text-muted-foreground">{t("agents.maxTasks", "max tasks")}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          {!isArchived && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" className="gap-2">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-auto">
                <DropdownMenuItem
                  className="text-destructive gap-2"
                  onClick={() => setConfirmArchive(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  {t("common.archiveAgent", "Archive Agent")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Tab Navigation - Pill Style */}
      <div className="shrink-0 px-6 py-4 border-b bg-background">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 w-fit">
          {detailTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {t(tab.labelKey, tab.defaultLabel)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl">
          {activeTab === "instructions" && (
            <InstructionsTab
              agent={agent}
              onSave={(instructions) => onUpdate(agent.id, { instructions })}
            />
          )}
          {activeTab === "skills" && (
            <SkillsTab agent={agent} />
          )}
          {activeTab === "tasks" && <TasksTab agent={agent} />}
          {activeTab === "settings" && (
            <SettingsTab
              agent={agent}
              runtimes={runtimes}
              onSave={(updates) => onUpdate(agent.id, updates)}
            />
          )}
        </div>
      </div>

       {/* Archive Confirmation */}
      {confirmArchive && (
        <Dialog open onOpenChange={(v) => { if (!v) setConfirmArchive(false); }}>
          <DialogContent className="max-w-sm" showCloseButton={false}>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <DialogHeader className="flex-1 gap-1">
                <DialogTitle className="text-base font-semibold">{t("agents.archiveAgentTitle", "Archive agent?")}</DialogTitle>
                <DialogDescription className="text-sm">
                  &quot;{agent.name}&quot; {t("agents.archiveAgentDescription", "will be archived. It won't be assignable or mentionable, but all history is preserved. You can restore it later.")}
                </DialogDescription>
              </DialogHeader>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setConfirmArchive(false)}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmArchive(false);
                  onArchive(agent.id);
                }}
              >
                {t("common.archive", "Archive")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}