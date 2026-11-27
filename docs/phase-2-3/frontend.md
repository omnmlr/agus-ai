# Functional integration handoff

The checked-in companion retains Home, Activity and Earnings with the existing visual components. The phone-native reference is a separate AOSP preview app, reached from Enrollment. It provisions its own user-approved work profile and uses the same person identity in that profile, with an independent runtime key. Keep the Work badge and Android approval steps visible in final UX. Never pass a bearer across profiles from the companion.

## Contributor interactions

| Screen | Data and actions | Required feedback |
| --- | --- | --- |
| Preview setup and Work sign-in | Android ManagedProvisioning, then `/auth/login` in the Work copy | Existing profile, unsupported image, wrong identity, provider unavailable, and pending Android confirmation. |
| Runtime enrollment and foreground window | `/me/runtime-enrollments`, `complete`, runtime-signed heartbeat | Enrollment binds one execution class. Window is explicit and time-bounded. Readiness incorporates available local policy, storage, battery, thermal and signed network sampling. |
| Qualification | `GET /me/qualifications`, `POST /me/qualifications/{version}/submissions` and appeal endpoint | Show current calibrated evidence, role eligibility, retest and pending review. Human reproduction and wallet exam results are separate from device compatibility. |
| Assignment inbox | `/me/assignments` with exact test build, instructions, eligibility, consent scope and test-unit terms | Empty list, incompatible runtime, stale window, invitation scope, decline, and concurrent reservation loss. |
| Active testing | Review scope and explicitly authorize. Use Android source approval, APK approval, launch, native Stop and operating-system notification action. | Label installer and uninstaller prompts. Show local stop and cleanup pending separately. Hold a device with unconfirmed residue or an interrupted operation. |
| Post-run submission | Draft expected/actual, steps and finding category. Preview exact fields and submit by current attempt/version. Corrections refer to approved action types in the selected agent run. | Submission has loading, reviewed, needs revision, cancelled, or expired states. A signed native receipt and reviewer acceptance are distinct indicators. |
| Training and earnings | Contributor-specific training grant or withdrawal, campaign earnings, dedicated payout wallet and transactions | Keep training scope separate from testing. Label nontransferable test units. Dedicated wallet changes affect future offers. |
| Existing Activity, Profile and notifications | Private invitations, marketplace queue, per-device decline, owner diagnostics, inbox mark read and optional preference categories | Show in-app inbox status. Live push requires a separate channel. Warnings and safety-related state remain visible. |

## Developer portal

- Use the Campaigns tab to edit an immutable draft revision, choose the project/build, define multiple execution lanes, coverage, skill, ABI/API, instructions and duration, choose invited or qualified-preview visibility, and set retention and test-unit terms.
- Publishing atomically creates coverage slots and dedicated marketplace runs. Pause blocks new claims. Cancellation requests active stops and preserves decisions on already submitted work.
- Open the campaign report for denominators and findings. Review the exact submitted version, request revision, reject, or accept. Partial credit is offered after a cleaned interruption with published partial terms. Download signed receipts from the assignment and verify with the operator’s pinned public key. [Receipt verification](../../packages/cooperative-android/README.md#verify-a-downloaded-receipt)
- For exports, both parties grant rights for the exact assignment. Regenerate the package after consent changes. Keep operational findings distinct from the minimized export. Previously delivered data is subject to separate retention and deletion obligations.
- Continue using run details for device-run monitoring, bounded actions, chain verification, signed evidence, and the dedicated Devnet payment workflow.
- The reference web supports password, email code and browser OAuth. Live email and Google sign-in require the authorized deployment bindings. The Android companion supports password and email code. Native Google callback and verified Android App Links remain deployment and UI acceptance items.

## Preview setup and contracts

Start from an authorized disposable local environment and follow [the SDK and emulator guide](../../packages/cooperative-android/README.md). The client contract is generated from [the OpenAPI schema](../../packages/developer-client/openapi.json), and the dedicated client routes remain available. See [API integration notes](../../services/control-plane/API.md) for the distinct person, runtime and lease credentials.

The original November UI/UX handoff and design token files were unavailable through the checkout, provided attachments, visible refs and PRs, and connected filename search. The [historical Chisom handoff](../mobile-test/FRONTEND.md) and [checked-in functional contract](../../FRONTEND_CONTRACT.md) govern integration. There are no changes to the visual design files or styling tokens. Reference UI changes wire operational states and controls for the final design.

A local operator can use the qualification-appeal endpoints with a person ID explicitly configured in `AGUS_PILOT_REVIEWER_IDS`. Reviewers cannot decide their own appeals. Reproduction amendments do not award wallet knowledge qualifications.
