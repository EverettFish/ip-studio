import { describe, expect, it } from "vitest";
import { allowRequest, isTrustedOrigin } from "./security";

describe("request security", () => {
  it("rejects cross-site browser requests", () => {
    const request = new Request("https://studio.example/api/generate", {
      headers: { origin: "https://attacker.example", "sec-fetch-site": "cross-site" },
    });
    expect(isTrustedOrigin(request)).toBe(false);
  });

  it("accepts same-origin browser requests", () => {
    const request = new Request("https://studio.example/api/generate", {
      headers: { origin: "https://studio.example", "sec-fetch-site": "same-origin" },
    });
    expect(isTrustedOrigin(request)).toBe(true);
  });

  it("enforces a simple per-window request limit", () => {
    const key = `test-${Date.now()}`;
    expect(allowRequest(key, 2, 60_000)).toBe(true);
    expect(allowRequest(key, 2, 60_000)).toBe(true);
    expect(allowRequest(key, 2, 60_000)).toBe(false);
  });
});
