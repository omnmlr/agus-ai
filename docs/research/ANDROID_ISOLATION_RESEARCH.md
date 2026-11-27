# Android isolation: external research and experiment gates

This is a technical reference for the engineering investigation, not a tested architecture decision. No phone, APK or emulator was executed by the research author.

## Required product boundary

A qualified owner installs AGUS, consents to a test environment, commits a defined foreground session and can always stop it. No mandatory PC for supported ordinary-phone workloads. The main display may be occupied. Background/simultaneous use is not required. Separate personal data from test apps and prevent agent actions or observation outside scope. A user-facing permission dialog is not by itself proof of isolation.

| Candidate | Verified external capability | Critical limitation |
|---|---|---|
| Work profile / profile owner [R21–R23] | Android separates profile storage and provides profile policy APIs | Not a separate kernel/display; cross-profile intents, capture, install and networking require testing; existing work profile/OEM restrictions |
| Test DPC [R24] | Reference implementation for enterprise profile/device policy | Sample, not a production testing sandbox; distinguish profile owner from device owner |
| Shelter [R25] / Island [R26] | Real work-profile management implementations | Shelter GPL-3.0; Island repository Apache-2.0. Verify per-file/dependency licenses before reuse; no security guarantees |
| Instrumentation / UI Automator [R27] | Native test tooling interacts with app and system UI | Test-runner authority is not normal installed-app authority; scope and launch permissions must be established |
| Developer-owned test SDK | Proposed bounded in-app semantic interface | Requires cooperative build; cannot certify unmodified binaries as equivalent |
| MediaProjection [R28] | Android screen capture with user consent; app-specific sharing on modern Android | Android 14+ consent per session; protected surfaces and wallet handoffs may be unavailable; never capture personal screens |
| Accessibility [R29] | Android offers accessibility services | Play restrictions on autonomous actions and disclosure; deterministic scripts do not automatically qualify; no broad access on personal devices |
| Android AVF [R30] | Microdroid VM isolation | AOSP states relevant APIs are restricted System APIs unavailable to third-party apps; not a full GUI guest solution |
| Secondary Android user | Candidate stronger user separation on supported devices | Availability and switching/control privileges vary; test OEM and policy constraints |
| On-device debugging helpers | Candidate laptop-free dedicated-device setup | Broad shell privileges are not isolation. Never make them a personal-phone trust boundary |

## Recommended experiment order (engineering team decides)

1. User-consented managed-profile provisioning on stock Android, without root or ADB-granted authority in the app. Observe explicit eligibility failures. Check real UI behavior in profile and personal user.
2. Foreground human assignment for a reviewed, authorized app in the isolated environment. Collect minimal structured evidence with consent and demonstrate stop/cleanup. No screen recording beyond approved surfaces.
3. Bounded automation using developer-authorized test SDK or permitted tooling. Verify that launch/control/observation operate with normal production privileges and cannot address other apps. Do not reuse emulator harness privileges as proof.
4. Validate wallet behavior using disposable accounts and owner-authorized confirmations. Treat physical Seeker, hardware-backed Seed Vault and protected screens as separate acceptance gates.
5. Integrate lease, heartbeat, report and job matching with existing control plane. Default to unavailable until safety and compatibility checks pass. Dedicated runner remains separate for broader authorized tests.

## Falsification matrix

Use harmless adversarial fixtures and synthetic personal data. Test personal contacts/photos/files/wallet accessibility; shared storage and clipboard; cross-profile intents and notification exposure; unauthorized app launch; screen capture leakage and protected surfaces; network access and policy failure; excessive resource use; offline lease expiration; owner reclaim/revoke; uninstall/cleanup and subsequent job isolation. Observe results from both profile and personal user. Record OS/build, permission grants, network policy, logs, test APK hashes, actual results, limitations and cleanup.

Do not expose an unrestricted remote shell, bypass lock screen, grant broad device-admin control on ordinary personal phones, capture wallet secrets, evade Play policies, or require disabling platform security. If arbitrary APK automation cannot be safe, gate ordinary phones to reviewed/instrumented or interactive workloads; dedicated hardware may offer broader scope. Reject unavailable capture rather than invent evidence.

Foreground awake behavior, thermal management, battery wear, OEM process killing and fresh capture consent can limit overnight sessions. Owner can reclaim device immediately; local timeout should work without cloud connectivity. Verify distribution eligibility independently for Play and dApp Store; technical feasibility does not establish store approval.

See [R21–R30](REFERENCES.md) and the current engineering [security](../../SECURITY.md) document. Phase 1 owns actual feasibility experiments and the architecture decision record.
