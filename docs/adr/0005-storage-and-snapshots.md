# ADR-0005 — Immutable snapshots and object storage

**Status:** Accepted (Phase 0, implemented in Phase 1a/4) · **Date:** 2026-08-05

## Context

Every score and recommendation must be reproducible from the inputs that
produced it. That means raw provider responses, SERP payloads, and crawled HTML
are retained unmodified, and derived scores are regenerated with a new algorithm
version rather than overwritten.

Volume is dominated by Phase-4 crawling, and the dominant read pattern is bulk
re-reads during a re-scoring backfill.

## Decision

`RawSnapshot(driver, objectKey, sha256, mimeType, byteSize, retentionClass, expiresAt)`
plus `src/lib/storage/blob.ts` with two drivers:

- `db` — an adjacent `bytea` table for payloads under ~256 KB. Ships Phase 1a,
  so nothing is blocked on picking a vendor.
- `s3` — **Cloudflare R2**. Ships Phase 4, when crawl volume arrives.

Keys are content-addressed as `sha256/<hash>`, gzipped. Identical repeated
fetches deduplicate for free. A nightly GC cron honours `retentionClass`.

## Rationale

R2 over S3: the API is S3-compatible, and egress is free. Snapshots are read in
bulk exactly when re-scoring, which is when S3 egress would bill hardest.

## Consequences

- Observations are append-only. Never overwrite last position, last schema set,
  or last response in place.
- Retention classes must be assigned when a snapshot is written, not later.
