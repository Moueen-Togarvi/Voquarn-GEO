import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
/** 96-bit IV — the size GCM is designed and recommended for; anything else needs a justification this doesn't have. */
const IV_LENGTH = 12;

export type EncryptedPayload = {
  ciphertext: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  authTag: Uint8Array<ArrayBuffer>;
  keyVersion: number;
};

/**
 * Prisma 7's generated `Bytes` field input wants a plain
 * `Uint8Array<ArrayBuffer>`, not Node's `Buffer<ArrayBufferLike>` — a
 * Buffer is structurally close enough to satisfy `instanceof Uint8Array`
 * but not TypeScript's stricter generic (ArrayBufferLike also covers
 * SharedArrayBuffer, which Bytes columns can't represent). `Uint8Array.from`
 * always allocates a fresh, plain-ArrayBuffer-backed copy at runtime — the
 * cast only narrows the type TS assigns to that guarantee, which `.from`'s
 * own (deliberately more permissive) signature doesn't express.
 */
function toBytes(buffer: Buffer): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(buffer) as Uint8Array<ArrayBuffer>;
}

/**
 * Bump this and add `INTEGRATION_ENCRYPTION_KEY_V<n>` to rotate keys without
 * touching already-encrypted rows — each EncryptedSecret records the
 * keyVersion it was sealed under, so old rows keep decrypting against their
 * original key while new writes use the current one. A KMS-backed key
 * provider replaces loadKey() later without changing either caller.
 */
const CURRENT_KEY_VERSION = 1;

function loadKey(version: number): Buffer {
  const envVar = `INTEGRATION_ENCRYPTION_KEY_V${version}`;
  const value = process.env[envVar];
  if (!value) {
    throw new Error(
      `${envVar} is not configured. Set a base64-encoded 32-byte key to enable secret storage.`,
    );
  }

  const key = Buffer.from(value, "base64");
  if (key.length !== 32) {
    throw new Error(
      `${envVar} must decode to exactly 32 bytes for AES-256-GCM (got ${key.length}).`,
    );
  }
  return key;
}

/**
 * Seals a secret (an OAuth refresh token today) for storage in
 * EncryptedSecret. Never called with anything that will later be returned
 * from a DTO-producing function — see the model comment in schema.prisma.
 */
export function encryptSecret(plaintext: string): EncryptedPayload {
  const key = loadKey(CURRENT_KEY_VERSION);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: toBytes(ciphertext),
    iv: toBytes(iv),
    authTag: toBytes(authTag),
    keyVersion: CURRENT_KEY_VERSION,
  };
}

/** Throws if the ciphertext, iv, or authTag have been tampered with, or if the recorded key version is unavailable — never returns a corrupted plaintext. */
export function decryptSecret(payload: EncryptedPayload): string {
  const key = loadKey(payload.keyVersion);

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(payload.iv));
  decipher.setAuthTag(Buffer.from(payload.authTag));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext)),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
