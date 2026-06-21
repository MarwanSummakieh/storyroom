import { exportNovelAsMarkdown } from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ novelId: string }> },
) {
  const { novelId } = await params;
  const markdown = await exportNovelAsMarkdown(novelId);

  return new Response(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${novelId}.md"`,
    },
  });
}
