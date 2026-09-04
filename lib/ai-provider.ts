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
  const trimmed = value.trim().replace(/\/+$/, "");
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
  if (!connection.planningModel.trim()) throw new Error("请填写规划模型 ID。");
  if (!connection.imageModel.trim()) throw new Error("请填写图片模型 ID。");
  return {
    ...connection,
    apiKey: connection.apiKey.trim(),
    baseUrl: normalizeApiBaseUrl(connection.baseUrl),
    imageBaseUrl: normalizeApiBaseUrl(connection.imageBaseUrl || connection.baseUrl),
    planningModel: connection.planningModel.trim(),
    imageModel: connection.imageModel.trim(),
    label: connection.label.trim() || "自定义兼容 API",
  };
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
  const response = await fetch(`${checked.baseUrl}/models`, {
    headers: { Authorization: `Bearer ${checked.apiKey}` },
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

export async function beginTokenDanceAuthorization(options?: { planningModel?: string; imageModel?: string }): Promise<void> {
  if (typeof window === "undefined") return;
  const verifier = randomBase64Url(48);
  const state = randomBase64Url(24);
  const challenge = await sha256Base64Url(verifier);
  const pending: PendingTokenDanceOAuth = {
    verifier,
    state,
    createdAt: Date.now(),
    planningModel: options?.planningModel || "seed-2.0-mini",
    imageModel: options?.imageModel || "seedream-5.0-lite",
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
  return defaultTokenDanceConnection(body.key, pending.planningModel, pending.imageModel);
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
