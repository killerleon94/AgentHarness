"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@multica/ui/components/ui/card";
import { Input } from "@multica/ui/components/ui/input";
import { Button } from "@multica/ui/components/ui/button";
import { Label } from "@multica/ui/components/ui/label";
import { useAuthStore } from "@multica/core/auth";

// We'll use window.location directly since this is a static link


interface ForgotPasswordPageProps {
  logo?: React.ReactNode;
  onResetRequested?: () => void;
}

export function ForgotPasswordPage({ logo, onResetRequested }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email) {
        setError("Email is required");
        return;
      }
      setLoading(true);
      setError("");
      try {
        await useAuthStore.getState().requestPasswordReset(email);
        setSuccess(true);
        onResetRequested?.();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to send reset email"
        );
        setLoading(false);
      }
    },
    [email, onResetRequested]
  );

  if (success) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            {logo && <div className="mx-auto mb-4">{logo}</div>}
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription>
              We&apos;ve sent a password reset link to {email}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Click the link in the email to reset your password. The link will
            expire in 1 hour.
          </CardContent>
          <CardFooter>
            <Button className="w-full" size="lg" onClick={() => window.location.href = "/login-password"}>
              Back to login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          {logo && <div className="mx-auto mb-4">{logo}</div>}
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={!email || loading}
            >
              {loading ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <div className="text-center text-sm text-muted-foreground">
            Remember your password?{" "}
            <a href="/login-password" className="text-primary hover:underline">
              Sign in
            </a>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

interface ResetPasswordPageProps {
  logo?: React.ReactNode;
  token: string;
  onSuccess: () => void;
}

export function ResetPasswordPage({ logo, token, onSuccess }: ResetPasswordPageProps) {

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!token) {
        setError("Invalid reset token");
        return;
      }
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
        await useAuthStore.getState().resetPassword(token, password);
        setSuccess(true);
        onSuccess();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to reset password"
        );
        setLoading(false);
      }
    },
    [token, password, confirmPassword, onSuccess]
  );

  if (!token) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Invalid Token</CardTitle>
            <CardDescription>
              This password reset link is invalid or has expired
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" size="lg" onClick={() => window.location.href = "/login"}>
              Request a new link
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            {logo && <div className="mx-auto mb-4">{logo}</div>}
            <CardTitle className="text-2xl">Password Reset</CardTitle>
            <CardDescription>
              Your password has been reset successfully
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" size="lg" onClick={() => window.location.href = "/login"}>
              Sign in with new password
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          {logo && <div className="mx-auto mb-4">{logo}</div>}
          <CardTitle className="text-2xl">Set New Password</CardTitle>
          <CardDescription>Enter your new password</CardDescription>
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
              {loading ? "Resetting..." : "Reset password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
