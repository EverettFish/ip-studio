# First-anchor and mobile feedback iteration

## Goal

Remove the first-use dead end for people who do not already own a character image, while making multi-image generation more predictable, transparent, and honest on mobile browsers.

## Product flow

1. The anchor modal offers two explicit paths: upload an existing character or create a first character from a short visual brief.
2. Starter demos fill an editable brief rather than silently controlling identity. The chosen core style is part of the first generation request.
3. A generated candidate remains a preview until the user explicitly confirms it as Image 1. It is never converted a second time during confirmation.
4. Every multi-image route exposes one optional shared-requirements field. The value is appended to every route job with a clear index-aware instruction.
5. Sticker sheets offer opaque or true-transparent output. Expression packs offer one consistent background policy and default to pure white.
6. Photo fusion adds explicit sitting geometry and an optional placement detail so the character contacts the seat rather than the chair back.

## Model guidance

- API setup and generation drawers recommend Image 2 / `gpt-image-2` where available for identity fidelity, transparency, and text-heavy outputs.
- The UI states that other image models can work but may differ, especially for infographics, sticker titles, and exact text.
- The recommendation never blocks TokenDance or custom image-capable models.

## Mobile safety

The site remains a static BYOK client, so iOS may suspend an in-flight request after backgrounding. While a batch is active, prevent accidental tab closure where the browser supports it, request a screen wake lock when available, and show a persistent explanation to keep the page foregrounded. Successful images continue to be saved one by one.

## Verification

- Unit-test starter-anchor prompts and both text-to-image protocols.
- Unit-test shared requirements, transparent stickers, consistent expression backgrounds, and sitting constraints.
- Run all tests, lint, production build, standalone build, and visual checks at desktop and iPhone-sized viewports before deployment.
