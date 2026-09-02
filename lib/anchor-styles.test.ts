import { describe, expect, it } from "vitest";
import { ANCHOR_STYLE_PRESETS, buildAnchorConversionPrompt, getAnchorStylePreset } from "./anchor-styles";

describe("anchor style presets", () => {
  it("offers original plus three illustrated conversion styles", () => {
    expect(ANCHOR_STYLE_PRESETS.map((preset) => preset.id)).toEqual(["original", "mengli", "island-3d", "flat"]);
    expect(ANCHOR_STYLE_PRESETS.filter((preset) => preset.requiresConversion)).toHaveLength(3);
    expect(ANCHOR_STYLE_PRESETS.filter((preset) => preset.preview)).toHaveLength(3);
  });

  it("keeps Image 1 as the only identity source during conversion", () => {
    for (const style of ["mengli", "island-3d", "flat"] as const) {
      const prompt = buildAnchorConversionPrompt(style);
      expect(prompt).toContain("Image 1 is the only identity source");
      expect(prompt).toContain("Change only the rendering medium");
      expect(prompt).toContain(getAnchorStylePreset(style).prompt);
      expect(prompt).toContain("No text, logo, watermark, scenery, extra character");
    }
  });
});
