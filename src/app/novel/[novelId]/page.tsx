import { StoryroomApp } from "@/components/storyroom/storyroom-app";

export default async function NovelPage({
  params,
}: {
  params: Promise<{ novelId: string }>;
}) {
  const { novelId } = await params;
  return <StoryroomApp novelId={novelId} />;
}
