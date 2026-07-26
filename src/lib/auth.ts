import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import type { User } from "@/lib/types";

/**
 * Resolve the local User row for the signed-in Clerk user, creating it on
 * first sight (JIT provisioning). Returns null if not signed in.
 */
export async function getCurrentUser(): Promise<User | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const existing = await db.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  // First time we've seen this Clerk user — create the local row.
  const clerkUser = await currentUser();
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ??
    clerkUser?.emailAddresses[0]?.emailAddress ??
    "";

  return db.user.create({ data: { clerkId, email } });
}

/**
 * Ensure the signed-in user owns `brandId`. Returns the local user id on
 * success, or an error tag the route can map to an HTTP status.
 */
export async function requireBrandOwnership(
  brandId: string,
): Promise<
  { ok: true; userId: string } | { ok: false; status: 401 | 403 | 404 }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401 };

  const brand = await db.brand.findUnique({
    where: { id: brandId },
    select: { userId: true },
  });
  if (!brand) return { ok: false, status: 404 };
  if (brand.userId !== user.id) return { ok: false, status: 403 };

  return { ok: true, userId: user.id };
}
