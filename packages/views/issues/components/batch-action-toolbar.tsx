"use client";

import { useState } from "react";
import { X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@multica/ui/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@multica/ui/components/ui/alert-dialog";
import type { UpdateIssueRequest } from "@multica/core/types";
import { useIssueSelectionStore } from "@multica/core/issues/stores/selection-store";
import { useBatchUpdateIssues, useBatchDeleteIssues } from "@multica/core/issues/mutations";
import { StatusPicker, PriorityPicker, AssigneePicker } from "./pickers";

import { fallbackT, type TranslateFn } from "@multica/core";

export function BatchActionToolbar({ t = fallbackT }: { t?: TranslateFn }) {
  const selectedIds = useIssueSelectionStore((s) => s.selectedIds);
  const clear = useIssueSelectionStore((s) => s.clear);
  const count = selectedIds.size;

  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const batchUpdate = useBatchUpdateIssues();
  const batchDelete = useBatchDeleteIssues();
  const loading = batchUpdate.isPending || batchDelete.isPending;

  if (count === 0) return null;

  const ids = Array.from(selectedIds);

  const handleBatchUpdate = async (updates: Partial<UpdateIssueRequest>) => {
    try {
      await batchUpdate.mutateAsync({ ids, updates });
      toast.success(t('batchAction.updated', `Updated ${count} issue${count > 1 ? "s" : ""}`));
    } catch {
      toast.error(t('batchAction.updateFailed', 'Failed to update issues'));
    }
  };

  const handleBatchDelete = async () => {
    try {
      await batchDelete.mutateAsync(ids);
      clear();
      toast.success(t('batchAction.deleted', `Deleted ${count} issue${count > 1 ? "s" : ""}`));
    } catch {
      toast.error(t('batchAction.deleteFailed', 'Failed to delete issues'));
    } finally {
      setDeleteOpen(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 rounded-xl border bg-background/95 backdrop-blur-sm px-2 py-1.5 shadow-xl shadow-slate-200/30 dark:shadow-slate-950/50">
        <div className="flex items-center gap-1.5 pl-1 pr-2 border-r mr-1">
          <span className="text-sm font-semibold">{count} {t('batchAction.selected', 'selected')}</span>
          <button
            type="button"
            onClick={clear}
            className="rounded p-1 hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>

        {/* Status */}
        <StatusPicker
          status="todo"
          onUpdate={handleBatchUpdate}
          open={statusOpen}
          onOpenChange={setStatusOpen}
          triggerRender={<Button variant="ghost" size="sm" disabled={loading} className="cursor-pointer" />}
          trigger={t('common.status', 'Status')}
          align="center"
          t={t}
        />

        {/* Priority */}
        <PriorityPicker
          priority="none"
          onUpdate={handleBatchUpdate}
          open={priorityOpen}
          onOpenChange={setPriorityOpen}
          triggerRender={<Button variant="ghost" size="sm" disabled={loading} className="cursor-pointer" />}
          trigger={t('common.priority', 'Priority')}
          align="center"
          t={t}
        />

        {/* Assignee */}
        <AssigneePicker
          assigneeType={null}
          assigneeId={null}
          onUpdate={handleBatchUpdate}
          open={assigneeOpen}
          onOpenChange={setAssigneeOpen}
          triggerRender={<Button variant="ghost" size="sm" disabled={loading} className="cursor-pointer" />}
          trigger={t('common.assignee', 'Assignee')}
          align="center"
          t={t}
        />

        {/* Delete */}
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => setDeleteOpen(true)}
          className="text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
        >
          <Trash2 className="size-4 mr-1" />
          {t('batchAction.delete', 'Delete')}
        </Button>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('batchAction.deleteTitle', `Delete ${count} issue${count > 1 ? "s" : ""}?`)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('batchAction.deleteDescription', 'This action cannot be undone. This will permanently delete the selected issue' + (count > 1 ? "s" : "") + ' and all associated data.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">{t('batchAction.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDelete}
              className="bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
            >
              {t('batchAction.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
