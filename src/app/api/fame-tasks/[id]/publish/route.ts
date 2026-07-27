import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { FameTaskKind, FameTaskStatus } from "@/lib/types";
import { canGenerateContent } from "@/lib/billing/enforce";
import { makePublisher } from "@/lib/publish";
import {
  generateComparisonArticle,
  generateAnswerSnippet,
  generateFAQ,
  type ContentBrand,
} from "@/lib/execution/content-generator";

export const maxDuration = 120;

interface TaskPayload {
  promptText?: string;
  competitor?: string | null;
  contentType?: "comparison" | "snippet" | "faq";
}

/**
 * POST /api/fame-tasks/[id]/publish — generate the task's content and publish it
 * to the brand's connected destination (optionally ?integrationId=...). Marks
 * the task DONE and records the published URL on success.
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
    include: {
      brand: {
        include: { prompts: { select: { text: true } } },
      },
    },
  });
  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (task.brand.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Tier gate: publishing is a Pro+ (content) feature.
  const allowed = await canGenerateContent(user.id);
  if (!allowed.ok) {
    return NextResponse.json(
      { error: allowed.reason, upgrade: true },
      { status: 402 },
    );
  }

  if (task.kind !== FameTaskKind.PUBLISH_CONTENT) {
    return NextResponse.json(
      { error: "This task is not a content-publish task" },
      { status: 400 },
    );
  }

  // Pick the integration (explicit id or the brand's first one).
  const integrationId = new URL(req.url).searchParams.get("integrationId");
  const integration = integrationId
    ? await db.integration.findFirst({
        where: { id: integrationId, brandId: task.brandId },
      })
    : await db.integration.findFirst({ where: { brandId: task.brandId } });
  if (!integration) {
    return NextResponse.json(
      { error: "No publishing destination connected" },
      { status: 400 },
    );
  }

  const publisher = makePublisher(
    integration.provider,
    integration.credentials,
  );
  if (!publisher) {
    return NextResponse.json(
      { error: `Publishing to ${integration.provider} is not supported yet` },
      { status: 400 },
    );
  }

  const brand: ContentBrand = {
    name: task.brand.name,
    domain: task.brand.domain,
    industry: task.brand.industry,
    description: task.brand.description,
  };

  // Generate the content this task represents.
  const payload = (task.payload ?? {}) as TaskPayload;
  let content;
  try {
    if (payload.contentType === "comparison" && payload.competitor) {
      content = await generateComparisonArticle(
        brand,
        payload.competitor,
        payload.promptText,
      );
    } else if (payload.contentType === "faq") {
      content = await generateFAQ(
        brand,
        task.brand.prompts.map((p) => p.text),
      );
    } else {
      content = await generateAnswerSnippet(
        brand,
        payload.promptText ?? task.title,
      );
    }
  } catch (error) {
    console.error("[fame publish] content generation failed:", error);
    return NextResponse.json(
      { error: "Content generation failed" },
      { status: 502 },
    );
  }

  const result = await publisher.publish({
    title: content.title,
    content: content.content,
    schema: content.schema,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 502 });
  }

  await db.fameTask.update({
    where: { id },
    data: { status: FameTaskStatus.DONE, publishedUrl: result.url ?? null },
  });

  return NextResponse.json({
    ok: true,
    url: result.url,
    message: result.message,
  });
}
