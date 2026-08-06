import { Prisma } from "@/generated/prisma/client";

/** True when `error` is a Prisma known-request error with the given code. */
export function isPrismaErrorCode(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}
