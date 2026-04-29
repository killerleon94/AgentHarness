"use client";

import { useState, useRef } from "react";
import {
  Cloud,
  Monitor,
  Loader2,
  Save,
  Globe,
  Lock,
  Camera,
  ChevronDown,
  Sparkles,
  Settings2,
  ListTodo,
} from "lucide-react";
import type { Agent, AgentVisibility, RuntimeDevice } from "@multica/core/types";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@multica/ui/components/ui/popover";
import { Button } from "@multica/ui/components/ui/button";
import { Input } from "@multica/ui/components/ui/input";
import { Label } from "@multica/ui/components/ui/label";
import { toast } from "sonner";
import { api } from "@multica/core/api";
import { useFileUpload } from "@multica/core/hooks/use-file-upload";
import { ActorAvatar } from "../../../common/actor-avatar";
import { useTranslation } from "@multica/core";
import { cn } from "@multica/ui/lib/utils";

export function SettingsTab({
  agent,
  runtimes,
  onSave,
}: {
  agent: Agent;
  runtimes: RuntimeDevice[];
  onSave: (updates: Partial<Agent>) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description ?? "");
  const [visibility, setVisibility] = useState<AgentVisibility>(agent.visibility);
  const [maxTasks, setMaxTasks] = useState(agent.max_concurrent_tasks);
  const [selectedRuntimeId, setSelectedRuntimeId] = useState(agent.runtime_id);
  const [runtimeOpen, setRuntimeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { upload, uploading } = useFileUpload(api);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedRuntime = runtimes.find((d) => d.id === selectedRuntimeId) ?? null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const result = await upload(file);
      if (!result) return;
      await onSave({ avatar_url: result.link });
      toast.success(t("agents.avatarUpdated", "Avatar updated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("agents.failedToUploadAvatar", "Failed to upload avatar"));
    }
  };

  const dirty =
    name !== agent.name ||
    description !== (agent.description ?? "") ||
    visibility !== agent.visibility ||
    maxTasks !== agent.max_concurrent_tasks ||
    selectedRuntimeId !== agent.runtime_id;

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t("agents.nameRequired", "Name is required"));
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description,
        visibility,
        max_concurrent_tasks: maxTasks,
        runtime_id: selectedRuntimeId,
      });
      toast.success(t("agents.settingsSaved", "Settings saved"));
    } catch {
      toast.error(t("agents.failedToSaveSettings", "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-br from-primary/5 to-muted/30 border border-primary/10">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">{t("common.settings", "Settings")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("agents.settingsDescription", "Configure your agent's identity, visibility, and runtime settings.")}
          </p>
        </div>
      </div>

      {/* Avatar Section */}
      <div className="flex items-center gap-6 p-4 rounded-xl border bg-gradient-to-br from-muted/20 to-transparent">
        <div className="relative group">
          <button
            type="button"
            className="relative h-20 w-20 shrink-0 rounded-2xl bg-muted overflow-hidden focus:outline-none focus:visible:ring-2 focus:visible:ring-ring cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <ActorAvatar actorType="agent" actorId={agent.id} size={80} className="rounded-none" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              ) : (
                <Camera className="h-6 w-6 text-white" />
              )}
            </div>
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold">{t("common.avatar", "Avatar")}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("agents.clickToUploadAvatar", "Click to upload avatar")}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {t("agents.avatarRecommended", "Recommended: 256x256px, PNG or JPG")}
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarUpload}
        />
      </div>

      {/* Basic Info */}
      <div className="space-y-4 p-4 rounded-xl border bg-background">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">{t("agents.basicInformation", "Basic Information")}</h4>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">{t("common.name", "Name")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5"
              placeholder={t("agents.agentNamePlaceholder", "Agent name")}
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">{t("common.description", "Description")}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("agents.form.descriptionPlaceholder", "What does this agent do?")}
              className="mt-1.5"
            />
          </div>
        </div>
      </div>

      {/* Visibility */}
      <div className="space-y-4 p-4 rounded-xl border bg-background">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">{t("common.visibility", "Visibility")}</h4>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setVisibility("workspace")}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer",
              visibility === "workspace"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/30 hover:bg-muted/30"
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Globe className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{t("common.workspace", "Workspace")}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t("agents.visibilityWorkspaceDesc", "All members can assign")}</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setVisibility("private")}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer",
              visibility === "private"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/30 hover:bg-muted/30"
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{t("common.private", "Private")}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t("agents.visibilityPrivateDesc", "Only you can assign")}</div>
            </div>
          </button>
        </div>
      </div>

      {/* Concurrency */}
      <div className="space-y-4 p-4 rounded-xl border bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">{t("agents.maxConcurrentTasks", "Max Concurrent Tasks")}</h4>
          </div>
          <span className="text-xs text-muted-foreground">{t("agents.concurrencyRange", "1-50")}</span>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={1}
            max={50}
            value={maxTasks}
            onChange={(e) => setMaxTasks(Number(e.target.value))}
            className="flex-1 h-2 rounded-full bg-muted appearance-none cursor-pointer accent-primary"
          />
          <div className="flex h-10 w-14 items-center justify-center rounded-lg bg-muted text-sm font-semibold">
            {maxTasks}
          </div>
        </div>
      </div>

      {/* Runtime */}
      <div className="space-y-4 p-4 rounded-xl border bg-background">
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">{t("common.runtime", "Runtime")}</h4>
        </div>
        <Popover open={runtimeOpen} onOpenChange={setRuntimeOpen}>
          <PopoverTrigger
            disabled={runtimes.length === 0}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-background p-4 text-left text-sm transition-colors hover:bg-muted/30 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
          >
            {selectedRuntime?.runtime_mode === "cloud" ? (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Cloud className="h-4 w-4 text-primary" />
              </div>
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Monitor className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold truncate">
                  {selectedRuntime?.name ?? t("agents.noRuntimeAvailable", "No runtime available")}
                </span>
                {selectedRuntime?.runtime_mode === "cloud" && (
                  <span className="shrink-0 rounded bg-info/10 px-2 py-0.5 text-xs font-medium text-info">
                    {t("common.cloud", "Cloud")}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {selectedRuntime?.device_info ?? t("agents.selectRuntime", "Select a runtime")}
              </div>
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              runtimeOpen ? "rotate-180" : ""
            )} />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[var(--anchor-width)] p-2 max-h-64 overflow-y-auto">
            {runtimes.map((device) => (
              <button
                key={device.id}
                onClick={() => {
                  setSelectedRuntimeId(device.id);
                  setRuntimeOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors mb-1 cursor-pointer",
                  device.id === selectedRuntimeId ? "bg-primary/5 border border-primary/20" : "hover:bg-muted/50 border border-transparent"
                )}
              >
                {device.runtime_mode === "cloud" ? (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Cloud className="h-4 w-4 text-primary" />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Monitor className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate">{device.name}</span>
                    {device.runtime_mode === "cloud" && (
                      <span className="shrink-0 rounded bg-info/10 px-1.5 py-0.5 text-xs font-medium text-info">
                        {t("common.cloud", "Cloud")}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{device.device_info}</div>
                </div>
                <span
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-full",
                    device.status === "online" ? "bg-success" : "bg-muted-foreground/40"
                  )}
                />
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-muted-foreground">
          {dirty && <span className="text-primary">{t("agents.unsavedChanges", "Unsaved changes")}</span>}
        </div>
        <Button
          onClick={handleSave}
          disabled={!dirty || saving}
          size="lg"
          className="gap-2 px-6"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {t("agents.saveChanges", "Save Changes")}
        </Button>
      </div>
    </div>
  );
}