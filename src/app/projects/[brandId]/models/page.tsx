import { Bot, CheckCircle2, LockKeyhole } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Models" };

export default function ModelsPage() {
  const configured = Boolean(process.env.OPENAI_API_KEY);
  const model = process.env.OPENAI_MODEL ?? "gpt-5.6-sol";

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Providers"
        title="AI models"
        description="One clean provider today, with an adapter ready for more engines tomorrow."
      />
      <section className="model-card content-card">
        <div className="model-logo">
          <Bot size={22} />
        </div>
        <div className="model-copy">
          <div className="model-title-row">
            <h2>OpenAI GPT-5.6 Sol</h2>
            <span
              className={configured ? "status-pill success" : "status-pill"}
            >
              {configured ? (
                <CheckCircle2 size={13} />
              ) : (
                <LockKeyhole size={13} />
              )}
              {configured ? "Configured" : "Key required"}
            </span>
          </div>
          <p>
            Responses API · Structured Outputs · native web search · citation
            metadata
          </p>
          <div className="capability-row">
            <span>Prompt generation</span>
            <span>Response analysis</span>
            <span>Web search</span>
          </div>
        </div>
        <div className="model-side">
          <small>Model ID</small>
          <code>{model}</code>
        </div>
      </section>
      <div className="provider-note">
        <strong>OpenAI powers company research and AI visibility.</strong>
        <p>
          Add <code>OPENAI_API_KEY</code> in the protected deployment
          environment. Voquarn first analyzes the client&apos;s service and
          content pages, then uses OpenAI web search to validate direct
          competitors and generate niche-specific AEO/GEO monitoring prompts.
        </p>
      </div>
    </div>
  );
}
