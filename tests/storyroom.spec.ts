import { expect, test } from "@playwright/test";

test("two tabs share manuscript, presence, and chat", async ({ browser }) => {
  const context = await browser.newContext();
  const pageOne = await context.newPage();
  const pageTwo = await context.newPage();

  await pageOne.goto("/");
  await pageTwo.goto("/");

  await pageOne.getByLabel("Display name").fill("Mara");
  await pageTwo.getByLabel("Display name").fill("Elias");

  await expect(pageOne.getByRole("heading", { name: "The Glass Harbor" })).toBeVisible();
  await expect(pageTwo.getByRole("heading", { name: "The Glass Harbor" })).toBeVisible();

  const editorOne = pageOne.getByLabel("Collaborative manuscript editor");
  const editorTwo = pageTwo.getByLabel("Collaborative manuscript editor");
  await editorOne.click();
  await pageOne.keyboard.type("The lighthouse blinked twice.");

  await expect(editorTwo).toContainText("The lighthouse blinked twice.");
  await expect(pageTwo.locator(".collaboration-cursor__label", { hasText: "Mara" })).toBeVisible();

  await pageTwo.getByLabel("Scene chat message").fill("Keep this opening image.");
  await pageTwo.getByRole("button", { name: "Send message" }).click();

  await expect(pageOne.getByText("Keep this opening image.")).toBeVisible();

  await context.close();
});
