/**
 * Every error code the API returns, in use or planned. Keep in sync with the
 * table in docs/events.md. AppError's `code` parameter is typed against this
 * so a typo fails typecheck instead of shipping as a silent new code.
 */
export const ERROR_CODES = [
  // In use
  "INVALID_JSON",
  "VALIDATION_ERROR",
  "CONFIRMATION_MISMATCH",
  "UNSAFE_WEBSITE_URL",
  "BRAND_NOT_FOUND",
  "DUPLICATE_BRAND",
  "DISCOVERY_FAILED",
  "AI_NOT_CONFIGURED",
  "OPERATION_NOT_FOUND",
  "COMPETITOR_NOT_FOUND",
  "MARKET_NOT_FOUND",
  "PROMPT_NOT_FOUND",
  "BATCH_NOT_FOUND",
  "SITE_NOT_FOUND",
  "INTEGRATION_NOT_FOUND",
  "OPPORTUNITY_NOT_FOUND",
  "PLAN_ITEM_NOT_FOUND",
  "CONTENT_ITEM_NOT_FOUND",
  "CONTENT_VERSION_NOT_FOUND",
  "CONTENT_BLOCKED",
  "QUOTA_EXCEEDED",
  "FORBIDDEN",
  "RATE_LIMITED",
  "UNAUTHENTICATED",
  "NO_ACTIVE_WORKSPACE",
  "PROVIDER_ERROR",
  "CONNECTION_REVOKED",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
