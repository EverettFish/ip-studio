import { describe, expect, it } from "vitest";
import { composeGenerationPrompt, getOrderedReferenceFiles, MENGLI_STYLE } from "./generation-policy";

describe("generation policy", () => {
  it("prepends the immutable anchor and Mengli locks", () => {
    const prompt = composeGenerationPrompt("Create the requested asset.");
    expect(prompt.startsWith("MANDATORY REFERENCE AND IDENTITY POLICY")).toBe(true);
    expect(prompt).toContain("Image 1 is always the user's accepted personal-IP anchor");
    expect(prompt).toContain(MENGLI_STYLE);
    expect(prompt).toContain("ROUTE REQUEST:\nCreate the requested asset.");
  });

  it("keeps identity fixed while switching the three expression styles", () => {
    const meme = composeGenerationPrompt("Reaction route.", "meme");
    const anchor = composeGenerationPrompt("Reaction route.", "anchor");
    const mengli = composeGenerationPrompt("Reaction route.", "mengli");

    for (const prompt of [meme, anchor, mengli]) {
      expect(prompt).toContain("Image 1 is always the user's accepted personal-IP anchor");
    }
    expect(meme).toContain("NATIVE MEME / REACTION STYLE");
    expect(meme).toContain("Image 2's own rendering medium");
    expect(meme).not.toContain("MENGLI ONLY");
    expect(anchor).toContain("ANCHOR ORIGINAL STYLE");
    expect(anchor).toContain("Image 1 controls both identity and rendering medium");
    expect(anchor).not.toContain("MENGLI ONLY");
    expect(mengli).toContain("MENGLI ONLY");
  });

  it("orders the anchor before every source reference", () => {
    const form = new FormData();
    const anchor = new File(["anchor"], "anchor.webp", { type: "image/webp" });
    const sourceA = new File(["source-a"], "a.webp", { type: "image/webp" });
    const sourceB = new File(["source-b"], "b.webp", { type: "image/webp" });
    form.append("sources", sourceA);
    form.append("anchor", anchor);
    form.append("sources", sourceB);
    const ordered = getOrderedReferenceFiles(form);
    expect(ordered.anchor?.name).toBe("anchor.webp");
    expect(ordered.all.map((file) => file.name)).toEqual(["anchor.webp", "a.webp", "b.webp"]);
  });

  it("does not invent an anchor when the required field is absent", () => {
    const form = new FormData();
    form.append("sources", new File(["source"], "source.webp", { type: "image/webp" }));
    const ordered = getOrderedReferenceFiles(form);
    expect(ordered.anchor).toBeUndefined();
    expect(ordered.sources).toHaveLength(1);
  });
});
