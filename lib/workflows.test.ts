import { describe, expect, it } from "vitest";
import { buildStaticJobs, defaultConfig, estimateCount, parseList, workflowMap } from "./workflows";

describe("workflow defaults", () => {
  it("creates the prescribed three sticker sheets", () => {
    const config = defaultConfig(workflowMap.stickers);
    const jobs = buildStaticJobs("stickers", config);
    expect(jobs).toHaveLength(3);
    expect(jobs.every((item) => item.background === "transparent")).toBe(true);
    expect(jobs[0].prompt).toContain("only identity source");
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
