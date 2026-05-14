"use client";

import { useState, useCallback, useEffect } from "react";
import { Input } from "@multica/ui/components/ui/input";
import { Button } from "@multica/ui/components/ui/button";
import { Loader2 } from "lucide-react";
import { api } from "@multica/core/api";
import { useTranslation } from "@multica/core";

export function useCaptcha() {
  const { t } = useTranslation();
  const [captchaId, setCaptchaId] = useState("");
  const [captchaImage, setCaptchaImage] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadCaptcha = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.newCaptcha();
      setCaptchaId(data.id);
      setCaptchaImage(data.image_data);
      setCaptchaAnswer("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load captcha");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCaptcha();
  }, [loadCaptcha]);

  return {
    captchaId,
    captchaImage,
    captchaAnswer,
    setCaptchaAnswer,
    loading,
    error,
    refresh: loadCaptcha,
  };
}

interface CaptchaDisplayProps {
  image: string;
  loading: boolean;
  onRefresh: () => void;
}

export function CaptchaDisplay({ image, loading, onRefresh }: CaptchaDisplayProps) {
  const { t } = useTranslation();
  return (
    <Button
      type="button"
      variant="outline"
      className="p-0 h-9 w-20 overflow-hidden shrink-0"
      onClick={onRefresh}
      title={t("captcha.refresh", "刷新验证码")}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : image ? (
        <img src={image} alt="captcha" className="h-full w-full object-contain" />
      ) : null}
    </Button>
  );
}