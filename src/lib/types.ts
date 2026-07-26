// Stable re-export of Prisma-generated enums and model types so the rest of
// the app imports from "@/lib/types" instead of the generated client path.
// (The generated output lives at src/generated/prisma and is gitignored.)

export {
  Engine,
  ScanStatus,
  Sentiment,
  Severity,
  Tier,
  SubscriptionStatus,
} from "@/generated/prisma/client";

export type {
  User,
  Brand,
  Competitor,
  Prompt,
  ScanRun,
  Result,
  VisibilityScore,
  Gap,
  Subscription,
} from "@/generated/prisma/client";
