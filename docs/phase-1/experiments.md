# Phone-native feasibility lab

The lab builds disposable controller, reviewed fixture and unreviewed control APKs. It exercises Android API 35 through visible app and system UI. It never uses a real account, wallet, contributor data, deployment secret or funded network. This is Phase 1 research code. Production clients need HTTPS, reviewed distribution, runtime enrollment/lease scopes and a signed workload manifest.

## Reproduction

Use a clean, disposable Android 15 (API 35) x86_64 AVD with managed users enabled, JDK 21, Node 24, Python 3 and Android platform/build tools. The script only accepts an emulator serial. As part of the test it creates and removes a work profile, so use an AVD reserved for this run.

```sh
export ANDROID_HOME=/absolute/path/to/android-sdk
npm ci --prefix services/control-plane --no-audit --no-fund
# Boot a clean API 35 AVD on emulator-5554, then run from the repository root.
bash experiments/phone-native/run-lab.sh "$(mktemp -d)"
```

The [GitHub-hosted workflow](../../.github/workflows/phase-1-phone-native.yml) creates this AVD and retains a synthetic marker log, JSON observations, build hashes and selected failure diagnostics. The experiment scripts are in [experiments/phone-native](../../experiments/phone-native).

| Action | Actual actor and privilege |
| --- | --- |
| Bootstrap controller and drive visible taps | ADB shell UID 2000 in CI installs the initial controller APK, opens the launcher activity in the requested user and emulates physical taps. The harness also reads package/user presence and app markers. There is no ADB activity in the production architecture. |
| Work-profile creation | An ordinary, user-installed controller requests `ACTION_PROVISION_MANAGED_PROFILE`. Android ManagedProvisioning runs its setup UI and handles approval. The controller applies its profile policy only after Android designates it profile owner. |
| App enrollment and backend transport | The work-profile controller uses `POST /api/v1/auth/register` and `GET /api/v1/auth/me` with disposable identity and emulator-host loopback. The real local control plane and file store receive requests. The test exercises person authentication. Native device credential enrollment, leases and evidence upload have their own acceptance requirements. |
| Reviewed artifact install | The profile owner checks a build-time SHA-256 and package allowlist. It stages the artifact using its own `PackageInstaller` session and processes framework callbacks. The lab user approves AGUS as an installation source in Android Settings and confirms the package operation. The DPC restores its work-profile install restriction after successful staging. A separate unreviewed artifact is rejected locally. |
| Automation and human interaction | The controller starts a signature-permission-protected activity for a nonce-bound result. The fixture receives one fixed verb and clicks its own view. The harness stands in for an owner to choose structured feedback or press Stop. No runtime ADB command drives the automated step or changes the target app. |
| Evidence | Controller validates the nonce, outcome schema, deadline and synthetic boundary result, then signs/verifies locally with an Android Keystore P-256 key. The harness sees a sanitized marker. This tests a device signing primitive and structured capture. A server-verifiable receipt envelope and attestation were not exercised by this fixture. |
| Stop and cleanup | Cooperating fixture exits via its Stop button. The work-profile controller suspends and uninstalls it through profile-scoped APIs, then verifies a fresh-data control on reinstall. Profile owner initiates Android removal. Harness observes parent-side launch and package state. |

## Passing hosted run

GitHub Actions passed at `33866e7f934934bc8a7ba0ccf4722d58f9b46eb6` on AOSP Android 15 API 35 x86_64, build `AE3A.240806.019/12368160:userdebug/test-keys`. The observer UID was 2000. [Passing CI run](https://github.com/omnmlr/agus-ai/actions/runs/45981236275) · [Harness assertions](evidence/api35/checks.json) · [App markers](evidence/api35/markers.log) · [APK hashes](evidence/api35/apk-sha256.txt) · [Tested revision](evidence/api35/revision.txt)

1. Android’s “Accept & continue” and “Next” screens created work user 10. The installed controller reported profile-owner policy application and completed a disposable account registration and authenticated read against the actual local control plane.
2. The controller rejected install before source approval and rejected the unreviewed APK twice. Android showed confirmation on both reviewed installs. Harness observations found the fixture only in the work user.
3. On both attempts the fixture's compiled step advanced its own view. It could not retrieve the parent canary, including a targeted query naming parent user 0, or connect directly to the lab host without network permission. The first attempt accepted structured feedback and locally verified its signature.
4. Android confirmed the first uninstall. Reinstall started without the seeded preference from the first attempt. On the second attempt the fixture’s Stop button cancelled the result and triggered device-local suspension and uninstall. Android again required confirmation. The harness observed both uninstall callbacks and package removal.
5. The owner UI initiated work-profile removal. The harness observed the deleted work user and successfully returned to the parent controller, with the fixture absent in the parent.

Android confirmation on install and uninstall is an observed product constraint on this image. A managed distribution route and the associated cleanup behavior need separate validation before considering unattended use. The successful run supports developing the bounded, attended first-party phone lanes and keeping broader automation in the existing dedicated lane.

## Iterations and local checks

The first hosted run at `6ec260b` built and signed the three APKs, booted an AOSP API 35 image as shell UID 2000, read the planted parent canary from the parent, and requested Android provisioning. The system displayed “Can't set up device,” before work-profile execution. The failure artifact includes `last-ui.xml` and app markers. Comparing the launch to Shelter’s activity-result contract identified a missing caller-preserving launch in the original controller. AOSP checks the caller package during setup, and the result-preserving launch restored the required identity. [Initial fail and retained artifact](https://github.com/omnmlr/agus-ai/actions/runs/45978602339) · [AOSP caller check](https://android.googlesource.com/platform/packages/apps/ManagedProvisioning/+/refs/tags/aml_net_341610030/src/com/android/managedprovisioning/preprovisioning/PreProvisioningActivityController.java) · [Pinned upstream launch contract](https://github.com/PeterCxy/Shelter/blob/0afac87b2dc34e58652d6bb3cebb61b1baaf1b98/app/src/main/java/net/typeblog/shelter/ui/SetupWizardActivity.java)

The caller-preserving run at `aee62dc` created work user 10 after “Accept & continue” and recorded the installed app gaining profile-owner authority. The controller then registered a disposable AGUS person and read it back through the real local API. Its checksum gate rejected the unreviewed artifact. Android returned a pending user-action status for the authorized fixture, followed by “Blocked by work policy.” This is evidence that the profile-owner role did not itself provide silent installation on the test image. This led to an explicit Android installer-source approval step in the disposable profile. [Hosted provisioning and policy result](https://github.com/omnmlr/agus-ai/actions/runs/45979937870)

The source-approval run at `379c381` verified that the controller could not install before approval, then installed the reviewed APK exclusively in work user 10 after both Android UI approvals. The fixture advanced its own view, the enabled controller could reach the backend while the fixture without network permission could not open a socket to it, and the fixture's explicit parent-user content query was denied. The controller accepted the structured “clear” selection and locally verified its Keystore signature. Android then denied uninstall because the DPC omitted `REQUEST_DELETE_PACKAGES`. The lab added that public permission and separated cleanup failure handling from signing. [Hosted install, action, evidence and uninstall failure](https://github.com/omnmlr/agus-ai/actions/runs/45980564614)

Local tooling also built and verified all three APKs using Android 35 build tools, and its manifest inspection confirmed that the fixture requests zero permissions. The local host lacks `/dev/kvm`, VMX and SVM. A forced software emulator launched, but the local ADB server could not create its home-directory state in the read-only environment, so local Android behavior remains unmeasured. The Android SDK command-line downloader failed to load manifests. The local tool archive digests matched Google repository metadata. Hosted CI supplied the working AVD and ADB.

Separate repository regression checks run in this workspace on Node 24: root workspaces 8 passing, control plane 8 passing, provider runner 6 passing, attestation 1 passing, settlement 7 passing with the external Postgres integration skipped, reference web 7 passing, and typed HTTP/MCP integration 2 passing. Runner tests simulate Android unless explicitly marked as an AVD run. Existing dedicated Android/Localnet evidence is linked from the baseline. [Existing dedicated AVD workflow](https://github.com/omnmlr/agus-ai/actions/runs/45923508742)

## Evidence limits

A synthetic canary is a controlled package/profile boundary check. It cannot establish that contacts, photos, app data, clipboard, personal wallets, system choosers, or every OEM bridge are isolated. The offline fixture’s socket denial only exercises an app without `INTERNET`. It does not validate lockdown VPN or a device-wide egress boundary. A fresh-install check covers fixture-local preference residue. It does not establish cross-customer wipe, reboot recovery, denial of a malicious APK’s resource use, or reliable owner reclaim from a non-cooperating app.

Human UI events were automated in the harness. The experiment exercises the workflow and evidence shape without claiming human skill or participant reliability. Phone-native execution must be evaluated separately from provider qualification, supported retail hardware, app distribution, attended wallet and overnight operation.
