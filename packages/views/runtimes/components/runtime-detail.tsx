"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import type { AgentRuntime } from "@multica/core/types";
import { useAuthStore } from "@multica/core/auth";
import { useWorkspaceId } from "@multica/core/hooks";
import { useTranslation } from "@multica/core";
import { memberListOptions } from "@multica/core/workspace/queries";
import { useDeleteRuntime } from "@multica/core/runtimes/mutations";
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
import { ActorAvatar } from "../../common/actor-avatar";
import { formatLastSeen } from "../utils";
import { StatusBadge, InfoField } from "./shared";
import { ProviderLogo } from "./provider-logo";
import { PingSection } from "./ping-section";
import { UpdateSection } from "./update-section";
import { UsageSection } from "./usage-section";

function getCliVersion(metadata: Record<string, unknown>): string | null {
  if (
    metadata &&
    typeof metadata.cli_version === "string" &&
    metadata.cli_version
  ) {
    return metadata.cli_version;
  }
  return null;
}

export function RuntimeDetail({ runtime }: { runtime: AgentRuntime }) {
  const { t } = useTranslation();
  const cliVersion =
    runtime.runtime_mode === "local" ? getCliVersion(runtime.metadata) : null;

  const user = useAuthStore((s) => s.user);
  const wsId = useWorkspaceId();
  const { data: members = [] } = useQuery(memberListOptions(wsId));
  const deleteMutation = useDeleteRuntime(wsId);

  const [deleteOpen, setDeleteOpen] = useState(false);

  // Resolve owner info
  const ownerMember = runtime.owner_id
    ? members.find((m) => m.user_id === runtime.owner_id) ?? null
    : null;

  // Permission check for delete
  const currentMember = user
    ? members.find((m) => m.user_id === user.id)
    : null;
  const isAdmin = currentMember
    ? currentMember.role === "owner" || currentMember.role === "admin"
    : false;
  const isRuntimeOwner = user && runtime.owner_id === user.id;
  const canDelete = isAdmin || isRuntimeOwner;

  const handleDelete = () => {
    deleteMutation.mutate(runtime.id, {
      onSuccess: () => {
        toast.success(t("runtimes.runtimeDeleted", "Runtime deleted"));
        setDeleteOpen(false);
      },
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : t("runtimes.failedToDelete", "Failed to delete runtime"));
      },
    });
  };

  return (
    <div className="flex h-full flex-col bg-background/50">
      <div className="flex h-12 shrink-0 items-center justify-between border-b bg-background/80 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50">
            <ProviderLogo provider={runtime.provider} className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate tracking-tight">{runtime.name}</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={runtime.status} />
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive cursor-pointer"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="rounded-xl border bg-card">
          <div className="grid grid-cols-2 gap-4 p-4">
            <InfoField label={t("runtimes.labels.runtimeMode", "Runtime Mode")} value={runtime.runtime_mode} />
            <InfoField label={t("runtimes.labels.provider", "Provider")} value={runtime.provider} />
            <InfoField label={t("runtimes.labels.status", "Status")} value={runtime.status} />
            <InfoField
              label={t("runtimes.labels.lastSeen", "Last Seen")}
              value={formatLastSeen(runtime.last_seen_at)}
            />
            {ownerMember && (
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground mb-1.5">{t("runtimes.labels.owner", "Owner")}</div>
                <div className="flex items-center gap-2.5">
                  <ActorAvatar
                    actorType="member"
                    actorId={ownerMember.user_id}
                    size={20}
                  />
                  <span className="text-sm font-medium">{ownerMember.name}</span>
                </div>
              </div>
            )}
            {runtime.device_info && (
              <InfoField label={t("runtimes.labels.device", "Device")} value={runtime.device_info} />
            )}
            {runtime.daemon_id && (
              <InfoField label={t("runtimes.labels.daemonId", "Daemon ID")} value={runtime.daemon_id} mono />
            )}
          </div>
        </div>

        {runtime.runtime_mode === "local" && (
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-xs font-medium text-muted-foreground mb-3 tracking-wide uppercase">
              {t("runtimes.labels.cliVersion", "CLI Version")}
            </h3>
            <UpdateSection
              runtimeId={runtime.id}
              currentVersion={cliVersion}
              isOnline={runtime.status === "online"}
            />
          </div>
        )}

        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-xs font-medium text-muted-foreground mb-3 tracking-wide uppercase">
            {t("runtimes.labels.connectionTest", "Connection Test")}
          </h3>
          <PingSection runtimeId={runtime.id} />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-xs font-medium text-muted-foreground mb-3 tracking-wide uppercase">
            {t("runtimes.labels.tokenUsage", "Token Usage")}
          </h3>
          <UsageSection runtimeId={runtime.id} />
        </div>

        {runtime.metadata && Object.keys(runtime.metadata).length > 0 && (
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-xs font-medium text-muted-foreground mb-2 tracking-wide uppercase">
              {t("runtimes.labels.metadata", "Metadata")}
            </h3>
            <div className="rounded-lg bg-muted/30 p-3">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
                {JSON.stringify(runtime.metadata, null, 2)}
              </pre>
            </div>
          </div>
        )}

        <div className="rounded-xl border bg-card p-4">
          <div className="grid grid-cols-2 gap-4">
            <InfoField
              label={t("runtimes.labels.created", "Created")}
              value={new Date(runtime.created_at).toLocaleString()}
            />
            <InfoField
              label={t("runtimes.labels.updated", "Updated")}
              value={new Date(runtime.updated_at).toLocaleString()}
            />
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={(v) => { if (!v) setDeleteOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("runtimes.deleteDialog.title", "Delete Runtime")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("runtimes.deleteDialog.description", `Are you sure you want to delete "${runtime.name}"? This action cannot be undone.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("runtimes.deleteDialog.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t("runtimes.deleteDialog.deleting", "Deleting...") : t("runtimes.deleteDialog.confirm", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
