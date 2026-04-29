"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  Download,
  Search,
  X,
  ChevronRight,
  FileText,
  Pencil,
  Eye,
  Code2,
  LayoutGrid,
  List,
} from "lucide-react";
import type { Skill, CreateSkillRequest, UpdateSkillRequest } from "@multica/core/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@multica/ui/components/ui/dialog";
import { Badge } from "@multica/ui/components/ui/badge";
import { Button } from "@multica/ui/components/ui/button";
import { Input } from "@multica/ui/components/ui/input";
import { Label } from "@multica/ui/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@multica/ui/components/ui/tabs";
import { toast } from "sonner";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { ScrollArea } from "@multica/ui/components/ui/scroll-area";
import { api } from "@multica/core/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@multica/core/auth";
import { useWorkspaceId } from "@multica/core/hooks";
import { useTranslation } from "@multica/core";
import { skillListOptions, workspaceKeys } from "@multica/core/workspace/queries";
import { cn } from "@multica/ui/lib/utils";
import { Markdown } from "../../common/markdown";

const SKILL_MD = "SKILL.md";

function buildFileMap(
  content: string,
  files: { path: string; content: string }[],
): Map<string, string> {
  const map = new Map<string, string>();
  map.set(SKILL_MD, content);
  for (const f of files) {
    if (f.path.trim()) map.set(f.path, f.content);
  }
  return map;
}

function parseFrontmatter(raw: string): {
  frontmatter: Record<string, string> | null;
  body: string;
} {
  const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) return { frontmatter: null, body: raw };

  const yamlBlock = match[1]!;
  const body = raw.slice(match[0].length);
  const frontmatter: Record<string, string> = {};

  for (const line of yamlBlock.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) frontmatter[key] = value;
  }

  return {
    frontmatter: Object.keys(frontmatter).length > 0 ? frontmatter : null,
    body,
  };
}

function isMarkdown(path: string) {
  return path.endsWith(".md") || path.endsWith(".mdx");
}

function getFileIcon(name: string) {
  if (name.endsWith(".md") || name.endsWith(".mdx")) return FileText;
  return Code2;
}

function FrontmatterCard({ data }: { data: Record<string, string> }) {
  return (
    <div className="mb-4 rounded-xl border bg-gradient-to-br from-primary/5 to-transparent px-4 py-3 backdrop-blur-sm">
      <div className="grid gap-1.5">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="flex gap-2 text-xs">
            <span className="shrink-0 font-medium text-muted-foreground min-w-[80px]">
              {key}
            </span>
            <span className="text-foreground">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Skill Dialog
// ---------------------------------------------------------------------------

function CreateSkillDialog({
  onClose,
  onCreate,
  onImport,
}: {
  onClose: () => void;
  onCreate: (data: CreateSkillRequest) => Promise<void>;
  onImport: (url: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"create" | "import">("create");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [importError, setImportError] = useState("");

  const detectedSource = (() => {
    const url = importUrl.trim().toLowerCase();
    if (url.includes("clawhub.ai")) return "clawhub" as const;
    if (url.includes("skills.sh")) return "skills.sh" as const;
    return null;
  })();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onCreate({ name: name.trim(), description: description.trim() });
      onClose();
    } catch {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importUrl.trim()) return;
    setLoading(true);
    setImportError("");
    try {
      await onImport(importUrl.trim());
      onClose();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : t("skills.importFailed", "Import failed"));
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md border-primary/20 bg-gradient-to-br from-background to-primary/5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            {t("skills.addSkill", "Add Skill")}
          </DialogTitle>
          <DialogDescription>
            {t("skills.addSkillDescription", "Create a new skill or import from ClawHub / Skills.sh.")}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "create" | "import")}>
          <TabsList className="w-full bg-muted/50">
            <TabsTrigger value="create" className="flex-1 data-[state=active]:bg-background">
              <Plus className="mr-1.5 h-3 w-3" />
              {t("skills.create", "Create")}
            </TabsTrigger>
            <TabsTrigger value="import" className="flex-1 data-[state=active]:bg-background">
              <Download className="mr-1.5 h-3 w-3" />
              {t("skills.import", "Import")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4 mt-4 min-h-[180px]">
            <div>
              <Label className="text-xs text-muted-foreground">{t("skills.name", "Name")}</Label>
              <Input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("skills.namePlaceholder", "e.g. Code Review, Bug Triage")}
                className="mt-1 bg-background/80 border-primary/10 focus:border-primary/30"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t("skills.description", "Description")}</Label>
              <Input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("skills.descriptionPlaceholder", "Brief description of what this skill does")}
                className="mt-1 bg-background/80 border-primary/10 focus:border-primary/30"
              />
            </div>
          </TabsContent>

          <TabsContent value="import" className="space-y-4 mt-4 min-h-[180px]">
            <div>
              <Label className="text-xs text-muted-foreground">{t("skills.skillUrl", "Skill URL")}</Label>
              <Input
                autoFocus
                type="text"
                value={importUrl}
                onChange={(e) => { setImportUrl(e.target.value); setImportError(""); }}
                placeholder={t("skills.skillUrlPlaceholder", "Paste a skill URL...")}
                className="mt-1 bg-background/80 border-primary/10 focus:border-primary/30 font-mono text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleImport()}
              />
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">{t("skills.supportedSources", "Supported sources")}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className={cn(
                  "rounded-lg border px-3 py-2.5 transition-all duration-200 cursor-pointer",
                  detectedSource === "clawhub"
                    ? "border-primary bg-primary/10 shadow-sm shadow-primary/20"
                    : "hover:border-primary/30 bg-muted/30"
                )}>
                  <div className="text-xs font-medium">ClawHub</div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground font-mono">
                    clawhub.ai/owner/skill
                  </div>
                </div>
                <div className={cn(
                  "rounded-lg border px-3 py-2.5 transition-all duration-200 cursor-pointer",
                  detectedSource === "skills.sh"
                    ? "border-primary bg-primary/10 shadow-sm shadow-primary/20"
                    : "hover:border-primary/30 bg-muted/30"
                )}>
                  <div className="text-xs font-medium">Skills.sh</div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground font-mono">
                    skills.sh/owner/repo/skill
                  </div>
                </div>
              </div>
            </div>

            {importError && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive border border-destructive/20">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {importError}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t("skills.cancel", "Cancel")}</Button>
          {tab === "create" ? (
            <Button onClick={handleCreate} disabled={loading || !name.trim()} className="bg-gradient-to-r from-primary to-primary/80">
              {loading ? t("skills.creating", "Creating...") : t("skills.create", "Create")}
            </Button>
          ) : (
            <Button onClick={handleImport} disabled={loading || !importUrl.trim()} className="bg-gradient-to-r from-primary to-primary/80">
              {loading ? (
                detectedSource === "clawhub"
                  ? t("skills.importingFromClawHub", "Importing from ClawHub...")
                  : detectedSource === "skills.sh"
                    ? t("skills.importingFromSkillsSh", "Importing from Skills.sh...")
                    : t("skills.importing", "Importing...")
              ) : (
                <>
                  <Download className="mr-1.5 h-3 w-3" />
                  {t("skills.import", "Import")}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Skill Card (Bento Grid Style)
// ---------------------------------------------------------------------------

function SkillCard({
  skill,
  isSelected,
  onClick,
}: {
  skill: Skill;
  isSelected: boolean;
  onClick: () => void;
}) {
  const fileCount = skill.files?.length ?? 0;
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative w-full text-left p-5 rounded-2xl border transition-all duration-300 cursor-pointer",
        "hover:shadow-lg hover:shadow-primary/5",
        isSelected 
          ? "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30 shadow-lg shadow-primary/10" 
          : "bg-background/80 hover:bg-gradient-to-br hover:from-primary/5 hover:to-transparent border-border/50 hover:border-primary/20"
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all duration-300",
          isSelected 
            ? "bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/30" 
            : "bg-muted group-hover:bg-primary/10"
        )}>
          <Sparkles className={cn(
            "h-5 w-5 transition-colors duration-300",
            isSelected ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={cn(
            "font-semibold truncate transition-colors duration-300",
            isSelected ? "text-primary" : "group-hover:text-primary/80"
          )}>
            {skill.name}
          </h3>
          {skill.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {skill.description}
            </p>
          )}
          {fileCount > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                {fileCount} file{fileCount !== 1 ? "s" : ""}
              </Badge>
            </div>
          )}
        </div>
      </div>
      <ChevronRight className={cn(
        "absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 transition-all duration-300",
        isSelected ? "text-primary opacity-100" : "text-muted-foreground opacity-0 group-hover:opacity-100"
      )} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Skill Detail Drawer
// ---------------------------------------------------------------------------

function AddFileDialog({
  existingPaths,
  onClose,
  onAdd,
}: {
  existingPaths: string[];
  onClose: () => void;
  onAdd: (path: string) => void;
}) {
  const { t } = useTranslation();
  const [path, setPath] = useState("");
  const duplicate = existingPaths.includes(path.trim());

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">{t("skills.addFile", "Add File")}</DialogTitle>
          <DialogDescription className="text-xs">
            {t("skills.addFileDescription", "Add a supporting file to this skill.")}
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label className="text-xs text-muted-foreground">{t("skills.filePath", "File Path")}</Label>
          <Input
            autoFocus
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder={t("skills.filePathPlaceholder", "e.g. templates/review.md")}
            className="mt-1 font-mono text-sm bg-background/80"
            onKeyDown={(e) => {
              if (e.key === "Enter" && path.trim() && !duplicate) {
                onAdd(path.trim());
                onClose();
              }
            }}
          />
          {duplicate && (
            <p className="mt-1 text-xs text-destructive">{t("skills.fileAlreadyExists", "File already exists")}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t("skills.cancel", "Cancel")}</Button>
          <Button
            disabled={!path.trim() || duplicate}
            onClick={() => { onAdd(path.trim()); onClose(); }}
          >
            {t("skills.add", "Add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SkillDetailDrawer({
  skill,
  onClose,
  onUpdate,
  onDelete,
}: {
  skill: Skill;
  onClose: () => void;
  onUpdate: (id: string, data: UpdateSkillRequest) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  const [name, setName] = useState(skill.name);
  const [description, setDescription] = useState(skill.description);
  const [content, setContent] = useState(skill.content);
  const [files, setFiles] = useState<{ path: string; content: string }[]>(
    (skill.files ?? []).map((f) => ({ path: f.path, content: f.content })),
  );
  const [selectedPath, setSelectedPath] = useState(SKILL_MD);
  const [saving, setSaving] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAddFile, setShowAddFile] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");

  useEffect(() => {
    setName(skill.name);
    setDescription(skill.description);
    setContent(skill.content);
  }, [skill.id, skill.name, skill.description, skill.content]);

  useEffect(() => {
    setSelectedPath(SKILL_MD);
    setLoadingFiles(true);
    api.getSkill(skill.id).then((full) => {
      qc.invalidateQueries({ queryKey: workspaceKeys.skills(wsId) });
      setFiles((full.files ?? []).map((f) => ({ path: f.path, content: f.content })));
    }).catch((e) => {
      toast.error(e instanceof Error ? e.message : "Failed to load skill files");
    }).finally(() => setLoadingFiles(false));
  }, [skill.id, qc, wsId]);

  const fileMap = useMemo(() => buildFileMap(content, files), [content, files]);
  const filePaths = useMemo(() => Array.from(fileMap.keys()), [fileMap]);
  const selectedContent = fileMap.get(selectedPath) ?? "";
  const isMd = isMarkdown(selectedPath);

  const { frontmatter, body } = useMemo(
    () => (isMd ? parseFrontmatter(selectedContent) : { frontmatter: null, body: selectedContent }),
    [selectedContent, isMd],
  );

  const isDirty =
    name !== skill.name ||
    description !== skill.description ||
    content !== skill.content ||
    JSON.stringify(files) !==
      JSON.stringify((skill.files ?? []).map((f) => ({ path: f.path, content: f.content })));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(skill.id, {
        name: name.trim(),
        description: description.trim(),
        content,
        files: files.filter((f) => f.path.trim()),
      });
    } catch {
      // toast handled by parent
    } finally {
      setSaving(false);
    }
  };

  const handleFileContentChange = (newContent: string) => {
    if (selectedPath === SKILL_MD) {
      setContent(newContent);
    } else {
      setFiles((prev) =>
        prev.map((f) =>
          f.path === selectedPath ? { ...f, content: newContent } : f,
        ),
      );
    }
  };

  const handleAddFile = (path: string) => {
    setFiles((prev) => [...prev, { path, content: "" }]);
    setSelectedPath(path);
    setViewMode("edit");
  };

  const handleDeleteFile = () => {
    if (selectedPath === SKILL_MD) return;
    setFiles((prev) => prev.filter((f) => f.path !== selectedPath));
    setSelectedPath(SKILL_MD);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative ml-auto h-full w-full max-w-4xl bg-background/95 backdrop-blur-xl border-l shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-4 px-6 py-4">
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3 flex-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-sm font-semibold bg-transparent border-0 p-0 focus:ring-0 focus:outline-none focus:underline"
                  placeholder={t("skills.namePlaceholder", "Skill name")}
                />
                <Input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-6 text-xs text-muted-foreground bg-transparent border-0 p-0 focus:ring-0 focus:outline-none mt-0.5"
                  placeholder={t("skills.descriptionPlaceholder", "Description")}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isDirty && (
                <Button onClick={handleSave} disabled={saving || !name.trim()} size="sm" className="bg-gradient-to-r from-primary to-primary/80">
                  <Save className="h-3 w-3 mr-1" />
                  {saving ? t("skills.saving", "Saving...") : t("skills.save", "Save")}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          {/* File tabs */}
          <div className="flex items-center gap-1 px-6 pb-3 overflow-x-auto">
            {filePaths.map((path) => {
              const Icon = getFileIcon(path);
              const isSelected = path === selectedPath;
              return (
                <button
                  key={path}
                  onClick={() => setSelectedPath(path)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer",
                    isSelected 
                      ? "bg-primary/10 text-primary border border-primary/20" 
                      : "hover:bg-accent text-muted-foreground"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {path === SKILL_MD ? "SKILL.md" : path.split("/").pop()}
                  {path !== SKILL_MD && (
                    <span 
                      onClick={(e) => { e.stopPropagation(); handleDeleteFile(); }}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
            <button
              onClick={() => setShowAddFile(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-accent text-muted-foreground transition-colors cursor-pointer"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-140px)] overflow-y-auto">
          {loadingFiles ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <div className="p-6">
              {/* View mode toggle for markdown */}
              {isMd && (
                <div className="flex items-center justify-end gap-1 mb-4 p-1 bg-muted/50 rounded-lg w-fit ml-auto">
                  <button
                    onClick={() => setViewMode("preview")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
                      viewMode === "preview" 
                        ? "bg-background shadow-sm text-foreground" 
                        : "hover:text-foreground/70 text-muted-foreground"
                    )}
                  >
                    <Eye className="h-3 w-3" />
                    Preview
                  </button>
                  <button
                    onClick={() => setViewMode("edit")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
                      viewMode === "edit" 
                        ? "bg-background shadow-sm text-foreground" 
                        : "hover:text-foreground/70 text-muted-foreground"
                    )}
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                </div>
              )}

              {isMd && viewMode === "preview" ? (
                <div className="p-6">
                  {frontmatter && <FrontmatterCard data={frontmatter} />}
                  <Markdown mode="full">
                    {body || "*No content yet*"}
                  </Markdown>
                </div>
              ) : (
                <textarea
                  value={selectedContent}
                  onChange={(e) => handleFileContentChange(e.target.value)}
                  placeholder={
                    isMd
                      ? "Write markdown content..."
                      : "File content..."
                  }
                  className="w-full min-h-[500px] resize-none rounded-xl border bg-background/50 p-4 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
                />
              )}
            </div>
          )}
        </div>

        {/* Add file dialog */}
        {showAddFile && (
          <AddFileDialog
            existingPaths={filePaths}
            onClose={() => setShowAddFile(false)}
            onAdd={handleAddFile}
          />
        )}

        {/* Delete Confirmation */}
        {confirmDelete && (
          <Dialog open onOpenChange={(v) => { if (!v) setConfirmDelete(false); }}>
            <DialogContent className="max-w-sm" showCloseButton={false}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <DialogHeader className="flex-1 gap-1">
                  <DialogTitle className="text-sm font-semibold">{t("skills.deleteSkillTitle", "Delete skill?")}</DialogTitle>
                  <DialogDescription className="text-xs">
                    {t("skills.deleteSkillDescription", "This will permanently delete \"{name}\" and remove it from all agents.").replace("{name}", skill.name)}
                  </DialogDescription>
                </DialogHeader>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                  {t("skills.cancel", "Cancel")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setConfirmDelete(false);
                    onDelete(skill.id);
                  }}
                >
                  {t("skills.delete", "Delete")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SkillsPage() {
  const { t } = useTranslation();
  const isLoading = useAuthStore((s) => s.isLoading);
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  const { data: skills = [] } = useQuery(skillListOptions(wsId));
  const [selectedId, setSelectedId] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewAs, setViewAs] = useState<"grid" | "list">("grid");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return skills;
    const query = searchQuery.toLowerCase();
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query)
    );
  }, [skills, searchQuery]);

  const handleCreate = async (data: CreateSkillRequest) => {
    const skill = await api.createSkill(data);
    qc.invalidateQueries({ queryKey: workspaceKeys.skills(wsId) });
    setSelectedId(skill.id);
    toast.success(t("skills.skillCreated", "Skill created"));
  };

  const handleImport = async (url: string) => {
    const skill = await api.importSkill({ url });
    qc.invalidateQueries({ queryKey: workspaceKeys.skills(wsId) });
    setSelectedId(skill.id);
    toast.success(t("skills.skillImported", "Skill imported"));
  };

  const handleUpdate = async (id: string, data: UpdateSkillRequest) => {
    try {
      await api.updateSkill(id, data);
      qc.invalidateQueries({ queryKey: workspaceKeys.skills(wsId) });
      toast.success(t("skills.skillSaved", "Skill saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("skills.failedToSaveSkill", "Failed to save skill"));
      throw e;
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteSkill(id);
      if (selectedId === id) {
        const remaining = skills.filter((s) => s.id !== id);
        setSelectedId(remaining[0]?.id ?? "");
      }
      qc.invalidateQueries({ queryKey: workspaceKeys.skills(wsId) });
      toast.success(t("skills.skillDeleted", "Skill deleted"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("skills.failedToDeleteSkill", "Failed to delete skill"));
    }
  };

  const selected = skills.find((s) => s.id === selectedId) ?? null;

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Header */}
      <div className="border-b bg-background/50 backdrop-blur-md">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{t("skills.title", "Skills")}</h1>
              <p className="text-xs text-muted-foreground">{t("skills.skillsDescription", "Skills define reusable instructions for agents.")}</p>
            </div>
          </div>
          <Button onClick={() => setShowCreate(true)} size="sm" className="bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20">
            <Plus className="h-3 w-3 mr-1" />
            {t("skills.createSkill", "Create Skill")}
          </Button>
        </div>

        {/* Search and filters */}
        <div className="flex items-center gap-3 px-6 pb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("skills.searchPlaceholder", "Search skills...")}
              className="pl-10 bg-muted/50 border-0 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
            <button
              onClick={() => setViewAs("grid")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
                viewAs === "grid" 
                  ? "bg-background shadow-sm text-foreground" 
                  : "hover:text-foreground/70 text-muted-foreground"
              )}
            >
              <LayoutGrid className="h-3 w-3" />
            </button>
            <button
              onClick={() => setViewAs("list")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
                viewAs === "list" 
                  ? "bg-background shadow-sm text-foreground" 
                  : "hover:text-foreground/70 text-muted-foreground"
              )}
            >
              <List className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {filteredSkills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-muted to-muted/50 border border-border/50">
                <Sparkles className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{t("skills.noSkillsYet", "No skills yet")}</p>
              <Button
                onClick={() => setShowCreate(true)}
                size="sm"
                className="mt-4 bg-gradient-to-r from-primary to-primary/80"
              >
                <Plus className="h-3 w-3 mr-1" />
                {t("skills.createSkill", "Create Skill")}
              </Button>
            </div>
          ) : viewAs === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredSkills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  isSelected={skill.id === selectedId}
                  onClick={() => { setSelectedId(skill.id); setDrawerOpen(true); }}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSkills.map((skill) => (
                <button
                  key={skill.id}
                  onClick={() => { setSelectedId(skill.id); setDrawerOpen(true); }}
                  className={cn(
                    "group w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 cursor-pointer text-left",
                    skill.id === selectedId 
                      ? "bg-gradient-to-r from-primary/10 to-transparent border-primary/20" 
                      : "hover:bg-muted/50 border-transparent"
                  )}
                >
                  <div className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
                    skill.id === selectedId ? "bg-primary/20" : "bg-muted group-hover:bg-primary/10"
                  )}>
                    <Sparkles className={cn(
                      "h-4 w-4",
                      skill.id === selectedId ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{skill.name}</div>
                    {skill.description && (
                      <div className="text-sm text-muted-foreground truncate">{skill.description}</div>
                    )}
                  </div>
                  {(skill.files?.length ?? 0) > 0 && (
                    <Badge variant="secondary" className="shrink-0">
                      {skill.files.length}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Detail Drawer */}
      {selected && drawerOpen && (
        <SkillDetailDrawer
          key={selected.id}
          skill={selected}
          onClose={() => setDrawerOpen(false)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}

      {/* Create Dialog */}
      {showCreate && (
        <CreateSkillDialog
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
          onImport={handleImport}
        />
      )}
    </div>
  );
}
