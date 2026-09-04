# Provider connectivity repair

The production meta CSP still permitted only OpenAI. Keep the static export architecture and other CSP directives, but permit HTTPS connections (and explicitly configured loopback development endpoints). Custom endpoint validation remains required; no user credential is proxied through IP Studio.

Separate required image credentials/model/protocol from optional article planning. Image-only connections use transparent local paragraph grouping for article routes, with no network text-model call. API planning can have a distinct endpoint and key; never reuse the image credential across origins implicitly.

Model discovery is optional for custom gateways: a missing /models endpoint must not prevent saving an image-only API. Explicit protocol metadata and known text-only model names reject invalid image selections. A user-initiated one-image test is the only UI state that claims image generation succeeded.

Validate source and exported CSP, mock OAuth exchange and image-only requests, test independent planner credentials, then verify production browser public TokenDance model discovery without user secrets or charges. Paid generation and actual account authorization require the user's own account.
