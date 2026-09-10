import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultCustomConnection,
  defaultOpenAiConnection,
  defaultTokenDanceConnection,
  forgetAiConnection,
  microYuanToYuan,
  getTokenDancePaymentStatus,
  imageModelOptions,
  isPaymentExpired,
  IP_STUDIO_APP_URL,
  normalizeApiBaseUrl,
  paymentTimestampMs,
  rememberAiConnection,
  restoreAiConnection,
  tokenDanceAttributionHeaders,
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

  it("requires an image model but not a text model for image-only APIs", () => {
    const connection = { ...defaultCustomConnection(), apiKey: "custom-key", baseUrl: "https://api.example.com/v1", imageBaseUrl: "https://api.example.com/v1" };
    expect(() => validateConnectionFields(connection)).toThrow(/生图模型/);
    expect(validateConnectionFields({ ...connection, imageModel: "my-image-model" }).planningMode).toBe("local");
  });

  it("converts TokenDance micro-yuan values", () => {
    expect(microYuanToYuan(12_500_000)).toBe(12.5);
  });

  it("treats TokenDance payment timestamps as Unix seconds instead of 1970 milliseconds", () => {
    const session = { id: "pay-1", amount: 50, status: "pending" as const, paymentUrl: "https://example.test/pay", statusUrl: "/payment/pay-1", expiredAt: 1_786_500_000, createdAt: 1_786_499_000 };
    expect(paymentTimestampMs(session.expiredAt)).toBe(1_786_500_000_000);
    expect(isPaymentExpired(session, 1_786_499_999_999)).toBe(false);
    expect(isPaymentExpired(session, 1_786_500_000_000)).toBe(true);
  });

  it("offers only image-capable TokenDance run models without replacing a custom model", () => {
    expect(imageModelOptions({ ...defaultOpenAiConnection("key"), provider: "tokendance", imageModel: "seedream-5.0-lite" })).toEqual(["seedream-5.0-lite", "seedream-5.0-pro"]);
    expect(imageModelOptions({ ...defaultOpenAiConnection("key"), provider: "custom", imageModel: "my-image-model" })).toEqual(["my-image-model"]);
  });

  it("uses the exact stable App URL only for TokenDance model gateway requests", () => {
    const connection = defaultTokenDanceConnection("td-test-key");
    expect(IP_STUDIO_APP_URL).toBe("https://ipstudio.fun/");
    expect(tokenDanceAttributionHeaders(connection, "https://tokendance.space/gateway/ark/v3/images/generations")).toEqual({ "X-App-URL": "https://ipstudio.fun/" });
    expect(tokenDanceAttributionHeaders(connection, "https://tokendance.space/portal/api/v1/user/balance")).toEqual({});
    expect(tokenDanceAttributionHeaders(connection, "https://tokendance.space.evil.example/gateway/v1/chat/completions")).toEqual({});
    expect(tokenDanceAttributionHeaders(defaultOpenAiConnection("sk-test-key"), "https://tokendance.space/gateway/v1/images/edits")).toEqual({});
  });

  it("never sends a TokenDance key to an untrusted payment status URL", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(getTokenDancePaymentStatus(defaultOpenAiConnection("sk-test-key"), "https://evil.example/status")).rejects.toThrow(/停止发送/);
    expect(fetch).not.toHaveBeenCalled();
  });
});
