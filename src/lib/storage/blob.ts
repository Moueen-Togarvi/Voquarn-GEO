import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";

import type { RetentionClass, StorageDriver } from "@/generated/prisma/enums";
import type { WorkspaceContext } from "@/lib/auth/context";
import { scopedDb } from "@/lib/db/scoped";
import { DB_DRIVER_MAX_BYTES } from "@/lib/storage/drivers/db";
import { s3BlobDriver } from "@/lib/storage/drivers/s3";

export type RawSnapshotRef = {
  id: string;
  sha256: string;
  byteSize: number;
  mimeType: string;
  driver: StorageDriver;
};

type WriteSnapshotInput = {
  bytes: Buffer;
  mimeType: string;
  retentionClass?: RetentionClass;
  /** Defaults to "DB" — the only driver wired up until Phase 4. */
  driver?: StorageDriver;
};

/**
 * Immutable, content-addressed snapshot storage. Every raw provider payload,
 * crawled page, and SERP response is written here exactly once; a duplicate
 * write of identical bytes reuses the existing row instead of storing a
 * second copy. See docs/adr/0005-storage-and-snapshots.md.
 */
export async function writeSnapshot(
  ctx: WorkspaceContext,
  input: WriteSnapshotInput,
): Promise<RawSnapshotRef> {
  const compressed = gzipSync(input.bytes);
  const sha256 = createHash("sha256").update(compressed).digest("hex");
  const driver = input.driver ?? "DB";

  const existing = await scopedDb(ctx).rawSnapshot.findUnique({
    where: { workspaceId_sha256: { workspaceId: ctx.workspaceId, sha256 } },
  });
  if (existing) {
    return toRef(existing);
  }

  const objectKey = `${ctx.workspaceId}/${sha256}`;

  if (driver === "DB") {
    if (compressed.byteLength > DB_DRIVER_MAX_BYTES) {
      throw new Error(
        `Snapshot of ${compressed.byteLength} compressed bytes exceeds the DB driver's ${DB_DRIVER_MAX_BYTES}-byte limit. Pass driver: "S3" once Phase 4 wires it up.`,
      );
    }

    const snapshot = await scopedDb(ctx).rawSnapshot.create({
      data: {
        workspaceId: ctx.workspaceId,
        driver: "DB",
        objectKey,
        sha256,
        mimeType: input.mimeType,
        byteSize: compressed.byteLength,
        retentionClass: input.retentionClass ?? "STANDARD",
        blob: { create: { bytes: compressed } },
      },
    });
    return toRef(snapshot);
  }

  await s3BlobDriver.put(objectKey, compressed, input.mimeType);
  const snapshot = await scopedDb(ctx).rawSnapshot.create({
    data: {
      workspaceId: ctx.workspaceId,
      driver: "S3",
      objectKey,
      sha256,
      mimeType: input.mimeType,
      byteSize: compressed.byteLength,
      retentionClass: input.retentionClass ?? "STANDARD",
    },
  });
  return toRef(snapshot);
}

export async function readSnapshot(
  ctx: WorkspaceContext,
  snapshotId: string,
): Promise<Buffer> {
  const snapshot = await scopedDb(ctx).rawSnapshot.findUnique({
    where: { id: snapshotId },
    include: { blob: true },
  });
  if (!snapshot) {
    throw new Error(`RawSnapshot ${snapshotId} not found.`);
  }

  const compressed =
    snapshot.driver === "DB"
      ? Buffer.from(snapshot.blob?.bytes ?? new Uint8Array())
      : await s3BlobDriver.get(snapshot.objectKey);

  return gunzipSync(compressed);
}

function toRef(snapshot: {
  id: string;
  sha256: string;
  byteSize: number;
  mimeType: string;
  driver: StorageDriver;
}): RawSnapshotRef {
  return {
    id: snapshot.id,
    sha256: snapshot.sha256,
    byteSize: snapshot.byteSize,
    mimeType: snapshot.mimeType,
    driver: snapshot.driver,
  };
}
