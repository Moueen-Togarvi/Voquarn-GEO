import { IntegrationProvider } from "@/lib/types";
import type { Publisher } from "@/lib/publish/types";
import {
  wordpressPublisher,
  type WordPressCredentials,
} from "@/lib/publish/wordpress";
import {
  webhookPublisher,
  type WebhookCredentials,
} from "@/lib/publish/webhook";

export type {
  Publisher,
  PublishInput,
  PublishResult,
} from "@/lib/publish/types";

/**
 * Build the right Publisher from a stored Integration's provider + credentials.
 * Returns null for unsupported providers (e.g. Webflow, not yet implemented).
 */
export function makePublisher(
  provider: IntegrationProvider,
  credentials: unknown,
): Publisher | null {
  switch (provider) {
    case IntegrationProvider.WORDPRESS:
      return wordpressPublisher(credentials as WordPressCredentials);
    case IntegrationProvider.GENERIC_WEBHOOK:
      return webhookPublisher(credentials as WebhookCredentials);
    case IntegrationProvider.WEBFLOW:
      return null; // planned next
    default:
      return null;
  }
}
