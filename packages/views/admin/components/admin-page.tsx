"use client";

import { useState, useEffect, useRef } from "react";
import { UserPlus, Ban, CheckCircle, CheckSquare, Square, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search, Upload, Download, Pencil, X, Check } from "lucide-react";
import type { PaginatedUsersResponse, ImportUsersResult, BatchCreateUserResult } from "@multica/core/types";
import { Button } from "@multica/ui/components/ui/button";
import { Input } from "@multica/ui/components/ui/input";
import { Textarea } from "@multica/ui/components/ui/textarea";
import { Badge } from "@multica/ui/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@multica/ui/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@multica/ui/components/ui/table";
import { Checkbox } from "@multica/ui/components/ui/checkbox";
import { Switch } from "@multica/ui/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@multica/ui/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@multica/ui/components/ui/tooltip";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@multica/ui/components/ui/alert-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { userListOptions, adminKeys, useUpdateUserName } from "@multica/core/admin/queries";
import { api } from "@multica/core/api";
import { useTranslation } from "@multica/core";

type SortField = "name" | "email" | "role" | "disabled" | "created_at" | "password_change_required";
type SortOrder = "asc" | "desc";

function downloadCSV(results: { email: string; success: boolean; error?: string }[], filename: string) {
  const header = "email,success,error\n";
  const escapeCsv = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const rows = results.map((r) => [escapeCsv(r.email), String(r.success), escapeCsv(r.error || "")].join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function AdminUsersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [sort, setSort] = useState<SortField>("created_at");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [batchEmails, setBatchEmails] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<{ title: string; description: string; onConfirm: () => Promise<void> } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportUsersResult | null>(null);
  const [batchResult, setBatchResult] = useState<BatchCreateUserResult[] | null>(null);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingError, setEditingError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateUserName = useUpdateUserName();

  useEffect(() => {
    api.getRegistrationStatus().then((r) => setRegistrationEnabled(r.enabled)).catch(() => {});
  }, []);

  const { data, isLoading } = useQuery(userListOptions({ page, per_page: perPage, sort, order, search: search || undefined })) as {
    data: PaginatedUsersResponse | undefined;
    isLoading: boolean;
  };
  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const invalidate = () => qc.invalidateQueries({ queryKey: adminKeys.base });
  const toggleSelect = (id: string) => setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => {
    const selectable = users.filter((u) => u.role !== "admin");
    if (selectedIds.size === selectable.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectable.map((u) => u.id)));
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleSort = (field: SortField) => {
    if (sort === field) {
      setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setOrder(field === "password_change_required" ? "desc" : "asc");
    }
    setPage(1);
  };

  const sortArrow = (field: SortField) => {
    if (sort !== field) return null;
    return order === "asc" ? <ChevronUp className="ml-1 h-3 w-3 inline" /> : <ChevronDown className="ml-1 h-3 w-3 inline" />;
  };

  const sortableHeader = (field: SortField, label: string) => (
    <button onClick={() => handleSort(field)} className="flex items-center cursor-pointer hover:text-foreground">
      {label}{sortArrow(field)}
    </button>
  );

  const handleCreate = async () => {
    const email = newEmail.trim();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setBatchResult([{ email, success: false, error: "Invalid email format" }]);
      return;
    }
    setCreating(true);
    setBatchResult(null);
    try {
      const name = (newName.trim() || email.split("@")[0]) as string;
      await api.createUser({ email, name });
      invalidate();
      setShowCreate(false); setNewEmail(""); setNewName("");
    } catch { /* ignore */ } finally { setCreating(false); }
  };

  const handleBatchCreate = async () => {
    const lines = batchEmails.split(/[\n;]+/).map((s) => s.trim()).filter(Boolean);
    if (!lines.length) return;
    setCreating(true);
    setImportResult(null);
    setBatchResult(null);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const valid: { email: string; name: string }[] = [];
    const results: BatchCreateUserResult[] = [];
    for (const email of lines) {
      if (!emailRegex.test(email)) {
        results.push({ email, success: false, error: "Invalid email format" });
      } else {
        valid.push({ email, name: email.split("@")[0] ?? email });
      }
    }
    if (valid.length > 0) {
      try {
        const apiResults = await api.batchCreateUsers(valid);
        results.push(...apiResults);
        invalidate();
      } catch (err) {
        for (const v of valid) {
          results.push({ email: v.email, success: false, error: err instanceof Error ? err.message : "Request failed" });
        }
      }
    }
    setBatchResult(results);
    setBatchEmails("");
    setCreating(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setBatchResult(null);
    try {
      const result = await api.importUsers(file);
      setImportResult(result);
      invalidate();
    } catch (err) {
      setImportResult({ total: 0, created: 0, failed: 1, results: [{ email: "", success: false, error: err instanceof Error ? err.message : "Unknown error" }] });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleBatchDisable = () => {
    const ids = [...selectedIds];
    setConfirmAction({
      title: t("admin.batchDisableTitle", "Disable Users"),
      description: t("admin.batchDisableDesc", "Disable ") + ids.length + t("admin.usersSuffix", " users") + "?",
      onConfirm: async () => { await api.batchDisableUsers(ids); invalidate(); setSelectedIds(new Set()); },
    });
  };

  const handleBatchEnable = async () => {
    await api.batchEnableUsers([...selectedIds]);
    invalidate(); setSelectedIds(new Set());
  };

  const handleRegistrationToggle = async (enabled: boolean) => {
    setRegistrationEnabled(enabled);
    try { await api.setRegistrationStatus(enabled); } catch { setRegistrationEnabled(!enabled); }
  };

  const selectableCount = users.filter((u) => u.role !== "admin").length;

  if (isLoading) return <div className="p-6 text-muted-foreground">{t("common.loading", "Loading...")}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">{t("admin.userManagement", "User Management")}</h1>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleBatchDisable}><Ban className="mr-1 h-3 w-3" />{t("common.disable", "Disable")} ({selectedIds.size})</Button>
              <Button variant="outline" size="sm" onClick={handleBatchEnable}><CheckCircle className="mr-1 h-3 w-3" />{t("common.enable", "Enable")} ({selectedIds.size})</Button>
            </>
          )}
          <Button size="sm" onClick={() => setShowCreate(true)}><UserPlus className="mr-2 h-4 w-4" />{t("admin.createUser", "Create User")}</Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch checked={registrationEnabled} onCheckedChange={handleRegistrationToggle} id="reg-toggle" />
          <label htmlFor="reg-toggle" className="text-sm font-medium cursor-pointer">
            {t("admin.allowRegistration", "Allow registration")}
          </label>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("admin.searchPlaceholder", "Search by name or email...")}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-8"
        />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t("admin.allUsers", "All Users")} ({total})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <button onClick={toggleAll} className="cursor-pointer">
                    {selectedIds.size > 0 && selectedIds.size < selectableCount ? <CheckSquare className="h-4 w-4 text-muted-foreground" />
                      : selectedIds.size === selectableCount ? <CheckSquare className="h-4 w-4 text-primary" />
                      : <Square className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </TableHead>
                <TableHead>{sortableHeader("name", t("common.name", "Name"))}</TableHead>
                <TableHead>{sortableHeader("password_change_required", t("admin.activationStatus", "Activation Status"))}</TableHead>
                <TableHead>{sortableHeader("email", t("common.email", "Email"))}</TableHead>
                <TableHead>{sortableHeader("role", t("common.role", "Role"))}</TableHead>
                <TableHead>{sortableHeader("disabled", t("common.status", "Status"))}</TableHead>
                <TableHead className="w-24">{t("common.actions", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("admin.noUsers", "No users found")}</TableCell></TableRow>
              ) : users.map((u) => (
                <TableRow key={u.id} className={u.disabled ? "opacity-60" : ""}>
                  <TableCell>{u.role !== "admin" ? <Checkbox checked={selectedIds.has(u.id)} onCheckedChange={() => toggleSelect(u.id)} /> : null}</TableCell>
                  <TableCell className="font-medium">
                    {editingUserId === u.id ? (
                      <div className="flex items-center gap-1">
                        <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="h-8 w-32" />
                        <button onClick={async () => {
                          if (!editingName.trim()) { setEditingError(t("admin.nameRequired", "Name cannot be empty")); return; }
                          try {
                            await updateUserName.mutateAsync({ id: editingUserId!, name: editingName.trim() });
                            setEditingUserId(null); setEditingName(""); setEditingError(null);
                          } catch (err) {
                            setEditingError(err instanceof Error ? err.message : "Update failed");
                          }
                        }}><Check className="h-4 w-4 text-green-600" /></button>
                        <button onClick={() => { setEditingUserId(null); setEditingName(""); setEditingError(null); }}><X className="h-4 w-4 text-muted-foreground" /></button>
                        {editingError && <span className="text-destructive text-xs ml-1">{editingError}</span>}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span>{u.name}</span>
                        {u.role !== "admin" && !u.disabled && (
                          <button onClick={() => { setEditingUserId(u.id); setEditingName(u.name); setEditingError(null); }} className="text-muted-foreground hover:text-foreground">
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.disabled ? "—" : (
                      u.password_change_required
                        ? (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-amber-600 border-amber-600 cursor-default">{t("admin.notActivated", "Not Activated")}</Badge>
                            </TooltipTrigger>
                            <TooltipContent>{t("admin.notActivatedTooltip", "First login not completed")}</TooltipContent>
                          </Tooltip>
                        )
                        : (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-green-600 border-green-600 cursor-default">{t("admin.activated", "Activated")}</Badge>
                            </TooltipTrigger>
                            <TooltipContent>{t("admin.activatedTooltip", "Has completed initial login")}</TooltipContent>
                          </Tooltip>
                        )
                    )}
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell><Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role === "admin" ? t("common.admin", "Admin") : t("common.user", "User")}</Badge></TableCell>
                  <TableCell>{u.disabled ? <Badge variant="destructive">{t("common.disabled", "Disabled")}</Badge> : <Badge variant="outline" className="text-green-600 border-green-600">{t("common.active", "Active")}</Badge>}</TableCell>
                  <TableCell>
                    {u.role !== "admin" && (u.disabled ? (
                      <Button variant="ghost" size="sm" onClick={async () => { await api.enableUser(u.id); invalidate(); }}><CheckCircle className="mr-1 h-3 w-3" />{t("common.enable", "Enable")}</Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ title: t("admin.disableUser", "Disable User"), description: t("admin.disableConfirm", "Disable ") + u.name + "?", onConfirm: async () => { await api.disableUser(u.id); invalidate(); } })}><Ban className="mr-1 h-3 w-3" />{t("common.disable", "Disable")}</Button>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{page} / {totalPages}（{total} {t("admin.totalUsers", "users")}）</span>
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
              <Input
                name="pageInput"
                type="number"
                min={1}
                max={totalPages}
                placeholder={`1-${totalPages}`}
                className="w-16 h-8 text-center text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </form>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) { setImportResult(null); setBatchResult(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("admin.createUser", "Create User")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.email", "Email")}</label>
              <Input type="email" placeholder="user@company.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.name", "Name")} <span className="text-muted-foreground">({t("common.optional", "optional")})</span></label>
              <Input placeholder={t("admin.namePlaceholder", "Defaults to email prefix")} value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
            </div>
            <div className="border-t pt-4">
              <label className="text-sm font-medium mb-2 block">{t("admin.batchCreate", "Batch Create")}</label>
              <Textarea placeholder="user1@corp.com; user2@corp.com" value={batchEmails} onChange={(e) => setBatchEmails(e.target.value)} rows={3} />
            </div>
            <div className="border-t pt-4">
              <label className="text-sm font-medium mb-2 block">{t("admin.importFromFile", "Import from File")}</label>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => api.downloadTemplate("xlsx").catch(() => {})}>
                  <Download className="mr-1 h-3 w-3" />{t("admin.downloadTemplateXlsx", "Excel Template")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => api.downloadTemplate("md").catch(() => {})}>
                  <Download className="mr-1 h-3 w-3" />{t("admin.downloadTemplateMd", "MD Template")}
                </Button>
                <Button variant="outline" size="sm" disabled={importing} onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-1 h-3 w-3" />{importing ? t("admin.importing", "Importing...") : t("admin.uploadFile", "Upload File")}
                </Button>
                <input ref={fileInputRef} type="file" accept=".xls,.xlsx,.csv,.md" className="hidden" onChange={handleFileUpload} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t("admin.supportedFormats", "Supports .xls, .xlsx, .csv, .md (max 10MB)")}</p>
              {(batchResult || importResult) && (
                <div className="mt-3 p-3 rounded border text-sm">
                  {batchResult && (
                    <>
                      <p className="font-medium">{t("admin.batchResult", "Result")}: <span className="text-green-600">{batchResult.filter((r) => r.success).length} {t("common.success", "success")}</span>{batchResult.filter((r) => !r.success).length > 0 && <>, <span className="text-destructive">{batchResult.filter((r) => !r.success).length} {t("common.failed", "failed")}</span></>}</p>
                      {batchResult.filter((r) => !r.success).length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          {batchResult.filter((r) => !r.success).map((r, i) => (
                            <li key={i}>{r.email || "(empty)"}: {r.error}</li>
                          ))}
                        </ul>
                      )}
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => downloadCSV(batchResult, `batch-result-${Date.now()}.csv`)}>
                        <Download className="mr-1 h-3 w-3" />{t("admin.exportCsv", "Export CSV")}
                      </Button>
                    </>
                  )}
                  {importResult && (
                    <>
                      <p className="font-medium">{t("admin.importResult", "Result")}: <span className="text-green-600">{importResult.created} {t("common.success", "success")}</span>{importResult.failed > 0 && <>, <span className="text-destructive">{importResult.failed} {t("common.failed", "failed")}</span></>}</p>
                      {importResult.results.filter((r) => !r.success).length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          {importResult.results.filter((r) => !r.success).map((r, i) => (
                            <li key={i}>{r.email || "(empty)"}: {r.error}</li>
                          ))}
                        </ul>
                      )}
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => downloadCSV(importResult.results, `import-result-${Date.now()}.csv`)}>
                        <Download className="mr-1 h-3 w-3" />{t("admin.exportCsv", "Export CSV")}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>{t("common.cancel", "Cancel")}</Button>
            {batchEmails.trim() ? <Button onClick={handleBatchCreate} disabled={creating}>{t("common.create", "Create")}</Button>
              : <Button onClick={handleCreate} disabled={creating || !newEmail.trim()}>{t("common.create", "Create")}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle><AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { confirmAction?.onConfirm(); setConfirmAction(null); }}>{t("common.confirm", "Confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
