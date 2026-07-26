"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Play, Loader2, ChevronDown, ExternalLink } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ENGINE_LABELS,
  ENGINE_ORDER,
  ENGINE_COLOR_VAR,
  type EngineName,
} from "@/lib/scan/serialize";
import type { BrandDashboard } from "@/lib/dashboard";

const SENTIMENT_COLORS = {
  positive: "var(--chart-2)",
  neutral: "var(--chart-3)",
  negative: "var(--chart-5)",
};

export function BrandDashboardView({ data }: { data: BrandDashboard }) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollUntilDone = useCallback(
    (scanRunId: string) => {
      let elapsed = 0;
      pollRef.current = setInterval(async () => {
        elapsed += 3;
        try {
          const res = await fetch(`/api/scan/${scanRunId}`);
          if (res.ok) {
            const scan = (await res.json()) as { status: string };
            if (scan.status === "DONE" || scan.status === "FAILED") {
              if (pollRef.current) clearInterval(pollRef.current);
              setScanning(false);
              if (scan.status === "DONE") {
                toast.success("Scan complete");
                router.refresh();
              } else {
                toast.error(
                  "Scan failed — check that API keys are configured.",
                );
              }
              return;
            }
          }
        } catch {
          // keep polling; transient
        }
        // Give up after ~5 minutes.
        if (elapsed > 300) {
          if (pollRef.current) clearInterval(pollRef.current);
          setScanning(false);
          toast.error("Scan is taking longer than expected. Refresh later.");
        }
      }, 3000);
    },
    [router],
  );

  const runScan = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: data.brand.id }),
      });
      if (!res.ok) {
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? "Failed",
        );
      }
      const { scanRunId } = (await res.json()) as { scanRunId: string };
      toast.info("Scan started — querying AI engines…");
      pollUntilDone(scanRunId);
    } catch (error) {
      setScanning(false);
      toast.error(
        error instanceof Error ? error.message : "Could not start scan.",
      );
    }
  }, [data.brand.id, pollUntilDone]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {data.brand.name}
          </h1>
          <p className="text-muted-foreground text-sm">
            {data.brand.domain} · {data.brand.industry}
          </p>
        </div>
        <Button onClick={runScan} disabled={scanning}>
          {scanning ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Scanning…
            </>
          ) : (
            <>
              <Play className="size-4" />
              {data.hasScan ? "Re-run scan" : "Run scan"}
            </>
          )}
        </Button>
      </div>

      {!data.hasScan ? (
        <EmptyState scanning={scanning} />
      ) : (
        <>
          <OverviewRow data={data} />
          <div className="grid gap-6 lg:grid-cols-2">
            <ShareOfVoiceChart data={data} />
            <TrendChart data={data} />
          </div>
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <PromptsTable data={data} />
            <SentimentChart data={data} />
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ scanning }: { scanning: boolean }) {
  return (
    <Card>
      <CardContent className="text-muted-foreground py-16 text-center text-sm">
        {scanning
          ? "Running your first scan across ChatGPT, Claude, Gemini, and Perplexity…"
          : "No scans yet. Run a scan to see how this brand appears in AI answers."}
      </CardContent>
    </Card>
  );
}

function ScoreGauge({ score }: { score: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <div className="text-5xl font-semibold tabular-nums">{score}</div>
      <div className="text-muted-foreground text-xs">out of 100</div>
    </div>
  );
}

function OverviewRow({ data }: { data: BrandDashboard }) {
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_2fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Overall visibility
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6">
          <ScoreGauge score={data.overallScore} />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.engineCards.map((card) => (
          <Card key={card.engine}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{ background: ENGINE_COLOR_VAR[card.engine] }}
                />
                {ENGINE_LABELS[card.engine]}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold tabular-nums">
                {card.score}
                <span className="text-muted-foreground text-sm">%</span>
              </p>
              <p className="text-muted-foreground text-xs">
                SoV {Math.round(card.shareOfVoice * 100)}% · Cited{" "}
                {card.citationRate}%
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ShareOfVoiceChart({ data }: { data: BrandDashboard }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Share of voice — brand vs competitors
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.shareOfVoice}
              layout="vertical"
              margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
            >
              <CartesianGrid
                horizontal={false}
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
              <XAxis
                type="number"
                stroke="var(--muted-foreground)"
                fontSize={12}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="var(--muted-foreground)"
                fontSize={12}
                width={100}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={tooltipStyle}
              />
              <Bar
                dataKey="value"
                name="Mentions"
                radius={[0, 4, 4, 0]}
                fill="var(--chart-1)"
              >
                {data.shareOfVoice.map((entry, i) => (
                  <Cell
                    key={entry.name}
                    fill={i === 0 ? "var(--chart-1)" : "var(--chart-3)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendChart({ data }: { data: BrandDashboard }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Visibility trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          {data.trend.length < 2 ? (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              Run more scans to see a trend.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.trend}
                margin={{ left: 0, right: 16, top: 8, bottom: 4 }}
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="score"
                  name="Overall score"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SentimentChart({ data }: { data: BrandDashboard }) {
  const pieData = [
    { name: "Positive", key: "positive", value: data.sentiment.positive },
    { name: "Neutral", key: "neutral", value: data.sentiment.neutral },
    { name: "Negative", key: "negative", value: data.sentiment.negative },
  ].filter((d) => d.value > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Sentiment</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          {pieData.length === 0 ? (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              No mentions to analyze yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {pieData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={
                        SENTIMENT_COLORS[
                          entry.key as keyof typeof SENTIMENT_COLORS
                        ]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PromptsTable({ data }: { data: BrandDashboard }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Prompts ({data.prompts.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-muted-foreground flex items-center justify-end gap-3 pb-1 text-xs">
          {ENGINE_ORDER.map((e) => (
            <span key={e} className="flex items-center gap-1">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: ENGINE_COLOR_VAR[e] }}
              />
              {ENGINE_LABELS[e]}
            </span>
          ))}
        </div>
        {data.prompts.map((row) => (
          <PromptRowItem key={row.promptText} row={row} />
        ))}
      </CardContent>
    </Card>
  );
}

function PromptRowItem({ row }: { row: BrandDashboard["prompts"][number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-border rounded-md border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-muted/40 flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span className="line-clamp-1 text-sm">{row.promptText}</span>
          <Badge variant="outline" className="mt-1 text-[10px]">
            {row.category}
          </Badge>
        </span>
        <span className="flex items-center gap-2">
          {ENGINE_ORDER.map((e) => {
            const mentioned = row.mentions[e as EngineName];
            return (
              <span
                key={e}
                title={`${ENGINE_LABELS[e]}: ${
                  mentioned === undefined
                    ? "not queried"
                    : mentioned
                      ? "mentioned"
                      : "not mentioned"
                }`}
                className="size-2.5 rounded-full"
                style={{
                  background:
                    mentioned === true
                      ? ENGINE_COLOR_VAR[e]
                      : "var(--muted-foreground)",
                  opacity: mentioned === true ? 1 : 0.3,
                }}
              />
            );
          })}
          <ChevronDown
            className={`text-muted-foreground size-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {open ? (
        <div className="border-border space-y-3 border-t px-3 py-3">
          {row.details.map((d) => (
            <div key={d.engine} className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium">
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ background: ENGINE_COLOR_VAR[d.engine] }}
                />
                {ENGINE_LABELS[d.engine]}
              </div>
              <p className="text-muted-foreground line-clamp-4 text-xs whitespace-pre-wrap">
                {d.responseText || "(empty response)"}
              </p>
              {d.citedSources.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {d.citedSources.slice(0, 5).map((src) => (
                    <a
                      key={src}
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary inline-flex items-center gap-1 text-[11px] hover:underline"
                    >
                      <ExternalLink className="size-3" />
                      {hostOf(src)}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  color: "var(--popover-foreground)",
  fontSize: "12px",
} as const;
