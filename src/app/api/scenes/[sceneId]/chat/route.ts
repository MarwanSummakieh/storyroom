import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { addChatMessage, listChatMessages } from "@/lib/store";
import { createChatMessageSchema } from "@/lib/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sceneId: string }> },
) {
  try {
    const { sceneId } = await params;
    return NextResponse.json(await listChatMessages(sceneId));
  } catch (error) {
    return jsonError(error, 404);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sceneId: string }> },
) {
  try {
    const { sceneId } = await params;
    const input = createChatMessageSchema.parse(await request.json());
    return NextResponse.json(await addChatMessage(sceneId, input), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
