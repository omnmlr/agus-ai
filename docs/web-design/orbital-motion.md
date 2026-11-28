# Orbital in Motion review

Base branch `release/hackathon-integrated` at `3042759`. Review branch `feature/orbital-motion`.

## Run the review

Extract `agus-orbital-motion-review.zip` and run `node review.mjs` with Node 24. Open the loopback URLs shown in the terminal. The console uses the displayed disposable login, an isolated file store, and a synthetic APK record. Stop with Ctrl+C. The launcher starts the real control-plane HTTP server. It does not configure Google, Resend, settlement, private Work, devices, or any external infrastructure.

The branch can also be run from source using the [web handoff](handoff.md#local-preview). The [deployment runbook](../../DEPLOYMENT.md) covers separate, authorized deployment to Neon or Docker.

## Creative and technical decisions

- The hero uses an original Cycles render of the Seeker’s distinctive rear camera assembly, cast-metal edges, dark lower panel, and machined turntable. The scene incorporates the approved ghost artwork and a shared floor reflection and shadow pass. The artwork stays readable without JavaScript. The mobile crop uses a smaller WebP. The scene responds to pointer and scroll, and stops updating outside the viewport. [Seeker hardware reference](https://solanamobile.com/seeker)
- The supplied recordings informed timing. AGUS’s old stage replaced multiple states together. HeyElsa carried activity across adjacent sections and Resend let a physical object establish a focal point before software details followed. The new version carries an orbital shape through the homepage and introduces the console surface as it enters the viewport. Developer controls use shorter feedback and stable focus.
- The replay reconstructs the recorded Localnet Android execution from the signed receipt and uses the separate Devnet attestation of that receipt’s digest. Device graphics are a reconstruction and playback timing is editorial. Verification links to the exact attestation transaction. Playback, pause, chapter jumps and arrow keys all control the same timeline. [Sanitized acceptance evidence](../phase-2-3/evidence/devnet-2026-11-28/)
- The scene source is [render-orbital-stage.py](art/render-orbital-stage.py). Use Blender 4.3 with a tightly alpha-cropped PNG of `apps/web/public/assets/orbital-ghost.webp` as its first argument and a PNG output path as its second. The shipped WebPs use spatial denoising (`hqdn3d=3.2:2.8:0:0`), an 83-quality desktop encode, and a mobile crop of `(185,68,1290,1060)` resized to 740 × 664 pixels.

## Exact package handoff

Build and review the checked release revision. Reuse the current authorized deployment environment, bindings and rollback procedure only after approval. No live deployment is needed to run the review.

```bash
npm ci --prefix services/control-plane --omit=dev
npm ci --prefix services/settlement --omit=dev
npm ci --prefix deploy/neon
npm --prefix apps/web run build
npm --prefix apps/web test
npm --prefix deploy/neon test
bash deploy/neon/verify-local.sh
docker build -f deploy/Dockerfile --target web -t agus-web-platform:orbital-motion .
```

For Neon, build the bundle from the final commit using the [Neon handoff commands](handoff.md#integration-and-packaging) or use the checksummed bundle in the review release. The standalone review archive is for local evaluation. It is separate from the Neon function ZIP.
