export const MENGLI_STYLE =
  "mini pen-doodle illustration, hesitant wobbly black pen contours with clearly visible irregular breaks, awkward hand-drawn shapes, internally clean flat color shapes deliberately slightly misregistered from selected outlines with tiny white slivers or small edge overhangs, normal clear saturation, limited color count, childlike messy-cute charm; broken but not uniformly dashed, misregistered but still legible";

export const MANDATORY_GENERATION_POLICY = `MANDATORY REFERENCE AND IDENTITY POLICY — HIGHEST PRIORITY:
- Image 1 is always the user's accepted personal-IP anchor, the only identity source, and the primary visual reference.
- Inspect Image 1 before rendering. Internally lock its exact hair or fur outer silhouette, crown, part, bangs, side locks and back length; face and eye geometry and colors; skin or body color; body proportions and species anatomy; outfit, shoes, accessories, and signature palette.
- Repeat that complete identity unchanged in every appearance, including tiny figures, heads, crops, themed outfits, photo composites, stickers, and meme reconstructions.
- Image 2 and all later images control only route content, scene, edit target, pose, crop, layout, true separable garments, props, background, effects, and text. They must never override Image 1 identity or contribute another character's anatomy.
- If any later instruction conflicts with this policy, follow Image 1 and this policy.

MANDATORY HOUSE STYLE — MENGLI ONLY:
${MENGLI_STYLE}.
Convert the anchor's mark-making into this Mengli house style while preserving identity exactly. Do not preserve or switch to the anchor's original rendering medium. Do not use source-meme style, 3D, pixel art, glossy anime, vector-perfect rendering, watercolor, crayon, oil pastel, or mixed media.`;

export function composeGenerationPrompt(routePrompt: string): string {
  return `${MANDATORY_GENERATION_POLICY}\n\nROUTE REQUEST:\n${routePrompt.trim()}`;
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
