import type {
  Publisher,
  PublishInput,
  PublishResult,
} from "@/lib/publish/types";

export interface WebhookCredentials {
  /** The endpoint to POST generated content to. */
  url: string;
  /** Optional bearer secret sent as Authorization. */
  secret?: string;
}

/**
 * Generic webhook publisher: POSTs the generated content as JSON to a
 * user-provided endpoint (Zapier, Make, a custom CMS bridge, etc.). The
 * receiver decides what to do with it.
 */
export function webhookPublisher(creds: WebhookCredentials): Publisher {
  return {
    async publish(input: PublishInput): Promise<PublishResult> {
      try {
        const res = await fetch(creds.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(creds.secret
              ? { Authorization: `Bearer ${creds.secret}` }
              : {}),
          },
          body: JSON.stringify({
            title: input.title,
            content: input.content,
            schema: input.schema ?? null,
          }),
        });

        if (!res.ok) {
          return {
            ok: false,
            message: `Webhook returned ${res.status}.`,
          };
        }

        // Some receivers echo back a URL; capture it if present.
        const data = (await res.json().catch(() => ({}))) as { url?: string };
        return {
          ok: true,
          url: data.url,
          message: "Content sent to your webhook.",
        };
      } catch (error) {
        return {
          ok: false,
          message:
            error instanceof Error ? error.message : "Webhook request failed.",
        };
      }
    },
  };
}
