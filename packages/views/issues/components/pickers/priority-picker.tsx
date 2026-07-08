"use client";

import type { IssuePriority, UpdateIssueRequest } from "@multica/core/types";
import { PRIORITY_ORDER, PRIORITY_CONFIG } from "@multica/core/issues/config";
import { PriorityIcon } from "../priority-icon";
import { PropertyPicker, PickerItem } from "./property-picker";

import { useControllableOpen, fallbackT, withT, type TranslateFn } from "@multica/core";

function getPriorityDictKey(priority: IssuePriority): string {
  const map: Record<string, string> = {
    urgent: "urgent",
    high: "high",
    medium: "medium",
    low: "low",
    none: "noPriority",
  };
  return map[priority] || priority;
}

export function PriorityPicker({
  priority,
  onUpdate,
  trigger: customTrigger,
  triggerRender,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  align,
  t = fallbackT,
}: {
  priority: IssuePriority;
  onUpdate: (updates: Partial<UpdateIssueRequest>) => void;
  trigger?: React.ReactNode;
  triggerRender?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  align?: "start" | "center" | "end";
  t?: TranslateFn;
}) {
  const [open, setOpen] = useControllableOpen(controlledOpen, controlledOnOpenChange);
  const cfg = PRIORITY_CONFIG[priority];
  const translate = withT(t);

  return (
    <PropertyPicker
      open={open}
      onOpenChange={setOpen}
      width="w-44"
      align={align}
      triggerRender={triggerRender}
      trigger={
        customTrigger ?? (
          <>
            <PriorityIcon priority={priority} className="shrink-0" />
            <span className="truncate">{translate(`issueDetail.priorities.${getPriorityDictKey(priority)}`, cfg.label)}</span>
          </>
        )
      }
    >
      {PRIORITY_ORDER.map((p) => {
        const c = PRIORITY_CONFIG[p];
        return (
          <PickerItem
            key={p}
            selected={p === priority}
            onClick={() => {
              onUpdate({ priority: p });
              setOpen(false);
            }}
          >
            <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${c.badgeBg} ${c.badgeText}`}>
              <PriorityIcon priority={p} className="h-3 w-3" inheritColor />
              {translate(`issueDetail.priorities.${getPriorityDictKey(p)}`, c.label)}
            </span>
          </PickerItem>
        );
      })}
    </PropertyPicker>
  );
}
