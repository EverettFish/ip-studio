"use client";

export type AiProviderId = "openai" | "tokendance" | "custom";
export type ImageApiProtocol = "openai-edits" | "ark-generations";
export type PlanningApiProtocol = "openai-responses" | "openai-chat-completions";

export type AiConnection = {
  provider: AiProviderId;
  label: string;
  apiKey: string;
  baseUrl: string;
  imageBaseUrl: string;
  planningModel: string;
  imageModel: string;
  planningProtocol: PlanningApiProtocol;
  imageProtocol: ImageApiProtocol;
  planningMode?: "local" | "api";
  planningApiKey?: string;
};

export type TokenDanceBalance = {
  credits: number;
  creditsUsed: number;
  balance: number;
};

export type TokenDancePaymentSession = {
  id: string;
  amount: number;
  status: "pending" | "paid" | "failed" | "closed" | "refunded";
  paymentUrl: string;
  alipayUrl?: string;
  statusUrl: string;
  expiredAt: string;
  createdAt: string;
};

type StoredConnection = { connection: AiConnection; expiresAt: number };
type PendingTokenDanceOAuth = {
  verifier: string;
  state: string;
  createdAt: number;
  planningModel: string;
  imageModel: string;
  code?: string;
  planningMode?: "local" | "api";
};

const CONNECTION_STORAGE = "ip-studio-ai-connection-v2";
const LEGACY_KEY_STORAGE = "ip-studio-api-key-session";
const TOKENDANCE_OAUTH_STORAGE = "ip-studio-tokendance-oauth";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const OAUTH_TTL_MS = 15 * 60 * 1000;

export const OPENAI_BASE_URL = "https://api.openai.com/v1";
export const TOKENDANCE_OPENAI_BASE_URL = "https://tokendance.space/gateway/v1";
export const TOKENDANCE_ARK_BASE_URL = "https://tokendance.space/gateway/ark/v3";
export const TOKENDANCE_PORTAL_BASE_URL = "https://tokendance.space/portal/api/v1";

export function defaultOpenAiConnection(apiKey = ""): AiConnection {
  return {
    provider: "openai",
    label: "OpenAI 官方",
    apiKey,
    baseUrl: OPENAI_BASE_URL,
    imageBaseUrl: OPENAI_BASE_URL,
    planningModel: "gpt-5.6-luna",
    imageModel: "gpt-image-2",
    planningProtocol: "openai-responses",
    imageProtocol: "openai-edits",
    planningMode: "api",
  };
}

export function defaultTokenDanceConnection(apiKey = "", planningModel = "seed-2.0-mini", imageModel = "seedream-5.0-lite"): AiConnection {
  return {
    provider: "tokendance",
    label: "观猹 TokenDance",
    apiKey,
    baseUrl: TOKENDANCE_OPENAI_BASE_URL,
    imageBaseUrl: TOKENDANCE_ARK_BASE_URL,
    planningModel,
    imageModel,
    planningProtocol: "openai-chat-completions",
    imageProtocol: "ark-generations",
    planningMode: "api",
  };
}

export function defaultCustomConnection(): AiConnection {
  return {
    provider: "custom",
    label: "自定义兼容 API",
    apiKey: "",
    baseUrl: "",
    imageBaseUrl: "",
    planningModel: "",
    imageModel: "",
    planningProtocol: "openai-chat-completions",
    imageProtocol: "openai-edits",
    planningMode: "local",
  };
}

export function rememberAiConnection(connection: AiConnection, now = Date.now()): void {
  if (typeof window === "undefined") return;
  const stored: StoredConnection = { connection, expiresAt: now + SESSION_TTL_MS };
  window.sessionStorage.setItem(CONNECTION_STORAGE, JSON.stringify(stored));
  window.sessionStorage.removeItem(LEGACY_KEY_STORAGE);
}

export function restoreAiConnection(now = Date.now()): AiConnection | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(CONNECTION_STORAGE) || "null") as StoredConnection | null;
    if (stored?.connection?.apiKey && stored.expiresAt > now) return stored.connection;
    window.sessionStorage.removeItem(CONNECTION_STORAGE);

    const legacy = JSON.parse(window.sessionStorage.getItem(LEGACY_KEY_STORAGE) || "null") as { apiKey?: string; expiresAt?: number } | null;
    if (legacy?.apiKey && Number(legacy.expiresAt) > now) {
      const migrated = defaultOpenAiConnection(legacy.apiKey);
      rememberAiConnection(migrated, now);
      return migrated;
    }
    window.sessionStorage.removeItem(LEGACY_KEY_STORAGE);
    return undefined;
  } catch {
    window.sessionStorage.removeItem(CONNECTION_STORAGE);
    window.sessionStorage.removeItem(LEGACY_KEY_STORAGE);
    return undefined;
  }
}

export function forgetAiConnection(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(CONNECTION_STORAGE);
  window.sessionStorage.removeItem(LEGACY_KEY_STORAGE);
}

export function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "").replace(/\/(?:images\/(?:edits|generations)|chat\/completions|responses|models)$/, "");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("接口地址格式不正确，请填写完整的 https:// 地址。");
  }
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
    throw new Error("为避免 Key 被截获，自定义接口必须使用 HTTPS；仅本机 localhost 可以使用 HTTP。");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("接口地址不能包含账号、密码、查询参数或锚点。");
  }
  return trimmed;
}

export function validateConnectionFields(connection: AiConnection): AiConnection {
  if (connection.apiKey.trim().length < 8) throw new Error("请填写有效的 API Key。");
  if (!connection.imageModel.trim()) throw new Error("请填写生图模型 ID，不是聊天模型名称。");
  assertImageModel(connection.imageModel);
  const imageBaseUrl = normalizeApiBaseUrl(connection.imageBaseUrl || connection.baseUrl);
  const apiPlanning = usesApiPlanning(connection);
  if (apiPlanning && !connection.planningModel.trim()) throw new Error("启用 AI 文章规划后，请填写文字模型 ID；只有生图 API 可改用本地分段。");
  const checked = {
    ...connection,
    apiKey: connection.apiKey.trim(),
    baseUrl: apiPlanning ? normalizeApiBaseUrl(connection.baseUrl) : imageBaseUrl,
    imageBaseUrl,
    planningModel: connection.planningModel.trim(),
    imageModel: connection.imageModel.trim(),
    planningApiKey: connection.planningApiKey?.trim(),
    label: connection.label.trim() || "自定义兼容 API",
  };
  if (apiPlanning) getPlanningApiKey(checked);
  return checked;
}

export function usesApiPlanning(connection: AiConnection): boolean {
  return connection.planningMode ? connection.planningMode === "api" : Boolean(connection.planningModel);
}

export function getPlanningApiKey(connection: AiConnection): string {
  if (connection.planningApiKey?.trim()) return connection.planningApiKey.trim();
  if (new URL(connection.baseUrl).origin !== new URL(connection.imageBaseUrl).origin) {
    throw new Error("文字规划使用了另一家服务，请单独填写文字 API Key；不会把生图 Key 自动发送给另一家。");
  }
  return connection.apiKey;
}

export type AvailableModel = { id: string; supported_protocols?: string[] };

export function assertImageModel(id: string, model?: AvailableModel, protocol?: ImageApiProtocol): void {
  const name = id.trim().toLowerCase().split("/").at(-1) || "";
  // Reject identifiable text models, but do not guess the capabilities of custom aliases.
  if (/^(?:deepseek-(?:chat|reasoner|v\d|r\d)|seed-\d|claude-|gpt-(?!image)[345]|o[134](?:-|$)|glm-\d|qwen\d(?!.*image))/.test(name)) {
    throw new Error(`「${id}」是文字/对话模型，不能用于生图。请填写支持参考图的生图模型 ID（例如 gpt-image-2 或 Seedream），文字模型请放在文章规划中。`);
  }
  if (model?.supported_protocols?.length && protocol) {
    const required = protocol === "ark-generations" ? "ark:image-generations" : "openai:image-edits";
    if (!model.supported_protocols.includes(required)) {
      throw new Error(`「${id}」的公开能力不支持当前参考图协议。请选择支持图生图/图片编辑的模型，或切换正确协议。`);
    }
  }
}

export async function inspectImageModel(connection: AiConnection): Promise<string> {
  const checked = validateConnectionFields(connection);
  const url = checked.provider === "tokendance" ? `${TOKENDANCE_OPENAI_BASE_URL}/models` : `${checked.imageBaseUrl}/models`;
  const response = await fetch(url, {
    headers: checked.provider === "tokendance" ? {} : { Authorization: `Bearer ${checked.apiKey}` },
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 404 || response.status === 405) return "服务商没有模型列表接口，可以保存配置；请用下方单张测试确认生图能力。";
  if (!response.ok) throw await readError(response);
  const body = await response.json() as { data?: AvailableModel[] };
  if (!Array.isArray(body.data)) return "未获得标准模型列表；保存后可测试生成 1 张。";
  const model = body.data.find((item) => item.id === checked.imageModel);
  if (!model) throw new Error(`模型列表中没有「${checked.imageModel}」。请复制服务商提供的精确生图模型 ID，注意大小写。`);
  assertImageModel(model.id, model, checked.imageProtocol);
  return model.supported_protocols?.length ? "模型列表与参考图协议匹配；尚未实际生成图片。" : "模型 ID 存在；服务商未提供能力信息，仍需单张测试确认图生图。";
}

export async function checkTokenDanceNetwork(): Promise<string> {
  const response = await fetch(`${TOKENDANCE_OPENAI_BASE_URL}/models`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw await readError(response);
  const body = await response.json() as { data?: AvailableModel[] };
  if (!Array.isArray(body.data)) throw new Error("TokenDance 返回的模型目录格式异常。");
  return "TokenDance 网络可达，可继续授权。授权需在当前标签页完成。";
}

export class ProviderApiError extends Error {
  status?: number;
  recoveryAction?: string;

  constructor(message: string, status?: number, recoveryAction?: string) {
    super(message);
    this.name = "ProviderApiError";
    this.status = status;
    this.recoveryAction = recoveryAction;
  }
}

async function readError(response: Response): Promise<ProviderApiError> {
  let message = `请求失败（${response.status}）`;
  try {
    const body = await response.json() as { error?: { message?: string } | string; message?: string };
    message = typeof body.error === "string" ? body.error : body.error?.message || body.message || message;
  } catch {
    // Keep the status-only message when the gateway does not return JSON.
  }
  return new ProviderApiError(message, response.status, response.headers.get("TokenDance-Recovery-Action") || undefined);
}

async function authorizedJson<T>(url: string, apiKey: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) throw await readError(response);
  return response.json() as Promise<T>;
}

export async function validateAiConnection(connection: AiConnection): Promise<AiConnection> {
  const checked = validateConnectionFields(connection);
  if (checked.provider === "tokendance") {
    await getTokenDanceBalance(checked);
    return checked;
  }
  // A dedicated image gateway is not required to implement /models or any text API.
  if (checked.provider === "custom") return checked;
  const response = await fetch(`${checked.imageBaseUrl}/models`, {
    headers: { Authorization: `Bearer ${checked.apiKey}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw await readError(response);
  return checked;
}

function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  let binary = "";
  new Uint8Array(digest).forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function beginTokenDanceAuthorization(options?: { planningModel?: string; imageModel?: string; planningMode?: "local" | "api" }): Promise<void> {
  if (typeof window === "undefined") return;
  if (!/^https?:$/.test(new URL(window.location.href).protocol)) throw new Error("OAuth 授权需要通过网站地址打开，请在 ipstudio.fun 使用；本地 HTML 文件可手动配置 Key。");
  const verifier = randomBase64Url(48);
  const state = randomBase64Url(24);
  const challenge = await sha256Base64Url(verifier);
  const pending: PendingTokenDanceOAuth = {
    verifier,
    state,
    createdAt: Date.now(),
    planningModel: options?.planningModel || "seed-2.0-mini",
    imageModel: options?.imageModel || "seedream-5.0-lite",
    planningMode: options?.planningMode || "api",
  };
  window.sessionStorage.setItem(TOKENDANCE_OAUTH_STORAGE, JSON.stringify(pending));

  const callback = new URL(window.location.href);
  callback.search = "";
  callback.hash = "";
  callback.searchParams.set("td_oauth", "1");
  callback.searchParams.set("td_state", state);

  const authorization = new URL("https://tokendance.space/auth");
  authorization.searchParams.set("callback_url", callback.toString());
  authorization.searchParams.set("code_challenge", challenge);
  authorization.searchParams.set("code_challenge_method", "S256");
  authorization.searchParams.set("app_url", window.location.origin);
  authorization.searchParams.set("key_name", "IP Studio 浏览器会话");
  window.location.assign(authorization.toString());
}

export function hasTokenDanceAuthorizationCallback(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  if (url.searchParams.get("td_oauth") === "1" && url.searchParams.has("code")) return true;
  try {
    const pending = JSON.parse(window.sessionStorage.getItem(TOKENDANCE_OAUTH_STORAGE) || "null") as PendingTokenDanceOAuth | null;
    return Boolean(pending?.code);
  } catch {
    return false;
  }
}

function cleanTokenDanceCallbackUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("td_oauth");
  url.searchParams.delete("td_state");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export async function completeTokenDanceAuthorization(): Promise<AiConnection> {
  if (typeof window === "undefined") throw new Error("只能在浏览器中完成 TokenDance 授权。");
  const url = new URL(window.location.href);
  let pending: PendingTokenDanceOAuth | null = null;
  try {
    pending = JSON.parse(window.sessionStorage.getItem(TOKENDANCE_OAUTH_STORAGE) || "null") as PendingTokenDanceOAuth | null;
  } catch {
    // Handled by the validation below.
  }
  if (!pending || Date.now() - pending.createdAt > OAUTH_TTL_MS) {
    window.sessionStorage.removeItem(TOKENDANCE_OAUTH_STORAGE);
    cleanTokenDanceCallbackUrl();
    throw new Error("TokenDance 授权已过期，请重新发起授权。");
  }

  const callbackCode = url.searchParams.get("code");
  const callbackState = url.searchParams.get("td_state");
  if (callbackCode) {
    if (callbackState !== pending.state) {
      window.sessionStorage.removeItem(TOKENDANCE_OAUTH_STORAGE);
      cleanTokenDanceCallbackUrl();
      throw new Error("TokenDance 授权状态不一致，已为你拦截，请重新授权。");
    }
    pending.code = callbackCode;
    window.sessionStorage.setItem(TOKENDANCE_OAUTH_STORAGE, JSON.stringify(pending));
    cleanTokenDanceCallbackUrl();
  }
  if (!pending.code) throw new Error("TokenDance 没有返回授权码，请重新授权。");

  const result = await fetch(`${TOKENDANCE_PORTAL_BASE_URL}/auth/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: pending.code,
      code_verifier: pending.verifier,
      code_challenge_method: "S256",
    }),
  });
  if (!result.ok) throw await readError(result);
  const body = await result.json() as { key?: string };
  if (!body.key) throw new Error("TokenDance 没有返回可用的 API Key，请重新授权。");
  window.sessionStorage.removeItem(TOKENDANCE_OAUTH_STORAGE);
  return { ...defaultTokenDanceConnection(body.key, pending.planningModel, pending.imageModel), planningMode: pending.planningMode || "api" };
}

export async function getTokenDanceBalance(connection: AiConnection): Promise<TokenDanceBalance> {
  const body = await authorizedJson<{ balance: { credits: number; credits_used: number; balance: number } }>(
    `${TOKENDANCE_PORTAL_BASE_URL}/user/balance`,
    connection.apiKey,
  );
  return {
    credits: body.balance.credits,
    creditsUsed: body.balance.credits_used,
    balance: body.balance.balance,
  };
}

export function microYuanToYuan(value: number): number {
  return value / 1_000_000;
}

export async function createTokenDancePayment(connection: AiConnection, amount: number): Promise<TokenDancePaymentSession> {
  if (!Number.isInteger(amount) || amount < 1 || amount > 100000) throw new Error("充值金额需为 1–100000 元的整数。");
  const body = await authorizedJson<{ session: {
    id: string;
    amount: number;
    status: TokenDancePaymentSession["status"];
    payment_url: string;
    alipay_url?: string;
    status_url: string;
    expired_at: string;
    created_at: string;
  } }>(`${TOKENDANCE_PORTAL_BASE_URL}/payment/sessions`, connection.apiKey, {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
  return {
    id: body.session.id,
    amount: body.session.amount,
    status: body.session.status,
    paymentUrl: body.session.payment_url,
    alipayUrl: body.session.alipay_url,
    statusUrl: body.session.status_url,
    expiredAt: body.session.expired_at,
    createdAt: body.session.created_at,
  };
}

export async function getTokenDancePaymentStatus(connection: AiConnection, statusUrl: string): Promise<TokenDancePaymentSession["status"]> {
  const resolved = new URL(statusUrl, `${TOKENDANCE_PORTAL_BASE_URL}/`);
  if (resolved.protocol !== "https:" || resolved.hostname !== "tokendance.space") {
    throw new Error("支付状态地址校验失败，已停止发送账户凭证。");
  }
  const body = await authorizedJson<{ session?: { status?: TokenDancePaymentSession["status"] }; status?: TokenDancePaymentSession["status"] }>(
    resolved.toString(),
    connection.apiKey,
  );
  return body.session?.status || body.status || "pending";
}
