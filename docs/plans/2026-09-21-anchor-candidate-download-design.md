# Anchor candidate download

## Goal

Let users download both kinds of generated anchor candidates before they decide whether to save one as the core IP anchor:

- a starter anchor generated from a text description;
- a style-converted anchor generated from an uploaded source image.

## Interaction

Generated images are staged as candidates instead of being saved immediately. A candidate card provides full-size preview, PNG download, and regeneration. The primary action changes from **generate candidate** to **confirm candidate** only after a successful generation.

The uploaded source remains separate from the generated candidate. Changing the selected style invalidates the old candidate so a user cannot accidentally confirm or download an image made with a different style.

## Data flow

`pendingAnchorFile` keeps the uploaded identity source. `pendingAnchorCandidate` keeps generated output. Text-to-image creation writes only the candidate; upload conversion reads the source and writes the candidate. Confirmation chooses the original source for the original-style path, otherwise it requires the candidate, while preserving the uploaded source in the saved anchor record for later restyling.

## Verification

- Starter generation exposes preview and PNG download before confirmation.
- Upload conversion exposes preview and PNG download before confirmation.
- Changing style clears a stale candidate.
- Original-style upload still saves without an API call.
- Desktop and narrow mobile layouts remain usable.
- Unit tests, lint, static export, CSP verification, and standalone build pass.
