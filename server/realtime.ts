import "dotenv/config";

import { Server } from "@hocuspocus/server";
import * as Y from "yjs";

import { addChatMessage, loadDocumentState, saveDocumentState } from "../src/lib/store";
import { statelessMessageSchema } from "../src/lib/validation";

const port = Number(process.env.COLLAB_PORT ?? 1234);

const server = new Server({
  name: "storyroom-realtime",
  port,
  timeout: 30_000,
  debounce: 750,
  maxDebounce: 4_000,

  async onLoadDocument({ documentName, document }) {
    const update = await loadDocumentState(documentName);

    if (update) {
      Y.applyUpdate(document, update);
    }
  },

  async onStoreDocument({ documentName, document }) {
    await saveDocumentState(documentName, Y.encodeStateAsUpdate(document));
  },

  async onStateless({ payload, documentName, document }) {
    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(payload);
    } catch {
      return;
    }

    const parsed = statelessMessageSchema.safeParse(parsedJson);

    if (!parsed.success || parsed.data.type !== "chat:message") {
      return;
    }

    const message = await addChatMessage(documentName, {
      authorName: parsed.data.authorName,
      authorColor: parsed.data.authorColor,
      body: parsed.data.body,
    });

    document.broadcastStateless(
      JSON.stringify({
        type: "chat:created",
        message,
      }),
    );
  },
});

async function shutdown(signal: string) {
  console.log(`[realtime] ${signal} received, flushing pending document stores.`);
  server.hocuspocus.flushPendingStores();
  await server.destroy();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

server.listen(port, () => {
  console.log(`[realtime] Storyroom WebSocket server listening on ws://localhost:${port}`);
});
