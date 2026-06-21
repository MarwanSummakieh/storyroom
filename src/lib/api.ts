import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(error: unknown, status = 400) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: error.issues.map((issue) => issue.message).join(", ") },
      { status },
    );
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unexpected error." },
    { status },
  );
}
