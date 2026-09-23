import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import security from "./security-policy.json";
import { assertImageModel, beginTokenDanceAuthorization, completeTokenDanceAuthorization, defaultCustomConnection, defaultOpenAiConnection, defaultTokenDanceConnection, getPlanningApiKey, inspectImageModel, IP_STUDIO_APP_URL, normalizeApiBaseUrl, ProviderApiError, validateAiConnection, validateConnectionFields } from "./ai-provider";
import { browserApiError, generateBrowserImage, generateBrowserImageResult, generateBrowserStarterAnchor, planBrowserJobs } from "./browser-openai";
import { planLocalArticle } from "./local-planner";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4oQAAAAASUVORK5CYII=";
const imageOnly = () => ({ ...defaultCustomConnection(), apiKey: "image-secret", imageBaseUrl: "https://images.example/v1", imageModel: "custom-image" });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("production connectivity regression", () => {
  it("allows TokenDance and arbitrary HTTPS API connections without relaxing script sources", () => {
    const directives = Object.fromEntries(security.csp.split(";").map((part) => { const [name, ...values] = part.trim().split(/\s+/); return [name, values]; }));
    expect(directives["connect-src"]).toContain("https:");
    expect(directives["script-src"]).not.toContain("https:");
    expect(directives["object-src"]).toEqual(["'none'"]);
    expect(readFileSync("app/layout.tsx", "utf8")).toContain("security.csp");
    expect(readFileSync("scripts/build-standalone.mjs", "utf8")).toContain("security.csp");
  });

  it("publishes the Watcha review badge above the API selector", () => {
    const shell = readFileSync("components/StudioShell.tsx", "utf8");
    expect(shell.indexOf("watcha-review-badge")).toBeLessThan(shell.indexOf("api-mini"));
    expect(shell).toContain("https://watcha.cn/products/ip-studio?utm_source=product-badge&utm_content=invite");
    expect(shell).toContain("https://tos.watcha.cn/public/images/invite-0-white.png");
    expect(security.csp).toContain("img-src 'self' data: blob: https://tos.watcha.cn");
  });

  it("saves image-only credentials without requesting a text or model-list endpoint", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const saved = await validateAiConnection(imageOnly());
    expect(saved.baseUrl).toBe(saved.imageBaseUrl);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts pasted full image endpoints without appending the endpoint twice", () => {
    expect(normalizeApiBaseUrl("https://images.example/v1/images/edits/")).toBe("https://images.example/v1");
  });

  it("blocks text models in image fields and mismatched model protocols", () => {
    expect(() => assertImageModel("deepseek-chat")).toThrow(/不能用于生图/);
    expect(() => assertImageModel("gpt-4o")).toThrow(/不能用于生图/);
    expect(() => assertImageModel("alias", { id: "alias", supported_protocols: ["openai:chat-completions"] }, "openai-edits")).toThrow(/不支持/);
    expect(() => assertImageModel("seedream-5.0-lite", { id: "seedream-5.0-lite", supported_protocols: ["ark:image-generations"] }, "ark-generations")).not.toThrow();
  });

  it("does not reuse an image key at another provider's planner", () => {
    const separate = { ...imageOnly(), planningMode: "api" as const, baseUrl: "https://text.example/v1", planningModel: "deepseek-chat" };
    expect(() => validateConnectionFields(separate)).toThrow(/单独填写/);
    expect(getPlanningApiKey({ ...separate, planningApiKey: "text-secret" })).toBe("text-secret");
  });

  it("does not block custom image gateways that lack /models", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 404)));
    expect(await inspectImageModel(imageOnly())).toContain("没有模型列表");
  });

  it("uses local source grouping with no text API request", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const jobs = await planBrowserJobs({ connection: imageOnly(), workflow: "article", article: "今天在咖啡店写作。下午整理新的文件。晚上读一本好书。", config: { count: 2 } });
    expect(jobs).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(jobs[0].prompt).toContain("今天在咖啡店写作");
    expect(jobs[0].title).not.toContain("Life");
  });

  it("groups source content without dropping paragraphs", () => {
    const jobs = planLocalArticle("infographic", "第一段。第二段。第三段。第四段。", { pages: 2 });
    expect(jobs.map((job) => job.prompt).join("")).toContain("第四段");
    expect(jobs.every((job) => job.size === "1024x1536")).toBe(true);
  });

  it("uses independent text credentials for actual planning", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ choices: [{ message: { content: JSON.stringify({ jobs: [{ title: "咖啡店", prompt: "An IP reading.", size: "1024x1024", background: "opaque" }] }) } }] }));
    vi.stubGlobal("fetch", fetchMock);
    await planBrowserJobs({ connection: { ...imageOnly(), planningMode: "api", planningApiKey: "text-secret", planningModel: "deepseek-chat", baseUrl: "https://text.example/v1" }, workflow: "article", article: "一篇关于读书的文章", config: { count: 1 } });
    expect(fetchMock.mock.calls[0][0]).toBe("https://text.example/v1/chat/completions");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer text-secret");
  });

  it("attributes TokenDance text planning requests to the exact IP Studio App URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ choices: [{ message: { content: JSON.stringify({ jobs: [{ title: "咖啡店", prompt: "An IP reading.", size: "1024x1024", background: "opaque" }] }) } }] }));
    vi.stubGlobal("fetch", fetchMock);
    await planBrowserJobs({ connection: defaultTokenDanceConnection("td-test-key"), workflow: "article", article: "一篇关于读书与咖啡的文章，内容足够生成一个清晰画面。", config: { count: 1 } });
    expect(fetchMock.mock.calls[0][1].headers["X-App-URL"]).toBe(IP_STUDIO_APP_URL);
  });

  it("sends the anchor as first reference and decodes the returned TokenDance image", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ data: [{ b64_json: png }] }));
    vi.stubGlobal("fetch", fetchMock);
    const blob = new Blob([Buffer.from(png, "base64")], { type: "image/png" });
    const result = await generateBrowserImage({ connection: defaultTokenDanceConnection("td-test-key"), anchor: { id: "primary", name: "anchor.png", blob, updatedAt: 1 }, source: new File([blob], "source.png", { type: "image/png" }), quality: "low", job: { id: "test", title: "测试", prompt: "Use image 1 as anchor", size: "1024x1024", background: "opaque" } });
    expect(fetchMock.mock.calls[0][0]).toBe("https://tokendance.space/gateway/ark/v3/images/generations");
    expect(fetchMock.mock.calls[0][1].headers["X-App-URL"]).toBe(IP_STUDIO_APP_URL);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.image).toHaveLength(2);
    expect(body.image[0]).toBe(`data:image/png;base64,${png}`);
    expect(result.type).toBe("image/png");
  });

  it("attributes TokenDance OpenAI-compatible image edit requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ data: [{ b64_json: png }] }));
    vi.stubGlobal("fetch", fetchMock);
    const blob = new Blob([Buffer.from(png, "base64")], { type: "image/png" });
    const connection = {
      ...defaultTokenDanceConnection("td-test-key"),
      imageBaseUrl: "https://tokendance.space/gateway/v1",
      imageModel: "gpt-image-2",
      imageProtocol: "openai-edits" as const,
    };
    await generateBrowserImage({ connection, anchor: { id: "primary", name: "anchor.png", blob, updatedAt: 1 }, quality: "low", job: { id: "openai-edit", title: "测试", prompt: "Keep image 1 identity", size: "1024x1024", background: "opaque" } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://tokendance.space/gateway/v1/images/edits");
    expect(init.headers["X-App-URL"]).toBe(IP_STUDIO_APP_URL);
  });

  it("creates a first anchor through TokenDance text-to-image without a fake reference image", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ data: [{ b64_json: png }] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateBrowserStarterAnchor({ connection: defaultTokenDanceConnection("td-test-key"), brief: "蓝色短发，黑色上衣，黄色鞋子，手里拿着笔记本", styleId: "mengli" });
    const [url, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(url).toBe("https://tokendance.space/gateway/ark/v3/images/generations");
    expect(init.headers["X-App-URL"]).toBe(IP_STUDIO_APP_URL);
    expect(body.image).toBeUndefined();
    expect(body.prompt).toContain("There is no identity reference image yet");
    expect(result.type).toBe("image/png");
  });

  it("includes a starter reference in TokenDance image-to-image generation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ data: [{ b64_json: png }] }));
    vi.stubGlobal("fetch", fetchMock);
    const blob = new Blob([Buffer.from(png, "base64")], { type: "image/png" });
    const reference = new File([blob], "reference.png", { type: "image/png" });
    await generateBrowserStarterAnchor({ connection: defaultTokenDanceConnection("td-test-key"), brief: "参考蓝色短发和圆眼睛，穿黑色宽松上衣", styleId: "mengli", reference });
    const [url, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(url).toBe("https://tokendance.space/gateway/ark/v3/images/generations");
    expect(body.image).toBe(`data:image/png;base64,${png}`);
    expect(body.prompt).toContain("Image 1 is the user's visual identity reference");
  });

  it("creates a first anchor through the OpenAI image generations endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ data: [{ b64_json: png }] }));
    vi.stubGlobal("fetch", fetchMock);
    await generateBrowserStarterAnchor({ connection: defaultOpenAiConnection("sk-test-key"), brief: "绿色卷发，圆眼睛，白色连衣裙，戴一枚叶片吊坠", styleId: "flat", quality: "high" });
    const [url, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(url).toBe("https://api.openai.com/v1/images/generations");
    expect(body.model).toBe("gpt-image-2");
    expect(body.quality).toBe("high");
    expect(body.background).toBe("opaque");
  });

  it("uses the image edits endpoint when a starter reference is supplied", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ data: [{ b64_json: png }] }));
    vi.stubGlobal("fetch", fetchMock);
    const blob = new Blob([Buffer.from(png, "base64")], { type: "image/png" });
    const reference = new File([blob], "reference.png", { type: "image/png" });
    await generateBrowserStarterAnchor({ connection: defaultOpenAiConnection("sk-test-key"), brief: "保留参考图中的蓝色短发和圆眼睛，改成黑色卫衣", styleId: "mengli", reference });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/images/edits");
    expect(init.body instanceof FormData).toBe(true);
    expect(init.body.getAll("image[]")).toHaveLength(1);
    expect(init.body.get("prompt")).toContain("Image 1 is the user's visual identity reference");
  });

  it("returns provider-reported image token usage without inventing missing values", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ data: [{ b64_json: png }], usage: { output_tokens: 1756, total_tokens: 2850, generated_images: 1 } }));
    vi.stubGlobal("fetch", fetchMock);
    const blob = new Blob([Buffer.from(png, "base64")], { type: "image/png" });
    const result = await generateBrowserImageResult({ connection: defaultTokenDanceConnection("td-test-key"), anchor: { id: "primary", name: "anchor.png", blob, updatedAt: 1 }, quality: "low", job: { id: "usage-test", title: "用量测试", prompt: "Keep image 1 identity", size: "1024x1024", background: "opaque" } });
    expect(result.blob.type).toBe("image/png");
    expect(result.usage).toEqual({ inputTokens: undefined, outputTokens: 1756, totalTokens: 2850, generatedImages: 1 });
  });

  it("sends a custom image-only request as multipart edits, without text requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ data: [{ b64_json: png }] }));
    vi.stubGlobal("fetch", fetchMock);
    const blob = new Blob([Buffer.from(png, "base64")], { type: "image/png" });
    const connection = validateConnectionFields(imageOnly());
    await generateBrowserImage({ connection, anchor: { id: "primary", name: "anchor.png", blob, updatedAt: 1 }, quality: "medium", job: { id: "test", title: "测试", prompt: "Keep identity", size: "1024x1024", background: "opaque" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://images.example/v1/images/edits");
    expect(init.body instanceof FormData).toBe(true);
    expect(init.body.get("model")).toBe("custom-image");
    expect(init.body.getAll("image[]").length).toBe(1);
    expect(init.body.has("quality")).toBe(false);
    expect(init.headers["X-App-URL"]).toBeUndefined();
  });

  it("completes same-tab PKCE and removes the authorization code from the URL", async () => {
    const values = new Map<string, string>();
    const location = { href: "https://ipstudio.fun/", origin: "https://ipstudio.fun", assign: vi.fn() };
    const replaceState = vi.fn();
    vi.stubGlobal("window", { location, history: { replaceState }, sessionStorage: { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } });
    await beginTokenDanceAuthorization({ planningMode: "local" });
    const auth = new URL(location.assign.mock.calls[0][0]);
    expect(auth.searchParams.get("app_url")).toBe("https://ipstudio.fun/");
    expect(auth.searchParams.get("key_name")).toBe("IP Studio");
    const callback = new URL(auth.searchParams.get("callback_url")!);
    callback.searchParams.set("code", "one-time-test-code"); location.href = callback.toString();
    const fetchMock = vi.fn().mockResolvedValue(json({ key: "td-issued-key" })); vi.stubGlobal("fetch", fetchMock);
    const connection = await completeTokenDanceAuthorization();
    expect(connection.planningMode).toBe("local");
    expect(connection.apiKey).toBe("td-issued-key");
    expect(replaceState.mock.calls[0][2]).not.toContain("code=");
    const exchange = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(exchange.code_verifier.length).toBeGreaterThanOrEqual(43);
    expect(exchange.code_challenge_method).toBe("S256");
  });

  it("prioritizes TokenDance recovery actions over generic HTTP status messages", () => {
    expect(browserApiError(new ProviderApiError("Unauthorized", 401, "reauthorize_api_key"))).toContain("重新授权");
    expect(browserApiError(new ProviderApiError("Insufficient", 402, "top_up_balance"))).toContain("充值");
    expect(browserApiError(new ProviderApiError("Quota", 429, "api_key_quota"))).toContain("额度上限");
  });
});
