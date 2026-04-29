"use client";

import { useState, useEffect, useMemo } from "react";
import { Bot, Plus, Archive, Search } from "lucide-react";
import type { CreateAgentRequest, UpdateAgentRequest, Agent } from "@multica/core/types";
import { Button } from "@multica/ui/components/ui/button";
import { toast } from "sonner";
import { Input } from "@multica/ui/components/ui/input";
import { api } from "@multica/core/api";
import { useAuthStore } from "@multica/core/auth";
import { runtimeListOptions } from "@multica/core/runtimes/queries";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceId } from "@multica/core/hooks";
import { useTranslation } from "@multica/core";
import { agentListOptions, workspaceKeys } from "@multica/core/workspace/queries";
import { CreateAgentDialog } from "./create-agent-dialog";
import { AgentDetail } from "./agent-detail";
import { statusConfig } from "../config";
import { ActorAvatar } from "../../common/actor-avatar";
import { Cloud, Monitor } from "lucide-react";

export function AgentsPage() {
  const { t } = useTranslation();
  const isLoading = useAuthStore((s) => s.isLoading);
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  const { data: agents = [] } = useQuery(agentListOptions(wsId));
  const [selectedId, setSelectedId] = useState<string>("");
  const [showArchived, setShowArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: runtimes = [], isLoading: runtimesLoading } = useQuery(runtimeListOptions(wsId));

  const filteredAgents = useMemo(
    () => {
      let list = showArchived 
        ? agents.filter((a) => !!a.archived_at) 
        : agents.filter((a) => !a.archived_at);
      
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        list = list.filter((a) => 
          a.name.toLowerCase().includes(q) ||
          (a.description?.toLowerCase().includes(q))
        );
      }
      return list;
    },
    [agents, showArchived, searchQuery],
  );

  const archivedCount = useMemo(() => agents.filter((a) => !!a.archived_at).length, [agents]);

  useEffect(() => {
    if (filteredAgents.length > 0 && !filteredAgents.some((a) => a.id === selectedId)) {
      setSelectedId(filteredAgents[0]!.id);
    }
    if (!filteredAgents.some((a) => a.id === selectedId)) {
      setSelectedId("");
    }
  }, [filteredAgents, selectedId]);

  const handleCreate = async (data: CreateAgentRequest) => {
    const agent = await api.createAgent(data);
    qc.invalidateQueries({ queryKey: workspaceKeys.agents(wsId) });
    setSelectedId(agent.id);
  };

  const handleUpdate = async (id: string, data: Record<string, unknown>) => {
    try {
      await api.updateAgent(id, data as UpdateAgentRequest);
      qc.invalidateQueries({ queryKey: workspaceKeys.agents(wsId) });
      toast.success(t("agents.agentUpdated", "Agent updated"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("agents.failedToUpdate", "Failed to update agent"));
      throw e;
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await api.archiveAgent(id);
      qc.invalidateQueries({ queryKey: workspaceKeys.agents(wsId) });
      toast.success(t("agents.agentArchived", "Agent archived"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("agents.failedToArchive", "Failed to archive agent"));
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await api.restoreAgent(id);
      qc.invalidateQueries({ queryKey: workspaceKeys.agents(wsId) });
      toast.success(t("agents.agentRestored", "Agent restored"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("agents.failedToRestore", "Failed to restore agent"));
    }
  };

  const selected = agents.find((a) => a.id === selectedId) ?? null;

  if (isLoading) {
    return (
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 grid grid-cols-3 gap-4 p-4">
          <div className="col-span-1 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-xl border bg-muted/50" />
            ))}
          </div>
          <div className="col-span-2 rounded-xl border bg-muted/50" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Left Panel - Agent Cards Grid */}
      <div className="w-96 border-r flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 border-b p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-semibold">{t("agents.title", "Agents")}</h1>
            <div className="flex items-center gap-1">
              {archivedCount > 0 && (
                <Button
                  variant={showArchived ? "secondary" : "ghost"}
                  size="icon-xs"
                  onClick={() => setShowArchived(!showArchived)}
                  title={showArchived ? t("agents.showActiveAgents", "Show active agents") : t("agents.showArchivedAgents", "Show archived agents")}
                >
                  <Archive className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("agents.searchPlaceholder", "Search agents...")}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {/* Agent Cards */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Bot className="h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">
                {showArchived 
                  ? t("agents.noArchivedAgents", "No archived agents") 
                  : archivedCount > 0 
                    ? t("agents.noActiveAgents", "No active agents") 
                    : t("agents.noAgents", "No agents yet")}
              </p>
              {!showArchived && (
                <Button onClick={() => setShowCreate(true)} size="sm" className="mt-3">
                  <Plus className="h-3 w-3" />
                  {t("agents.createAgent", "Create Agent")}
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  isSelected={agent.id === selectedId}
                  onClick={() => setSelectedId(agent.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Agent Detail */}
      <div className="flex-1 overflow-hidden">
        {selected ? (
          <AgentDetail
            key={selected.id}
            agent={selected}
            runtimes={runtimes}
            onUpdate={handleUpdate}
            onArchive={handleArchive}
            onRestore={handleRestore}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <Bot className="h-12 w-12 text-muted-foreground/20" />
            <p className="mt-4 text-sm">{t("agents.selectAgent", "Select an agent to view details")}</p>
            <Button
              onClick={() => setShowCreate(true)}
              size="sm"
              className="mt-3"
            >
              <Plus className="h-3 w-3" />
              {t("agents.createAgent", "Create Agent")}
            </Button>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateAgentDialog
          runtimes={runtimes}
          runtimesLoading={runtimesLoading}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

function AgentCard({
  agent,
  isSelected,
  onClick,
}: {
  agent: Agent;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const st = statusConfig[agent.status];
  const isArchived = !!agent.archived_at;

  return (
    <button
      onClick={onClick}
      className={`group relative w-full text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
        isSelected 
          ? "border-primary bg-primary/5 shadow-sm" 
          : "border-border hover:border-primary/30 hover:bg-muted/50"
      } ${isArchived ? "opacity-60" : ""}`}
    >
      {/* Status Indicator */}
      {!isArchived && (
        <div className={`absolute top-3 right-3 h-2 w-2 rounded-full ${st.dot}`} />
      )}
      
      {/* Content */}
      <div className="flex items-start gap-3">
        <ActorAvatar 
          actorType="agent" 
          actorId={agent.id} 
          size={40} 
          className={`rounded-lg ${isArchived ? "grayscale" : ""}`} 
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold truncate ${isArchived ? "text-muted-foreground" : ""}`}>
              {agent.name}
            </span>
            {agent.runtime_mode === "cloud" ? (
              <Cloud className="h-3 w-3 shrink-0 text-muted-foreground" />
            ) : (
              <Monitor className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            {isArchived ? (
              <span className="text-xs text-muted-foreground">{t("common.archive", "Archived")}</span>
            ) : (
              <>
                <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                <span className={`text-xs ${st.color}`}>{t(st.labelKey, st.defaultLabel)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {agent.description && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{agent.description}</p>
      )}

      {/* Skills Preview */}
      {agent.skills.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{agent.skills.length}</span>
          <span className="text-xs text-muted-foreground">{t("agents.skillsCount", "skills")}</span>
          <div className="flex -space-x-1 ml-1">
            {agent.skills.slice(0, 3).map((skill) => (
              <div 
                key={skill.id} 
                className="h-5 w-5 rounded-full bg-muted border-2 border-background flex items-center justify-center"
                title={skill.name}
              >
                <span className="text-[8px] font-medium text-muted-foreground">
                  {skill.name.charAt(0)}
                </span>
              </div>
            ))}
            {agent.skills.length > 3 && (
              <div className="h-5 w-5 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                <span className="text-[8px] font-medium text-muted-foreground">+{agent.skills.length - 3}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selection Indicator */}
      {isSelected && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-b-xl opacity-0" />
      )}
    </button>
  );
}