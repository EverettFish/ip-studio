const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function base64PngToBlob(base64: string): Blob {
  try {
    const binary = atob(base64.trim());
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    if (bytes.length < PNG_SIGNATURE.length || PNG_SIGNATURE.some((value, index) => bytes[index] !== value)) {
      throw new Error("invalid PNG signature");
    }
    return new Blob([bytes], { type: "image/png" });
  } catch {
    throw new Error("模型返回了无法解码的图片数据，请重试这一张。");
  }
}
