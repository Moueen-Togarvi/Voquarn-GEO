import { z } from "zod";

/** Shared brand-creation schema used by the API route and the add-brand form. */
export const brandInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  domain: z
    .string()
    .trim()
    .min(1, "Domain is required")
    .max(255)
    // Accept "acme.com" or "https://acme.com"; we normalize before storing.
    .transform((d) => d.replace(/^https?:\/\//i, "").replace(/\/+$/, "")),
  industry: z.string().trim().min(1, "Industry is required").max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  competitors: z
    .array(z.string().trim().min(1))
    .max(20, "Up to 20 competitors")
    .default([]),
});

export type BrandInput = z.infer<typeof brandInputSchema>;
