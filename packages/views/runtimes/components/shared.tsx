import { Monitor, Cloud, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@multica/ui/components/ui/badge";
import { useTranslation } from "@multica/core";

export function RuntimeModeIcon({ mode }: { mode: string }) {
  return mode === "cloud" ? (
    <Cloud className="h-3.5 w-3.5" />
  ) : (
    <Monitor className="h-3.5 w-3.5" />
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const isOnline = status === "online";
  return (
    <Badge
      variant="secondary"
      className={`gap-1.5 px-2.5 py-1 text-xs font-medium ${
        isOnline ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"
      }`}
    >
      {isOnline ? (
        <Wifi className="h-3 w-3" />
      ) : (
        <WifiOff className="h-3 w-3" />
      )}
      {isOnline ? t("runtimes.status.online", "Online") : t("runtimes.status.offline", "Offline")}
    </Badge>
  );
}

export function InfoField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground tracking-wide">{label}</div>
      <div
        className={`text-sm truncate ${mono ? "font-mono text-xs bg-muted/50 px-1.5 py-0.5 rounded" : "font-medium text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}

export function TokenCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-3.5 py-2.5">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-base font-semibold text-foreground tabular-nums tracking-tight">{value}</div>
    </div>
  );
}
