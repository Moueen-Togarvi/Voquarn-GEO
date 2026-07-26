import OpenAI from "openai";

const apiKey = process.env.AGENT_ROUTER_API_KEY;
const baseURL = process.env.AGENT_ROUTER_BASE_URL;
if (!apiKey || !baseURL) {
  console.error("AGENT_ROUTER_API_KEY and AGENT_ROUTER_BASE_URL must be set.");
  process.exit(1);
}

const client = new OpenAI({
  apiKey,
  baseURL,
  maxRetries: 0,
});

const models = [
  process.env.AGENT_ROUTER_CLAUDE_MODEL ?? "claude-opus-4-8",
  process.env.AGENT_ROUTER_GPT_MODEL ?? "gpt-5.5",
  process.env.AGENT_ROUTER_GLM_MODEL ?? "glm-5.2",
];

let failed = false;

for (const model of models) {
  const startedAt = Date.now();
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: "Reply with exactly: ROUTER_OK",
        },
      ],
      max_tokens: 128,
    });
    const text = response.choices[0]?.message?.content?.trim() ?? "";
    const ok = text.includes("ROUTER_OK");
    failed ||= !ok;
    console.log(
      `${ok ? "PASS" : "FAIL"} ${model} (${Date.now() - startedAt}ms): ${text.slice(0, 80)}`,
    );
  } catch (error) {
    failed = true;
    console.error(
      `FAIL ${model} (${Date.now() - startedAt}ms):`,
      error instanceof Error ? error.message : error,
    );
  }
}

process.exitCode = failed ? 1 : 0;
