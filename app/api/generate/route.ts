import OpenAI, { toFile } from "openai";
import { NextResponse } from "next/server";
import { getSessionApiKey } from "@/lib/session";
import { allowRequest, isTrustedOrigin, secretFingerprint } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALLOWED_SIZES = new Set(["auto", "1024x1024", "1536x1024", "1024x1536"]);

function hasValidImageSignature(bytes: Uint8Array, mime: string): boolean {
  if (mime === "image/png") return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (mime === "image/jpeg") return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/webp") return bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

function cleanError(error: unknown): string {
  if (!(error instanceof Error)) return "生成失败，请稍后重试。";
  if (error.message.includes("rate_limit")) return "当前生成速度超过账户限制，请稍后重试这一张。";
  if (error.message.includes("billing")) return "账户额度不足或尚未开启 API 计费。";
  if (error.message.includes("verification")) return "当前组织尚未完成图像模型所需的验证。";
  if ("status" in error && error.status === 401) return "API Key 会话已失效，请重新连接。";
  if ("status" in error && error.status === 400) return "模型没有接受这组图片或配置，请换图后重试。";
  return "生成服务暂时没有完成这一张，请稍后单独重试。";
}

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "拒绝跨站请求。" }, { status: 403 });
  }
  const apiKey = await getSessionApiKey();
  if (!apiKey) return NextResponse.json({ error: "请先连接 API Key。" }, { status: 401 });
  if (!allowRequest(`generate:${secretFingerprint(apiKey)}`, 30, 60_000)) {
    return NextResponse.json({ error: "这一分钟的任务太多了，请稍后继续。" }, { status: 429 });
  }

  try {
    const form = await request.formData();
    const prompt = String(form.get("prompt") || "").trim();
    const size = String(form.get("size") || "1024x1024");
    const qualityValue = String(form.get("quality") || "medium");
    const backgroundValue = String(form.get("background") || "auto");
    const quality = (["low", "medium", "high"].includes(qualityValue) ? qualityValue : "medium") as "low" | "medium" | "high";
    const background = (["auto", "opaque", "transparent"].includes(backgroundValue) ? backgroundValue : "auto") as "auto" | "opaque" | "transparent";
    const imageFiles = form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);

    if (!prompt || prompt.length > 32000) {
      return NextResponse.json({ error: "生成说明为空或过长。" }, { status: 400 });
    }
    if (!ALLOWED_SIZES.has(size)) return NextResponse.json({ error: "不支持这个图片尺寸。" }, { status: 400 });
    if (imageFiles.length > 10 || imageFiles.some((file) => file.size > MAX_FILE_BYTES)) {
      return NextResponse.json({ error: "参考图最多 10 张，每张不超过 20MB。" }, { status: 400 });
    }
    if (imageFiles.some((file) => !ALLOWED_IMAGE_TYPES.has(file.type))) {
      return NextResponse.json({ error: "参考图仅支持 PNG、JPG 和 WEBP。" }, { status: 400 });
    }

    const client = new OpenAI({ apiKey });
    let result;

    if (imageFiles.length) {
      const uploads = await Promise.all(imageFiles.map(async (file) => {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (!hasValidImageSignature(bytes, file.type)) throw new Error("INVALID_IMAGE_SIGNATURE");
        return toFile(Buffer.from(bytes), file.name || "reference.png", { type: file.type });
      }));
      result = await client.images.edit({
        model: "gpt-image-2",
        image: uploads,
        prompt,
        size: size as never,
        quality,
        background,
        output_format: "png",
      });
    } else {
      result = await client.images.generate({
        model: "gpt-image-2",
        prompt,
        size: size as never,
        quality,
        background,
        output_format: "png",
      });
    }

    const base64 = result.data?.[0]?.b64_json;
    if (!base64) throw new Error("模型没有返回可用图片，请重试这一张。");
    return NextResponse.json({ image: `data:image/png;base64,${base64}` });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_IMAGE_SIGNATURE") {
      return NextResponse.json({ error: "图片内容与文件类型不一致，请重新导出后上传。" }, { status: 400 });
    }
    return NextResponse.json({ error: cleanError(error) }, { status: 500 });
  }
}
