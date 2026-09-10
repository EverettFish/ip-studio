# TokenDance application attribution

## Goal

Attribute every IP Studio model invocation sent through TokenDance to the stable App URL `https://ipstudio.fun/`, while leaving OpenAI, custom providers, account APIs, and temporary image downloads unchanged.

## Design

1. Define the App URL and display name once in the provider module. The trailing slash is part of the identity and must not be derived from the current page, preview query, or callback path.
2. Send `app_url=https://ipstudio.fun/` and `key_name=IP Studio` when starting OAuth with the existing S256 PKCE flow.
3. Add `X-App-URL: https://ipstudio.fun/` to TokenDance gateway model calls, including text planning, OpenAI-compatible image edits, Ark image generations, and SDK-backed requests.
4. Emit the attribution header only when the connection is TokenDance and the request target is exactly the HTTPS `tokendance.space` origin under `/gateway/`. Do not attach it to portal account endpoints, payment endpoints, custom gateways, or generated-image download URLs.
5. Give `TokenDance-Recovery-Action` precedence over generic HTTP status messaging so an expired OAuth key on a 401 response directs the user to reauthorize.

## Verification

- Unit-test the exact App URL, trailing slash, OAuth parameters, request header on text and image calls, absence on custom APIs, and recovery-action precedence.
- Run the complete test suite, lint, production build, standalone build, and CSP verification before deployment.
