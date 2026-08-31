export const MENGLI_STYLE =
  "mini pen-doodle illustration, hesitant wobbly black pen contours with clearly visible irregular breaks, awkward hand-drawn shapes, internally clean flat color shapes deliberately slightly misregistered from selected outlines with tiny white slivers or small edge overhangs, normal clear saturation, limited color count, childlike messy-cute charm; broken but not uniformly dashed, misregistered but still legible";

export type GenerationStyleMode = "meme" | "anchor" | "mengli";

export const MANDATORY_IDENTITY_POLICY = `MANDATORY REFERENCE AND IDENTITY POLICY — HIGHEST PRIORITY:
- Image 1 is always the user's accepted personal-IP anchor, the only identity source, and the primary visual reference.
- Inspect Image 1 before rendering. Internally lock its exact hair or fur outer silhouette, crown, part, bangs, side locks and back length; face and eye geometry and colors; skin or body color; body proportions and species anatomy; outfit, shoes, accessories, and signature palette.
- Repeat that complete identity unchanged in every appearance, including tiny figures, heads, crops, themed outfits, photo composites, stickers, and meme reconstructions.
- Image 2 and all later images control only route content, scene, edit target, pose, crop, layout, true separable garments, props, background, effects, and text. They must never override Image 1 identity or contribute another character's anatomy.
- If any later instruction conflicts with this identity policy, follow Image 1 and this policy.`;

const STYLE_POLICIES: Record<GenerationStyleMode, string> = {
  meme: `MANDATORY OUTPUT STYLE — NATIVE MEME / REACTION STYLE:
- When Image 2 is a meme reference, rebuild every visible element in Image 2's own rendering medium: line weight, shape simplification, palette, shading logic, texture, background treatment, effects, border, and typography treatment. Image 2 controls style and geometry, never identity.
- When there is no Image 2, use a coherent native chat-reaction / sticker-meme illustration language: bold readable silhouette, simplified compact shapes, punchy facial acting, clean high-contrast rendering, and instant thumbnail readability.
- Keep one coherent medium across the character, clothing, props, background, effects, border, and text. Do not force Mengli mark-making, preserve the anchor's original medium, or mix styles.`,
  anchor: `MANDATORY OUTPUT STYLE — ANCHOR ORIGINAL STYLE:
- Image 1 controls both identity and rendering medium. Preserve its original line quality, shape language, color handling, shading, texture, dimensionality, and degree of simplification.
- When Image 2 exists, preserve Image 2's composition, pose, crop, expression, true garments, props, background structure, effects, borders, and text, but translate every visible element into Image 1's original rendering medium.
- Keep one coherent medium across the complete result. Do not force Mengli mark-making, copy another character's identity, or leave Image 2 in a conflicting medium.`,
  mengli: `MANDATORY HOUSE STYLE — MENGLI ONLY:
${MENGLI_STYLE}.
Convert the anchor's mark-making into this Mengli house style while preserving identity exactly. Do not preserve or switch to the anchor's original rendering medium. Do not use source-meme style, 3D, pixel art, glossy anime, vector-perfect rendering, watercolor, crayon, oil pastel, or mixed media.`,
};

export function normalizeGenerationStyle(value: unknown): GenerationStyleMode {
  return value === "meme" || value === "anchor" || value === "mengli" ? value : "meme";
}

export function generationPolicy(style: GenerationStyleMode = "mengli"): string {
  return `${MANDATORY_IDENTITY_POLICY}\n\n${STYLE_POLICIES[style]}`;
}

export const MANDATORY_GENERATION_POLICY = generationPolicy("mengli");

export function composeGenerationPrompt(
  routePrompt: string,
  style: GenerationStyleMode = "mengli",
): string {
  return `${generationPolicy(style)}\n\nROUTE REQUEST:\n${routePrompt.trim()}`;
}

export function getOrderedReferenceFiles(form: FormData): {
  anchor?: File;
  sources: File[];
  all: File[];
} {
  const anchorValue = form.get("anchor");
  const anchor = anchorValue instanceof File && anchorValue.size > 0 ? anchorValue : undefined;
  const sources = form
    .getAll("sources")
    .filter((value): value is File => value instanceof File && value.size > 0);
  return { anchor, sources, all: anchor ? [anchor, ...sources] : sources };
}
