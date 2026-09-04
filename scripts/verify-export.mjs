import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const security = JSON.parse(await readFile("lib/security-policy.json", "utf8"));
for (const file of process.argv.slice(2).length ? process.argv.slice(2) : ["out/index.html"]) {
  const html = await readFile(file, "utf8");
  const metas = html.match(/<meta\s[^>]*http-equiv="Content-Security-Policy"[^>]*>/gi) || [];
  assert.equal(metas.length, 1, `${file}: expected exactly one CSP meta`);
  const content = metas[0].match(/content="([^"]*)"/)[1].replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  assert.equal(content, security.csp, `${file}: CSP differs from shared policy`);
  assert.match(content, /connect-src 'self' https:/);
  assert.match(content, /script-src 'self' 'unsafe-inline';/);
  console.log(`${file}: production CSP verified (HTTPS APIs allowed; script restrictions unchanged)`);
}
