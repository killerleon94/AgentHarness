"use client";

import { useState } from "react";
import { Ban, CheckCircle } from "lucide-react";
import { Button } from "@multica/ui/components/ui/button";
import { Badge } from "@multica/ui/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@multica/ui/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@multica/ui/components/ui/table";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@multica/ui/components/ui/alert-dialog";
import { useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { api } from "@multica/core/api";
import type { Workspace } from "@multica/core/types";
import { useTranslation } from "@multica/core";

export function adminWorkspaceListOptions() {
  return queryOptions({
    queryKey: ["admin", "workspaces"],
    queryFn: () => api.listWorkspaces(),
  });
}

export function AdminWorkspacesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: workspaces, isLoading } = useQuery(adminWorkspaceListOptions()) as {
    data: Workspace[] | undefined;
    isLoading: boolean;
  };
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const handleDisable = async (ws: Workspace) => {
    setConfirmAction({
      title: t("admin.workspaceDisableTitle", 'Disable "{name}"').replace("{name}", ws.name),
      description: t("admin.workspaceDisableDesc", "This workspace will be disabled. Members will no longer be able to access it. Only admins will see it in the workspace list. You can re-enable it at any time."),
      onConfirm: async () => {
        await api.disableWorkspace(ws.id);
        qc.invalidateQueries({ queryKey: ["admin", "workspaces"] });
      },
    });
  };

  const handleEnable = async (ws: Workspace) => {
    await api.enableWorkspace(ws.id);
    qc.invalidateQueries({ queryKey: ["admin", "workspaces"] });
  };

  const list = workspaces ?? [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.workspaces", "Workspaces")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading", "Loading...")}</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("admin.workspaceNoWorkspaces", "No workspaces found.")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name", "Name")}</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>{t("common.status", "Status")}</TableHead>
                  <TableHead className="w-40">{t("common.actions", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((ws) => (
                  <TableRow key={ws.id}>
                    <TableCell className="font-medium">{ws.name}</TableCell>
                    <TableCell className="text-muted-foreground">{ws.slug}</TableCell>
                    <TableCell>
                      {ws.disabled ? (
                        <Badge variant="secondary">{t("common.disabled", "Disabled")}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600 border-green-600">{t("common.active", "Active")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {ws.disabled ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEnable(ws)}
                        >
                          <CheckCircle className="mr-1 h-4 w-4" />
                          {t("common.enable", "Enable")}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDisable(ws)}
                        >
                          <Ban className="mr-1 h-4 w-4" />
                          {t("common.disable", "Disable")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(v) => { if (!v) setConfirmAction(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                await confirmAction?.onConfirm();
                setConfirmAction(null);
              }}
              >
                {t("common.disable", "Disable")}
              </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
