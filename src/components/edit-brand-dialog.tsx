"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EditBrandProps {
  brandId: string;
  initial: {
    name: string;
    domain: string;
    industry: string;
    competitors: string[];
    scanFrequency: "OFF" | "WEEKLY" | "DAILY";
  };
}

/**
 * Edit a brand: name/domain/industry, manage competitors, and set the
 * scheduled-scan frequency. Competitors are replaced wholesale on save.
 */
export function EditBrandDialog({ brandId, initial }: EditBrandProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(initial.name);
  const [domain, setDomain] = useState(initial.domain);
  const [industry, setIndustry] = useState(initial.industry);
  const [competitors, setCompetitors] = useState<string[]>(initial.competitors);
  const [draft, setDraft] = useState("");
  const [frequency, setFrequency] = useState(initial.scanFrequency);

  function addCompetitor() {
    const v = draft.trim();
    if (!v || competitors.includes(v)) {
      setDraft("");
      return;
    }
    setCompetitors((prev) => [...prev, v]);
    setDraft("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const all =
      draft.trim() && !competitors.includes(draft.trim())
        ? [...competitors, draft.trim()]
        : competitors;

    setSaving(true);
    try {
      const res = await fetch(`/api/brands/${brandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          domain,
          industry,
          competitors: all,
          scanFrequency: frequency,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Brand updated");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Could not update brand.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Pencil className="size-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit brand</DialogTitle>
            <DialogDescription>
              Update details, manage competitors, and set scheduled scans.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="e-name">Brand name</Label>
              <Input
                id="e-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="e-domain">Domain</Label>
              <Input
                id="e-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="e-industry">Industry</Label>
              <Input
                id="e-industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="e-competitor">Competitors</Label>
              <div className="flex gap-2">
                <Input
                  id="e-competitor"
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
            </div>
            <div className="grid gap-2">
              <Label>Scheduled scans</Label>
              <Select
                value={frequency}
                onValueChange={(v) =>
                  setFrequency(v as "OFF" | "WEEKLY" | "DAILY")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OFF">Off (manual only)</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="DAILY">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
