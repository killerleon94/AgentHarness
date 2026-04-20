"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@multica/ui/components/ui/card";
import { Input } from "@multica/ui/components/ui/input";
import { Button } from "@multica/ui/components/ui/button";
import { Label } from "@multica/ui/components/ui/label";
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
      // We need to get the current user ID from store
      const user = useAuthStore((s) => s.user);
      if (!user) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }
      // After successful change, the password_change_required flag will be cleared
      // We just need to login again or refresh the user data
      const token = localStorage.getItem("multica_token");
      if (!token) {
        setError("No token found");
        setLoading(false);
        return;
      }
      // Reset password with the existing token
      // We need to get reset password endpoint actually the same endpoint can be used
      // But for force change we just do it directly with current token isntead of reset token
      // Actually, let's create a different approach - we can just call update password through the existing reset endpoint with a special case
      await useAuthStore.getState().resetPassword(token, password);
       // Refresh user data
       await useAuthStore.getState().initialize();
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to change password");
      setLoading(false);
    }
  }, [password, confirmPassword, onSuccess]);

  return (
    <div className="flex min-h-svh items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          {logo && <div className="mx-auto mb-4">{logo}</div>}
          <CardTitle className="text-2xl">Change Password</CardTitle>
          <CardDescription>
            You must change your password before continuing
          </CardDescription>
        </CardHeader>
        <CardContent>
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
