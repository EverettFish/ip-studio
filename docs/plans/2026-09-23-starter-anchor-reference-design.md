# Starter anchor reference upload

## Goal

Let users who do not yet have a finished IP character upload one optional visual reference while generating their first anchor.

## Flow

1. In “还没有自己的形象？试一试”, the user may upload one PNG, JPG, or WEBP reference up to 20 MB.
2. The reference can be previewed, replaced, or removed before generation.
3. Without a reference, generation keeps using the text-to-image endpoint.
4. With a reference, generation uses the provider's image-edit/image-to-image path and assigns Image 1 as the visual identity reference.
5. The written brief overrides only explicit conflicts. Backgrounds, captions, watermarks, unrelated objects, and extra people are excluded.
6. The generated candidate remains separate from the reference and must still be previewed and confirmed before becoming the saved anchor.

## Verification

- Unit tests cover prompt roles and OpenAI-compatible endpoint routing.
- Existing text-only generation tests remain unchanged.
- Desktop and mobile visual QA cover upload, preview, replace, remove, and candidate invalidation.
