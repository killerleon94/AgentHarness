"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthStore } from "@multica/core/auth";
import { setLoggedInCookie } from "@/features/auth/auth-cookie";
import { LoginPageV2, validateCliCallback } from "@multica/views/auth";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

function LoginPageContent() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const searchParams = useSearchParams();

  const cliCallbackRaw = searchParams.get("cli_callback");
  const cliState = searchParams.get("cli_state") || "";
  const nextUrl = searchParams.get("next") || "/issues";

  useEffect(() => {
    if (!isLoading && user && !cliCallbackRaw) {
      if (user.password_change_required) {
        window.location.href = "/force-change-password";
      } else {
        router.replace(nextUrl);
      }
    }
  }, [isLoading, user, router, nextUrl, cliCallbackRaw]);

  const lastWorkspaceId =
    typeof window !== "undefined"
      ? localStorage.getItem("multica_workspace_id")
      : null;

  return (
    <LoginPageV2
      onSuccess={() => router.push(nextUrl)}
      onForceChangePassword={() => { window.location.href = "/force-change-password"; }}
      google={
        googleClientId
          ? {
              clientId: googleClientId,
              redirectUri: `${window.location.origin}/auth/callback`,
            }
          : undefined
      }
      cliCallback={
        cliCallbackRaw && validateCliCallback(cliCallbackRaw)
          ? { url: cliCallbackRaw, state: cliState }
          : undefined
      }
      lastWorkspaceId={lastWorkspaceId}
      onTokenObtained={setLoggedInCookie}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
