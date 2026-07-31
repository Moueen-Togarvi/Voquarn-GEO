import type { BrandInput } from "@/lib/validation/brand";

export type CompetitorDto = {
  id: string;
  name: string;
  websiteUrl: string;
  domain: string;
};

export type BrandDto = {
  id: string;
  name: string;
  websiteUrl: string;
  domain: string;
  description: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  competitors: CompetitorDto[];
};

export type BrandMutationPayload = BrandInput;

export type ApiSuccess<T> = { data: T };
export type ApiFailure = {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[] | undefined>;
  };
};
