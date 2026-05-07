"use client";

import { useState, useEffect, useMemo } from "react";
import { Folder, Download, Loader2, File, FolderOpen, CheckSquare, Square, Archive, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@multica/ui/components/ui/button";
import { api } from "@multica/core/api";
import { shortID } from "@multica/core/utils";
import { cn } from "@multica/ui/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@multica/ui/components/ui/tooltip";

type TranslateFn = (key: string, fallback: string) => string;

interface WorkdirFileBrowserProps {
  workspaceId: string;
  issueId: string;
  className?: string;
  t?: TranslateFn;
}

interface FileEntry {
  name: string;
  is_dir: boolean;
  size: number;
  path: string;
}

interface TaskFiles {
  task_id: string;
  task_status: string;
  work_dir: string;
  files: FileEntry[];
}

interface IssueWorkdirResponse {
  tasks: TaskFiles[];
}

const skipFiles = [".claude.json", "CLAUDE.md", ".env", ".env.local", ".gitignore", ".dockerignore", ".agent_context", "AGENTS.md"];
const isConfigFile = (name: string) => skipFiles.some((f) => name === f || name.startsWith(f + "/"));

export function WorkdirFileBrowser({
  workspaceId,
  issueId,
  className,
  t,
}: WorkdirFileBrowserProps) {
  const defaultT = (_key: string, fallback: string) => fallback;
  const translate = t || defaultT;
  const [taskData, setTaskData] = useState<TaskFiles[]>([]);
  const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.getIssueWorkdirFiles(issueId).then((res: IssueWorkdirResponse) => {
      setTaskData(res.tasks || []);
      setCollapsedTasks(new Set());
      setSelectedFiles(new Set());
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoading(false);
      toast.error("Failed to load workdir files");
    });
  }, [issueId]);

  const allFiles = useMemo(() => {
    const files: (FileEntry & { task_id: string })[] = [];
    for (const task of taskData) {
      for (const file of task.files) {
        if (!isConfigFile(file.name)) {
          files.push({ ...file, task_id: task.task_id });
        }
      }
    }
    return files;
  }, [taskData]);

  const visibleFiles = allFiles.filter((f) => !isConfigFile(f.name));
  const allSelected = visibleFiles.length > 0 && selectedFiles.size === visibleFiles.length;

  const toggleTaskCollapse = (taskId: string) => {
    setCollapsedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const toggleFileSelection = (filePath: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedFiles.size === visibleFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(visibleFiles.map((f) => f.path)));
    }
  };

  const handleDownload = async (file: FileEntry) => {
    setDownloading(true);
    try {
      await api.downloadWorkdirFile(workspaceId, file.path, file.name);
      toast.success("Download started");
    } catch (err) {
      toast.error("Failed to download file");
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  const handleFolderDownload = async (file: FileEntry) => {
    setDownloading(true);
    try {
      await api.downloadWorkdirFolderAsZip(workspaceId, file.path);
      toast.success("Download started");
    } catch (err) {
      toast.error("Failed to download folder");
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  const handleBatchDownload = async () => {
    if (selectedFiles.size === 0) return;
    setDownloading(true);
    try {
      for (const filePath of selectedFiles) {
        const file = allFiles.find((f) => f.path === filePath);
        if (!file) continue;
        if (file.is_dir) {
          await api.downloadWorkdirFolderAsZip(workspaceId, filePath);
        } else {
          await api.downloadWorkdirFile(workspaceId, filePath, file.name);
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      toast.success(`Downloaded ${selectedFiles.size} items`);
    } catch (err) {
      toast.error("Failed to download some files");
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (taskData.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        {translate('issueDetail.labels.noTaskRunsFound', 'No task runs found for this issue')}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground flex-1">
          {translate('issueDetail.labels.workdirFiles', 'Workdir files from task runs')}
        </span>
        {selectedFiles.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs"
            onClick={handleBatchDownload}
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Archive className="h-3 w-3 mr-1" />
            )}
            Download ({selectedFiles.size})
          </Button>
        )}
      </div>

      <div className="max-h-64 overflow-y-auto border rounded-md">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/30">
          <button
            onClick={selectAll}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {allSelected ? (
              <CheckSquare className="h-3.5 w-3.5" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            <span>Select all</span>
          </button>
        </div>

        {taskData.map((task) => {
          const isCollapsed = collapsedTasks.has(task.task_id);
          return (
            <div key={task.task_id}>
              <button
                onClick={() => toggleTaskCollapse(task.task_id)}
                className="flex items-center gap-2 px-3 py-1.5 w-full text-left hover:bg-accent/50"
              >
                <ChevronRight className={cn("h-3 w-3 text-muted-foreground transition-transform", !isCollapsed && "rotate-90")} />
                <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium truncate flex-1">
                  {shortID(task.task_id)} ({task.task_status})
                </span>
                <span className="text-xs text-muted-foreground">
                  {task.files.filter((f) => !isConfigFile(f.name)).length} files
                </span>
              </button>
              {!isCollapsed && task.files
                .filter((f) => !isConfigFile(f.name))
                .map((file) => (
                  <div
                    key={file.path}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent/50 group"
                    style={{ paddingLeft: "32px" }}
                  >
                    <button
                      onClick={() => toggleFileSelection(file.path)}
                      className="shrink-0"
                    >
                      {selectedFiles.has(file.path) ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <button className="flex-1 text-left flex items-center gap-2 min-w-0">
                      {file.is_dir ? (
                        <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <File className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm truncate">{file.name}</span>
                    </button>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={() => file.is_dir ? handleFolderDownload(file) : handleDownload(file)}
                            disabled={downloading}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        }
                      />
                      <TooltipContent side="left">
                        {file.is_dir ? `Download ${file.name}/` : `Download ${file.name}`}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WorkdirFileDownload({
  workspaceId,
  workdirPath,
  filename,
  className,
}: {
  workspaceId: string;
  workdirPath: string;
  filename: string;
  className?: string;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!workdirPath) return;
    setDownloading(true);
    try {
      const path = `${workdirPath}/${filename}`;
      await api.downloadWorkdirFile(workspaceId, path, filename);
    } catch (err) {
      toast.error("Failed to download file");
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={className}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownload}
        disabled={downloading}
      >
        {downloading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        <span className="ml-2">{filename}</span>
      </Button>
    </div>
  );
}
