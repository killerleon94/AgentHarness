"use client";

import { useState, useCallback } from "react";
import { Check, Search, X } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@multica/ui/components/ui/popover";

import { withT, type TranslateFn } from "@multica/core";

export function PropertyPicker({
  open,
  onOpenChange,
  trigger,
  triggerRender,
  width = "w-52",
  align = "end",
  searchable = false,
  searchPlaceholder = "Search...",
  onSearchChange,
  children,
  t,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trigger: React.ReactNode;
  triggerRender?: React.ReactElement;
  width?: string;
  align?: "start" | "center" | "end";
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearchChange?: (query: string) => void;
  children: React.ReactNode;
  t?: TranslateFn;
}) {
  const [query, setQuery] = useState("");
  const translate = withT(t);

  const handleOpenChange = useCallback(
    (v: boolean) => {
      onOpenChange(v);
      if (!v) {
        setQuery("");
        onSearchChange?.("");
      }
    },
    [onOpenChange, onSearchChange],
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        className={triggerRender ? undefined : "flex items-center gap-1.5 cursor-pointer rounded-lg px-2 py-1 -mx-2 hover:bg-muted/50 transition-all duration-200"}
        {...(triggerRender ? { render: triggerRender } : {})}
      >
        {trigger}
      </PopoverTrigger>
      <PopoverContent align={align} className={`${width} gap-0 p-0 shadow-xl shadow-slate-200/30 dark:shadow-slate-950/50 rounded-xl border-border/60 overflow-hidden`}>
        {searchable && (
          <div className="px-3 py-2.5 border-b border-border/40 bg-muted/20">
            <div className="flex items-center gap-2 px-2.5 h-9 rounded-lg bg-background border border-border/50 shadow-sm">
              <Search className="size-4 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  onSearchChange?.(e.target.value);
                }}
                placeholder={translate('issuesHeader.filter', searchPlaceholder)}
                aria-label="Search options"
                className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground outline-none"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
        <div className="p-1.5 max-h-64 overflow-y-auto">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

export function PickerItem({
  selected,
  disabled,
  onClick,
  hoverClassName,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  hoverClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all duration-150 ${
        disabled 
          ? "opacity-50 cursor-not-allowed" 
          : `cursor-pointer ${hoverClassName ?? "hover:bg-muted/60"}`
      } ${selected ? "bg-primary/8 text-primary" : ""}`}
    >
      <span className="flex flex-1 items-center gap-2.5">{children}</span>
      {selected && <Check className="h-4 w-4 text-primary" />}
    </button>
  );
}

export function PickerSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="px-3 pt-2.5 pb-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      {children}
    </div>
  );
}

export function PickerEmpty() {
  return (
    <div className="px-3 py-6 text-center">
      <div className="text-xs text-muted-foreground/50 font-medium">No results found</div>
    </div>
  );
}
