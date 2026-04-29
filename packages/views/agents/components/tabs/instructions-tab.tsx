"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, Sparkles } from "lucide-react";
import type { Agent } from "@multica/core/types";
import { Button } from "@multica/ui/components/ui/button";
import { useTranslation } from "@multica/core";
import { cn } from "@multica/ui/lib/utils";

export function InstructionsTab({
  agent,
  onSave,
}: {
  agent: Agent;
  onSave: (instructions: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(agent.instructions ?? "");
  const [saving, setSaving] = useState(false);
  const isDirty = value !== (agent.instructions ?? "");

  useEffect(() => {
    setValue(agent.instructions ?? "");
  }, [agent.id, agent.instructions]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(value);
    } catch {
      // toast handled by parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-br from-primary/5 to-muted/30 border border-primary/10">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">{t("agents.instructions", "Agent Instructions")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("agents.instructionsDescription", "Define this agent's identity and working style. These instructions are injected into the agent's context for every task.")}
          </p>
        </div>
      </div>

      {/* Editor */}
      <div className="relative group">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("agents.instructionsPlaceholder", `Define this agent's role, expertise, and working style.

Example:
You are a frontend engineer specializing in React and TypeScript.

## Working Style
- Write small, focused PRs — one commit per logical change
- Prefer composition over inheritance
- Always add unit tests for new components

## Constraints
- Do not modify shared/ types without explicit approval
- Follow the existing component patterns in features/`)}
          className="w-full min-h-[280px] rounded-xl border bg-background px-4 py-3 text-sm font-mono placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 resize-y transition-shadow"
        />
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <span className={cn(
            "text-xs transition-colors",
            value.length > 0 ? "text-muted-foreground" : "text-muted-foreground/50"
          )}>
            {value.length > 0 
              ? `${value.length.toLocaleString()} ${t("agents.characters", "characters")}` 
              : t("agents.noInstructions", "No instructions set")}
          </span>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {isDirty && (
            <span className="text-primary">{t("agents.unsavedChanges", "Unsaved changes")}</span>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={!isDirty || saving}
          size="sm"
          className="gap-2"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {t("common.save", "Save")}
        </Button>
      </div>
    </div>
  );
}