import { z } from "zod";

const organicResultSchema = z
  .object({
    position: z.number().int().positive(),
    title: z.string().nullish(),
    link: z.string(),
    snippet: z.string().nullish(),
    source: z.string().nullish(),
  })
  .passthrough();

const videoResultSchema = z
  .object({
    position: z.number().int().positive(),
    title: z.string().nullish(),
    url: z.string(),
    source: z.string().nullish(),
  })
  .passthrough();

const aiReferenceSchema = z
  .object({
    title: z.string().nullish(),
    link: z.string(),
    snippet: z.string().nullish(),
    source: z.string().nullish(),
  })
  .passthrough();

const aiOverviewSchema = z
  .object({
    state: z.enum(["complete", "deferred"]),
    session_key: z.string().nullish(),
    references: z.array(aiReferenceSchema).optional().default([]),
  })
  .passthrough();

/**
 * The subset of Scrape.do's structured Google Search response used by the
 * SERP hunt. Every provider-owned object is passthrough so newly added fields
 * do not break ingestion, while the URLs and positions we persist stay typed.
 */
export const scrapeDoSerpResponseSchema = z
  .object({
    search_parameters: z.record(z.string(), z.unknown()).optional(),
    search_information: z
      .object({ total_results: z.number().nullish() })
      .passthrough()
      .optional(),
    organic_results: z.array(organicResultSchema).optional().default([]),
    video_results: z.array(videoResultSchema).optional().default([]),
    ai_overview: aiOverviewSchema.nullish(),
  })
  .passthrough();

export const scrapeDoErrorSchema = z
  .object({
    error: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

export type ScrapeDoSerpResponse = z.infer<typeof scrapeDoSerpResponseSchema>;

export type ScrapeDoSerpRequest = {
  query: string;
  countryCode: string;
  languageCode: string;
  device: "desktop" | "mobile";
  start?: number;
};
