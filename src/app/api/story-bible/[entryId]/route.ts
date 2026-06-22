import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { updateStoryBibleEntry } from "@/lib/store";
import { updateStoryBibleEntrySchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  try {
    const { entryId } = await params;
    const input = updateStoryBibleEntrySchema.parse(await request.json());
    return NextResponse.json(await updateStoryBibleEntry(entryId, input));
  } catch (error) {
    return jsonError(error);
  }
}
