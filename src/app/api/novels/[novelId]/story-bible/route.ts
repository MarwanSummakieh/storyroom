import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { createStoryBibleEntry } from "@/lib/store";
import { createStoryBibleEntrySchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ novelId: string }> },
) {
  try {
    const { novelId } = await params;
    const input = createStoryBibleEntrySchema.parse(await request.json());
    return NextResponse.json(await createStoryBibleEntry(novelId, input), {
      status: 201,
    });
  } catch (error) {
    return jsonError(error);
  }
}
