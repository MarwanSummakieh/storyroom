import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { getNovel } from "@/lib/store";

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
