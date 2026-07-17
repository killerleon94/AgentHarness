import { Server, ArrowUpCircle, ChevronDown, Check, Play, Square } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import type { AgentRuntime, MemberWithUser } from "@multica/core/types";
import { useWorkspaceId } from "@multica/core/hooks";
import { useTranslation } from "@multica/core";
import { memberListOptions } from "@multica/core/workspace/queries";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@multica/ui/components/ui/dropdown-menu";
import { ActorAvatar } from "../../common/actor-avatar";
import { ProviderLogo } from "./provider-logo";

type RuntimeFilter = "mine" | "all";

function RuntimeListItem({
  runtime,
  isSelected,
  ownerMember,
  hasUpdate,
  onClick,
  t,
}: {
  runtime: AgentRuntime;
  isSelected: boolean;
  ownerMember: MemberWithUser | null;
  hasUpdate: boolean;
  onClick: () => void;
  t: (key: string, fallback: string) => string;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-all duration-150 cursor-pointer ${
        isSelected
          ? "bg-accent border-l-2 border-l-primary"
          : "hover:bg-accent/60 border-l-2 border-l-transparent"
      }`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50">
        <ProviderLogo provider={runtime.provider} className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{runtime.name}</div>
        <div className="mt-1 flex items-center gap-1.5">
          {ownerMember ? (
            <>
              <ActorAvatar
                actorType="member"
                actorId={ownerMember.user_id}
                size={14}
              />
              <span className="truncate text-xs text-muted-foreground">{ownerMember.name}</span>
            </>
          ) : (
            <span className="truncate text-xs text-muted-foreground">{runtime.runtime_mode}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {hasUpdate && (
          <span title={t("runtimes.updateAvailable", "Update available")}>
            <ArrowUpCircle className="h-4 w-4 text-info" />
          </span>
        )}
        <div
          className={`h-2 w-2 rounded-full transition-colors ${
            runtime.status === "online" ? "bg-success shadow-sm shadow-success/50" : "bg-muted-foreground/30"
          }`}
        />
      </div>
    </button>
  );
}

export function RuntimeList({
  runtimes,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
  ownerFilter,
  onOwnerFilterChange,
  updatableIds,
}: {
  runtimes: AgentRuntime[];
  selectedId: string;
  onSelect: (id: string) => void;
  filter: RuntimeFilter;
  onFilterChange: (filter: RuntimeFilter) => void;
  ownerFilter: string | null;
  onOwnerFilterChange: (ownerId: string | null) => void;
  updatableIds?: Set<string>;
}) {
  const { t } = useTranslation();
  const wsId = useWorkspaceId();
  const { data: members = [] } = useQuery(memberListOptions(wsId));
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isStartingMultica, setIsStartingMultica] = useState(false);
  const [isStoppingMultica, setIsStoppingMultica] = useState(false);
  const [daemonStatus, setDaemonStatus] = useState<"running" | "stopped" | "unknown">("unknown");

  // Get token from localStorage (matches what auth store uses)
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Read token from localStorage - this is what the auth store uses
    const storedToken = localStorage.getItem("multica_token");
    setToken(storedToken);
  }, []);

  // Fetch daemon status on mount and periodically
  useEffect(() => {
    const fetchStatus = async () => {
      if (!token) return;
      
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      };

      try {
        const statusResponse = await fetch("/api/multica/cli", {
          method: "POST",
          headers,
          body: JSON.stringify({ command: "daemon status" }),
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          const output = statusData.output as { status?: string } | undefined;
          setDaemonStatus(output?.status === "running" ? "running" : "stopped");
        } else {
          setDaemonStatus("stopped");
        }
      } catch {
        setDaemonStatus("stopped");
      }
    };

    fetchStatus();
    // Poll every 10 seconds
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [token]);

  const handleStopMultica = async () => {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      setIsStoppingMultica(true);

      // Call daemon stop
      const stopResponse = await fetch("/api/multica/cli", {
        method: "POST",
        headers,
        body: JSON.stringify({ command: "daemon stop" }),
      });

      if (!stopResponse.ok) {
        const errorData = await stopResponse.json();
        throw new Error(errorData.error || "Failed to stop daemon");
      }

      // Update status immediately after successful stop
      setDaemonStatus("stopped");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to stop AgentHarness:", error);
      alert("Failed to stop AgentHarness: " + message);
    } finally {
      setIsStoppingMultica(false);
    }
  };

  const handleStartMultica = async () => {
    try {
      // Use existing token from localStorage to authenticate with the API
      // The "login" command will auto-create a PAT and configure multica CLI
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // First call login to auto-create PAT and configure multica
      const loginResponse = await fetch("/api/multica/cli", {
        method: "POST",
        headers,
        body: JSON.stringify({ command: "login" }),
      });

      if (!loginResponse.ok) {
        const errorData = await loginResponse.json();
        throw new Error(errorData.error || "Login failed");
      }

      setIsStartingMultica(true);

      // Call daemon start (ignore error if already running)
      const daemonStartResponse = await fetch("/api/multica/cli", {
        method: "POST",
        headers,
        body: JSON.stringify({ command: "daemon start" }),
      });

      if (!daemonStartResponse.ok) {
        const errorData = await daemonStartResponse.json();
        // If daemon is already running, that's okay - we'll check status below
        if (!errorData.error?.includes("already running")) {
          throw new Error(errorData.error || "Failed to start daemon");
        }
      }

      // Poll for daemon status
      let isRunning = false;
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between checks
        const statusResponse = await fetch("/api/multica/cli", {
          method: "POST",
          headers,
          body: JSON.stringify({ command: "daemon status" }),
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          // Response is { status: "success", output: { status: "running", ... } }
          const output = statusData.output as { status?: string } | undefined;
          if (output?.status === "running") {
            isRunning = true;
            setDaemonStatus("running");
            break;
          }
        } else {
          const errorData = await statusResponse.json();
          throw new Error(errorData.error || "Failed to check daemon status");
        }
      }

      if (!isRunning) {
        throw new Error("Daemon failed to start");
      }

      // Refresh runtimes list - relies on WS event
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to start AgentHarness:", error);
      alert("Failed to start AgentHarness: " + message);
    } finally {
      setIsLoggingIn(false);
      setIsStartingMultica(false);
    }
  };

  const getOwnerMember = (ownerId: string | null) => {
    if (!ownerId) return null;
    return members.find((m) => m.user_id === ownerId) ?? null;
  };

  // Get unique owners from runtimes for filter dropdown
  const uniqueOwners = filter === "all"
    ? Array.from(new Set(runtimes.map((r) => r.owner_id).filter(Boolean) as string[]))
      .map((id) => members.find((m) => m.user_id === id))
      .filter(Boolean) as MemberWithUser[]
    : [];

  // Count runtimes per owner
  const ownerCounts = new Map<string, number>();
  for (const r of runtimes) {
    if (r.owner_id) ownerCounts.set(r.owner_id, (ownerCounts.get(r.owner_id) ?? 0) + 1);
  }

  // Apply client-side owner filter when in "all" mode
  const filteredRuntimes = filter === "all" && ownerFilter
    ? runtimes.filter((r) => r.owner_id === ownerFilter)
    : runtimes;

  const selectedOwner = ownerFilter ? getOwnerMember(ownerFilter) : null;

  return (
    <div className="overflow-y-auto h-full border-r bg-background/50">
      <div className="flex h-12 items-center justify-between border-b px-4 bg-background/80">
        <h1 className="text-sm font-semibold tracking-tight">{t("runtimes.title", "Runtimes")}</h1>
        <span className="text-xs text-muted-foreground font-medium">
          {filteredRuntimes.filter((r) => r.status === "online").length}/
          {filteredRuntimes.length} {t("runtimes.online", "online")}
        </span>
      </div>

      <div className="flex items-center justify-between border-b px-4 py-2.5 bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
            <button
              onClick={() => { onFilterChange("mine"); onOwnerFilterChange(null); }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                filter === "mine"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              }`}
            >
              {t("runtimes.filterMine", "Mine")}
            </button>
            <button
              onClick={() => { onFilterChange("all"); onOwnerFilterChange(null); }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                filter === "all"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              }`}
            >
              {t("runtimes.filterAll", "All")}
            </button>
          </div>

          {filter === "all" && uniqueOwners.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent cursor-pointer" />
                }
              >
                {selectedOwner ? (
                  <>
                    <ActorAvatar actorType="member" actorId={selectedOwner.user_id} size={16} />
                    <span className="max-w-20 truncate">{selectedOwner.name}</span>
                  </>
                ) : (
                  <span>{t("runtimes.ownerPlaceholder", "Owner")}</span>
                )}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => onOwnerFilterChange(null)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span className="text-xs">{t("runtimes.allOwners", "All owners")}</span>
                  {!ownerFilter && <Check className="h-3.5 w-3.5 text-foreground" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {uniqueOwners.map((m) => (
                  <DropdownMenuItem
                    key={m.user_id}
                    onClick={() => onOwnerFilterChange(ownerFilter === m.user_id ? null : m.user_id)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ActorAvatar actorType="member" actorId={m.user_id} size={18} />
                      <span className="text-xs truncate">{m.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{ownerCounts.get(m.user_id) ?? 0}</span>
                    </div>
                    {ownerFilter === m.user_id && <Check className="h-3.5 w-3.5 shrink-0 text-foreground" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center gap-2">
          {daemonStatus === "running" ? (
            <button
              onClick={handleStopMultica}
              disabled={isStoppingMultica}
              className="flex items-center gap-1.5 rounded-md bg-destructive/10 text-destructive px-3 py-1.5 text-xs font-medium transition-colors hover:bg-destructive/20 cursor-pointer"
            >
              {isStoppingMultica ? (
                <>
                  <Square className="h-3.5 w-3.5 animate-spin" />
                  <span>{t("runtimes.stopping", "Stopping...")}</span>
                </>
              ) : (
                <>
                  <Square className="h-3.5 w-3.5" />
                  <span>{t("runtimes.stop", "Stop")}</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleStartMultica}
              disabled={isStartingMultica || isLoggingIn || daemonStatus === "unknown"}
              className="flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium transition-colors hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
            >
              {isStartingMultica ? (
                <>
                  <Play className="h-3.5 w-3.5 animate-spin" />
                  <span>{t("runtimes.starting", "Starting...")}</span>
                </>
              ) : isLoggingIn ? (
                <>
                  <Play className="h-3.5 w-3.5 animate-spin" />
                  <span>{t("runtimes.loggingIn", "Logging in...")}</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  <span>{t("runtimes.start", "Start")}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {filteredRuntimes.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/50">
            <Server className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="mt-4 text-sm font-medium text-muted-foreground">
            {filter === "mine" 
              ? t("runtimes.noOwned", "No runtimes owned by you") 
              : ownerFilter 
                ? t("runtimes.noForOwner", "No runtimes for this owner") 
                : t("runtimes.noRegistered", "No runtimes registered")}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground/70 text-center max-w-[200px]">
            {t("runtimes.emptyHint", "Run harness daemon start to register a local runtime.")}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {filteredRuntimes.map((runtime) => (
            <RuntimeListItem
              key={runtime.id}
              runtime={runtime}
              isSelected={runtime.id === selectedId}
              ownerMember={getOwnerMember(runtime.owner_id)}
              hasUpdate={updatableIds?.has(runtime.id) ?? false}
              onClick={() => onSelect(runtime.id)}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}
