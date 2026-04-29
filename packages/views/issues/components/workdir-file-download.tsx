"use client";

import { useState, useEffect } from "react";
import { Folder, Download, Loader2, File, FolderOpen, ChevronLeft, CheckSquare, Square, Archive } from "lucide-react";
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
}

export function WorkdirFileBrowser({
  workspaceId,
  issueId,
  className,
  t,
}: WorkdirFileBrowserProps) {
  const defaultT = (_key: string, fallback: string) => fallback;
  const translate = t || defaultT;
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [pathStack, setPathStack] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filesLoading, setFilesLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const skipFiles = [".claude.json", "CLAUDE.md", ".env", ".env.local", ".gitignore", ".dockerignore", ".agent_context", "AGENTS.md"];
  const isConfigFile = (name: string) => skipFiles.some((f) => name === f || name.startsWith(f + "/"));

  const getTaskDir = () => {
    if (!selectedTask) return "";
    const workDir = selectedTask.work_dir;
    if (workDir) {
      const parts = workDir.split("/");
      return parts[parts.length - 2];
    }
    return shortID(selectedTask.id);
  };

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
      setCurrentPath("");
      setPathStack([]);
      setSelectedFiles(new Set());
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, [issueId]);

  useEffect(() => {
    if (!selectedTask) {
      setFiles([]);
      setCurrentPath("");
      setPathStack([]);
      return;
    }
    const taskDir = getTaskDir();
    if (!taskDir) {
      toast.error("No work directory found for this task");
      setFiles([]);
      setFilesLoading(false);
      return;
    }
    setFilesLoading(true);
    setCurrentPath(taskDir);
    setPathStack([]);
    setSelectedFiles(new Set());
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

  const loadDirectory = (dirPath: string) => {
    const taskDir = getTaskDir();
    if (!taskDir) return;
    setFilesLoading(true);
    setSelectedFiles(new Set());
    const newPath = `${taskDir}/workdir/${dirPath}`;
    setCurrentPath(newPath);
    setPathStack((prev) => [...prev, dirPath]);
    api.listWorkdirFiles(workspaceId, newPath).then((files) => {
      setFiles(files);
      setFilesLoading(false);
    }).catch((err) => {
      console.error(err);
      toast.error("Failed to load directory");
      setFilesLoading(false);
    });
  };

  const navigateBack = () => {
    if (pathStack.length === 0) {
      const taskDir = getTaskDir();
      if (!taskDir) return;
      setFilesLoading(true);
      setCurrentPath(`${taskDir}/workdir`);
      setPathStack([]);
      setSelectedFiles(new Set());
      api.listWorkdirFiles(workspaceId, `${taskDir}/workdir`).then((files) => {
        setFiles(files);
        setFilesLoading(false);
      });
      return;
    }
    const taskDir = getTaskDir();
    if (!taskDir) return;
    setFilesLoading(true);
    const newStack = [...pathStack];
    newStack.pop();
    setPathStack(newStack);
    const basePath = newStack.length === 0 ? `${taskDir}/workdir` : `${taskDir}/workdir/${newStack.join("/")}`;
    setCurrentPath(basePath);
    setSelectedFiles(new Set());
    api.listWorkdirFiles(workspaceId, basePath).then((files) => {
      setFiles(files);
      setFilesLoading(false);
    });
  };

  const toggleFileSelection = (name: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const selectAll = () => {
    const visibleFiles = files.filter((f) => !isConfigFile(f.name));
    if (selectedFiles.size === visibleFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(visibleFiles.map((f) => f.name)));
    }
  };

  const handleDownload = async (filename: string) => {
    if (!selectedTask) return;
    const taskDir = getTaskDir();
    if (!taskDir) {
      toast.error("No work directory found for this task");
      return;
    }
    setDownloading(true);
    try {
      const prefix = `${taskDir}/workdir/`;
      let filePath: string;
      if (currentPath.startsWith(prefix)) {
        filePath = currentPath.replace(prefix, "") + "/" + filename;
      } else {
        filePath = filename;
      }
      await api.downloadWorkdirFile(workspaceId, `${taskDir}/workdir/${filePath}`, filename);
      toast.success("Download started");
    } catch (err) {
      toast.error("Failed to download file");
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  const handleBatchDownload = async () => {
    if (!selectedTask || selectedFiles.size === 0) return;
    const taskDir = getTaskDir();
    if (!taskDir) return;
    setDownloading(true);
    try {
      const prefix = `${taskDir}/workdir/`;
      let basePath = "";
      if (currentPath.startsWith(prefix)) {
        basePath = currentPath.replace(prefix, "");
      }
      const filesList = Array.from(selectedFiles);
      for (const file of filesList) {
        const filePath = basePath ? `${basePath}/${file}` : file;
        const fullPath = `${taskDir}/workdir/${filePath}`;
        const isDir = files.some((f) => f.name === file && f.is_dir);
        if (isDir) {
          await api.downloadWorkdirFolderAsZip(workspaceId, fullPath);
        } else {
          await api.downloadWorkdirFile(workspaceId, fullPath, file);
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      toast.success(`Downloaded ${filesList.length} items`);
    } catch (err) {
      toast.error("Failed to download some files");
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  const handleFolderDownload = async (folderName: string) => {
    const taskDir = getTaskDir();
    if (!taskDir) return;
    setDownloading(true);
    try {
      const prefix = `${taskDir}/workdir/`;
      let folderPath: string;
      if (currentPath.startsWith(prefix)) {
        folderPath = currentPath.replace(prefix, "") + "/" + folderName;
      } else {
        folderPath = folderName;
      }
      await api.downloadWorkdirFolderAsZip(workspaceId, `${taskDir}/workdir/${folderPath}`);
      toast.success("Download started");
    } catch (err) {
      toast.error("Failed to download folder");
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

  if (tasks.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        {translate('issueDetail.labels.noTaskRunsFound', 'No task runs found for this issue')}
      </div>
    );
  }

  const visibleFiles = files.filter((f) => !isConfigFile(f.name));
  const allSelected = visibleFiles.length > 0 && selectedFiles.size === visibleFiles.length;

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground">{translate('issueDetail.labels.selectTask', 'Select task:')}</span>
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

      {selectedTask && (
        <div className="flex items-center gap-2 mb-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1"
            onClick={navigateBack}
            disabled={filesLoading}
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <span className="text-xs text-muted-foreground truncate flex-1">
            {pathStack.length === 0 ? "workdir" : `workdir/${pathStack.join("/")}`}
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
      )}

      {filesLoading ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading files...</span>
        </div>
      ) : files.length === 0 ? (
        <div className="text-sm text-muted-foreground py-2">
          No files in this directory
        </div>
      ) : (
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
          {visibleFiles.map((file) => (
            <div
              key={file.name}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent/50 group"
            >
              <button
                onClick={() => toggleFileSelection(file.name)}
                className="shrink-0"
              >
                {selectedFiles.has(file.name) ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              <button
                className="flex-1 text-left flex items-center gap-2 min-w-0"
                onClick={() => file.is_dir && loadDirectory(file.name)}
              >
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
                      onClick={() => file.is_dir ? handleFolderDownload(file.name) : handleDownload(file.name)}
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

