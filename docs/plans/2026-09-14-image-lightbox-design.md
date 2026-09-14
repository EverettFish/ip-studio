# Generated image lightbox

## Goal

Let users inspect any generated result without leaving IP Studio or opening a raw Blob URL.

## Interaction

- Generated images in the current job list, recent artworks, the full artbook, and starter-anchor candidates act as zoom-in buttons.
- The preview opens above drawers and modals, preserves the complete image ratio, and uses a neutral white stage so transparent edges remain readable.
- Users can close it with the visible close button, the dark backdrop, or Escape.
- Opening the preview locks page scrolling; closing restores the previous scroll behavior.

## Constraints

- Reuse the existing image or Blob URL. Do not copy image bytes, persist new data, or issue another network request.
- Keep download and delete actions separate from preview.
- On mobile, maximize the image area while keeping the close control reachable.
