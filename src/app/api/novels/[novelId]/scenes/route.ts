import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { createScene } from "@/lib/store";
import { createSceneSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ novelId: string }> },
) {
  try {
    const { novelId } = await params;
    const input = createSceneSchema.parse(await request.json());
    return NextResponse.json(await createScene(novelId, input), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
