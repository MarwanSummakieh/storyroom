import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { deleteNovel, getNovel, updateNovel } from "@/lib/store";
import { updateNovelSchema } from "@/lib/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ novelId: string }> },
) {
  try {
    const { novelId } = await params;
    return NextResponse.json(await getNovel(novelId));
  } catch (error) {
    return jsonError(error, 404);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ novelId: string }> },
) {
  try {
    const { novelId } = await params;
    const input = updateNovelSchema.parse(await request.json());
    return NextResponse.json(await updateNovel(novelId, input));
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ novelId: string }> },
) {
  try {
    const { novelId } = await params;
    await deleteNovel(novelId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, 404);
  }
}
