"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { brandInputSchema } from "@/lib/validation/brand";

export function AddBrandDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("");
  const [description, setDescription] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [competitorDraft, setCompetitorDraft] = useState("");

  function addCompetitor() {
    const value = competitorDraft.trim();
    if (!value || competitors.includes(value)) {
      setCompetitorDraft("");
      return;
    }
    setCompetitors((prev) => [...prev, value]);
    setCompetitorDraft("");
  }

  function removeCompetitor(value: string) {
    setCompetitors((prev) => prev.filter((c) => c !== value));
  }

  function reset() {
    setName("");
    setDomain("");
    setIndustry("");
    setDescription("");
    setCompetitors([]);
    setCompetitorDraft("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Include a competitor typed into the field but not yet "Added" as a chip,
    // so a user who types one and submits directly doesn't lose it.
    const draft = competitorDraft.trim();
    const allCompetitors =
      draft && !competitors.includes(draft)
        ? [...competitors, draft]
        : competitors;
    const parsed = brandInputSchema.safeParse({
      name,
      domain,
      industry,
      description,
      competitors: allCompetitors,
    });
    if (!parsed.success) {
      toast.error(
        parsed.error.issues[0]?.message ?? "Please check the form fields.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        throw new Error(
          (await res.json().catch(() => ({})))?.error ?? res.statusText,
        );
      }
      const { id } = (await res.json()) as { id: string };
      toast.success("Brand added — generating prompts…");
      setOpen(false);
      reset();
      router.push(`/brands/${id}`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create brand.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Add Brand
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add a brand</DialogTitle>
            <DialogDescription>
              We&apos;ll generate buyer-intent prompts and start tracking it
              across AI engines.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Brand name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Analytics"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="acme.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="product analytics"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What the product does, who it's for…"
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="competitor">Competitors</Label>
              <div className="flex gap-2">
                <Input
                  id="competitor"
                  value={competitorDraft}
                  onChange={(e) => setCompetitorDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCompetitor();
                    }
                  }}
                  placeholder="Add a competitor and press Enter"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addCompetitor}
                >
                  Add
                </Button>
              </div>
              {competitors.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {competitors.map((c) => (
                    <span
                      key={c}
                      className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs"
                    >
                      {c}
                      <button
                        type="button"
                        onClick={() => removeCompetitor(c)}
                        aria-label={`Remove ${c}`}
                        className="hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Adding…
                </>
              ) : (
                "Add brand"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
