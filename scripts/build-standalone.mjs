import { build } from "esbuild";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const publicRoot = path.join(projectRoot, "public");
const outputRoot = path.join(projectRoot, "standalone");

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(filePath) : [filePath];
  }));
  return nested.flat();
}

function mimeType(filePath) {
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".png")) return "image/png";
  if (/\.jpe?g$/i.test(filePath)) return "image/jpeg";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

const result = await build({
  entryPoints: [path.join(projectRoot, "standalone-entry.tsx")],
  outdir: path.join(projectRoot, ".standalone-build"),
  bundle: true,
  write: false,
  minify: true,
  platform: "browser",
  target: ["es2020"],
  format: "iife",
  jsx: "automatic",
  tsconfig: path.join(projectRoot, "tsconfig.json"),
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  loader: { ".woff": "dataurl", ".woff2": "dataurl" },
});

const jsOutput = result.outputFiles.find((file) => file.path.endsWith(".js"));
const cssOutput = result.outputFiles.find((file) => file.path.endsWith(".css"));
if (!jsOutput || !cssOutput) throw new Error("Standalone bundle is incomplete");

let script = jsOutput.text;
const publicFiles = await listFiles(publicRoot);
let favicon = "";
for (const filePath of publicFiles) {
  const relative = path.relative(publicRoot, filePath).split(path.sep).join("/");
  const dataUrl = `data:${mimeType(filePath)};base64,${(await readFile(filePath)).toString("base64")}`;
  script = script.replaceAll(JSON.stringify(`/${relative}`), JSON.stringify(dataUrl));
  if (relative === "credits/everettfish.webp") favicon = dataUrl;
}

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="上传一次角色锚点，用短问卷一键生成文章配图、信息图、贴纸、头像与更多个人 IP 素材。" />
  <meta name="referrer" content="no-referrer" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://api.openai.com; object-src 'none'; base-uri 'self'; form-action 'self'; worker-src 'self' blob:" />
  <link rel="icon" href="${favicon}" />
  <title>IP Studio｜一个角色，长出整个内容世界</title>
  <style>${cssOutput.text}</style>
</head>
<body><div id="root"></div><script>${script}</script></body>
</html>`;

await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, "index.html"), html, "utf8");
console.log(`Standalone site: ${Buffer.byteLength(html)} bytes`);
