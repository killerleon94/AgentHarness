"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@multica/ui/components/ui/input-otp";

import { useAuthStore } from "@multica/core/auth";
import { useWorkspaceStore } from "@multica/core/workspace";
import { useI18nStore, useTranslation } from "@multica/core";
import { api } from "@multica/core/api";
import type { User } from "@multica/core/types";
import { Loader2, Mail, Lock, Globe, Moon, Sun, Monitor } from "lucide-react";
import { useCaptcha } from "./captcha-input";

interface GoogleAuthConfig {
  clientId: string;
  redirectUri: string;
}

interface CliCallbackConfig {
  url: string;
  state: string;
}

interface LoginPageProps {
  logo?: ReactNode;
  onSuccess: () => void;
  onForceChangePassword?: () => void;
  google?: GoogleAuthConfig;
  cliCallback?: CliCallbackConfig;
  lastWorkspaceId?: string | null;
  onTokenObtained?: () => void;
}

export function LoginPageV2({
  logo,
  onSuccess,
  onForceChangePassword,
  google,
  cliCallback,
  lastWorkspaceId,
  onTokenObtained,
}: LoginPageProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"login_password" | "login_code" | "register" | "forgot">("login_password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [existingUser, setExistingUser] = useState<User | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const captcha = useCaptcha();

  const { hydrateWorkspace } = useWorkspaceStore();
  const { language: currentLang, setLanguage } = useI18nStore();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    setError("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setName("");
    setCode("");
    setCodeSent(false);
    captcha.setCaptchaAnswer("");
  }, [mode]);

  useEffect(() => {
    if (!cliCallback) return;
    const token = localStorage.getItem("multica_token");
    if (!token) return;

    api.setToken(token);
    api
      .getMe()
      .then((user) => {
        setExistingUser(user);
      })
      .catch(() => {
        api.setToken(null);
        localStorage.removeItem("multica_token");
      });
  }, [cliCallback]);

  const handlePasswordLogin = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      setError("");

      if (!email) {
        setError(t("auth.validation.emailRequired"));
        return;
      }
      if (!password) {
        setError(t("auth.validation.passwordRequired"));
        return;
      }

      if (!captcha.captchaId) {
        setError(t("captcha.required", "请先完成图形验证码"));
        return;
      }

      setLoading(true);
      try {
        const { token, user } = await api.loginWithPassword(email, password, captcha.captchaId, captcha.captchaAnswer);
        localStorage.setItem("multica_token", token);
        api.setToken(token);
        onTokenObtained?.();
        useAuthStore.getState().setUser(user);

        if (user.password_change_required && onForceChangePassword) {
          onForceChangePassword();
        } else {
          const wsList = await api.listWorkspaces();
          hydrateWorkspace(wsList, lastWorkspaceId);
          onSuccess();
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t("auth.errors.invalidCredentials")
        );
        captcha.refresh();
      } finally {
        setLoading(false);
      }
    },
    [email, password, lastWorkspaceId, onSuccess, onForceChangePassword, onTokenObtained, t, hydrateWorkspace, captcha]
  );

  const handleRegister = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      setError("");

      if (!name) {
        setError(t("auth.validation.nameRequired"));
        return;
      }
      if (!email) {
        setError(t("auth.validation.emailRequired"));
        return;
      }
      if (!password) {
        setError(t("auth.validation.passwordRequired"));
        return;
      }
      if (password.length < 8) {
        setError(t("auth.validation.passwordMinLength"));
        return;
      }
      if (password !== confirmPassword) {
        setError(t("auth.validation.passwordMismatch"));
        return;
      }

      setLoading(true);
      try {
        const { token, user } = await api.register(email, password, name);
        localStorage.setItem("multica_token", token);
        api.setToken(token);
        onTokenObtained?.();

        const wsList = await api.listWorkspaces();
        hydrateWorkspace(wsList, lastWorkspaceId);
        useAuthStore.getState().setUser(user);
        onSuccess();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t("auth.errors.registerFailed")
        );
      } finally {
        setLoading(false);
      }
    },
    [name, email, password, confirmPassword, lastWorkspaceId, onSuccess, onTokenObtained, t, hydrateWorkspace]
  );

  const handleSendCode = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!email) {
        setError(t("auth.validation.emailRequired"));
        return;
      }
      setLoading(true);
      setError("");
      try {
        await api._sendCode(email, captcha.captchaId, captcha.captchaAnswer);
        setCodeSent(true);
        setCooldown(10);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to send code. Make sure the server is running."
        );
      } finally {
        setLoading(false);
      }
    },
    [email, t, captcha]
  );

  const handleVerify = useCallback(
    async (value: string) => {
      if (value.length !== 6) return;
      setLoading(true);
      setError("");
      try {
        if (cliCallback) {
          const { token } = await api.verifyCode(email, value);
          localStorage.setItem("multica_token", token);
          api.setToken(token);
          onTokenObtained?.();
          redirectToCliCallback(cliCallback.url, token, cliCallback.state);
          return;
        }

        const user = await useAuthStore.getState().verifyCode(email, value);
        if (user.password_change_required && onForceChangePassword) {
          onTokenObtained?.();
          onForceChangePassword();
        } else {
          const wsList = await api.listWorkspaces();
          useWorkspaceStore.getState().hydrateWorkspace(wsList, lastWorkspaceId);
          onTokenObtained?.();
          onSuccess();
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("auth.errors.invalidCode")
        );
        setCode("");
        setLoading(false);
      }
    },
    [email, cliCallback, lastWorkspaceId, onSuccess, onTokenObtained, t]
  );

  const handleResend = useCallback(async () => {
    if (cooldown > 0) return;
    setError("");
    try {
      await api._sendCode(email, captcha.captchaId, captcha.captchaAnswer);
      setCooldown(10);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to resend code"
      );
    }
  }, [cooldown, email]);

  const handleForgotPassword = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!email) {
        setError(t("auth.validation.emailRequired"));
        return;
      }
      setLoading(true);
      setError("");
      try {
        await api.requestPasswordReset(email);
        setCodeSent(true);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("auth.errors.resetFailed")
        );
      } finally {
        setLoading(false);
      }
    },
    [email, t]
  );

  const handleGoogleLogin = () => {
    if (!google) return;
    const params = new URLSearchParams({
      client_id: google.clientId,
      redirect_uri: google.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  const handleCliAuthorize = () => {
    if (!cliCallback) return;
    const token = localStorage.getItem("multica_token");
    if (!token) return;
    setLoading(true);
    onTokenObtained?.();
    redirectToCliCallback(cliCallback.url, token, cliCallback.state);
  };

  if (existingUser && cliCallback) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            {logo && <div className="mx-auto mb-4">{logo}</div>}
            <CardTitle className="text-2xl">
              {t("auth.cli.authorize")}
            </CardTitle>
            <CardDescription>
              {t("auth.cli.authorizeDescription", `Allow the CLI to access Harness as ${existingUser.email}?`)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              onClick={handleCliAuthorize}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading
                ? t("auth.cli.authorizing")
                : t("auth.cli.authorizeBtn")}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setExistingUser(null);
              }}
            >
              {t("auth.cli.useDifferentAccount")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (codeSent && mode === "forgot") {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            {logo && <div className="mx-auto mb-4">{logo}</div>}
            <CardTitle className="text-2xl">
              {t("auth.checkYourEmail")}
            </CardTitle>
            <CardDescription>
              {t("auth.resetLinkSentTo", { email })}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-2">
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setCodeSent(false);
                setMode("login_password");
              }}
            >
              {t("auth.backToLogin")}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const isLoginMode = mode === "login_password" || mode === "login_code";

  return (
    <div className="flex min-h-svh items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          {logo && <div className="mx-auto mb-4">{logo}</div>}
          <CardTitle className="text-2xl">
            {showSettings
              ? t("auth.settings.title")
              : mode === "register"
              ? t("auth.signUp")
              : t("auth.signIn")}
          </CardTitle>
          {!showSettings && (
            <CardDescription>
              {google ? t("auth.orContinueWith") : t("auth.orContinueWith")}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent>
          {showSettings ? (
            <SettingsPanel
              currentLang={currentLang}
              onLanguageChange={setLanguage}
              onBack={() => setShowSettings(false)}
            />
          ) : (
            <>
              {google && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mb-4"
                    size="lg"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    {t("auth.continueWithGoogle")}
                  </Button>
                  <div className="relative w-full mb-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        {t("auth.orContinueWith")}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {isLoginMode && (
                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setMode("login_password")}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      mode === "login_password"
                        ? "border-input bg-accent text-accent-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Lock className="h-3.5 w-3.5" />
                    {t("auth.passwordLogin", "密码登录")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("login_code")}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      mode === "login_code"
                        ? "border-input bg-accent text-accent-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {t("auth.codeLogin", "验证码登录")}
                  </button>
                </div>
              )}

              {mode === "login_password" && (
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">{t("auth.email")}</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      autoFocus
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">{t("auth.password")}</Label>
                      <button
                        type="button"
                        onClick={() => setMode("forgot")}
                        className="text-xs text-primary underline-offset-4 hover:underline"
                      >
                        {t("auth.forgotPassword")}
                      </button>
                    </div>
                    <Input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          id="login-captcha"
                          type="text"
                          placeholder={t("captcha.placeholder", "图形验证码")}
                          value={captcha.captchaAnswer}
                          onChange={(e) => captcha.setCaptchaAnswer(e.target.value.toUpperCase())}
                          maxLength={4}
                          autoComplete="off"
                          className="flex-1 h-10"
                        />
                        <div
                          className="relative h-10 w-32 shrink-0 rounded-md overflow-hidden border bg-white cursor-pointer hover:opacity-80"
                          onClick={captcha.refresh}
                        >
                          {captcha.loading ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          ) : captcha.captchaImage ? (
                            <img
                              src={captcha.captchaImage}
                              alt="captcha"
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                      </div>
                      {captcha.error && (
                        <p className="text-xs text-destructive">{captcha.error}</p>
                      )}
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={loading || captcha.captchaAnswer.length < 4}
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t("auth.signIn")}
                    </Button>
                  </form>
                )}

              {mode === "login_code" && (
                <>
                  {!codeSent ? (
                    <form onSubmit={handleSendCode} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="code-email">{t("auth.email")}</Label>
                        <Input
                          id="code-email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          autoComplete="email"
                          autoFocus
                          required
                        />
                      </div>
                      <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          id="code-captcha"
                          type="text"
                          placeholder={t("captcha.placeholder", "图形验证码")}
                          value={captcha.captchaAnswer}
                          onChange={(e) => captcha.setCaptchaAnswer(e.target.value.toUpperCase())}
                          maxLength={4}
                          autoComplete="off"
                          className="flex-1 h-10"
                        />
                        <div
                          className="relative h-10 w-32 shrink-0 rounded-md overflow-hidden border bg-white cursor-pointer hover:opacity-80"
                          onClick={captcha.refresh}
                        >
                          {captcha.loading ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          ) : captcha.captchaImage ? (
                            <img
                              src={captcha.captchaImage}
                              alt="captcha"
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                      </div>
                      {captcha.error && (
                        <p className="text-xs text-destructive">{captcha.error}</p>
                      )}
                      </div>
                      {error && <p className="text-sm text-destructive">{error}</p>}
                      <Button
                        type="submit"
                        className="w-full"
                        size="lg"
                        disabled={loading || captcha.captchaAnswer.length < 4}
                      >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t("auth.sendCode")}
                      </Button>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>{t("auth.enterCode")}</Label>
                        <InputOTP
                          maxLength={6}
                          value={code}
                          onChange={(value) => {
                            setCode(value);
                            if (value.length === 6) handleVerify(value);
                          }}
                          disabled={loading}
                        >
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      {error && <p className="text-sm text-destructive">{error}</p>}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <button
                          type="button"
                          onClick={handleResend}
                          disabled={cooldown > 0}
                          className="text-primary underline-offset-4 hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
                        >
                          {cooldown > 0
                            ? t("auth.resendIn", { seconds: cooldown })
                            : t("auth.resendCode")}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {mode === "forgot" && (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">{t("auth.email")}</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      autoFocus
                      required
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={loading}
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("auth.sendResetLink")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setMode("login_password")}
                  >
                    {t("auth.backToLogin")}
                  </Button>
                </form>
              )}

              {mode === "register" && (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">{t("auth.name")}</Label>
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      autoFocus
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">{t("auth.email")}</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">{t("auth.password")}</Label>
                    <Input
                      id="register-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-confirm">{t("auth.confirmPassword")}</Label>
                    <Input
                      id="register-confirm"
                      type="password"
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
                    disabled={loading}
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("auth.createAccount")}
                  </Button>
                </form>
              )}

              {!showSettings && (
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  {isLoginMode ? (
                    <>
                      {t("auth.noAccount", "Don't have an account?")}{" "}
                      <button
                        type="button"
                        onClick={() => setMode("register")}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {t("auth.signUp")}
                      </button>
                    </>
                  ) : (
                    <>
                      {t("auth.alreadyHaveAccount", "Already have an account?")}{" "}
                      <button
                        type="button"
                        onClick={() => setMode("login_password")}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {t("auth.signIn")}
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>

        {!showSettings && (
          <CardFooter className="flex flex-col gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setShowSettings(true)}
            >
              <Globe className="mr-1.5 h-3.5 w-3.5" />
              {t("auth.settings.title")}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

function SettingsPanel({
  currentLang,
  onLanguageChange,
  onBack,
}: {
  currentLang: "en" | "zh";
  onLanguageChange: (lang: "en" | "zh") => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
    if (stored) setTheme(stored);
  }, []);

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.remove("light", "dark");
    if (newTheme !== "system") {
      document.documentElement.classList.add(newTheme);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.add(prefersDark ? "dark" : "light");
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>{t("auth.settings.language")}</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={currentLang === "en" ? "default" : "outline"}
            size="sm"
            onClick={() => onLanguageChange("en")}
          >
            English
          </Button>
          <Button
            variant={currentLang === "zh" ? "default" : "outline"}
            size="sm"
            onClick={() => onLanguageChange("zh")}
          >
            中文
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <Label>{t("auth.settings.theme")}</Label>
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant={theme === "light" ? "default" : "outline"}
            size="sm"
            onClick={() => handleThemeChange("light")}
          >
            <Sun className="mr-1.5 h-3.5 w-3.5" />
            {t("auth.settings.themeLight")}
          </Button>
          <Button
            variant={theme === "dark" ? "default" : "outline"}
            size="sm"
            onClick={() => handleThemeChange("dark")}
          >
            <Moon className="mr-1.5 h-3.5 w-3.5" />
            {t("auth.settings.themeDark")}
          </Button>
          <Button
            variant={theme === "system" ? "default" : "outline"}
            size="sm"
            onClick={() => handleThemeChange("system")}
          >
            <Monitor className="mr-1.5 h-3.5 w-3.5" />
            {t("auth.settings.themeSystem")}
          </Button>
        </div>
      </div>

      <Button variant="ghost" className="w-full" onClick={onBack}>
        {t("auth.backToLogin")}
      </Button>
    </div>
  );
}

function redirectToCliCallback(url: string, token: string, state: string) {
  const separator = url.includes("?") ? "&" : "?";
  window.location.href = `${url}${separator}token=${encodeURIComponent(token)}&state=${encodeURIComponent(state)}`;
}
