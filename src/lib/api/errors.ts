import { NextResponse } from "next/server";
import { z } from "zod";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string[] | undefined>,
  ) {
    super(message);
  }
}

function isPrismaError(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  );
}

export function errorResponse(error: unknown) {
  if (error instanceof SyntaxError) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "The request body must contain valid JSON.",
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Review the highlighted fields and try again.",
          fieldErrors: z.flattenError(error).fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          fieldErrors: error.fieldErrors,
        },
      },
      { status: error.status },
    );
  }

  if (isPrismaError(error) && error.code === "P2002") {
    return NextResponse.json(
      {
        error: {
          code: "DUPLICATE_BRAND",
          message: "A project for this domain already exists.",
          fieldErrors: {
            websiteUrl: ["This website is already being tracked"],
          },
        },
      },
      { status: 409 },
    );
  }

  console.error(error);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      },
    },
    { status: 500 },
  );
}
