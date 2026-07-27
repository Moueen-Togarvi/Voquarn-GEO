"use client";

import { useState, useCallback } from "react";
import { Loader2, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface InfluentialSource {
  domain: string;
  type: string;
  mentions: number;
  sampleUrl?: string;
}

/**
 * Sources deep-dive: which third-party domains the AI answers reference for
 * this brand. Fetched on demand (the /sources route also runs Serper).
 */
export function SourcesPanel({ brandId }: { brandId: string }) {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [sources, setSources] = useState<InfluentialSource[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/brands/${brandId}/sources`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { influence: InfluentialSource[] };
      setSources(data.influence ?? []);
      setLoaded(true);
    } catch {
      toast.error("Could not load sources.");
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-medium">
          Sources that influence AI answers
        </CardTitle>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          {loaded ? "Refresh" : "Analyze"}
        </Button>
      </CardHeader>
      <CardContent>
        {!loaded ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Analyze which domains (Reddit, G2, blogs…) the AI answers reference
            for your queries.
          </p>
        ) : sources.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No third-party domains found in the latest scan&apos;s answers.
          </p>
        ) : (
          <div className="space-y-1">
            {sources.map((s) => (
              <div
                key={s.domain}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {s.type}
                  </Badge>
                  {s.sampleUrl ? (
                    <a
                      href={s.sampleUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary inline-flex items-center gap-1 truncate hover:underline"
                    >
                      {s.domain}
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="truncate">{s.domain}</span>
                  )}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {s.mentions} {s.mentions === 1 ? "mention" : "mentions"}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
