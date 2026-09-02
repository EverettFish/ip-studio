import { describe, expect, it } from "vitest";
import { buildStaticJobs, defaultConfig, estimateCount, parseList, workflowMap } from "./workflows";

describe("workflow defaults", () => {
  it("creates the prescribed three sticker sheets", () => {
    const config = defaultConfig(workflowMap.stickers);
    const jobs = buildStaticJobs("stickers", config);
    expect(jobs).toHaveLength(3);
    expect(jobs.map((item) => item.title)).toEqual(["Life · 贴纸页", "Work · 贴纸页", "Media · 贴纸页"]);
    expect(jobs.every((item) => item.background === "opaque" && item.size === "1024x1536")).toBe(true);
    expect(jobs[0].prompt).toContain("only identity source");
    expect(jobs[0].prompt).toContain("EXACTLY 18 INDEPENDENT PIECES");
    expect(jobs[0].prompt).toContain("top 12–16%");
  });

  it("uses custom sticker themes for counts, titles, and exact headers", () => {
    const config = { ...defaultConfig(workflowMap.stickers), themes: "考研日常\n旅行手账\n咖啡时间" };
    const jobs = buildStaticJobs("stickers", config);
    expect(estimateCount("stickers", config)).toBe(3);
    expect(jobs.map((item) => item.title)).toEqual(["考研日常 · 贴纸页", "旅行手账 · 贴纸页", "咖啡时间 · 贴纸页"]);
    expect(jobs[0].prompt).toContain("THEME AND HEADER TITLE EXACTLY:\n考研日常");
    expect(jobs[0].prompt).not.toContain("Life · 贴纸页");
  });

  it("defaults every standard route to the accepted anchor style", () => {
    const routes = ["photo", "stickers", "folders", "letter", "polaroid", "avatars"] as const;
    for (const route of routes) {
      const styleField = workflowMap[route].fields.find((field) => field.key === "style");
      expect(styleField?.defaultValue).toBe("anchor");
      expect(styleField?.options?.map((option) => option.value)).toEqual(["anchor", "mengli"]);
      const sourceCount = route === "photo" ? 1 : 0;
      const jobs = buildStaticJobs(route, defaultConfig(workflowMap[route]), sourceCount);
      expect(jobs.length).toBeGreaterThan(0);
      expect(jobs.every((item) => item.prompt.includes("Image 1 is always the user's accepted personal-IP anchor"))).toBe(true);
      expect(jobs.every((item) => item.prompt.includes("MANDATORY OUTPUT STYLE — ANCHOR ORIGINAL STYLE"))).toBe(true);
    }
  });

  it("keeps Mengli available as a temporary override on every standard route", () => {
    for (const route of ["article", "infographic", "photo", "stickers", "folders", "letter", "polaroid", "avatars"] as const) {
      const styleField = workflowMap[route].fields.find((field) => field.key === "style");
      expect(styleField?.options?.some((option) => option.value === "mengli")).toBe(true);
    }
    const sticker = buildStaticJobs("stickers", { ...defaultConfig(workflowMap.stickers), style: "mengli" })[0];
    expect(sticker.prompt).toContain("MANDATORY HOUSE STYLE — MENGLI ONLY");
  });

  it("offers and applies all three styles in both expression workflows", () => {
    for (const route of ["expressions", "possession"] as const) {
      const styleField = workflowMap[route].fields.find((field) => field.key === "style");
      expect(styleField?.defaultValue).toBe("anchor");
      expect(styleField?.options?.map((option) => option.value)).toEqual(["anchor", "mengli", "meme"]);

      const sourceCount = route === "possession" ? 1 : 0;
      const base = defaultConfig(workflowMap[route]);
      const meme = buildStaticJobs(route, { ...base, style: "meme" }, sourceCount)[0].prompt;
      const anchor = buildStaticJobs(route, { ...base, style: "anchor" }, sourceCount)[0].prompt;
      const mengli = buildStaticJobs(route, { ...base, style: "mengli" }, sourceCount)[0].prompt;

      expect(meme).toContain("NATIVE MEME / REACTION STYLE");
      expect(meme).not.toContain("MENGLI ONLY");
      expect(anchor).toContain("ANCHOR ORIGINAL STYLE");
      expect(anchor).not.toContain("MENGLI ONLY");
      expect(mengli).toContain("MENGLI ONLY");
      expect([meme, anchor, mengli].every((prompt) => prompt.includes("only identity source"))).toBe(true);
    }
  });

  it("creates one reconstruction per supplied meme", () => {
    const config = { ...defaultConfig(workflowMap.possession), style: "meme" };
    const jobs = buildStaticJobs("possession", config, 4);
    expect(jobs).toHaveLength(4);
    expect(jobs.map((item) => item.sourceIndex)).toEqual([0, 1, 2, 3]);
    expect(jobs[0].prompt).toContain("complete head-and-body identity");
    expect(jobs[0].prompt).toContain("NATIVE MEME / REACTION STYLE");
    expect(jobs[0].prompt).toContain("Image 2's own rendering medium");
  });

  it("keeps route-specific Skill geometry in the generated prompts", () => {
    const folder = buildStaticJobs("folders", defaultConfig(workflowMap.folders))[0];
    const letter = buildStaticJobs("letter", defaultConfig(workflowMap.letter))[0];
    const polaroid = buildStaticJobs("polaroid", defaultConfig(workflowMap.polaroid))[0];
    expect(folder.prompt).toContain("width:height 1.28–1.45");
    expect(folder.prompt).toContain("outline-free");
    expect(letter.prompt).toContain("58–70%");
    expect(letter.prompt).toContain("9–12 light");
    expect(polaroid.prompt).toContain("58–68%");
    expect(polaroid.background).toBe("transparent");
  });

  it("keeps route counts and list parsing deterministic", () => {
    const config = defaultConfig(workflowMap.folders);
    expect(estimateCount("folders", config)).toBe(4);
    expect(parseList("甲、乙\n丙，丁", [])).toEqual(["甲", "乙", "丙", "丁"]);
  });

  it("uses compact micro-scenes for only part of an expression pack", () => {
    const config = defaultConfig(workflowMap.expressions);
    const jobs = buildStaticJobs("expressions", config);
    const scenes = jobs.filter((item) => item.prompt.includes("compact irregular micro-scene"));
    expect(jobs).toHaveLength(12);
    expect(scenes.length).toBeGreaterThanOrEqual(4);
    expect(scenes.length).toBeLessThanOrEqual(6);
  });
});
