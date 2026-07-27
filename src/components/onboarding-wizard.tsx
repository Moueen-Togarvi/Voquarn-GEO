"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, X, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { brandInputSchema } from "@/lib/validation/brand";

type Step = "details" | "competitors" | "scanning";

/**
 * First-run onboarding: brand details → AI-suggested competitors → create brand
 * (auto-generates prompts) → first scan → land on the dashboard.
 */
export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("details");

  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("");
  const [description, setDescription] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  const [suggesting, setSuggesting] = useState(false);
  const [working, setWorking] = useState(false);

  const goToCompetitors = useCallback(async () => {
    if (!name.trim() || !domain.trim() || !industry.trim()) {
      toast.error("Fill in name, domain, and industry.");
      return;
    }
    setStep("competitors");
    // Auto-suggest competitors in the background.
    setSuggesting(true);
    try {
      const res = await fetch("/api/suggest-competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, industry, description }),
      });
      if (res.ok) {
        const data = (await res.json()) as { competitors: string[] };
        setCompetitors(data.competitors ?? []);
      }
    } catch {
      /* non-critical */
    } finally {
      setSuggesting(false);
    }
  }, [name, domain, industry, description]);

  const addCompetitor = useCallback(() => {
    const v = draft.trim();
    if (!v || competitors.includes(v)) {
      setDraft("");
      return;
    }
    setCompetitors((prev) => [...prev, v]);
    setDraft("");
  }, [draft, competitors]);

  const finish = useCallback(async () => {
    const all =
      draft.trim() && !competitors.includes(draft.trim())
        ? [...competitors, draft.trim()]
        : competitors;
    const parsed = brandInputSchema.safeParse({
      name,
      domain,
      industry,
      description,
      competitors: all,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the details.");
      return;
    }

    setWorking(true);
    setStep("scanning");
    try {
      // 1. Create the brand (prompts generate in the background).
      const createRes = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!createRes.ok) throw new Error("Could not create the brand.");
      const { id } = (await createRes.json()) as { id: string };

      // 2. Give prompt generation a moment, then kick off the first scan.
      await new Promise((r) => setTimeout(r, 4000));
      const scanRes = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: id }),
      });

      // 3. Land on the brand dashboard — the scan continues in the background.
      if (scanRes.ok) {
        toast.success("Your first scan is running — watch it land!");
      } else {
        toast.info("Brand created. Run a scan from its page.");
      }
      router.push(`/brands/${id}`);
      router.refresh();
    } catch (e) {
      setWorking(false);
      setStep("competitors");
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    }
  }, [name, domain, industry, description, competitors, draft, router]);

  const progress = step === "details" ? 33 : step === "competitors" ? 66 : 100;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Let&apos;s track your brand in AI answers
        </h1>
        <p className="text-muted-foreground text-sm">
          Three quick steps to your first visibility report.
        </p>
        <Progress value={progress} className="mx-auto max-w-xs" />
      </div>

      {step === "details" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your brand</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="o-name">Brand name</Label>
              <Input
                id="o-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Analytics"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="o-domain">Domain</Label>
              <Input
                id="o-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="acme.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="o-industry">Industry</Label>
              <Input
                id="o-industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="product analytics"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="o-desc">Description (optional)</Label>
              <Textarea
                id="o-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What you do, who it's for…"
              />
            </div>
            <Button className="w-full" onClick={goToCompetitors}>
              Next <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {step === "competitors" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Competitors
              {suggesting ? (
                <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-normal">
                  <Sparkles className="size-3 animate-pulse" /> suggesting…
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              We suggested a few — add or remove any.
            </p>
            <div className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCompetitor();
                  }
                }}
                placeholder="Add a competitor and press Enter"
              />
              <Button type="button" variant="secondary" onClick={addCompetitor}>
                Add
              </Button>
            </div>
            {competitors.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {competitors.map((c) => (
                  <span
                    key={c}
                    className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs"
                  >
                    {c}
                    <button
                      type="button"
                      aria-label={`Remove ${c}`}
                      onClick={() =>
                        setCompetitors((prev) => prev.filter((x) => x !== c))
                      }
                      className="hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("details")}
                className="flex-1"
              >
                Back
              </Button>
              <Button onClick={finish} className="flex-1" disabled={working}>
                <Check className="size-4" />
                Create &amp; scan
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "scanning" ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Loader2 className="text-primary size-8 animate-spin" />
            <p className="font-medium">Setting up {name}…</p>
            <p className="text-muted-foreground text-sm">
              Generating buyer-intent prompts and starting your first scan
              across the AI engines. Taking you to your dashboard.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
