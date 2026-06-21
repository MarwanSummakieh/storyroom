import { describe, expect, it } from "vitest";

import {
  createChatMessageSchema,
  createStoryBibleEntrySchema,
  updateSceneSchema,
} from "@/lib/validation";

describe("Storyroom validation", () => {
  it("accepts valid story bible entries", () => {
    const entry = createStoryBibleEntrySchema.parse({
      kind: "character",
      title: "Mara Vale",
      body: "Keeps a ledger of impossible coastlines.",
      tags: ["lead", "secret"],
    });

    expect(entry.kind).toBe("character");
    expect(entry.tags).toEqual(["lead", "secret"]);
  });

  it("rejects invalid chat colors", () => {
    expect(() =>
      createChatMessageSchema.parse({
        authorName: "Mara",
        authorColor: "green",
        body: "This should fail.",
      }),
    ).toThrow();
  });

  it("limits scene statuses to the workflow states", () => {
    expect(updateSceneSchema.parse({ status: "review" })).toEqual({
      status: "review",
    });
    expect(() => updateSceneSchema.parse({ status: "published" })).toThrow();
  });
});
