import { NextResponse } from "next/server";

import type { ApiAccepted, ApiSuccess } from "@/lib/api/types";
import { getClientIp } from "@/lib/api/client-ip";
import { AppError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { listBrands } from "@/lib/brands/service";
import type { BrandDto } from "@/lib/brands/types";
import {
  assertPublicWebsiteUrl,
  UnsafeWebsiteError,
} from "@/lib/discovery/website";
import { inngest } from "@/lib/inngest/client";
import { brandDiscoveryRequested } from "@/lib/inngest/events";
import { createOperation } from "@/lib/operations/service";
import { brandDiscoveryInputSchema } from "@/lib/validation/brand";

export const GET = route(async ({ ctx }) => {
  return NextResponse.json({
    data: await listBrands(ctx),
  } satisfies ApiSuccess<BrandDto[]>);
});

export const POST = route(async ({ ctx, request }) => {
  const rateLimit = await checkRateLimit({
    key: `brand-discovery:${getClientIp(request)}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    throw new AppError(
      429,
      "RATE_LIMITED",
      "Too many projects created recently. Try again in a bit.",
    );
  }

  const input = brandDiscoveryInputSchema.parse(await request.json());

  // Fail fast on an obviously bad URL rather than creating an Operation that
  // is only ever going to fail once a worker picks it up.
  try {
    await assertPublicWebsiteUrl(input.websiteUrl);
  } catch (error) {
    if (error instanceof UnsafeWebsiteError) {
      throw new AppError(400, "UNSAFE_WEBSITE_URL", error.message, {
        websiteUrl: [error.message],
      });
    }
    throw error;
  }

  const operation = await createOperation(ctx, {
    kind: "BRAND_DISCOVERY",
    progressTotal: 4,
  });

  await inngest.send(
    brandDiscoveryRequested.create({
      workspaceId: ctx.workspaceId,
      operationId: operation.id,
      brandId: null,
      name: input.name,
      websiteUrl: input.websiteUrl,
    }),
  );

  return NextResponse.json(
    { operationId: operation.id } satisfies ApiAccepted,
    { status: 202 },
  );
});
