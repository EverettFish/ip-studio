# Generation feedback repair

## Goal

Resolve four user-visible failures without adding a backend or changing the browser-owned API-key model: payment sessions must not expire immediately, TokenDance balance must be visible from the studio, a running batch must be stoppable between images, and the image model must be selectable per creation run.

## Design

1. Normalize TokenDance payment timestamps before comparing them. The API returns Unix seconds, while JavaScript dates use milliseconds. Only `paid` is success; real `failed`, `closed`, and `refunded` states remain terminal. Add a manual status refresh alongside the existing three-second polling.
2. Keep a lightweight TokenDance balance snapshot in `StudioShell`. Read it after connection, before a batch, and after each image attempt. The sidebar shows the remaining yuan balance. The batch summary uses the balance delta as authoritative cost and API `usage.total_tokens` when the image response supplies it.
3. Add a cooperative stop flag. Clicking stop never claims to cancel a request that already reached the provider; it finishes the current image and marks all not-yet-started jobs as stopped. This prevents accidental extra paid requests.
4. Add a per-run model field beside quality. TokenDance gets the two currently supported Ark image models as choices. Other providers retain their configured model and allow an explicit per-run model ID. The selection is applied to generation only and does not silently overwrite saved API settings.

## Safety and verification

The official Watcha review badge stays directly above the API card, but is rendered as a compact centered pill so it remains discoverable without competing with the primary controls.

- API keys remain in session storage and are sent only to the configured provider.
- No estimated cost is invented for providers that do not expose balance or cost.
- Tests cover Unix-second payment expiry, usage parsing, queue stop state, model selection wiring, and sidebar balance placement.
- Run tests, lint, production build, exported CSP verification, and a visual review of the production page before deployment.
