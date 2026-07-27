"use client";

import { useState } from "react";
import { Plug, Loader2, X } from "lucide-react";
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

interface Integration {
  id: string;
  provider: string;
  siteUrl: string | null;
}

/**
 * Connect (or disconnect) a publishing destination for a brand — WordPress
 * (Application Password) or a generic webhook.
 */
export function ConnectIntegrationDialog({
  brandId,
  connected,
  onChange,
}: {
  brandId: string;
  connected: Integration[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState<"WORDPRESS" | "GENERIC_WEBHOOK">(
    "WORDPRESS",
  );

  // WordPress fields
  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  // Webhook fields
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body =
        provider === "WORDPRESS"
          ? { provider, siteUrl, username, appPassword }
          : { provider, url, secret: secret || undefined };
      const res = await fetch(`/api/brands/${brandId}/integrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast.success("Destination connected");
      setOpen(false);
      onChange();
    } catch {
      toast.error("Could not connect. Check the details.");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect(id: string) {
    try {
      await fetch(`/api/integrations/${id}`, { method: "DELETE" });
      toast.success("Disconnected");
      onChange();
    } catch {
      toast.error("Could not disconnect.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plug className="size-4" />
          {connected.length > 0
            ? `Destinations (${connected.length})`
            : "Connect site"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Publishing destinations</DialogTitle>
          <DialogDescription>
            Where the platform publishes generated content.
          </DialogDescription>
        </DialogHeader>

        {connected.length > 0 ? (
          <div className="space-y-2">
            {connected.map((c) => (
              <div
                key={c.id}
                className="border-border flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{c.provider}</span>
                  {c.siteUrl ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {c.siteUrl}
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  aria-label="Disconnect"
                  onClick={() => disconnect(c.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <form onSubmit={connect} className="space-y-4 border-t pt-4">
          <div className="grid gap-2">
            <Label>Provider</Label>
            <Select
              value={provider}
              onValueChange={(v) =>
                setProvider(v as "WORDPRESS" | "GENERIC_WEBHOOK")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WORDPRESS">WordPress</SelectItem>
                <SelectItem value="GENERIC_WEBHOOK">Generic webhook</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {provider === "WORDPRESS" ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="wp-site">Site URL</Label>
                <Input
                  id="wp-site"
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  placeholder="https://yourblog.com"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="wp-user">Username</Label>
                <Input
                  id="wp-user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="wp-pass">Application Password</Label>
                <Input
                  id="wp-pass"
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  placeholder="xxxx xxxx xxxx xxxx"
                  required
                />
                <p className="text-muted-foreground text-xs">
                  Create one in WordPress under Users → Profile → Application
                  Passwords.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor="wh-url">Webhook URL</Label>
                <Input
                  id="wh-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://hooks.example.com/..."
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="wh-secret">Secret (optional)</Label>
                <Input
                  id="wh-secret"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Connecting…
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
