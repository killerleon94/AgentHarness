"use client";

import { useState } from "react";
import { Download, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@multica/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@multica/ui/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import type { Attachment } from "@multica/core/types";
import { api } from "@multica/core/api";
import { timeAgo } from "@multica/core/utils";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(contentType: string) {
  if (contentType.startsWith("image/")) return "🖼️";
  if (contentType.startsWith("video/")) return "🎬";
  if (contentType.startsWith("audio/")) return "🎵";
  if (contentType.includes("pdf")) return "📄";
  if (contentType.includes("zip") || contentType.includes("tar") || contentType.includes("gz")) return "📦";
  return "📎";
}

async function downloadFile(url: string, filename: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    toast.error("Failed to download file");
    console.error(err);
  }
}

interface AttachmentCardProps {
  attachment: Attachment;
  currentUserId?: string;
  onDelete?: (id: string) => void;
}

export function AttachmentCard({ attachment, currentUserId, onDelete }: AttachmentCardProps) {
  const [deleting, setDeleting] = useState(false);

  const isOwn = attachment.uploader_type === "member" && attachment.uploader_id === currentUserId;

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await api.deleteAttachment(attachment.id);
      onDelete(attachment.id);
      toast.success("Attachment deleted");
    } catch {
      toast.error("Failed to delete attachment");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card/50 px-3 py-2 hover:bg-accent/50 transition-colors group">
      <span className="text-lg shrink-0" title={attachment.content_type}>
        {getFileIcon(attachment.content_type)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.filename}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatFileSize(attachment.size_bytes)}</span>
          <span>·</span>
          <span>{timeAgo(attachment.created_at)}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => downloadFile(attachment.download_url, attachment.filename)}
          title="Download"
        >
          <Download className="h-4 w-4" />
        </Button>
        {isOwn && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
