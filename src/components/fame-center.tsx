"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  RefreshCw,
  Rocket,
  Check,
  Copy,
  Plug,
  TrendingUp,
  TrendingDown,
  FileText,
  Code2,
  Send,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConnectIntegrationDialog } from "@/components/connect-integration-dialog";

type FameKind =
  | "PUBLISH_CONTENT"
  | "ADD_SCHEMA"
  | "UPDATE_LLMS_TXT"
  | "SUBMIT_INDEXNOW"
  | "GET_MENTION";

interface FameTask {
  id: string;
  kind: FameKind;
  title: string;
  detail: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  publishedUrl: string | null;
}

interface Integration {
  id: string;
  provider: string;
  siteUrl: string | null;
}

interface Comparison {
  hasComparison: boolean;
  before: { date: string; score: number; mentions: number } | null;
  after: { date: string; score: number; mentions: number } | null;
  scoreDelta: number;
  mentionsDelta: number;
}

const KIND_ICON: Record<FameKind, React.ReactNode> = {
  PUBLISH_CONTENT: <FileText className="size-4" />,
  ADD_SCHEMA: <Code2 className="size-4" />,
  UPDATE_LLMS_TXT: <Code2 className="size-4" />,
  SUBMIT_INDEXNOW: <Send className="size-4" />,
  GET_MENTION: <Users className="size-4" />,
};

export function FameCenter({ brandId }: { brandId: string }) {
  const [tasks, setTasks] = useState<FameTask[] | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [modal, setModal] = useState<{ title: string; body: string } | null>(
    null,
  );

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      try {
        const res = await fetch(
          `/api/brands/${brandId}/fame${refresh ? "?refresh=1" : ""}`,
        );
        if (!res.ok) throw new Error();
        const data = (await res.json()) as {
          tasks: FameTask[];
          integrations: Integration[];
        };
        setTasks(data.tasks);
        setIntegrations(data.integrations);
      } catch {
        toast.error("Could not load the Fame plan.");
        setTasks([]);
      } finally {
        setRefreshing(false);
      }
    },
    [brandId],
  );

  // Load on mount. Inlined so the effect owns its request lifecycle.
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`/api/brands/${brandId}/fame`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as {
          tasks: FameTask[];
          integrations: Integration[];
        };
        if (!ignore) {
          setTasks(data.tasks);
          setIntegrations(data.integrations);
        }
      } catch {
        if (!ignore) {
          toast.error("Could not load the Fame plan.");
          setTasks([]);
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, [brandId]);

  const publish = useCallback(
    async (task: FameTask) => {
      if (integrations.length === 0) {
        toast.error("Connect a publishing destination first.");
        return;
      }
      setBusy(task.id);
      try {
        const res = await fetch(`/api/fame-tasks/${task.id}/publish`, {
          method: "POST",
        });
        const data = (await res.json()) as { message?: string; error?: string };
        if (!res.ok) throw new Error(data.error);
        toast.success(data.message ?? "Published.");
        void load(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Publish failed.");
      } finally {
        setBusy(null);
      }
    },
    [integrations.length, load],
  );

  const execute = useCallback(
    async (task: FameTask) => {
      setBusy(task.id);
      try {
        // IndexNow needs a key; prompt for it inline.
        let body: Record<string, unknown> = {};
        if (task.kind === "SUBMIT_INDEXNOW") {
          const key = window.prompt(
            "Enter your IndexNow key (hosted at /<key>.txt on your domain):",
          );
          if (!key) {
            setBusy(null);
            return;
          }
          body = { indexNowKey: key };
        }
        const res = await fetch(`/api/fame-tasks/${task.id}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as {
          asset?: string;
          message?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error);
        if (data.asset) {
          setModal({ title: task.title, body: data.asset });
        }
        toast.success(data.message ?? "Done.");
        void load(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed.");
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  const markDone = useCallback(
    async (task: FameTask) => {
      setTasks(
        (prev) =>
          prev?.map((t) => (t.id === task.id ? { ...t, status: "DONE" } : t)) ??
          null,
      );
      try {
        await fetch(`/api/fame-tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "DONE" }),
        });
      } catch {
        void load(false);
      }
    },
    [load],
  );

  const total = tasks?.length ?? 0;
  const done = tasks?.filter((t) => t.status === "DONE").length ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Fame Plan</h1>
          <p className="text-muted-foreground text-sm">
            The concrete steps that make your brand show up in AI answers —
            publish, signal, and measure the lift.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ConnectIntegrationDialog
            brandId={brandId}
            connected={integrations}
            onChange={() => load(false)}
          />
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
            Rebuild plan
          </Button>
        </div>
      </div>

      <ImpactCard brandId={brandId} />

      {tasks !== null && total > 0 ? (
        <Card>
          <CardContent className="py-4">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">Plan progress</span>
              <span className="text-muted-foreground">
                {done} of {total} done
              </span>
            </div>
            <Progress value={pct} />
          </CardContent>
        </Card>
      ) : null}

      {tasks === null ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : total === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            Run a scan, then click “Rebuild plan” to generate your Fame Plan.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <Card
              key={task.id}
              className={task.status === "DONE" ? "opacity-60" : ""}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  {KIND_ICON[task.kind]}
                  {task.title}
                  {task.status === "DONE" ? (
                    <Badge variant="secondary" className="ml-auto">
                      Done
                    </Badge>
                  ) : null}
                </CardTitle>
                <p className="text-muted-foreground text-sm">{task.detail}</p>
                {task.publishedUrl ? (
                  <a
                    href={task.publishedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary text-xs hover:underline"
                  >
                    {task.publishedUrl}
                  </a>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {task.kind === "PUBLISH_CONTENT" ? (
                  <Button
                    size="sm"
                    disabled={busy === task.id}
                    onClick={() => publish(task)}
                  >
                    {busy === task.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Rocket className="size-4" />
                    )}
                    Generate &amp; publish
                  </Button>
                ) : task.kind === "GET_MENTION" ? null : (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy === task.id}
                    onClick={() => execute(task)}
                  >
                    {busy === task.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Plug className="size-4" />
                    )}
                    {task.kind === "SUBMIT_INDEXNOW" ? "Submit" : "Get asset"}
                  </Button>
                )}
                {task.status !== "DONE" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    onClick={() => markDone(task)}
                  >
                    <Check className="size-4" />
                    Mark done
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AssetModal modal={modal} onClose={() => setModal(null)} />
    </div>
  );
}

function ImpactCard({ brandId }: { brandId: string }) {
  const [loading, setLoading] = useState(false);
  const [cmp, setCmp] = useState<Comparison | null>(null);

  const measure = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/brands/${brandId}/impact`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { comparison: Comparison };
      setCmp(data.comparison);
    } catch {
      toast.error("Could not measure impact.");
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-medium">
          Impact — before vs after
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={measure}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <TrendingUp className="size-4" />
          )}
          Measure
        </Button>
      </CardHeader>
      <CardContent>
        {!cmp ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            After completing tasks, re-run a scan and measure the visibility
            lift between your last two scans.
          </p>
        ) : !cmp.hasComparison ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            Need at least two scans to compare. Run another scan after
            publishing.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat
              label={`Before (${cmp.before!.date})`}
              value={cmp.before!.score}
            />
            <Stat
              label={`After (${cmp.after!.date})`}
              value={cmp.after!.score}
            />
            <DeltaStat label="Score change" value={cmp.scoreDelta} />
            <DeltaStat label="Mentions change" value={cmp.mentionsDelta} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}

function DeltaStat({ label, value }: { label: string; value: number }) {
  const positive = value > 0;
  return (
    <div>
      <p
        className={`flex items-center gap-1 text-2xl font-semibold tabular-nums ${
          value === 0
            ? ""
            : positive
              ? "text-[var(--chart-2)]"
              : "text-[var(--chart-5)]"
        }`}
      >
        {value !== 0 ? (
          positive ? (
            <TrendingUp className="size-5" />
          ) : (
            <TrendingDown className="size-5" />
          )
        ) : null}
        {positive ? "+" : ""}
        {value}
      </p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}

function AssetModal({
  modal,
  onClose,
}: {
  modal: { title: string; body: string } | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={modal !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="pr-6">{modal?.title}</DialogTitle>
        </DialogHeader>
        {modal ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(modal.body);
                  toast.success("Copied");
                }}
              >
                <Copy className="size-4" />
                Copy
              </Button>
            </div>
            <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs whitespace-pre-wrap">
              {modal.body}
            </pre>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
