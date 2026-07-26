import { Engine } from "@/lib/types";
import type { AIEngine, EngineResponse } from "@/lib/engines/types";
import { withRetry } from "@/lib/engines/retry";
import {
  AGENT_ROUTER_MODELS,
  completeWithAgentRouter,
  isAgentRouterConfigured,
} from "@/lib/agent-router";

const routerConfigured = isAgentRouterConfigured();

export const openaiEngine: AIEngine = {
  name: Engine.OPENAI,
  label: "ChatGPT",
  isConfigured: routerConfigured,

  async runPrompt(prompt: string): Promise<EngineResponse> {
    const start = Date.now();
    if (!routerConfigured) {
      throw new Error("Agent router is not configured");
    }

    const text = await withRetry("agent-router-gpt", () =>
      completeWithAgentRouter({
        prompt,
        model: AGENT_ROUTER_MODELS.gpt,
      }),
    );

    return {
      text,
      sources: [],
      model: AGENT_ROUTER_MODELS.gpt,
      latencyMs: Date.now() - start,
    };
  },
};
