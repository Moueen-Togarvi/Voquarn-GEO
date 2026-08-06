import type { BlobDriver } from "@/lib/storage/drivers/types";

/**
 * Cloudflare R2 (S3-compatible), per docs/adr/0005-storage-and-snapshots.md.
 * Not implemented — ships in Phase 4 when crawl volume actually needs bytes
 * larger than the DB driver's limit. Selecting driver: "S3" before then
 * throws immediately rather than silently falling back to the DB driver.
 */
export const s3BlobDriver: BlobDriver = {
  async put(): Promise<void> {
    throw new Error(
      "The S3/R2 storage driver is not implemented yet (Phase 4). Use the DB driver for snapshots under its size limit.",
    );
  },
  async get(): Promise<Buffer> {
    throw new Error(
      "The S3/R2 storage driver is not implemented yet (Phase 4). Use the DB driver for snapshots under its size limit.",
    );
  },
};
