import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { FameTaskKind, FameTaskStatus } from "@/lib/types";
import {
  buildTechnicalAssets,
  submitToIndexNow,
  type TechnicalBrand,
} from "@/lib/execution/technical";

export const maxDuration = 60;

const bodySchema = z
  .object({
    // Required only for SUBMIT_INDEXNOW.
    indexNowKey: z.string().min(8).max(128).optional(),
    urls: z.array(z.string().url()).max(50).optional(),
  })
  .optional();

/**
 * POST /api/fame-tasks/[id]/execute — run a non-content Fame task:
 * - ADD_SCHEMA / UPDATE_LLMS_TXT → returns the ready-to-paste asset, marks DONE
 * - SUBMIT_INDEXNOW → pings IndexNow with the provided key + URLs, marks DONE
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const task = await db.fameTask.findUnique({
    where: { id },
    include: { brand: true },
  });
  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (task.brand.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  const body = parsed.success ? (parsed.data ?? {}) : {};

  const brand: TechnicalBrand = {
    name: task.brand.name,
    domain: task.brand.domain,
    industry: task.brand.industry,
    description: task.brand.description,
  };
  const assets = buildTechnicalAssets(brand);

  if (task.kind === FameTaskKind.ADD_SCHEMA) {
    await db.fameTask.update({
      where: { id },
      data: { status: FameTaskStatus.DONE },
    });
    return NextResponse.json({
      ok: true,
      asset: `${assets.organizationSchema}\n\n${assets.productSchema}`,
      message: "Paste this JSON-LD into your site's <head>.",
    });
  }

  if (task.kind === FameTaskKind.UPDATE_LLMS_TXT) {
    await db.fameTask.update({
      where: { id },
      data: { status: FameTaskStatus.DONE },
    });
    return NextResponse.json({
      ok: true,
      asset: assets.llmsTxt,
      message: "Host this at https://" + brand.domain + "/llms.txt",
    });
  }

  if (task.kind === FameTaskKind.SUBMIT_INDEXNOW) {
    if (!body.indexNowKey) {
      return NextResponse.json(
        {
          error:
            "An IndexNow key is required. Generate one (8-128 hex chars) and host it at https://" +
            brand.domain +
            "/<key>.txt, then submit it here.",
        },
        { status: 400 },
      );
    }
    const host = brand.domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    const urls = body.urls?.length ? body.urls : [`https://${host}/`];
    const result = await submitToIndexNow(host, urls, body.indexNowKey);
    if (result.ok) {
      await db.fameTask.update({
        where: { id },
        data: { status: FameTaskStatus.DONE },
      });
    }
    return NextResponse.json({ ok: result.ok, message: result.message });
  }

  return NextResponse.json(
    { error: "This task kind is not executable here" },
    { status: 400 },
  );
}
