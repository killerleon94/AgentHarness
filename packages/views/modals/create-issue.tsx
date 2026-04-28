"use client";

import { useState, useRef } from "react";
import { useNavigation } from "../navigation";
import { Check, ChevronRight, Maximize2, Minimize2, X as XIcon, Calendar, Folder } from "lucide-react";
import { cn } from "@multica/ui/lib/utils";
import { toast } from "sonner";
import type { IssueStatus, IssuePriority, IssueAssigneeType } from "@multica/core/types";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@multica/ui/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@multica/ui/components/ui/tooltip";
import { Button } from "@multica/ui/components/ui/button";
import { ContentEditor, type ContentEditorRef, TitleEditor, useFileDropZone, FileDropOverlay } from "../editor";
import { StatusIcon, StatusPicker, PriorityPicker, AssigneePicker, DueDatePicker, PriorityIcon } from "../issues/components";
import { ProjectPicker } from "../projects/components/project-picker";
import { useWorkspaceStore } from "@multica/core/workspace";
import { useIssueDraftStore } from "@multica/core/issues/stores/draft-store";
import { useCreateIssue } from "@multica/core/issues/mutations";
import { useFileUpload } from "@multica/core/hooks/use-file-upload";
import { api } from "@multica/core/api";
import { FileUploadButton } from "@multica/ui/components/common/file-upload-button";
import { useTranslation } from "@multica/core";

function getPriorityDictKey(priority: IssuePriority): string {
  const map: Record<string, string> = {
    urgent: "urgent",
    high: "high",
    medium: "medium",
    low: "low",
    none: "noPriority",
  };
  return map[priority] || priority;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function PriorityIconInline({ priority }: { priority: IssuePriority }) {
  return <PriorityIcon priority={priority} className="h-3.5 w-3.5" inheritColor />;
}

function UserIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

function CalendarIcon() {
  return <Calendar className="size-3.5" />;
}

function FolderIcon() {
  return <Folder className="size-3.5" />;
}

function PropertyPill({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-background/60 px-2.5 py-1.5 text-xs",
        "hover:bg-muted/60 hover:border-border/60 transition-all duration-200 cursor-pointer",
        "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// CreateIssueModal
// ---------------------------------------------------------------------------

export function CreateIssueModal({ onClose, data }: { onClose: () => void; data?: Record<string, unknown> | null }) {
  const { t: translate } = useTranslation();
  const router = useNavigation();
  const workspaceName = useWorkspaceStore((s) => s.workspace?.name);

  const draft = useIssueDraftStore((s) => s.draft);
  const setDraft = useIssueDraftStore((s) => s.setDraft);
  const clearDraft = useIssueDraftStore((s) => s.clearDraft);

  const [title, setTitle] = useState(draft.title);
  const descEditorRef = useRef<ContentEditorRef>(null);
  const { isDragOver: descDragOver, dropZoneProps: descDropZoneProps } = useFileDropZone({
    onDrop: (files) => files.forEach((f) => descEditorRef.current?.uploadFile(f)),
  });
  const [status, setStatus] = useState<IssueStatus>((data?.status as IssueStatus) || draft.status);
  const [priority, setPriority] = useState<IssuePriority>(draft.priority);
  const [submitting, setSubmitting] = useState(false);
  const [assigneeType, setAssigneeType] = useState<IssueAssigneeType | undefined>(draft.assigneeType);
  const [assigneeId, setAssigneeId] = useState<string | undefined>(draft.assigneeId);
  const [dueDate, setDueDate] = useState<string | null>(draft.dueDate);
  const [projectId, setProjectId] = useState<string | undefined>(
    (data?.project_id as string) || undefined,
  );
  const [isExpanded, setIsExpanded] = useState(false);

  // File upload — collect attachment IDs so we can link them after issue creation.
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const { uploadWithToast } = useFileUpload(api);
  const handleUpload = async (file: File) => {
    const result = await uploadWithToast(file);
    if (result) {
      setAttachmentIds((prev) => [...prev, result.id]);
    }
    return result;
  };

  // Sync field changes to draft store
  const updateTitle = (v: string) => { setTitle(v); setDraft({ title: v }); };
  const updateStatus = (v: IssueStatus) => { setStatus(v); setDraft({ status: v }); };
  const updatePriority = (v: IssuePriority) => { setPriority(v); setDraft({ priority: v }); };
  const updateAssignee = (type?: IssueAssigneeType, id?: string) => {
    setAssigneeType(type); setAssigneeId(id);
    setDraft({ assigneeType: type, assigneeId: id });
  };
  const updateDueDate = (v: string | null) => { setDueDate(v); setDraft({ dueDate: v }); };

  const createIssueMutation = useCreateIssue();
  const handleSubmit = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      const issue = await createIssueMutation.mutateAsync({
        title: title.trim(),
        description: descEditorRef.current?.getMarkdown()?.trim() || undefined,
        status,
        priority,
        assignee_type: assigneeType,
        assignee_id: assigneeId,
        due_date: dueDate || undefined,
        attachment_ids: attachmentIds.length > 0 ? attachmentIds : undefined,
        parent_issue_id: (data?.parent_issue_id as string) || undefined,
        project_id: projectId,
      });
      clearDraft();
      onClose();
      toast.custom((t) => (
        <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg p-4 w-[360px]">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center justify-center size-5 rounded-full bg-emerald-500/15 text-emerald-500">
              <Check className="size-3" />
            </div>
            <span className="text-sm font-medium">{translate('modal.createIssue.issueCreated')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground ml-7">
            <StatusIcon status={issue.status} className="size-3.5 shrink-0" />
            <span className="truncate">{issue.identifier} – {issue.title}</span>
          </div>
          <button
            type="button"
            className="ml-7 mt-2 text-sm text-primary hover:underline cursor-pointer"
            onClick={() => {
              router.push(`/issues/${issue.id}`);
              toast.dismiss(t);
            }}
          >
            {translate('modal.createIssue.viewIssue')}
          </button>
        </div>
      ), { duration: 5000 });
    } catch {
      toast.error(translate('modal.createIssue.failedToCreate'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "p-0 gap-0 flex flex-col overflow-hidden rounded-2xl border-border/60 shadow-2xl shadow-slate-300/30 dark:shadow-slate-950/50",
          "!top-1/2 !left-1/2 !-translate-x-1/2",
          "!transition-all !duration-300 !ease-out",
          isExpanded
            ? "!max-w-4xl !w-full !h-5/6 !-translate-y-1/2"
            : "!max-w-2xl !w-full !h-[32rem] !-translate-y-1/2",
        )}
      >
        <DialogTitle className="sr-only">{translate('modal.createIssue.title')}</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0 border-b border-border/40 bg-gradient-to-r from-muted/30 to-transparent">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-7 rounded-lg bg-primary/10 text-primary">
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v8M8 12h8" />
              </svg>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground font-medium">{workspaceName}</span>
              <ChevronRight className="size-3 text-muted-foreground/30" />
              {typeof data?.parent_issue_identifier === "string" && (
                <>
                  <span className="text-muted-foreground/70 font-medium">{data.parent_issue_identifier}</span>
                  <ChevronRight className="size-3 text-muted-foreground/30" />
                </>
              )}
              <span className="font-semibold text-foreground">{data?.parent_issue_id ? translate('modal.createIssue.newSubIssue') : translate('modal.createIssue.newIssue')}</span>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="rounded-lg p-1.5 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-all duration-200 cursor-pointer"
                  >
                    {isExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                  </button>
                }
              />
              <TooltipContent side="bottom">{isExpanded ? translate('modal.createIssue.collapse') : translate('modal.createIssue.expand')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={onClose}
                    className="rounded-lg p-1.5 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-all duration-200 cursor-pointer"
                  >
                    <XIcon className="size-4" />
                  </button>
                }
              />
              <TooltipContent side="bottom">{translate('modal.createIssue.close')}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Title */}
        <div className="px-5 pt-3 pb-2 shrink-0">
          <TitleEditor
            autoFocus
            defaultValue={draft.title}
            placeholder={translate('modal.createIssue.titlePlaceholder')}
            className="text-lg font-semibold"
            onChange={(v) => updateTitle(v)}
            onSubmit={handleSubmit}
          />
        </div>

        {/* Description — takes remaining space */}
        <div {...descDropZoneProps} className="relative flex-1 min-h-0 overflow-y-auto px-5">
          <ContentEditor
            ref={descEditorRef}
            defaultValue={draft.description}
            placeholder={translate('modal.createIssue.descriptionPlaceholder')}
            onUpdate={(md) => setDraft({ description: md })}
            onUploadFile={handleUpload}
            debounceMs={500}
          />
          {descDragOver && <FileDropOverlay />}
        </div>

        {/* Property toolbar */}
        <div className="shrink-0 border-t border-border/40 bg-muted/20">
          <div className="flex items-center gap-1 px-3 py-2">
            <StatusPicker
              status={status}
              onUpdate={(u) => { if (u.status) updateStatus(u.status); }}
              triggerRender={<PropertyPill icon={<StatusIcon status={status} className="h-3.5 w-3.5" inheritColor />} label={translate(`board.statuses.${status === 'in_progress' ? 'inProgress' : status === 'in_review' ? 'inReview' : status}`, status)} />}
              align="start"
              t={translate}
            />

            <PriorityPicker
              priority={priority}
              onUpdate={(u) => { if (u.priority) updatePriority(u.priority); }}
              triggerRender={<PropertyPill icon={<PriorityIconInline priority={priority} />} label={translate(`issueDetail.priorities.${getPriorityDictKey(priority)}`, priority)} />}
              align="start"
              t={translate}
            />

            <AssigneePicker
              assigneeType={assigneeType ?? null}
              assigneeId={assigneeId ?? null}
              onUpdate={(u) => updateAssignee(
                u.assignee_type ?? undefined,
                u.assignee_id ?? undefined,
              )}
              triggerRender={<PropertyPill icon={<UserIcon />} label={assigneeType && assigneeId ? translate('common.assignee') : translate('common.unassigned', 'Unassigned')} />}
              align="start"
              t={translate}
            />

            <DueDatePicker
              dueDate={dueDate}
              onUpdate={(u) => updateDueDate(u.due_date ?? null)}
              triggerRender={<PropertyPill icon={<CalendarIcon />} label={dueDate ? formatDate(dueDate) : translate('issueDetail.dueDate.clear', 'Clear date')} />}
              align="start"
              t={translate}
            />

            <ProjectPicker
              projectId={projectId ?? null}
              onUpdate={(u) => setProjectId(u.project_id ?? undefined)}
              triggerRender={<PropertyPill icon={<FolderIcon />} label={translate('common.project', 'Project')} />}
              align="start"
              t={translate}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/40 shrink-0 bg-muted/10">
          <FileUploadButton
            onSelect={(file) => descEditorRef.current?.uploadFile(file)}
          />
          <Button size="sm" onClick={handleSubmit} disabled={!title.trim() || submitting} className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium cursor-pointer shadow-sm">
            {submitting ? (
              <>
                <span className="mr-1.5 inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {translate('modal.createIssue.creating')}
              </>
            ) : translate('modal.createIssue.createIssue')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
