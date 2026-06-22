/**
 * End-to-end smoke test for the Prisma/Postgres store.
 *
 * Usage:
 *   1. Ensure Postgres is running and the schema is applied:
 *        docker compose up -d
 *        DATABASE_URL=... pnpm db:push
 *   2. Run:
 *        DATABASE_URL=... pnpm db:test
 *
 * Requires DATABASE_URL to be set (otherwise the store falls back to JSON and
 * this test is meaningless).
 */
import "dotenv/config";

import * as Y from "yjs";

import * as store from "@/lib/store";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set — this test only validates the Postgres path.",
    );
  }

  console.log("→ getWorkspace() (seeds on first run)");
  const workspace = await store.getWorkspace();
  assert(workspace.activeNovel, "workspace should have an active novel");
  const seededNovel = workspace.activeNovel!;
  assert(seededNovel.chapters.length >= 1, "seed novel should have a chapter");
  assert(
    seededNovel.chapters[0].scenes.length >= 1,
    "seed chapter should have scenes",
  );
  console.log(
    `  ✓ active novel: "${seededNovel.title}" with ${seededNovel.chapters[0].scenes.length} scene(s), ${seededNovel.storyBible.length} bible entr(ies)`,
  );

  console.log("→ createNovel()");
  const novel = await store.createNovel({
    title: "Smoke Test Novel",
    logline: "Verifying the Postgres-backed repository end to end.",
    genre: "Test fixture",
  });
  assert(novel.id, "created novel should have an id");
  assert(novel.chapters[0]?.scenes[0]?.id, "created novel should have a scene");
  const sceneId = novel.chapters[0].scenes[0].id;
  console.log(`  ✓ novel ${novel.id}, opening scene ${sceneId}`);

  console.log("→ createScene()");
  const scene = await store.createScene(novel.id, {
    chapterId: novel.chapters[0].id,
    title: "Second Scene",
    summary: "Added by the smoke test.",
  });
  assert(scene.position === 2, "second scene should be at position 2");
  console.log(`  ✓ scene ${scene.id} at position ${scene.position}`);

  console.log("→ updateScene()");
  const updated = await store.updateScene(scene.id, { status: "review" });
  assert(updated.status === "review", "scene status should be 'review'");
  console.log(`  ✓ status -> ${updated.status}`);

  console.log("→ createStoryBibleEntry()");
  const entry = await store.createStoryBibleEntry(novel.id, {
    kind: "canon",
    title: "Test Canon",
    body: "Reflections lie forward.",
    tags: ["test", "canon"],
  });
  assert(entry.kind === "canon", "bible entry kind should round-trip lowercase");
  console.log(`  ✓ bible entry ${entry.id} (${entry.kind})`);

  console.log("→ addChatMessage() / listChatMessages()");
  const message = await store.addChatMessage(sceneId, {
    authorName: "Smoke Tester",
    authorColor: "#7c3aed",
    body: "Hello from the smoke test.",
  });
  const messages = await store.listChatMessages(sceneId);
  assert(
    messages.some((m) => m.id === message.id),
    "listed messages should include the new message",
  );
  console.log(`  ✓ ${messages.length} message(s) for scene`);

  console.log("→ saveDocumentState() / loadDocumentState()");
  // A real Yjs update for the manuscript's XmlFragment, so the export path
  // (which Yjs-decodes the snapshot) is exercised with valid data.
  const doc = new Y.Doc();
  const fragment = doc.getXmlFragment("default");
  const paragraph = new Y.XmlElement("paragraph");
  const text = new Y.XmlText();
  text.insert(0, "Reflections lie forward.");
  paragraph.insert(0, [text]);
  fragment.insert(0, [paragraph]);
  const payload = Y.encodeStateAsUpdate(doc);

  await store.saveDocumentState(sceneId, payload);
  const loaded = await store.loadDocumentState(sceneId);
  assert(loaded !== null, "document state should load");
  assert(
    loaded!.length === payload.length && loaded!.every((b, i) => b === payload[i]),
    "loaded bytes should equal saved bytes",
  );
  console.log(`  ✓ round-tripped ${loaded!.length} bytes`);

  console.log("→ exportNovelAsMarkdown()");
  const markdown = await store.exportNovelAsMarkdown(novel.id);
  assert(markdown.includes("# Smoke Test Novel"), "export should include title");
  assert(
    markdown.includes("Reflections lie forward."),
    "export should include the manuscript text decoded from the snapshot",
  );
  console.log(`  ✓ exported ${markdown.length} chars of Markdown (with manuscript text)`);

  console.log("\n✅ All Prisma store operations passed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Smoke test failed:");
    console.error(error);
    process.exit(1);
  });
