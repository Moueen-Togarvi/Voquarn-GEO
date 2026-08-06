import { z } from "zod";

/**
 * DataForSEO's Google Organic Live Advanced SERP response
 * (`POST /v3/serp/google/organic/live/advanced`), reconstructed from their
 * published documentation rather than a captured live response — this
 * sandbox has no DataForSEO credentials to call the real endpoint against.
 * Every field beyond what src/lib/providers/dataforseo/mapper.ts actually
 * reads is optional/passthrough on purpose, so an unexpected real-world
 * shape degrades to "fewer results mapped," not a thrown parse error.
 * Verify field names against a real response before relying on this in
 * production.
 */
const serpItemSchema = z
  .object({
    type: z.string(),
    rank_group: z.number().nullish(),
    rank_absolute: z.number().nullish(),
    domain: z.string().nullish(),
    title: z.string().nullish(),
    description: z.string().nullish(),
    url: z.string().nullish(),
    items: z.array(z.unknown()).nullish(),
    references: z
      .array(
        z.object({
          url: z.string().nullish(),
          domain: z.string().nullish(),
          title: z.string().nullish(),
        }),
      )
      .nullish(),
  })
  .passthrough();

export type SerpItem = z.infer<typeof serpItemSchema>;

const serpTaskResultSchema = z
  .object({
    keyword: z.string(),
    se_domain: z.string().nullish(),
    location_code: z.number().nullish(),
    language_code: z.string().nullish(),
    datetime: z.string().nullish(),
    se_results_count: z.number().nullish(),
    items_count: z.number().nullish(),
    items: z.array(serpItemSchema).nullish(),
  })
  .passthrough();

const serpTaskSchema = z
  .object({
    id: z.string().nullish(),
    status_code: z.number().nullish(),
    status_message: z.string().nullish(),
    result: z.array(serpTaskResultSchema).nullish(),
  })
  .passthrough();

export const serpLiveResponseSchema = z
  .object({
    status_code: z.number(),
    status_message: z.string(),
    tasks: z.array(serpTaskSchema).nullish(),
  })
  .passthrough();

export type SerpLiveResponse = z.infer<typeof serpLiveResponseSchema>;

export type SerpLiveRequest = {
  keyword: string;
  locationCode: number;
  languageCode: string;
  device: "desktop" | "mobile";
  depth?: number;
};
