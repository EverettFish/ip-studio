# First-visit onboarding

## Goal

Give a first-time visitor a friendly four-step introduction without blocking returning users or requiring account state.

## Experience

The first successful client mount checks a versioned local-storage flag. If it is missing, IP Studio opens a full-screen onboarding layer with four short steps:

1. create or upload a character anchor;
2. connect TokenDance or a compatible image API;
3. choose a creation tool and answer a short questionnaire;
4. preview, download, and reuse completed work.

Each step uses one square Mengli illustration of the existing blue-haired and green-haired IP Studio mascots. The illustration carries the action; the interface carries all text. Visitors can skip at any time, move backward and forward, or finish on the fourth step. Skipping and finishing both dismiss the automatic first-visit presentation. A persistent **new user guide** button reopens it later without clearing that preference.

## Accessibility and behavior

The onboarding is an accessible modal dialog with a labelled title, keyboard-operable controls, clear progress dots, restrained motion, and responsive single-column presentation on phones. The page beneath cannot scroll while the guide is open. No API connection or uploaded image is required to complete it.

## Verification

- A fresh browser profile opens step 1 automatically.
- Next, previous, skip, finish, and manual reopen all work.
- Completion persists across reloads in the same browser.
- Four illustrations load with no text, logos, or identity drift.
- Desktop and 430px mobile layouts have no horizontal overflow.
- Tests, lint, static export, CSP verification, and standalone build pass.
