import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { prosemirrorJSONToYDoc } from "y-prosemirror";
import * as Y from "yjs";

import { yUpdateToPlainText } from "@/lib/y-export";

describe("Yjs export helpers", () => {
  it("extracts readable text from a TipTap collaboration snapshot", () => {
    const schema = getSchema([StarterKit]);
    const document = prosemirrorJSONToYDoc(
      schema,
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "The harbor reflected tomorrow." }],
          },
        ],
      },
      "default",
    );

    const update = Y.encodeStateAsUpdate(document);
    expect(yUpdateToPlainText(update)).toBe("The harbor reflected tomorrow.");
  });
});
