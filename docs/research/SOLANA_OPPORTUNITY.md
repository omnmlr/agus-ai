# Why Solana Mobile needs better release evidence

## Ecosystem evidence

Solana Mobile reported 793 unique developers building for Seeker and 2,130 Seeker dApp launches on 20 October 2026 [R8]. An October hardware expansion announcement reported over 1,500 dApp Store apps, 154 million transactions and more than $13B of Seeker transaction volume [R9]. These are first-party figures with different definitions and snapshots; launches are not unique current apps, transaction volume is not revenue, and developers are not necessarily buyers. Seeker Connect's announcement describes access to 100,000+ active Seeker owners [R10]. The Ledger Atom expansion makes hardware diversity more relevant [R9, R11].

The builder grant program explicitly considers mobile tooling, infrastructure and research [R12]. The security program covers Seed Vault and other ecosystem components [R13]. AGUS could align with these priorities; no grant, endorsement or security-program status is claimed.

## The founder's problem, without exaggeration

Solana Mobile provides Fake Wallet and emulator development tools; its hackathon guidance explicitly supports development on regular Android or an emulator [R14–R16]. AGUS is not required to begin development. It addresses the subsequent assurance gap: real hardware, real wallet configurations, lifecycle differences, human behavior, and evidence of the actual blockchain outcome. A Seeker owner still has only one sample of device state and user behavior.

| Public issue report | Proposed repeatable test |
|---|---|
| [MWA #1484](https://github.com/solana-mobile/mobile-wallet-adapter/issues/1484): remote QR behavior differs between Fake Wallet and production Seeker wallets | Compare transport, versions and hardware with authorized test accounts |
| [MWA #1436](https://github.com/solana-mobile/mobile-wallet-adapter/issues/1436): default wallet selection traps a user | Multiple installed wallets, defaults, explicit recovery |
| [MWA #1364](https://github.com/solana-mobile/mobile-wallet-adapter/issues/1364): PWA fails after reopening | Background/foreground, session restart and reconnect |

These are reported incidents, not verified universal bugs; current fix status can change. Test against pinned versions and record if reproduced, not reproduced, or unsupported. Do not assume AGUS has reproduced these reports.

## Products by stakeholder

- **Mobile dApp builders:** pre-release regression matrix, wallet handoff checks, cancellation and reconnect, UI feedback, on-chain assertion reports. CI/MCP provides recurring utility, not just one-time rental.
- **Wallet and SDK maintainers:** targeted interoperability regression campaigns; reproducible traces with app version, wallet version, device, network and callback outcome.
- **Solana Mobile:** proposed developer-credit program, opt-in aggregated issue taxonomy and release readiness assistance. Existing store review and Guardians are not replaced. No access to proprietary review processes is assumed.
- **Foundation and ecosystem programs:** potential sponsored testing for early teams and hackathons; measurable outcomes per credit rather than token incentives for idle devices.
- **AI financial agent builders:** evaluate if an agent correctly identifies cancellation, pending, wrong network and finalized success.

## Why blockchain is useful, not decoration

Wallet callback evidence alone is insufficient. Record exact expected payer, recipient, amount, network and transaction signature; independently confirm finality and effects. The baseline [demo](../../DEMO.md) documents a Localnet callback-without-broadcast negative control and corrected run. A signed evidence digest can be bound to an on-chain attestation when issuance is verified; a signature is not proof of physical hardware authenticity. Test USDC payout demonstrates settlement mechanics, not a real-money business. Seed Vault requires real supported hardware and authorized human confirmation; never substitute a simulator for hardware-backed signing.

## Partner hypothesis

Offer mobile builders a narrow wallet assurance campaign first. Measure whether reports lead to fixed defects and repeated paid releases. Approach Solana Mobile later with aggregated evidence and a scoped proposal; avoid implying that the ecosystem operator needs to outsource security or store review.

Sources: [R8–R16, R17–R19](REFERENCES.md).
