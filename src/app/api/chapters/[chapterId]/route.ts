import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { updateChapter } from "@/lib/store";
import { updateChapterSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ chapterId: string }> },
) {
  try {
    const { chapterId } = await params;
    const input = updateChapterSchema.parse(await request.json());
    return NextResponse.json(await updateChapter(chapterId, input));
  } catch (error) {
    return jsonError(error);
  }
}
