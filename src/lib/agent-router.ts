import "server-only";

import OpenAI from "openai";

export const AGENT_ROUTER_MODELS = {
  claude: process.env.AGENT_ROUTER_CLAUDE_MODEL ?? "claude-opus-4-8",
  gpt: process.env.AGENT_ROUTER_GPT_MODEL ?? "gpt-5.5",
  glm: process.env.AGENT_ROUTER_GLM_MODEL ?? "glm-5.2",
} as const;

export type AgentRouterModel =
  (typeof AGENT_ROUTER_MODELS)[keyof typeof AGENT_ROUTER_MODELS];

const apiKey = process.env.AGENT_ROUTER_API_KEY;
const baseURL = process.env.AGENT_ROUTER_BASE_URL;

let client: OpenAI | null = null;

export function isAgentRouterConfigured(): boolean {
  return Boolean(apiKey && baseURL);
}

function getAgentRouter(): OpenAI {
  if (!apiKey || !baseURL) {
    throw new Error(
      "AGENT_ROUTER_API_KEY and AGENT_ROUTER_BASE_URL must be set",
    );
  }

  // AgentRouter only accepts requests that identify as the Codex CLI client;
  // without these headers it rejects with 401 "unauthorized client detected".
  client ??= new OpenAI({
    apiKey,
    baseURL,
    maxRetries: 0,
    defaultHeaders: {
      "User-Agent": "codex_cli_rs/0.20.0",
      originator: "codex_cli_rs",
    },
  });

  return client;
}

export async function completeWithAgentRouter(opts: {
  prompt: string;
  system?: string;
  model?: AgentRouterModel | string;
  maxTokens?: number;
}): Promise<string> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  if (opts.system) {
    messages.push({ role: "system", content: opts.system });
  }
  messages.push({ role: "user", content: opts.prompt });

  const completion = await getAgentRouter().chat.completions.create({
    model: opts.model ?? AGENT_ROUTER_MODELS.claude,
    messages,
    max_tokens: opts.maxTokens ?? 4096,
  });

  return completion.choices[0]?.message?.content ?? "";
}
