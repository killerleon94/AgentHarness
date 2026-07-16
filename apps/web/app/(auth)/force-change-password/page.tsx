"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@multica/core/auth";
import { ForceChangePasswordPage } from "@multica/views/auth";

function ForceChangeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const nextUrl = searchParams.get("next") || "/issues";

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!user.password_change_required) {
      router.replace(nextUrl);
    }
  }, [isLoading, user, router, nextUrl]);

  if (isLoading || !user || user.password_change_required !== true) return null;

  return <ForceChangePasswordPage onSuccess={() => { window.location.href = nextUrl; }} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ForceChangeContent />
    </Suspense>
  );
}
