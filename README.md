# Orbital in Motion

Review build for `92932dc754185e46e72fbecea9f1a51c02905628`, based on `release/hackathon-integrated`.

## Run the site and console

1. Download and extract [agus-orbital-motion-review.zip](https://raw.githubusercontent.com/omnmlr/agus-ai/refs/heads/review/orbital-motion-92932dc/agus-orbital-motion-review.zip).
2. Run `node review.mjs` with Node 24. No dependency installation is needed.
3. Open the loopback URL and use the disposable console credentials printed by the launcher.

The review uses the real local control plane, a fresh file store, and a synthetic APK. Google, Resend, private Work, the campaign pilot, and settlement are outside the standalone preview. The homepage replay reconstructs a recorded Localnet run and displays the separate Devnet receipt attestation.

## See the experience

The recordings capture Chromium with motion enabled.

- [Desktop homepage and theater](https://raw.githubusercontent.com/omnmlr/agus-ai/refs/heads/review/orbital-motion-92932dc/orbital-homepage-desktop.mp4)
- [Full mobile replay](https://raw.githubusercontent.com/omnmlr/agus-ai/refs/heads/review/orbital-motion-92932dc/orbital-replay-mobile.mp4)
- [Console sign-in, themes, project creation, digest copy and mobile navigation](https://raw.githubusercontent.com/omnmlr/agus-ai/refs/heads/review/orbital-motion-92932dc/orbital-console.mp4)

## Verification and deployment

The review passed checks at six viewport sizes, 16 public routes, 41 local destinations, keyboard and theme checks, reduced-motion and no-JavaScript fallback, console workflows against the local API, and disposable TLS PostgreSQL smoke in the Neon bundle. The Docker web target contains the new assets. A six-second Chromium replay sample measured a 16.8 ms 95th-percentile frame interval at desktop and mobile viewport sizes. The desktop sample observed one 78 ms main-thread task. The mobile viewport was emulated.

[Neon candidate bundle](https://raw.githubusercontent.com/omnmlr/agus-ai/refs/heads/review/orbital-motion-92932dc/agus-neon-orbital-motion.zip) for a separately approved deployment. Verify both archives with [SHA256SUMS.txt](SHA256SUMS.txt).

- [Pull request](https://github.com/omnmlr/agus-ai/pull/3)
- [Deployment handoff](https://github.com/omnmlr/agus-ai/blob/92932dc754185e46e72fbecea9f1a51c02905628/docs/web-design/orbital-motion.md)
