"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const COPIED_RESET_MS = 1500;

/**
 * Icon-only copy-to-clipboard button. `label` is the accessible name (e.g.
 * "Copy Enterprise onboarding") — never visible text, so it must fully
 * describe what gets copied on its own. The "Copied" confirmation is
 * announced via aria-live rather than shown only visually, since the icon
 * swap alone is invisible to a screen reader.
 */
export function CopyButton({
  value,
  label,
  small,
}: {
  value: string;
  label: string;
  small?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => window.clearTimeout(timeoutRef.current);
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(
        () => setCopied(false),
        COPIED_RESET_MS,
      );
    } catch {
      // Clipboard access can be denied by the browser/permissions — silently
      // no-op rather than surface an error for a non-critical convenience action.
    }
  }

  return (
    <button
      type="button"
      className={cn("icon-button", small && "icon-button-sm")}
      onClick={handleCopy}
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
    >
      {copied ? (
        <Check size={small ? 12 : 15} />
      ) : (
        <Copy size={small ? 12 : 15} />
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </button>
  );
}
