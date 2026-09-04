import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultCustomConnection,
  defaultOpenAiConnection,
  forgetAiConnection,
  microYuanToYuan,
  getTokenDancePaymentStatus,
  normalizeApiBaseUrl,
  rememberAiConnection,
  restoreAiConnection,
  validateConnectionFields,
} from "./ai-provider";

function installSessionStorage(initial?: Record<string, string>) {
  const values = new Map<string, string>(Object.entries(initial || {}));
  const sessionStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  vi.stubGlobal("window", { sessionStorage });
  return values;
}

describe("AI provider connection", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the complete provider configuration for eight hours", () => {
    installSessionStorage();
    const connection = defaultOpenAiConnection("sk-test-key");
    rememberAiConnection(connection, 1_000);
    expect(restoreAiConnection(1_000 + 7 * 60 * 60 * 1_000)).toEqual(connection);
    expect(restoreAiConnection(1_000 + 8 * 60 * 60 * 1_000)).toBeUndefined();
  });

  it("migrates the previous OpenAI-only tab session", () => {
    installSessionStorage({
      "ip-studio-api-key-session": JSON.stringify({ apiKey: "sk-legacy-key", expiresAt: 9_000 }),
    });
    expect(restoreAiConnection(1_000)).toMatchObject({ provider: "openai", apiKey: "sk-legacy-key" });
  });

  it("forgets the active provider immediately", () => {
    installSessionStorage();
    rememberAiConnection(defaultOpenAiConnection("sk-test-key"), 1_000);
    forgetAiConnection();
    expect(restoreAiConnection(1_001)).toBeUndefined();
  });

  it("only accepts encrypted remote custom endpoints", () => {
    expect(normalizeApiBaseUrl("https://api.example.com/v1/")).toBe("https://api.example.com/v1");
    expect(normalizeApiBaseUrl("http://localhost:4000/v1")).toBe("http://localhost:4000/v1");
    expect(() => normalizeApiBaseUrl("http://api.example.com/v1")).toThrow(/HTTPS/);
  });

  it("requires both custom model identifiers", () => {
    const connection = { ...defaultCustomConnection(), apiKey: "custom-key", baseUrl: "https://api.example.com/v1", imageBaseUrl: "https://api.example.com/v1" };
    expect(() => validateConnectionFields(connection)).toThrow(/规划模型/);
  });

  it("converts TokenDance micro-yuan values", () => {
    expect(microYuanToYuan(12_500_000)).toBe(12.5);
  });

  it("never sends a TokenDance key to an untrusted payment status URL", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(getTokenDancePaymentStatus(defaultOpenAiConnection("sk-test-key"), "https://evil.example/status")).rejects.toThrow(/停止发送/);
    expect(fetch).not.toHaveBeenCalled();
  });
});
