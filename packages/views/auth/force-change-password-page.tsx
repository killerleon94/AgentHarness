"use client";

import { useState, useCallback } from "react";
import { ShieldAlert } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@multica/ui/components/ui/card";
import { Alert, AlertDescription } from "@multica/ui/components/ui/alert";
import { Input } from "@multica/ui/components/ui/input";
import { Button } from "@multica/ui/components/ui/button";
import { Label } from "@multica/ui/components/ui/label";
import { api } from "@multica/core/api";
import { useAuthStore } from "@multica/core/auth";

interface ForceChangePasswordPageProps {
  logo?: React.ReactNode;
  onSuccess: () => void;
}

export function ForceChangePasswordPage({
  logo,
  onSuccess,
}: ForceChangePasswordPageProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const userEmail = useAuthStore((s) => s.user?.email) ?? "";

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!password) {
        setError("New password is required");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
      setLoading(true);
      setError("");
      try {
        await api.changePassword(null, password);
        // Refresh user data to get updated password_change_required status
        await useAuthStore.getState().initialize();
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to change password");
        setLoading(false);
      }
    },
    [password, confirmPassword, onSuccess]
  );

  return (
    <div className="flex min-h-svh items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          {logo && <div className="mx-auto mb-4">{logo}</div>}
          <CardTitle className="text-2xl">Set Your Password</CardTitle>
          <CardDescription>
            Your account has been created by an administrator. Please set a new password to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              First time login for <strong>{userEmail}</strong>. You must set a new password before accessing the system.
            </AlertDescription>
          </Alert>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={!password || !confirmPassword || loading}
            >
              {loading ? "Changing..." : "Change password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
