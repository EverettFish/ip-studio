import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetApiKey, rememberApiKey, restoreApiKey } from "./browser-openai";

function installSessionStorage() {
  const values = new Map<string, string>();
  const sessionStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  vi.stubGlobal("window", { sessionStorage });
}

describe("browser API key session", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("restores a key during the eight-hour tab session", () => {
    installSessionStorage();
    rememberApiKey("sk-test", 1_000);
    expect(restoreApiKey(1_000 + 7 * 60 * 60 * 1_000)).toBe("sk-test");
  });

  it("expires and removes a key after eight hours", () => {
    installSessionStorage();
    rememberApiKey("sk-test", 1_000);
    expect(restoreApiKey(1_000 + 8 * 60 * 60 * 1_000)).toBe("");
  });

  it("forgets a connected key immediately", () => {
    installSessionStorage();
    rememberApiKey("sk-test", 1_000);
    forgetApiKey();
    expect(restoreApiKey(1_001)).toBe("");
  });
});
