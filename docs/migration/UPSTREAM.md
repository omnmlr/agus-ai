# Mobile testing migration

**Source checkpoint** `5ecc4d97156fc9ac94de895e76691e0ddef7a0c3` on `pivot/solana-mobile-testing`. [Source tree](https://github.com/omnmlr/hackaholics-financial-agent/tree/5ecc4d97156fc9ac94de895e76691e0ddef7a0c3)

The first imported tree contains the original mobile-test package, documentation, and historical evidence. The original workflow is archived under `docs/mobile-test/upstream-workflow.yml`. Git filtering preserves authors, committer identities, dates, messages, and path content. Rewritten trees and parent links produce new commit IDs. The initial empty baseline is retained.

| Original commit | Imported commit | Change |
| --- | --- | --- |
| [`0932e5df2888`](https://github.com/omnmlr/hackaholics-financial-agent/commit/0932e5df2888c7259eae3a27670f23508e0ee84f) | `50410575dac538dc3126dce0326f0d29df0b9cfd` | Record a signed Android run with measured device and lease evidence |
| [`1e11a5703b4b`](https://github.com/omnmlr/hackaholics-financial-agent/commit/1e11a5703b4bda8f376ee85d9e5f7c8fdb427bc7) | `1e11a5703b4bda8f376ee85d9e5f7c8fdb427bc7` | chore: establish empty main baseline for initial implementation review |
| [`203c6723670d`](https://github.com/omnmlr/hackaholics-financial-agent/commit/203c6723670dd2e3782c600d636c59e16ef90b9a) | `cb9fde08bfd30c5376321c254550edd200e21bbb` | Add measured device leases, agent outcome grading and signed reports |
| [`4aba0b74a4fd`](https://github.com/omnmlr/hackaholics-financial-agent/commit/4aba0b74a4fd401d23794ddea31ef9b0a95d3f1f) | `d0a2b99b7c65e77b724a0c6de717f84d75990f11` | Bind the hosted emulator to the generated AVD directory |
| [`5ecc4d97156f`](https://github.com/omnmlr/hackaholics-financial-agent/commit/5ecc4d97156fc9ac94de895e76691e0ddef7a0c3) | `d03a33e01347fa1754c06251cb460d16bd7645d2` | Record complete Android, evaluation and settlement acceptance |
| [`75b29c17ddff`](https://github.com/omnmlr/hackaholics-financial-agent/commit/75b29c17ddfffc20317e94e3dc99119757a8aa32) | `5d91801bb9bc9c2275e38e3cfecb1b482836691d` | Resolve Android SDK tools on the hosted KVM runner |
| [`7794f5312749`](https://github.com/omnmlr/hackaholics-financial-agent/commit/7794f5312749f0ab40879e528fa317f4925c2f16) | `dbbb018dd9e8c650d6441fb741937ddb8d6b798d` | Verify completed-task grading and preserve passing Android reports |
| [`79744827afb3`](https://github.com/omnmlr/hackaholics-financial-agent/commit/79744827afb3b07880d2c62b0bd0d24767f126e1) | `0c9c067603a1a3da24869017d4e9722089176657` | Keep the emulator and validator alive in the Android test step |
| [`7cf4b1865375`](https://github.com/omnmlr/hackaholics-financial-agent/commit/7cf4b1865375655e61a1ba3e4b4014666ab5169e) | `e460911abde928e05f6b0adf086f09d8c1c9b9d9` | Read the bounded Android wallet callback buffer with explicit timestamps |
| [`98da083b511b`](https://github.com/omnmlr/hackaholics-financial-agent/commit/98da083b511baaaa2f51e52a2211480a896c7442) | `a8311c9ec5e190be0acbc4497230d9a63ab4cfe7` | Correct CI startup and document reproducible test evidence |
| [`9cd9b51a74b6`](https://github.com/omnmlr/hackaholics-financial-agent/commit/9cd9b51a74b6f8cbc8ab69a2734af4916ebbf007) | `818a21c57459c98c26e6368d5443d289e3bd3206` | Build isolated Solana Mobile regression runner and MWA lab |
| [`ed1b7ea3dba7`](https://github.com/omnmlr/hackaholics-financial-agent/commit/ed1b7ea3dba7eaf450c4f4cb33d82fdb2c637322) | `bbc42444f27d3a1a5102823e01e893bd0aeb93fc` | Keep Android failure evidence and exercise adjudication in CI |

The upstream repository has no repository-level license declaration. This import carries the original attribution and makes no new licensing grant. The fixture downloads unmodified pinned Mobile Wallet Adapter artifacts under the upstream license. [Mobile Wallet Adapter license](https://github.com/solana-mobile/mobile-wallet-adapter/blob/main/LICENSE)

The new product keeps its own service identities, persistence, build storage and deploy target. The financial deployment, application history, production dependencies, escrow state and databases remain in the source product. The financial APK remains an external test target.
