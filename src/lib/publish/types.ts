/** Content to publish to a connected destination. */
export interface PublishInput {
  title: string;
  /** Markdown or HTML body. */
  content: string;
  /** Optional JSON-LD schema to include (as a script block). */
  schema?: string;
}

export interface PublishResult {
  ok: boolean;
  /** The public URL of the published content, when available. */
  url?: string;
  message: string;
}

/** A connected publishing destination. */
export interface Publisher {
  publish(input: PublishInput): Promise<PublishResult>;
}
