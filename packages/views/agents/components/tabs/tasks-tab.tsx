"use client";

import { useState, useEffect } from "react";
import { ListTodo, Clock, Play, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import type { Agent, AgentTask } from "@multica/core/types";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { api } from "@multica/core/api";
import { useWorkspaceId } from "@multica/core/hooks";
import { issueListOptions } from "@multica/core/issues/queries";
import { useQuery } from "@tanstack/react-query";
import { taskStatusConfig } from "../../config";
import { useTranslation } from "@multica/core";
import { cn } from "@multica/ui/lib/utils";

export function TasksTab({ agent }: { agent: Agent }) {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const wsId = useWorkspaceId();
  const { data: issues = [] } = useQuery(issueListOptions(wsId));

  useEffect(() => {
    setLoading(true);
    api
      .listAgentTasks(agent.id)
      .then(setTasks)
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [agent.id]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border p-4">
            <Skeleton className="h-5 w-5 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  const activeStatuses = ["running", "dispatched", "queued"];
  const sortedTasks = [...tasks].sort((a, b) => {
    const aActive = activeStatuses.indexOf(a.status);
    const bActive = activeStatuses.indexOf(b.status);
    const aIsActive = aActive !== -1;
    const bIsActive = bActive !== -1;
    if (aIsActive && !bIsActive) return -1;
    if (!aIsActive && bIsActive) return 1;
    if (aIsActive && bIsActive) return aActive - bActive;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const issueMap = new Map(issues.map((i) => [i.id, i]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-br from-primary/5 to-muted/30 border border-primary/10">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">{t("agents.taskQueue", "Task Queue")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("agents.taskQueueDescription", "Issues assigned to this agent and their execution status.")}
          </p>
        </div>
        {tasks.length > 0 && (
          <div className="shrink-0 rounded-xl bg-muted px-3 py-1.5">
            <span className="text-sm font-semibold">{tasks.length}</span>
            <span className="text-xs text-muted-foreground ml-1">
              {t("agents.taskCount", "tasks")}
            </span>
          </div>
        )}
      </div>

      {/* Tasks List */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <ListTodo className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="mt-4 text-sm font-medium text-muted-foreground">{t("agents.noTasksInQueue", "No tasks in queue")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("agents.assignIssueToGetStarted", "Assign an issue to this agent to get started.")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedTasks.map((task) => {
            const config = taskStatusConfig[task.status] ?? taskStatusConfig.queued!;
            const Icon = config.icon;
            const issue = issueMap.get(task.issue_id);
            const isActive = task.status === "running" || task.status === "dispatched";
            const isRunning = task.status === "running";

            return (
              <div
                key={task.id}
                className={cn(
                  "group relative flex items-center gap-4 rounded-xl border bg-background p-4 transition-all hover:shadow-sm",
                  isRunning
                    ? "border-success/30 bg-success/5"
                    : task.status === "dispatched"
                      ? "border-info/30 bg-info/5"
                      : "border-border hover:border-primary/20"
                )}
              >
                {/* Status Icon */}
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  isRunning 
                    ? "bg-success/10" 
                    : task.status === "dispatched"
                      ? "bg-info/10"
                      : task.status === "completed"
                        ? "bg-success/10"
                        : task.status === "failed"
                          ? "bg-destructive/10"
                          : "bg-muted"
                )}>
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      config.color,
                      isRunning ? "animate-spin" : ""
                    )}
                  />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {issue && (
                      <span className="shrink-0 text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {issue.identifier}
                      </span>
                    )}
                    <span className={cn(
                      "text-sm font-medium truncate",
                      isActive ? "" : "text-muted-foreground"
                    )}>
                      {issue?.title ?? `Issue ${task.issue_id.slice(0, 8)}...`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {isRunning && task.started_at ? (
                      <>
                        <Clock className="h-3 w-3" />
                        <span>Started {new Date(task.started_at).toLocaleString()}</span>
                      </>
                    ) : task.status === "dispatched" && task.dispatched_at ? (
                      <>
                        <Play className="h-3 w-3" />
                        <span>Dispatched {new Date(task.dispatched_at).toLocaleString()}</span>
                      </>
                    ) : task.status === "completed" && task.completed_at ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Completed {new Date(task.completed_at).toLocaleString()}</span>
                      </>
                    ) : task.status === "failed" && task.completed_at ? (
                      <>
                        <XCircle className="h-3 w-3" />
                        <span>Failed {new Date(task.completed_at).toLocaleString()}</span>
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3" />
                        <span>Queued {new Date(task.created_at).toLocaleString()}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status Badge */}
                <span className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs font-medium",
                  task.status === "running" ? "bg-success/10 text-success" :
                  task.status === "dispatched" ? "bg-info/10 text-info" :
                  task.status === "completed" ? "bg-success/10 text-success" :
                  task.status === "failed" ? "bg-destructive/10 text-destructive" :
                  "bg-muted text-muted-foreground"
                )}>
                  {t(config.labelKey, config.defaultLabel)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}