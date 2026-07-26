import { Engine } from "@/lib/types";
import type { AIEngine, EngineResponse } from "@/lib/engines/types";
import { withRetry } from "@/lib/engines/retry";
import {
  AGENT_ROUTER_MODELS,
  completeWithAgentRouter,
  isAgentRouterConfigured,
} from "@/lib/agent-router";

const MAX_TOKENS = 4096;
const routerConfigured = isAgentRouterConfigured();

export const claudeEngine: AIEngine = {
  name: Engine.CLAUDE,
  label: "Claude",
  isConfigured: routerConfigured,

  async runPrompt(prompt: string): Promise<EngineResponse> {
    const start = Date.now();
    if (!routerConfigured) {
      throw new Error("Agent router is not configured");
    }

    const text = await withRetry("agent-router-claude", () =>
      completeWithAgentRouter({
        prompt,
        model: AGENT_ROUTER_MODELS.claude,
        maxTokens: MAX_TOKENS,
      }),
    );

    return {
      text,
      sources: [],
      model: AGENT_ROUTER_MODELS.claude,
      latencyMs: Date.now() - start,
    };
  },
};
