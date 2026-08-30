import { describe, expect, it } from "vitest";
import { anchorStyleInstruction, buildStaticJobs, defaultConfig, estimateCount, parseList, workflowMap } from "./workflows";

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

  it("makes the selected anchor rendering mode explicit", () => {
    expect(anchorStyleInstruction("mengli")).toContain("CONVERT TO MENGLI");
    expect(anchorStyleInstruction("preserve")).toContain("PRESERVE ORIGINAL");
  });

  it("creates one reconstruction per supplied meme", () => {
    const config = defaultConfig(workflowMap.possession);
    const jobs = buildStaticJobs("possession", config, 4);
    expect(jobs).toHaveLength(4);
    expect(jobs.map((item) => item.sourceIndex)).toEqual([0, 1, 2, 3]);
    expect(jobs[0].prompt).toContain("complete head-and-body identity");
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
