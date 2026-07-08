import { useState } from "react";

/**
 * Manage an open/close boolean that can be either controlled (via props) or
 * uncontrolled (internal state). Falls back to internal state when the
 * controlled value/handler are not provided.
 */
export function useControllableOpen(
  controlledOpen?: boolean,
  controlledOnOpenChange?: (open: boolean) => void,
): [boolean, (open: boolean) => void] {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  return [open, setOpen];
}
