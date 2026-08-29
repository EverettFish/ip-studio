import OpenAI from "openai";
import { NextResponse } from "next/server";
import { KEY_COOKIE, encryptApiKey, getSessionApiKey } from "@/lib/session";
import { allowRequest, isTrustedOrigin, requestFingerprint } from "@/lib/security";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ connected: Boolean(await getSessionApiKey()) });
}

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "拒绝跨站请求。" }, { status: 403 });
  }
  if (!allowRequest(`session:${requestFingerprint(request)}`, 10, 60_000)) {
    return NextResponse.json({ error: "尝试次数过多，请一分钟后再试。" }, { status: 429 });
  }
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 4096) return NextResponse.json({ error: "请求内容过大。" }, { status: 413 });
    const body = (await request.json()) as { apiKey?: string };
    const apiKey = body.apiKey?.trim();
    if (!apiKey || apiKey.length < 20) {
      return NextResponse.json({ error: "请输入有效的 API Key。" }, { status: 400 });
    }

    const client = new OpenAI({ apiKey });
    await client.models.retrieve("gpt-image-2");

    const response = NextResponse.json({ connected: true });
    response.cookies.set(KEY_COOKIE, encryptApiKey(apiKey), {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "连接失败";
    return NextResponse.json(
      { error: message.includes("Incorrect API key") || message.includes("401") ? "API Key 无效，请检查后重试。" : "暂时无法验证这个 Key，请检查账户状态后重试。" },
      { status: 401 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "拒绝跨站请求。" }, { status: 403 });
  }
  const response = NextResponse.json({ connected: false });
  response.cookies.set(KEY_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
