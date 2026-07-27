import type {
  Publisher,
  PublishInput,
  PublishResult,
} from "@/lib/publish/types";

export interface WordPressCredentials {
  /** Site base URL, e.g. https://example.com */
  siteUrl: string;
  /** WordPress username. */
  username: string;
  /** An Application Password (Users → Profile → Application Passwords). */
  appPassword: string;
}

interface WpPostResponse {
  link?: string;
  id?: number;
}

/**
 * Publishes to a WordPress site via the REST API using an Application Password
 * (HTTP Basic auth). Posts are created as drafts so a human reviews before
 * going live — safe-by-default for a semi-automated flow.
 */
export function wordpressPublisher(creds: WordPressCredentials): Publisher {
  const base = creds.siteUrl.replace(/\/+$/, "");
  const auth = Buffer.from(`${creds.username}:${creds.appPassword}`).toString(
    "base64",
  );

  return {
    async publish(input: PublishInput): Promise<PublishResult> {
      try {
        const body = input.schema
          ? `${input.content}\n\n<script type="application/ld+json">\n${input.schema}\n</script>`
          : input.content;

        const res = await fetch(`${base}/wp-json/wp/v2/posts`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: input.title,
            content: body,
            status: "draft", // review before publish
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          return {
            ok: false,
            message: `WordPress error ${res.status}: ${text.slice(0, 160)}`,
          };
        }

        const data = (await res.json()) as WpPostResponse;
        return {
          ok: true,
          url: data.link,
          message: "Published as a draft in WordPress — review and publish it.",
        };
      } catch (error) {
        return {
          ok: false,
          message:
            error instanceof Error
              ? error.message
              : "WordPress request failed.",
        };
      }
    },
  };
}
