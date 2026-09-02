import type { AnchorStyleId } from "./types";
import { MENGLI_STYLE } from "./generation-policy";

export type AnchorStylePreset = {
  id: AnchorStyleId;
  label: string;
  shortLabel: string;
  description: string;
  preview?: string;
  requiresConversion: boolean;
  prompt: string;
};

export const ANCHOR_STYLE_PRESETS: AnchorStylePreset[] = [
  {
    id: "original",
    label: "直接使用原图",
    shortLabel: "原图画风",
    description: "身份和原来的绘制媒介都不改变。",
    requiresConversion: false,
    prompt: "Preserve the source image exactly; no style conversion.",
  },
  {
    id: "mengli",
    label: "萌粒画风",
    shortLabel: "萌粒画风",
    description: "断续手绘线条、轻微错位平涂，松弛可爱。",
    preview: "/art/anchor-styles/mengli.webp",
    requiresConversion: true,
    prompt: MENGLI_STYLE,
  },
  {
    id: "island-3d",
    label: "岛屿生活感 3D",
    shortLabel: "柔和 3D",
    description: "圆润微缩比例、哑光软陶材质和柔和棚拍光。",
    preview: "/art/anchor-styles/island-3d.webp",
    requiresConversion: true,
    prompt: "original cozy life-simulation-inspired 3D miniature character, rounded toy-like proportions, gently simplified facial geometry, matte clay and soft vinyl materials, soft diffuse studio lighting, subtle contact shadow, clean normal saturation; do not copy any existing game character, asset, interface, logo, or franchise-specific design",
  },
  {
    id: "flat",
    label: "现代扁平无描边",
    shortLabel: "扁平无描边",
    description: "清晰几何色块、无外轮廓、轻巧现代。",
    preview: "/art/anchor-styles/flat.webp",
    requiresConversion: true,
    prompt: "modern editorial flat illustration, absolutely no outlines or contour strokes, crisp simplified geometric color shapes, balanced asymmetry, clean solid fills, limited vivid palette, minimal shape layering, no gradients, no texture, no 3D, highly legible silhouette",
  },
];

export function getAnchorStylePreset(id?: AnchorStyleId): AnchorStylePreset {
  return ANCHOR_STYLE_PRESETS.find((preset) => preset.id === id) ?? ANCHOR_STYLE_PRESETS[0];
}

export function buildAnchorConversionPrompt(styleId: Exclude<AnchorStyleId, "original">): string {
  const preset = getAnchorStylePreset(styleId);
  return `Create one accepted personal-IP anchor by transforming Image 1 into the selected core style.

REFERENCE ROLE:
- Image 1 is the only identity source. It controls the subject and overrides every other consideration.
- There is no other identity or character reference.

IDENTITY LOCK:
- Inspect Image 1 first and preserve every visible identity trait: exact hair or fur outer silhouette, crown, part, bangs, side locks and back length; face and eye geometry and colors; skin or body color; species anatomy; body proportions; outfit, shoes, accessories, signature palette, expression, and visible pose.
- Change only the rendering medium. Do not beautify, age, gender-swap, redesign, simplify away, or invent identity traits.
- Ignore and remove source captions, QR codes, watermarks, decorative backgrounds, and unrelated objects unless physically part of the character.

SELECTED CORE STYLE:
${preset.prompt}

COMPOSITION:
- One character only, centered on a pure white 1:1 square canvas.
- Preserve the source framing and all visible anatomy. If the source already shows a full body, keep the full body with generous margins. Never invent hidden limbs, garments, or accessories from a cropped source.
- Keep the complete visible hair, ears, horns, hat, and silhouette uncropped.

No text, logo, watermark, scenery, extra character, borrowed identity, mixed rendering medium, or identity drift.`;
}
