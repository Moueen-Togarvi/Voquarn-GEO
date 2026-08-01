import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/errors";
import { createBrand, listBrands } from "@/lib/brands/service";
import { discoverBrandProfile } from "@/lib/discovery/brand-profile";
import { brandDiscoveryInputSchema } from "@/lib/validation/brand";

export async function GET() {
  try {
    return NextResponse.json({ data: await listBrands() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = brandDiscoveryInputSchema.parse(await request.json());
    const profile = await discoverBrandProfile(input);
    const brand = await createBrand(profile);
    return NextResponse.json({ data: brand }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
