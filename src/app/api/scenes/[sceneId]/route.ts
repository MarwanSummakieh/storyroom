import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { updateScene } from "@/lib/store";
import { updateSceneSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sceneId: string }> },
) {
  try {
    const { sceneId } = await params;
    const input = updateSceneSchema.parse(await request.json());
    return NextResponse.json(await updateScene(sceneId, input));
  } catch (error) {
    return jsonError(error);
  }
}
