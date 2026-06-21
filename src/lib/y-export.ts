import { generateText } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { yXmlFragmentToProsemirrorJSON } from "y-prosemirror";
import * as Y from "yjs";

export function encodeYDocUpdate(document: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(document);
}

export function decodeYDocUpdate(update: Uint8Array): Y.Doc {
  const document = new Y.Doc();
  Y.applyUpdate(document, update);
  return document;
}

export function yUpdateToPlainText(update: Uint8Array | null): string {
  if (!update || update.byteLength === 0) {
    return "";
  }

  const document = decodeYDocUpdate(update);
  const fragment = document.getXmlFragment("default");
  const json = yXmlFragmentToProsemirrorJSON(fragment);

  try {
    return generateText(json, [StarterKit]).trim();
  } catch {
    return "";
  }
}
