// ─────────────────────────────────────────────────────────────
// ⏸  PADDLE BILLING PAUSED (per request).
//
// The Paddle client + tier↔price mapping are written but commented out until
// payment integration is enabled. To turn billing on:
//   1. Uncomment this file.
//   2. Add the /api/webhooks/paddle handler (paddle.webhooks.unmarshal + switch
//      on EventName) and a /pricing checkout page.
//   3. Set ENFORCE_LIMITS = true in src/lib/billing/enforce.ts.
//   4. Fill PADDLE_* env vars (see .env.example).
// ─────────────────────────────────────────────────────────────

/*
import { Paddle, Environment } from "@paddle/paddle-node-sdk";
import { Tier } from "@/lib/types";

const apiKey = process.env.PADDLE_API_KEY;

let client: Paddle | null = null;

export function getPaddle(): Paddle | null {
  if (!apiKey) return null;
  client ??= new Paddle(apiKey, {
    environment:
      process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
        ? Environment.production
        : Environment.sandbox,
  });
  return client;
}

export function tierForPriceId(priceId: string): Tier | null {
  if (priceId && priceId === process.env.PADDLE_PRICE_PRO) return Tier.PRO;
  if (priceId && priceId === process.env.PADDLE_PRICE_AGENCY) return Tier.AGENCY;
  if (priceId && priceId === process.env.PADDLE_PRICE_STARTER)
    return Tier.STARTER;
  return null;
}

export function priceIdForTier(tier: Tier): string | undefined {
  switch (tier) {
    case Tier.PRO:
      return process.env.PADDLE_PRICE_PRO;
    case Tier.AGENCY:
      return process.env.PADDLE_PRICE_AGENCY;
    case Tier.STARTER:
      return process.env.PADDLE_PRICE_STARTER;
    default:
      return undefined;
  }
}
*/

export {};
