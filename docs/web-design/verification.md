# Orbital Systems verification

## Reviewed browser captures

Chromium rendered the packaged website at 100% zoom. The authenticated console captures use a disposable API, synthetic APK bytes and isolated fixture accounts. The console crop on the homepage uses the same isolated data.

| Area | Captures |
| --- | --- |
| Homepage | [1440×900](screenshots/home-1440.jpg) · [1280×800](screenshots/home-1280.jpg) · [1024×768](screenshots/home-1024.jpg) · [768×1024](screenshots/home-768.jpg) · [390×844](screenshots/home-390.jpg) · [375×812](screenshots/home-375.jpg) |
| Full homepage | [Desktop](screenshots/home-full-1440.jpg) · [Mobile](screenshots/home-full-390.jpg) |
| Execution theater | [Register](screenshots/stage-register.jpg) · [Execute](screenshots/stage-execute.jpg) · [Verify on desktop](screenshots/stage-verify-1440.jpg) · [Verify on mobile](screenshots/stage-verify-390.jpg) |
| Navigation and footer | [Open mobile navigation](screenshots/navigation-open.jpg) · [Desktop menu](screenshots/navigation-desktop.jpg) · [Footer](screenshots/footer-1440.jpg) |
| Public documents | [Privacy Policy](screenshots/privacy-desktop.jpg) · [Terms of Service](screenshots/terms-desktop.jpg) · [Docs in light](screenshots/docs-light.jpg) · [Docs in dark](screenshots/docs-dark.jpg) · [375px API reference](screenshots/docs-api-mobile.jpg) |
| Authentication | [Light](screenshots/auth-light.jpg) · [Dark](screenshots/auth-dark.jpg) · [Mobile](screenshots/auth-mobile.jpg) · [Unavailable provider](screenshots/auth-unavailable.jpg) |
| Workspace | [Onboarding](screenshots/console-onboarding.jpg) · [Populated overview](screenshots/console-overview.jpg) · [Mobile drawer](screenshots/console-drawer.jpg) · [Light settings](screenshots/settings-light.jpg) · [Dark settings](screenshots/settings-dark.jpg) |
| Campaign and execution | [Authoring](screenshots/campaign-creation.jpg) · [Saved revision](screenshots/campaign-draft.jpg) · [Run detail](screenshots/test-run-detail.jpg) · [Findings and evidence](screenshots/findings-and-evidence.jpg) |
| Settlement | [Localnet fixture quote](screenshots/funding-quote.jpg) · [Unconfirmed funding state](screenshots/funding-unconfirmed.jpg) |

### Review changes

1. Compared the logo and Geist typography with the approved brand board. At narrow widths, the display heading initially gave “layer” its own line. Adjusting the narrow type scale and holding “mobile intelligence” together produced three readable lines with both CTAs visible.
2. The first set of shots exposed boxed arrow glyphs. Stroked arrows and outline console navigation icons use predictable geometry at desktop and touch sizes.
3. The theater initially changed its text inside a stationary highlighted row. The final highlight now moves between build, execution and evidence with the terminal and handset state.
4. A long CLI command widened the page to 540px at a 390px viewport. The integration grid now keeps the code’s overflow within the snippet. The six-width rerun passed without horizontal page overflow.
5. Resend’s artifact-led sections, Browserbase’s technical dividers and HeyElsa’s module rhythm informed the final review. The reference sheets remain private. [Reference notes](research.md)

## Acceptance gates

| Gate | Status | Evidence |
| --- | --- | --- |
| Brand and responsive layout | Pass | Inspected the dark and light lockups and favicon shape against the approved board, verified the loaded Geist face, reviewed six viewport sizes, checked theater states and working navigation. |
| Public routes, links and themes | Pass | Playwright checked 16 public routes and 40 local link destinations. Keyboard and touch viewport controls, docs copy, theme persistence across docs and auth, scroll-driven staging, reduced motion and static fallback passed. No unexpected public browser errors or failed requests. Demo, waitlist and general paths checked with isolated generated output. |
| Browser workflow | Pass | Chromium exercised invitation return, uninvited registration denial, invited signup, project creation, APK hashing/upload, mixed campaign revision and publication, pause/resume, execution filters, cancellation, reload, contributor findings, authorized review and report/receipt downloads. |
| Ownership and write recovery | Pass | Browser exercised foreign-resource denial and session rotation/revocation. A deliberately dropped HTTP 201 response created one run, and retry reused the request key and returned that same run. |
| Funding and settlement | Pass, local | Browser rendered a locked quote and blocked publication on unconfirmed funding. Separately, the real PostgreSQL and Agave 2.3.13 Localnet acceptance finalized 1,700,000 funding atoms, a 700,000-atom payout, a 200,000-atom partial award and an 800,000-atom refund, with zero remaining in the deposit account. |
| Contracts and API | Pass | Seven web checks, Neon adapter and preflight, developer-client contracts, and control-plane tests passed. The control-plane suite ran 21 tests with the funded case exercised separately. OAuth and OTP tests used synthetic provider responses. |
| Packaging | Pass, local | Neon bundled the actual assets, passed local PostgreSQL TLS, clean URLs, scoped authentication and a real 80 KB fixture upload. The Compose web target built with the pinned Caddy image and returned expected routes, file MIME types, invite redirects and branded 404. |
| Hosted sign-in, App Links and device execution | Not run | Authorized Google consent, Resend delivery, custom-domain association, and fresh physical Seeker execution were outside this local run. Existing backend routes and settings remain in place. |
| Hosted launch and Google approval | Not run | Founder approval, monitored private contact, legal review, authorized-domain verification and consent-screen submission remain owner steps. |

The [handoff](handoff.md) provides exact local commands and test fixtures. The [functionality matrix](functionality-matrix.md) maps UI operations to API endpoints and identifies availability boundaries.

## Lab performance

Lighthouse 13.6.0 with Chromium 156 against the final local Caddy homepage. The desktop and default mobile audits ran after the browser sweep.

| Metric | Desktop | Mobile |
| --- | ---: | ---: |
| Performance | 100 | 100 |
| Accessibility | 100 | 100 |
| Best practices | 100 | 100 |
| SEO | 100 | 100 |
| First contentful paint | 0.2 s | 0.9 s |
| Largest contentful paint | 0.4 s | 1.7 s |
| Total blocking time | 0 ms | 0 ms |
| Cumulative layout shift | 0 | 0 |
| Total transfer | 137 KiB | 137 KiB |

The two marketing JavaScript modules total about 2.6 KiB gzipped. The main ghost WebP is 20 KiB and the lazy workspace capture is 31 KiB. The scene uses static art and CSS, so it also renders without WebGL. Field INP was not measured.

The verified Neon fixture package contains 50 public assets. The ZIP generated in the local workspace is `/workspace/work/orbital-delivery/agus-neon-function.zip` with SHA-256 `114e65c80c47dd58f31a344c1a8bcdf780f8027b2b01b7ff2bad4e7bec267943`. The checked-out branch includes the build command in [the handoff](handoff.md#integration-and-packaging).
