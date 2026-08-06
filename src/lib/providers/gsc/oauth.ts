import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const GOOGLE_AUTHORIZATION_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

const STATE_TTL_MS = 10 * 60 * 1000;

export type OAuthStatePayload = {
  workspaceId: string;
  siteId: string;
};

function stateSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET is not configured. It signs the OAuth state parameter as well as auth sessions.",
    );
  }
  return secret;
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * A stateless, HMAC-signed OAuth `state` parameter — no server-side session
 * storage needed between the authorize redirect and the callback. Encodes
 * which workspace/site the connection is for plus a short expiry, so the
 * callback can be verified without a database round trip and a forged or
 * replayed-after-expiry state is rejected outright.
 */
export function signState(payload: OAuthStatePayload): string {
  const nonce = randomBytes(9).toString("base64url");
  const expiresAt = Date.now() + STATE_TTL_MS;
  const body = JSON.stringify({ ...payload, nonce, expiresAt });
  const encoded = Buffer.from(body, "utf8").toString("base64url");
  const signature = createHmac("sha256", stateSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyState(token: string): OAuthStatePayload {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    throw new Error("Malformed OAuth state.");
  }

  const expected = createHmac("sha256", stateSecret())
    .update(encoded)
    .digest("base64url");
  if (!timingSafeEqualStrings(signature, expected)) {
    throw new Error("OAuth state signature mismatch.");
  }

  const body = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8"),
  ) as OAuthStatePayload & { nonce: string; expiresAt: number };

  if (Date.now() > body.expiresAt) {
    throw new Error("OAuth state expired. Restart the connection flow.");
  }

  return { workspaceId: body.workspaceId, siteId: body.siteId };
}

export function buildAuthorizationUrl(input: {
  redirectUri: string;
  state: string;
}): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID is not configured.");
  }

  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GSC_SCOPE);
  // offline + consent guarantee a refresh_token comes back even on a repeat
  // authorization — Google otherwise only issues one on the very first
  // consent for a given client/user pair.
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", input.state);
  return url.toString();
}

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

function requireOAuthClientCredentials(): {
  clientId: string;
  clientSecret: string;
} {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET are not configured.",
    );
  }
  return { clientId, clientSecret };
}

/**
 * Structurally complete against Google's documented OAuth2 web-server flow
 * but never exercised against live Google endpoints in this environment (no
 * OAuth client registered here) — verify against a real consent screen and
 * token exchange before relying on it in production.
 */
export async function exchangeCodeForTokens(input: {
  code: string;
  redirectUri: string;
}): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = requireOAuthClientCredentials();

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed (${response.status}).`);
  }
  return (await response.json()) as GoogleTokenResponse;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = requireOAuthClientCredentials();

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Google token refresh failed (${response.status}).`);
  }
  return (await response.json()) as GoogleTokenResponse;
}
