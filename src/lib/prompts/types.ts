import type { PromptSource, PromptType } from "@/generated/prisma/enums";

export type PromptDto = {
  id: string;
  text: string;
  type: PromptType;
  source: PromptSource;
  isActive: boolean;
  approvedAt: string | null;
  marketId: string;
  createdAt: string;
  updatedAt: string;
};
