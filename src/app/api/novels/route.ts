import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { createNovel, getWorkspace } from "@/lib/store";
import { createNovelSchema } from "@/lib/validation";

export async function GET() {
  return NextResponse.json(await getWorkspace());
}

export async function POST(request: Request) {
  try {
    const input = createNovelSchema.parse(await request.json());
    return NextResponse.json(await createNovel(input), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
