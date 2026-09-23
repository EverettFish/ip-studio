import { describe, expect, it } from "vitest";
import { ANCHOR_STYLE_PRESETS, buildAnchorConversionPrompt, buildStarterAnchorPrompt, getAnchorStylePreset, STARTER_ANCHOR_DEMOS } from "./anchor-styles";

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

  it("builds an original starter anchor without pretending an identity image exists", () => {
    expect(STARTER_ANCHOR_DEMOS).toHaveLength(3);
    const prompt = buildStarterAnchorPrompt(STARTER_ANCHOR_DEMOS[0].brief, "mengli");
    expect(prompt).toContain("There is no identity reference image yet");
    expect(prompt).toContain("Pure white 1:1 square canvas");
    expect(prompt).toContain("occupying about 25–35%");
    expect(prompt).toContain(getAnchorStylePreset("mengli").prompt);
    expect(prompt).not.toContain("Image 1 is the only identity source");
  });

  it("assigns an uploaded starter reference a clear identity role", () => {
    const prompt = buildStarterAnchorPrompt(STARTER_ANCHOR_DEMOS[0].brief, "mengli", true);
    expect(prompt).toContain("Image 1 is the user's visual identity reference");
    expect(prompt).toContain("CHARACTER BRIEF overrides Image 1 only where they explicitly conflict");
    expect(prompt).not.toContain("There is no identity reference image yet");
  });

  it("requires a meaningful starter description", () => {
    expect(() => buildStarterAnchorPrompt("蓝发", "flat")).toThrow(/至少写一句/);
  });
});
