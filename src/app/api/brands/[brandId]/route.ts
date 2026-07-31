import { NextResponse } from "next/server";
import { errorResponse, AppError } from "@/lib/api/errors";
import { deleteBrand, getBrand, updateBrand } from "@/lib/brands/service";
import { brandInputSchema, deleteBrandSchema } from "@/lib/validation/brand";

type RouteContext = { params: Promise<{ brandId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { brandId } = await context.params;
    const brand = await getBrand(brandId);
    if (!brand) {
      throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
    }
    return NextResponse.json({ data: brand });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { brandId } = await context.params;
    const input = brandInputSchema.parse(await request.json());
    return NextResponse.json({ data: await updateBrand(brandId, input) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { brandId } = await context.params;
    const { confirmation } = deleteBrandSchema.parse(await request.json());
    return NextResponse.json({
      data: await deleteBrand(brandId, confirmation),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
