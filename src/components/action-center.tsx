"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  RefreshCw,
  FileText,
  Code2,
  Link2,
  Check,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface Gap {
  id: string;
  promptText: string;
  category: string;
  competitorsWinning: string[];
  citedSources: string[];
  severity: "HIGH" | "MEDIUM" | "LOW";
  recommendedAction: string;
  addressed: boolean;
}

const SEVERITY_STYLES: Record<Gap["severity"], string> = {
  HIGH: "bg-[var(--chart-5)]/15 text-[var(--chart-5)]",
  MEDIUM: "bg-[var(--chart-4)]/15 text-[var(--chart-4)]",
  LOW: "bg-muted text-muted-foreground",
};

interface ModalState {
  title: string;
  body: string;
  schema?: string;
}

export function ActionCenter({ brandId }: { brandId: string }) {
  const [gaps, setGaps] = useState<Gap[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyGap, setBusyGap] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      try {
        const res = await fetch(
          `/api/brands/${brandId}/gaps${refresh ? "?refresh=1" : ""}`,
        );
        if (!res.ok) throw new Error("Failed to load gaps");
        const { gaps } = (await res.json()) as { gaps: Gap[] };
        setGaps(gaps);
      } catch {
        toast.error("Could not load gaps.");
        setGaps([]);
      } finally {
        setRefreshing(false);
      }
    },
    [brandId],
  );

  // Fetch on mount. Inlined (not calling `load`) so the effect owns its own
  // request lifecycle and can ignore a stale response after unmount/brand-change.
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`/api/brands/${brandId}/gaps`);
        if (!res.ok) throw new Error();
        const { gaps } = (await res.json()) as { gaps: Gap[] };
        if (!ignore) setGaps(gaps);
      } catch {
        if (!ignore) {
          toast.error("Could not load gaps.");
          setGaps([]);
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, [brandId]);

  const toggleDone = useCallback(
    async (gap: Gap) => {
      const next = !gap.addressed;
      setGaps(
        (prev) =>
          prev?.map((g) => (g.id === gap.id ? { ...g, addressed: next } : g)) ??
          null,
      );
      try {
        const res = await fetch(`/api/gaps/${gap.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ addressed: next }),
        });
        if (!res.ok) throw new Error();
      } catch {
        toast.error("Could not update.");
        void load(false);
      }
    },
    [load],
  );

  const generateContent = useCallback(
    async (gap: Gap, type: "comparison" | "faq" | "snippet") => {
      setBusyGap(gap.id);
      try {
        const target =
          type === "comparison"
            ? gap.competitorsWinning[0]
            : type === "snippet"
              ? gap.promptText
              : undefined;
        const res = await fetch(`/api/brands/${brandId}/content`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, target }),
        });
        if (!res.ok) throw new Error();
        const { content } = (await res.json()) as {
          content: { title: string; content: string; schema?: string };
        };
        setModal({
          title: content.title,
          body: content.content,
          schema: content.schema,
        });
      } catch {
        toast.error("Content generation failed.");
      } finally {
        setBusyGap(null);
      }
    },
    [brandId],
  );

  const showSchema = useCallback(async () => {
    setBusyGap("schema");
    try {
      const res = await fetch(`/api/brands/${brandId}/technical`);
      if (!res.ok) throw new Error();
      const { assets } = (await res.json()) as {
        assets: {
          organizationSchema: string;
          productSchema: string;
          llmsTxt: string;
        };
      };
      setModal({
        title: "Technical GEO assets",
        body: `<!-- Organization JSON-LD -->\n${assets.organizationSchema}\n\n<!-- Product JSON-LD -->\n${assets.productSchema}\n\n<!-- llms.txt -->\n${assets.llmsTxt}`,
      });
    } catch {
      toast.error("Could not load schema.");
    } finally {
      setBusyGap(null);
    }
  }, [brandId]);

  const total = gaps?.length ?? 0;
  const done = gaps?.filter((g) => g.addressed).length ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Action Center
          </h1>
          <p className="text-muted-foreground text-sm">
            Turn monitoring gaps into published, citation-ready content.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => load(true)}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Re-analyze gaps
        </Button>
      </div>

      {gaps !== null && total > 0 ? (
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex-1">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">Progress</span>
                <span className="text-muted-foreground">
                  {done} of {total} addressed
                </span>
              </div>
              <Progress value={pct} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {gaps === null ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : total === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground space-y-2 py-16 text-center text-sm">
            <p className="text-foreground font-medium">No gaps found yet.</p>
            <p>
              Gaps appear where a <strong>competitor</strong> is mentioned in AI
              answers but your brand is not. To surface them:
            </p>
            <p>
              1. Make sure this brand has competitors (edit the brand and add a
              few).
              <br />
              2. Run a scan on the brand.
              <br />
              3. Come back here and click “Re-analyze gaps”.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {gaps.map((gap) => (
            <Card key={gap.id} className={gap.addressed ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base leading-snug">
                    {gap.promptText}
                  </CardTitle>
                  <Badge
                    className={SEVERITY_STYLES[gap.severity]}
                    variant="secondary"
                  >
                    {gap.severity}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm">
                  Competitors winning:{" "}
                  <span className="text-foreground">
                    {gap.competitorsWinning.join(", ") || "—"}
                  </span>
                </p>
                <p className="text-sm">
                  <span className="font-medium">Recommended: </span>
                  {gap.recommendedAction}
                </p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busyGap === gap.id}
                  onClick={() =>
                    generateContent(
                      gap,
                      gap.competitorsWinning.length > 0
                        ? "comparison"
                        : "snippet",
                    )
                  }
                >
                  {busyGap === gap.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <FileText className="size-4" />
                  )}
                  Generate content
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => generateContent(gap, "faq")}
                  disabled={busyGap === gap.id}
                >
                  <FileText className="size-4" />
                  FAQ
                </Button>
                <Button size="sm" variant="secondary" onClick={showSchema}>
                  <Code2 className="size-4" />
                  Get schema
                </Button>
                {gap.citedSources.length > 0 ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setModal({
                        title: "Winning sources",
                        body: gap.citedSources.join("\n"),
                      })
                    }
                  >
                    <Link2 className="size-4" />
                    View sources
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant={gap.addressed ? "default" : "outline"}
                  onClick={() => toggleDone(gap)}
                  className="ml-auto"
                >
                  <Check className="size-4" />
                  {gap.addressed ? "Done" : "Mark done"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ContentModal modal={modal} onClose={() => setModal(null)} />
    </div>
  );
}

function ContentModal({
  modal,
  onClose,
}: {
  modal: ModalState | null;
  onClose: () => void;
}) {
  const copy = useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }, []);

  return (
    <Dialog open={modal !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-6">
            <span className="truncate">{modal?.title}</span>
          </DialogTitle>
        </DialogHeader>
        {modal ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => copy(modal.body)}
              >
                <Copy className="size-4" />
                Copy
              </Button>
            </div>
            <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs whitespace-pre-wrap">
              {modal.body}
            </pre>
            {modal.schema ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">JSON-LD schema</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copy(modal.schema!)}
                  >
                    <Copy className="size-4" />
                    Copy schema
                  </Button>
                </div>
                <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
                  {modal.schema}
                </pre>
              </>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
