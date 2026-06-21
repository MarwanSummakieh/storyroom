import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { createChapter } from "@/lib/store";
import { createChapterSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ novelId: string }> },
) {
  try {
    const { novelId } = await params;
    const input = createChapterSchema.parse(await request.json());
    return NextResponse.json(await createChapter(novelId, input), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
