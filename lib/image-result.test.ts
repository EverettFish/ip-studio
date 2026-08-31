import { describe, expect, it } from "vitest";
import { base64PngToBlob } from "./image-result";

const ONE_PIXEL_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("generated image decoding", () => {
  it("decodes b64_json directly into a PNG Blob", async () => {
    const blob = base64PngToBlob(ONE_PIXEL_PNG);
    const signature = Array.from(new Uint8Array(await blob.slice(0, 8).arrayBuffer()));
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBeGreaterThan(8);
    expect(signature).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it("rejects malformed b64_json before saving an artwork", () => {
    expect(() => base64PngToBlob("not-an-image")).toThrow("无法解码");
  });
});
