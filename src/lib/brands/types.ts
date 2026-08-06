import type {
  BrandStatus,
  CompetitorSource,
  CompetitorStatus,
} from "@/generated/prisma/enums";
import type { BrandInput } from "@/lib/validation/brand";

export type CompetitorDto = {
  id: string;
  name: string;
  websiteUrl: string;
  domain: string;
  status: CompetitorStatus;
  source: CompetitorSource;
};

export type BrandDto = {
  id: string;
  name: string;
  websiteUrl: string;
  domain: string;
  description: string;
  category: string;
  status: BrandStatus;
  defaultMarketId: string | null;
  createdAt: string;
  updatedAt: string;
  competitors: CompetitorDto[];
};

export type BrandMutationPayload = BrandInput;
