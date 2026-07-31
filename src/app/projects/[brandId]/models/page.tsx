import { Bot, CheckCircle2, LockKeyhole } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Models" };

export default function ModelsPage() {
  const configured = Boolean(process.env.ZAI_API_KEY);

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
            <h2>GLM-5.1</h2>
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
            Z.AI flagship text model · structured JSON · web search · citation
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
          <code>glm-5.1</code>
        </div>
      </section>
      <div className="provider-note">
        <strong>No model calls run in this milestone.</strong>
        <p>
          Add <code>ZAI_API_KEY</code> in the protected deployment environment
          before enabling prompt generation. OpenAI, Perplexity, and other
          providers will use the same internal contract later.
        </p>
      </div>
    </div>
  );
}
