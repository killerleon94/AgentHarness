"use client";

import { useEffect, type ReactNode } from "react";
import { getApi } from "../api";
import { useAuthStore } from "../auth";
import { useWorkspaceStore } from "../workspace";
import { createLogger } from "../logger";
import { defaultStorage } from "./storage";
import type { StorageAdapter } from "../types/storage";

const logger = createLogger("auth");

export function AuthInitializer({
  children,
  onLogin,
  onLogout,
  storage = defaultStorage,
}: {
  children: ReactNode;
  onLogin?: () => void;
  onLogout?: () => void;
  storage?: StorageAdapter;
}) {
  useEffect(() => {
    const token = storage.getItem("multica_token");
    if (!token) {
      onLogout?.();
      useAuthStore.setState({ isLoading: false });
      return;
    }

    const api = getApi();
    api.setToken(token);
    const wsId = storage.getItem("multica_workspace_id");

    api.getMe()
      .then(async (user) => {
        onLogin?.();
        useAuthStore.setState({ user, isLoading: false });

        if (!user.password_change_required) {
          try {
            const wsList = await api.listWorkspaces();
            useWorkspaceStore.getState().hydrateWorkspace(wsList, wsId);
          } catch {
            // workspace load failed, user still logged in
          }
        }
      })
      .catch((err) => {
        logger.error("auth init failed", err);
        api.setToken(null);
        api.setWorkspaceId(null);
        storage.removeItem("multica_token");
        storage.removeItem("multica_workspace_id");
        onLogout?.();
        useAuthStore.setState({ user: null, isLoading: false });
      });
  }, []);

  return <>{children}</>;
}
