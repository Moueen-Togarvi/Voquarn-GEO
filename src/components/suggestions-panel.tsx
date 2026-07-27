"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Suggestion {
  id: string;
  text: string;
  category: string;
  volume: number | null;
  reason: string;
}

/**
 * AI-suggested prompts inbox: generate fresh prompt ideas and accept/dismiss.
 * Accepting adds the prompt to the tracked set (re-scan to measure it).
 */
export function SuggestionsPanel({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Load any pending suggestions on mount.
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`/api/brands/${brandId}/prompts/suggest`);
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions: Suggestion[] };
        if (!ignore) setItems(data.suggestions ?? []);
      } catch {
        /* non-critical */
      }
    })();
    return () => {
      ignore = true;
    };
  }, [brandId]);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/brands/${brandId}/prompts/suggest`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { suggestions: Suggestion[] };
      setItems(data.suggestions ?? []);
      if ((data.suggestions ?? []).length === 0) {
        toast.info("No new suggestions right now.");
      }
    } catch {
      toast.error("Could not generate suggestions.");
    } finally {
      setGenerating(false);
    }
  }, [brandId]);

  const act = useCallback(
    async (id: string, action: "accept" | "dismiss") => {
      setBusy(id);
      setItems((prev) => prev.filter((s) => s.id !== id));
      try {
        const res = await fetch(`/api/suggestions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) throw new Error();
        if (action === "accept") {
          toast.success("Added to tracked prompts — re-scan to measure it.");
          router.refresh();
        }
      } catch {
        toast.error("Action failed.");
      } finally {
        setBusy(null);
      }
    },
    [router],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-medium">
          AI-suggested prompts
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={generate}
          disabled={generating}
        >
          {generating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          Suggest
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Get AI-proposed high-intent prompts to track. Click “Suggest”.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((s) => (
              <div
                key={s.id}
                className="border-border flex items-start justify-between gap-3 rounded-md border px-3 py-2"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm">{s.text}</p>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant="outline" className="text-[10px]">
                      {s.category}
                    </Badge>
                    {s.volume !== null ? (
                      <Badge variant="secondary" className="text-[10px]">
                        ~{s.volume.toLocaleString()}/mo
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground text-xs">{s.reason}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-7"
                    aria-label="Accept"
                    disabled={busy === s.id}
                    onClick={() => act(s.id, "accept")}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label="Dismiss"
                    disabled={busy === s.id}
                    onClick={() => act(s.id, "dismiss")}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
