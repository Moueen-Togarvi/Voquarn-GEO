import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "@/lib/crypto/envelope";

const ENV_VAR = "INTEGRATION_ENCRYPTION_KEY_V1";
const originalValue = process.env[ENV_VAR];

describe("crypto envelope", () => {
  beforeEach(() => {
    process.env[ENV_VAR] = randomBytes(32).toString("base64");
  });

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[ENV_VAR];
    } else {
      process.env[ENV_VAR] = originalValue;
    }
  });

  it("round-trips a secret through encrypt and decrypt", () => {
    const plaintext = "1//0gA_a_super_secret_refresh_token";
    const payload = encryptSecret(plaintext);
    expect(decryptSecret(payload)).toBe(plaintext);
  });

  it("produces a different ciphertext and iv on every call (random IV)", () => {
    const first = encryptSecret("same plaintext");
    const second = encryptSecret("same plaintext");
    expect(
      Buffer.from(first.ciphertext).equals(Buffer.from(second.ciphertext)),
    ).toBe(false);
    expect(Buffer.from(first.iv).equals(Buffer.from(second.iv))).toBe(false);
  });

  it("records the current key version", () => {
    const payload = encryptSecret("token");
    expect(payload.keyVersion).toBe(1);
  });

  it("throws rather than returning corrupted plaintext when the ciphertext is tampered with", () => {
    const payload = encryptSecret("token");
    const tampered = {
      ...payload,
      ciphertext: Buffer.from(payload.ciphertext).fill(0xff),
    };
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("throws when the auth tag is tampered with", () => {
    const payload = encryptSecret("token");
    const tampered = {
      ...payload,
      authTag: Buffer.from(payload.authTag).fill(0xaa),
    };
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("throws a clear error when the configured key is not 32 bytes", () => {
    process.env[ENV_VAR] = Buffer.from("too-short").toString("base64");
    expect(() => encryptSecret("token")).toThrow(/32 bytes/);
  });

  it("throws a clear error when the key for a version is not configured", () => {
    delete process.env[ENV_VAR];
    expect(() => encryptSecret("token")).toThrow(/not configured/);
  });
});
