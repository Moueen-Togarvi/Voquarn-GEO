import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/errors";
import { createBrand, listBrands } from "@/lib/brands/service";
import { brandInputSchema } from "@/lib/validation/brand";

export async function GET() {
  try {
    return NextResponse.json({ data: await listBrands() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = brandInputSchema.parse(await request.json());
    const brand = await createBrand(input);
    return NextResponse.json({ data: brand }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
