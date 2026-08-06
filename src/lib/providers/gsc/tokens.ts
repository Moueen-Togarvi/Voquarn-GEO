import type { WorkspaceContext } from "@/lib/auth/context";
import {
  getDecryptedRefreshToken,
  rotateRefreshToken,
} from "@/lib/integrations/service";
import { refreshAccessToken } from "@/lib/providers/gsc/oauth";

/**
 * Always refreshes rather than caching an access token + its expiry — GSC
 * imports run at most once a day, so the extra token exchange is cheap and
 * avoids tracking token-expiry state anywhere. Rotates the stored refresh
 * token if Google happens to issue a new one on this call (rare, but the
 * next refresh would fail against a stale stored token if unhandled).
 */
export async function getFreshAccessToken(
  ctx: WorkspaceContext,
  connectionId: string,
): Promise<string> {
  const refreshToken = await getDecryptedRefreshToken(ctx, connectionId);
  const tokens = await refreshAccessToken(refreshToken);

  if (tokens.refresh_token && tokens.refresh_token !== refreshToken) {
    await rotateRefreshToken(ctx, connectionId, tokens.refresh_token);
  }

  return tokens.access_token;
}
