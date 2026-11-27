# Sources

Research snapshot 27 November 2026. Primary vendor sources establish advertised products, policies or first-party metrics; issue reports are reported experiences; academic sources establish research results. None demonstrates AGUS customer demand. External sources can change.

| ID | Source | Use / caveat |
|---|---|---|
| R1 | [AWS Device Farm pricing](https://aws.amazon.com/device-farm/pricing/) | Published metered device pricing; not identical service |
| R2 | [BrowserStack pricing and device cloud](https://www.browserstack.com/pricing?product=live) | Vendor product and scale claims |
| R3 | [Applause testing services](https://www.applause.com/our-services/) | Managed human and automated QA |
| R4 | [Testlio payments testing](https://www.testlio.com/solutions/payments-testing) | Commercial real-world payment testing |
| R5 | [Testlio ecommerce case study](https://www.testlio.com/customers/ecommerce-testing-case-study) | Vendor-reported multicountry defect example |
| R6 | [Scale frontier data catalogue](https://scale.com/off-the-shelf-data) | Commercial GUI trajectories and evaluations |
| R7 | [On the Effects of Data Scale on UI Control Agents, NeurIPS 2024](https://papers.neurips.cc/paper_files/paper/2024/file/a79f3ef3b445fd4659f44648f7ea8ffd-Paper-Datasets_and_Benchmarks_Track.pdf) | AndroidControl task and app counts; retrieved abstract/search excerpt |
| R8 | [Solana Mobile October 20 ecosystem update](https://solanamobile.com/blog/the-clock-in-builds-are-in-what%E2%80%99s-next-on-seeker) | 793 developers and 2,130 launches, first-party snapshot |
| R9 | [Ledger hardware expansion](https://solanamobile.com/blog/solana-mobile-announces-ledger-as-its-first-hardware-expansion-partner) | Hardware expansion and ecosystem metrics |
| R10 | [Seeker Connect, October 21](https://solanamobile.com/blog/seeker-connect-one-tap-solana-wallet-connection) | Connection SDK, active owner claim |
| R11 | [Solana Mobile November 23 update](https://solanamobile.com/blog/three-firsts-for-seeker-hardware-expansion-new-guardians-and-skr-burns) | Hardware and ecosystem developments |
| R12 | [Solana Mobile Builder Grants](https://solanamobile.com/grants) | Eligibility priorities, not award promise |
| R13 | [Security disclosure and grants](https://solanamobile.com/blog/introducing-the-solana-mobile-vulnerability-disclosure-policy-bug-bounty-program-and-security-grants) | Security scope and controlled research |
| R14 | [CLOCK IN development guidance](https://solanamobile.com/blog/clock-in-the-solana-mobile-hackathon) | Ordinary Android/emulator development |
| R15 | [Mobile Wallet Adapter source](https://github.com/solana-mobile/mobile-wallet-adapter) | Official protocol implementations and Fake Wallet |
| R16 | [Seed Vault SDK](https://github.com/solana-mobile/seed-vault-sdk) | Simulator and test account limits |
| R17 | [MWA issue 1484](https://github.com/solana-mobile/mobile-wallet-adapter/issues/1484) | Reported Fake Wallet vs production discrepancy |
| R18 | [MWA issue 1436](https://github.com/solana-mobile/mobile-wallet-adapter/issues/1436) | Reported wallet selection issue |
| R19 | [MWA issue 1364](https://github.com/solana-mobile/mobile-wallet-adapter/issues/1364) | Reported lifecycle issue |
| R20 | [AndroidWorld](https://github.com/google-research/android_world) | Open mobile agent evaluation benchmark |
| R21 | [Android work profiles](https://developer.android.com/work/managed-profiles) | Separate profile storage |
| R22 | [Build a DPC](https://developer.android.com/work/dpc/build-dpc) | Provisioning and management APIs |
| R23 | [DPC security](https://developer.android.com/work/dpc/security) | Profile vs device owner policy |
| R24 | [Google Test DPC](https://github.com/googlesamples/android-testdpc) | Reference implementation |
| R25 | [Shelter](https://github.com/PeterCxy/Shelter) | Work-profile implementation, GPL-3.0 mirror |
| R26 | [Island](https://github.com/oasisfeng/island) | Work-profile implementation, Apache-2.0 repository |
| R27 | [UI Automator](https://developer.android.com/training/testing/other-components/ui-automator) | Instrumented testing framework |
| R28 | [Media projection](https://developer.android.com/media/grow/media-projection) | User consent and capture restrictions |
| R29 | [Play AccessibilityService policy](https://support.google.com/googleplay/android-developer/answer/10964491) | Autonomous action restrictions and disclosures |
| R30 | [AOSP AVF API documentation](https://android.googlesource.com/platform/packages/modules/Virtualization/+/HEAD/libs/framework-virtualization/README.md) | Restricted system permissions, Microdroid |

Repository evidence: [baseline commit](https://github.com/omnmlr/agus-ai/commit/7a2ece43d60732c4d2b2a054d0997515f90e302d), [implementation ledger](../../PROGRESS.md), [demo](../../DEMO.md), [frontend contract](../../FRONTEND_CONTRACT.md), [security](../../SECURITY.md), [passing Localnet workflow](https://github.com/omnmlr/agus-ai/actions/runs/45888580906), [agent wallet and marketplace workflow](https://github.com/omnmlr/agus-ai/actions/runs/45923508742). Evidence links are repository-reported; this research assignment did not rerun tests.
