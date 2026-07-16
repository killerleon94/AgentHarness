"use client";

import { useState } from "react";
import { User, Palette, Key, Settings, Users, FolderGit2, Shield, Building2 } from "lucide-react";
import { useWorkspaceStore } from "@multica/core/workspace";
import { useAuthStore } from "@multica/core/auth";
import { useTranslation } from "@multica/core";
import { AccountTab } from "./account-tab";
import { AppearanceTab } from "./appearance-tab";
import { TokensTab } from "./tokens-tab";
import { ApiKeysTab } from "./api-keys-tab";
import { WorkspaceTab } from "./workspace-tab";
import { MembersTab } from "./members-tab";
import { RepositoriesTab } from "./repositories-tab";
import { AdminUsersPage, AdminWorkspacesPage } from "@multica/views/admin";
import { cn } from "@multica/ui/lib/utils";

type TabId = "profile" | "appearance" | "tokens" | "workspace" | "api-keys" | "repositories" | "members" | "users" | "workspaces";

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ElementType;
  group: "account" | "workspace";
}

export function SettingsPage() {
  const { t } = useTranslation();
  const workspaceName = useWorkspaceStore((s) => s.workspace?.name);
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  const accountTabs: TabConfig[] = [
    { id: "profile", label: t("settings.navigation.profile", "Profile"), icon: User, group: "account" },
    { id: "appearance", label: t("settings.navigation.appearance", "Appearance"), icon: Palette, group: "account" },
    { id: "tokens", label: t("settings.navigation.apiTokens", "API Tokens"), icon: Key, group: "account" },
  ];

  const workspaceTabs: TabConfig[] = [
    { id: "workspace", label: t("settings.navigation.general", "General"), icon: Settings, group: "workspace" },
    { id: "api-keys", label: t("settings.navigation.apiKeys", "API Keys"), icon: Key, group: "workspace" },
    { id: "repositories", label: t("settings.navigation.repositories", "Repositories"), icon: FolderGit2, group: "workspace" },
    { id: "members", label: t("settings.navigation.members", "Members"), icon: Users, group: "workspace" },
    ...(user?.role === "admin" ? [
      { id: "users" as const, label: t("settings.navigation.users", "Users"), icon: Shield, group: "workspace" as const },
      { id: "workspaces" as const, label: t("settings.navigation.workspaces", "Workspaces"), icon: Building2, group: "workspace" as const },
    ] : []),
  ];

  const allTabs = [...accountTabs, ...workspaceTabs];

  const renderContent = () => {
    switch (activeTab) {
      case "profile": return <AccountTab />;
      case "appearance": return <AppearanceTab />;
      case "tokens": return <TokensTab />;
      case "workspace": return <WorkspaceTab />;
      case "api-keys": return <ApiKeysTab />;
      case "repositories": return <RepositoriesTab />;
      case "members": return <MembersTab />;
      case "users": return <AdminUsersPage />;
      case "workspaces": return <AdminWorkspacesPage />;
      default: return null;
    }
  };

  return (
    <div className="flex h-full flex-col bg-gradient-to-br from-background via-background to-muted/20">
      {/* Modern Header */}
      <div className="shrink-0 border-b border-border/60 bg-card/80 backdrop-blur-sm">
        <div className="px-6 py-5">
          <div className="flex items-center gap-4 mb-5">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
              <Settings className="size-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{t("common.settings", "Settings")}</h1>
              <p className="text-sm text-muted-foreground">{workspaceName ?? t("common.workspace", "Workspace")}</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border/40 w-fit">
            {allTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer",
                    isActive
                      ? "bg-background shadow-sm text-foreground border border-border/60"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  <Icon className="size-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
