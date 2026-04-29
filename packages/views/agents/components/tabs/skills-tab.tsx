"use client";

import { useState } from "react";
import { Plus, FileText, Trash2, Sparkles, X } from "lucide-react";
import type { Agent } from "@multica/core/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@multica/ui/components/ui/dialog";
import { Button } from "@multica/ui/components/ui/button";
import { toast } from "sonner";
import { api } from "@multica/core/api";
import { useWorkspaceId } from "@multica/core/hooks";
import { skillListOptions, workspaceKeys } from "@multica/core/workspace/queries";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@multica/core";

export function SkillsTab({
  agent,
}: {
  agent: Agent;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  const { data: workspaceSkills = [] } = useQuery(skillListOptions(wsId));
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const agentSkillIds = new Set(agent.skills.map((s) => s.id));
  const availableSkills = workspaceSkills.filter((s) => !agentSkillIds.has(s.id));

  const handleAdd = async (skillId: string) => {
    setSaving(true);
    try {
      const newIds = [...agent.skills.map((s) => s.id), skillId];
      await api.setAgentSkills(agent.id, { skill_ids: newIds });
      qc.invalidateQueries({ queryKey: workspaceKeys.agents(wsId) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("agents.failedToAddSkill", "Failed to add skill"));
    } finally {
      setSaving(false);
      setShowPicker(false);
    }
  };

  const handleRemove = async (skillId: string) => {
    setSaving(true);
    try {
      const newIds = agent.skills.filter((s) => s.id !== skillId).map((s) => s.id);
      await api.setAgentSkills(agent.id, { skill_ids: newIds });
      qc.invalidateQueries({ queryKey: workspaceKeys.agents(wsId) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("agents.failedToRemoveSkill", "Failed to remove skill"));
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
          <h3 className="text-sm font-semibold">{t("common.skills", "Skills")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("agents.skillsDescription", "Reusable skills assigned to this agent. Manage skills on the Skills page.")}
          </p>
        </div>
        {availableSkills.length > 0 && (
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowPicker(true)}
            disabled={saving}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {t("agents.addSkill", "Add Skill")}
          </Button>
        )}
      </div>

      {/* Skills List */}
      {agent.skills.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <FileText className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="mt-4 text-sm font-medium text-muted-foreground">{t("agents.noSkillsAssigned", "No skills assigned")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("agents.addSkillsFromWorkspace", "Add skills from the workspace to this agent.")}
          </p>
          {availableSkills.length > 0 && (
            <Button
              onClick={() => setShowPicker(true)}
              size="sm"
              className="mt-4 gap-2"
              disabled={saving}
            >
              <Plus className="h-4 w-4" />
              {t("agents.addSkill", "Add Skill")}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {agent.skills.map((skill) => (
            <div
              key={skill.id}
              className="group relative flex items-center gap-4 rounded-xl border bg-background p-4 transition-all hover:border-primary/20 hover:shadow-sm"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{skill.name}</div>
                {skill.description && (
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {skill.description}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleRemove(skill.id)}
                disabled={saving}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Skill Picker Dialog */}
      {showPicker && (
        <Dialog open onOpenChange={(v) => { if (!v) setShowPicker(false); }}>
          <DialogContent className="max-w-md">
            <div className="flex items-center justify-between">
              <DialogHeader>
                <DialogTitle className="text-base">{t("agents.addSkill", "Add Skill")}</DialogTitle>
                <DialogDescription className="text-sm">
                  {t("agents.selectSkillToAssign", "Select a skill to assign to this agent.")}
                </DialogDescription>
              </DialogHeader>
              <Button 
                variant="ghost" 
                size="icon-sm"
                onClick={() => setShowPicker(false)}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-2 py-2">
              {availableSkills.map((skill) => (
                <button
                  key={skill.id}
                  onClick={() => handleAdd(skill.id)}
                  disabled={saving}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/50 border border-transparent hover:border-primary/10"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{skill.name}</div>
                    {skill.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {skill.description}
                      </div>
                    )}
                  </div>
                </button>
              ))}
              {availableSkills.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    {t("agents.allSkillsAssigned", "All workspace skills are already assigned.")}
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}