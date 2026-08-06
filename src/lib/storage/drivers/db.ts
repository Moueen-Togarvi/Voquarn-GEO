/**
 * The DB driver stores compressed bytes directly in RawSnapshotBlob, a 1:1
 * child of RawSnapshot — it has no independent object-store key the way the
 * S3 driver does, so it does not implement the same put/get shape. blob.ts
 * writes and reads it inline via Prisma; this file only holds the one real
 * constraint of storing binary payloads in a Postgres row.
 */
export const DB_DRIVER_MAX_BYTES = 256 * 1024;
