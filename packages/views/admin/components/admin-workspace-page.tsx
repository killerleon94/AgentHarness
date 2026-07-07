"use client";

import { useState, useEffect } from "react";
import { Ban, CheckCircle, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@multica/ui/components/ui/button";
import { Input } from "@multica/ui/components/ui/input";
import { Badge } from "@multica/ui/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@multica/ui/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@multica/ui/components/ui/table";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@multica/ui/components/ui/alert-dialog";
import { useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { api } from "@multica/core/api";
import type { Workspace } from "@multica/core/types";
import { useTranslation } from "@multica/core";

export function adminWorkspaceListOptions(params?: { page?: number; per_page?: number; search?: string }) {
  return queryOptions({
    queryKey: ["admin", "workspaces", params],
    queryFn: () => api.listWorkspaces(params),
  });
}

export function AdminWorkspacesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useQuery(adminWorkspaceListOptions({ page, per_page: perPage, search: search || undefined }));

  // data is always an array from the API
  const workspaces: Workspace[] = Array.isArray(data) ? data : (data as any)?.workspaces ?? [];
  const total = Array.isArray(data) ? workspaces.length : (data as any)?.total ?? workspaces.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

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

  return (
    <>
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("admin.searchWorkspacePlaceholder", "Search by workspace name...")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8"
          />
        </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.workspaces", "Workspaces")} ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading", "Loading...")}</p>
          ) : workspaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("admin.workspaceNoWorkspaces", "No workspaces found.")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name", "Name")}</TableHead>
                  <TableHead>{t("common.owner", "Owner")}</TableHead>
                  <TableHead>{t("common.status", "Status")}</TableHead>
                  <TableHead className="w-40">{t("common.actions", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspaces.map((ws) => (
                  <TableRow key={ws.id}>
                    <TableCell className="font-medium">{ws.name}</TableCell>
                    <TableCell className="text-muted-foreground">{ws.owner_name || "-"}</TableCell>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{page} / {totalPages}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <form onSubmit={(e) => {
              e.preventDefault();
              const input = (e.currentTarget.elements.namedItem("pageInput") as HTMLInputElement);
              const v = parseInt(input.value, 10);
              if (v >= 1 && v <= totalPages) setPage(v);
              input.value = "";
            }}>
              <Input name="pageInput" type="number" min={1} max={totalPages}
                placeholder={`1-${totalPages}`} className="w-16 h-8 text-center text-xs" />
            </form>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      </div>

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
