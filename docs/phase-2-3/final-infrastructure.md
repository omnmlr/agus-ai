# Final infrastructure and Companion handoff

The funded campaign and SAS acceptance are complete at product commit `c2e2a97`. The [committed evidence](evidence/devnet-2026-11-28/README.md) records independent finalized reads for funding, both awards, the refund, and the SAS attestation.

## Stockholm capacity and access

The prior inventory identifies `i-0b608f6472205b337` in `eu-north-1` as the financial host. Its public hostname currently resolves to `13.48.206.202`. Public HTTPS demonstrates reachability. Actual CPU, free memory, Docker disk and inode headroom, security groups, and per-container usage require authenticated inspection. The prior financial limits total 1,430 MB. The AGUS AI API and web limits add 416 MiB and 0.75 vCPU. If the recorded t3.small class still applies, it has 2 GiB of RAM and a sustained baseline of 0.4 vCPU across both CPUs. The configured limits leave little room for the OS and Docker at simultaneous peaks. Compare measured busy-period memory and CPU credits, Docker root disk including image extraction, and existing availability before adding the stack. [T3 General Purpose specs](https://aws.amazon.com/ec2/instance-types/t3/)

Run the prepared probe from a workstation with the authorized AWS CLI profile. It prints the instance and security groups, SSM ping, seven days of hourly EC2 CPU and credit data, and a read-only host and container resource snapshot. An existing authorized SSH alias can run the host probe separately.

```powershell
./deploy/stockholm/Get-StockholmReadiness.ps1 -Profile <authorized-stockholm-profile>
# Existing approved SSH alias alternative for the host probe
./deploy/stockholm/Get-StockholmReadiness.ps1 -SshAlias <existing-stockholm-alias>
```

Use the existing instance role and approved SSM document access. Keep SSM HTTPS egress on 443 and the existing SSH policy. Reuse the TLS edge’s existing inbound 443, and port 80 where its certificate challenge requires it. Publish the AGUS AI web service only on the dedicated Docker edge network or its existing loopback binding, `127.0.0.1:4174`. Its API remains on the private Compose network. Allow verified TLS to the existing AGUS AI PostgreSQL endpoint, Devnet RPC, Google and Resend as applicable. [SSM prerequisites](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-prerequisites.html) · [EC2 CPU and credit metrics](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/viewing_metrics_with_cloudwatch.html)

## App Links and hosted settlement

Neon deployment 6 is the healthy rollback. The observed deployment 5 mismatch was native 200 with the correct association, while the mapped hostname returned the old bundle’s 404. A narrow log observation showed the mapped path reaching the Function. The effective deployment ID for that historical custom-host request remains unavailable. The [combined Caddy vhost](../../deploy/stockholm/Caddyfile.combined.example) reuses the verified proxy design and the existing [signed Companion association](../../deploy/stockholm/assetlinks.json). It serves the exact App Links path and forwards the website, API, and Android callback to the isolated AGUS AI stack. For a host-based Caddy edge, use the Compose loopback target noted in the example.

If measured headroom is sufficient, this topology resolves both public App Links and hosted worker placement while keeping the existing managed AGUS AI PostgreSQL database. If it is insufficient, use an existing spare always-on Linux AMD64 host for the same isolated stack. Retain Neon as the production backend until such a host is ready. If no spare host exists, an eligible OCI Always Free A1 allocation is a fallback subject to availability, idle reclamation, and an independently validated ARM64 rebuild. The current distribution is Linux AMD64. [OCI Free compute limits](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)

1. Prepare the integrated product commit after the website and Android changes land. Build `bash deploy/package.sh <integrated-sha> <output-directory>` on an existing Docker build machine. Keep build work off the shared financial host. Transfer and verify the resulting checksum manifest. Load the approved images at the scheduled staging window.
2. Use the existing operator secret store to stage `/etc/agus-ai/runtime.env` and the **existing** campaign operator key in `/etc/agus-ai/campaign-operator.json`. Both files need mode 0400 or 0600. The signer must be readable by container UID 1000 through the existing read-only mount. Configure the restricted AGUS AI database login, TLS verification, and the same sign-in provider bindings. Keep the legacy settlement flag at zero. Campaign settlement currently requires a separately approved private-preview configuration. The existing application enforces its membership and reviewer boundaries.
3. Run `bash deploy/stockholm/verify-settlement-stage.sh <release-directory> <integrated-sha>` with access to Docker and the staged secrets. It verifies the release, inputs, offline image preflight, and the pinned operator’s public address without starting a worker. The existing campaign PostgreSQL lease, idempotency, and finalized transaction verification remain in the product code.
4. With authorized domain and edge access, provision a certificate valid for `agusai.grindcity.app`. The existing financial certificate covers `agus.grindcity.app` only. Validate the merged edge. Check the exact App Links JSON, Android return route, PostgreSQL health, console and protected API from a staging client using `curl --resolve` with normal TLS verification.
5. Obtain explicit live cutover approval. The verified deployment 6 bundle predates `AGUS_NEON_API_MAINTENANCE`. Submit the tested maintenance-capable Function ZIP and `AGUS_NEON_API_MAINTENANCE=1` in the **same** approved deployment. An environment-only update to deployment 6 cannot fence its API. Verify the pinned maintenance response on both the native and custom URLs before enabling the new production database writer. If either old URL continues serving writes, halt the cutover. Follow the [single writer cutover](../../DEPLOYMENT.md#private-https-runtime-and-campaign-settlement). Change only the `agusai` Name.com record and confirm both hostnames after the approved change. To roll back, stop the new writer first, restore the original CNAME and prior Neon availability, and preserve the settlement records.

## Windows Companion release and physical acceptance

Use the [release script](../../scripts/android/Release-Companion.ps1) with JDK 17 or compatible JDK on PATH, the existing SDK build-tools 35.0.0 and the founder’s approved DPAPI signing store. It builds a revision-labeled release, signs with the existing key, verifies the certificate and application ID, and writes the APK, ZIP, and checksums. A cached artifact can be signed or packaged with its original source revision.

```powershell
./scripts/android/Release-Companion.ps1 -OutputDirectory <fresh-directory>
./scripts/android/Release-Companion.ps1 -SignedApk <existing-signed-apk> -SourceRevision <original-full-sha> -OutputDirectory <fresh-directory>
```

Use the [device script](../../scripts/android/CompanionDevice.ps1) for USB or Android Wireless debugging. On wireless, the pair and connect ports shown by Android can differ. Supply the PIN at the ADB prompt. Select the authorized physical device by its ADB serial. The script limits installation to the verified Companion package.

```powershell
./scripts/android/CompanionDevice.ps1 -Action Devices
./scripts/android/CompanionDevice.ps1 -Action Pair -Endpoint <ip:pair-port>
./scripts/android/CompanionDevice.ps1 -Action Connect -Endpoint <ip:debug-port>
./scripts/android/CompanionDevice.ps1 -Action Install -Serial <serial> -Apk <signed-apk>
./scripts/android/CompanionDevice.ps1 -Action Diagnostics -Serial <serial> -Report <new-local-json>
./scripts/android/CompanionDevice.ps1 -Action Acceptance -Serial <serial> -Report <new-local-json>
```

Acceptance verifies the installed certificate, public association, Android verified-domain state and actual intent routing. It then records observed outcomes for Google, email OTP, restart and sign-out using an authorized test account. The report omits credentials and device serials. Use the separate [dedicated Work and Seeker acceptance](windows-activation.md#private-preview-approval) for those products. [Wireless ADB](https://developer.android.com/tools/adb#wireless)
