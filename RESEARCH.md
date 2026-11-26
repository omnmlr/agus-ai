# Research and integration decisions

The source branch investigated Phone Harness, Droidrun alternatives, Maestro and Appium-style automation, managed device farms, Seeker-specific testing, and Solana's testing stack. Device control is widely available. A release runner becomes useful when it consistently joins compatibility, exact wallet assertions, repeatable environment conditions and evidence consumers can verify. [Pinned upstream research](docs/mobile-test/RESEARCH.md)

| Integration | Present decision |
| --- | --- |
| Mobile Wallet Adapter | Use the official Fake Wallet and clientlib to exercise Localnet handoff and signing. Keep callback reporting and chain finality checks separate. [Fixture and evidence](docs/mobile-test/DEMO.md) |
| Seeker Connect and Seed Vault | Keep independent scenario families. Use official SDK/simulator for software compatibility and require an attended Seeker for hardware or device identity claims. [Integration matrix](docs/mobile-test/ARCHITECTURE.md) |
| Genesis Token and SIWS | Test mint eligibility through a verified wallet association and fresh domain-bound nonce when a supported provider is available. Hardware provenance must come from a separate signal. [Network design](docs/mobile-test/NETWORK.md) |
| Circle test USDC | Pin the official Devnet mint and six decimals. Verify exact finalized transfers and use disposable accounts. [Circle contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses) |
| Solana Attestation Service | A schema and issuer can bind a receipt digest and evidence class. Keep private artifacts off-chain and describe the claim the issuer can actually support. [Official SAS documentation](https://solana.com/docs/tools/attestations/overview) |
| dApp Store and Guardians | Produce pre-submission evidence, seek compatibility feedback and assess grant fit. Publishing and approval follow the official workflow. [Publishing documentation](https://docs.solanamobile.com/dapp-publishing/intro) · [Guardians](https://solanamobile.com/blog/introducing-the-first-solana-mobile-guardians) · [Build on Seeker](https://buildonseeker.com/) |

An Android companion can manage registration and provider controls. The dedicated desktop runner supplies USB ADB and makes the isolation boundary explicit. Managed profiles and Android Virtualization Framework require OEM-specific validation before an everyday-device experiment. [Isolation research](docs/mobile-test/NETWORK.md)
