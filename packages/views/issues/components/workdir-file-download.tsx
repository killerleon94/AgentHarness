"use client";

import { useState, useEffect } from "react";
import { Folder, Download, Loader2, File, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@multica/ui/components/ui/button";
import { api } from "@multica/core/api";
import { shortID } from "@multica/core/utils";
import type { AgentTask } from "@multica/core/types";
import { cn } from "@multica/ui/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@multica/ui/components/ui/tooltip";

interface WorkdirFileBrowserProps {
  workspaceId: string;
  issueId: string;
  className?: string;
}

interface FileEntry {
  name: string;
  is_dir: boolean;
  size: number;
}

export function WorkdirFileBrowser({
  workspaceId,
  issueId,
  className,
}: WorkdirFileBrowserProps) {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filesLoading, setFilesLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  const skipFiles = [".claude.json", "CLAUDE.md", ".env", ".env.local", ".gitignore", ".dockerignore", ".agent_context", "AGENTS.md"];
  const isConfigFile = (name: string) => skipFiles.some((f) => name === f || name.startsWith(f + "/"));

  useEffect(() => {
    api.listTasksByIssue(issueId).then((tasks) => {
      const completedTasks = tasks.filter(
        (t) =>
          t.status === "completed" ||
          t.status === "failed" ||
          t.status === "cancelled"
      );
      setTasks(completedTasks);
      setSelectedTask(null);
      setFiles([]);
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, [issueId]);

  useEffect(() => {
    if (!selectedTask) {
      setFiles([]);
      return;
    }
    setFilesLoading(true);
    let taskDir = "";
    const workDir = selectedTask.work_dir;
    if (workDir) {
      const parts = workDir.split("/");
      taskDir = parts[parts.length - 2];
    } else {
      taskDir = shortID(selectedTask.id);
    }
    if (!taskDir) {
      toast.error("No work directory found for this task");
      setFiles([]);
      setFilesLoading(false);
      return;
    }
    const path = `${taskDir}/workdir`;
    api.listWorkdirFiles(workspaceId, path).then((files) => {
      setFiles(files);
      setFilesLoading(false);
    }).catch((err) => {
      console.error(err);
      toast.error("Failed to load files: " + (err instanceof Error ? err.message : String(err)));
      setFiles([]);
      setFilesLoading(false);
    });
  }, [selectedTask, workspaceId]);

  const handleDownload = async (filename: string) => {
    if (!selectedTask) return;
    setDownloading(true);
    setDownloadingFile(filename);
    try {
      let taskDir = "";
      const workDir = selectedTask.work_dir;
      if (workDir) {
        const parts = workDir.split("/");
        taskDir = parts[parts.length - 2];
      } else {
        taskDir = shortID(selectedTask.id);
      }
      if (!taskDir) {
        toast.error("No work directory found for this task");
        setDownloading(false);
        return;
      }
      const path = `${taskDir}/workdir/${filename}`;
      await api.downloadWorkdirFile(workspaceId, path, filename);
      toast.success("Download started");
    } catch (err) {
      toast.error("Failed to download file");
      console.error(err);
    } finally {
      setDownloading(false);
      setDownloadingFile(null);
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

  if (tasks.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        No task runs found for this issue.
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground">Select task:</span>
        <select
          className="flex-1 text-xs border rounded px-2 py-1 bg-background"
          value={selectedTask?.id || ""}
          onChange={(e) => {
            const task = tasks.find((t) => t.id === e.target.value);
            setSelectedTask(task || null);
          }}
        >
          <option value="">-- Select task --</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {shortID(task.id)} ({task.status})
            </option>
          ))}
        </select>
      </div>

      {filesLoading ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading files...</span>
        </div>
      ) : files.length === 0 ? (
        <div className="text-sm text-muted-foreground py-2">
          No files in workdir
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto border rounded-md">
          {files.filter((f) => !isConfigFile(f.name)).map((file) => (
            <div
              key={file.name}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent/50 group"
            >
              {file.is_dir ? (
                <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <File className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className="text-sm truncate flex-1">{file.name}</span>
              {!file.is_dir && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDownload(file.name)}
                        disabled={downloading}
                      >
                        {downloadingFile === file.name ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Download className="h-3 w-3" />
                        )}
                      </Button>
                    }
                  />
                  <TooltipContent side="left">Download {file.name}</TooltipContent>
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WorkdirFileDownload({
  workspaceId,
  workDir,
  filename,
  className,
}: {
  workspaceId: string;
  workDir: string;
  filename: string;
  className?: string;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!workDir) return;
    setDownloading(true);
    try {
      const path = `${workDir}/workdir/${filename}`;
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
