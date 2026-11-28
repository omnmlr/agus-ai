# Stockholm SSM operator commands

## Decision

The snapshot shows 1.1 GiB available RAM, negligible current CPU load, 2.7 GB available disk, and no swap. The financial containers used about 250 MiB together against configured limits totaling 1,430 MiB. AGUS AI adds hard caps of 320 MiB for API plus worker and 96 MiB for web, with a combined cap of 0.75 vCPU. Its Docker JSON logs rotate at 10 MiB per file with three files per container, about 60 MiB total. The present memory snapshot supports controlled staging. Simultaneous financial peaks at their configured limits leave too little margin for the OS. Review peak usage and CPU credits before accepting steady co-location. Keep at least 384 MiB available during supervised operation, and stop the isolated AGUS AI stack if that margin erodes or financial health worsens.

Disk is the immediate staging gate. The verified earlier archive is 148 MB compressed and contains 490 MB of saved layers. A conservative import budget for that archive is about 3.4 GB free **after** placing the archive, including 2 GiB left for the host. The staging script measures the actual candidate’s expanded layers and the Docker filesystem. The 3.724 GB Docker marks reclaimable does not identify expendable images.

## 1. Run now in the existing SSM session

```bash
sudo docker image ls -a --digests --no-trunc
sudo docker ps -aq | xargs -r sudo docker inspect --type container \
  --format '{{.Name}} {{.State.Status}} {{.Image}} {{.Config.Image}}'
sudo docker system df -v
sudo docker inspect --type container agus-crypto-devnet-edge-1 \
  --format 'command={{.Path}}{{range .Mounts}}{{println}}{{.Source}} -> {{.Destination}}{{end}}'
sudo docker info --format '{{.DockerRootDir}}' | xargs -r df -hP
```

Compare every inactive image’s full ID with the stopped-container list and the financial release owner’s recorded rollback ID or digest. Keep the active images, anything referenced by a stopped container, and the known financial rollback even if Docker labels it inactive. An image is a deletion candidate only if the financial owner confirms it is superseded and all required rollback images remain locally or in a verified off-host archive. Remove only a reviewed exact ID with `sudo docker image rm sha256:<approved-id>`; Docker's normal reference checks stay enabled. If neither inactive image is expendable, leave both and stage on the existing spare Linux host instead. [Docker image removal](https://docs.docker.com/reference/cli/docker/image/rm/)

## 2. Stage the integrated release without starting production

Build `deploy/package.sh` off-host at the merged product SHA. Transfer that trusted release directory through the existing approved artifact channel. Set the directory and expected SHA supplied by the builder.

```bash
RELEASE=/var/releases/agus-ai-REPLACE_WITH_INTEGRATED_SHA
EXPECTED=REPLACE_WITH_INTEGRATED_SHA
cd "$RELEASE"
sudo bash stockholm/image-inventory.sh
sudo bash stockholm/stage-release.sh "$RELEASE" "$EXPECTED"
# After staging the existing production env and the existing pinned operator through the secret store:
sudo bash stockholm/verify-settlement-stage.sh "$RELEASE" "$EXPECTED"
```

The offline preflight reads the operator key through a read-only mount in a network-disabled container. It neither starts the application nor enables settlement. The existing financial service, volumes, container limits, log settings and Caddy vhost stay in service. Review EC2 CPU credits over the busy window before enabling the worker.

Stage `stockholm/Caddyfile.combined.example` as an isolated vhost, importing it from the existing edge configuration. Put `stockholm/assetlinks.json` at the approved mounted path `/etc/caddy/agus-app-links/assetlinks.json`. Use the existing config mount and a verified graceful reload method; if adding this requires recreating the financial edge, stop and arrange an approved maintenance plan. For a containerized edge the AGUS AI upstream is `agus-ai-web:8080` on the dedicated network. For host Caddy use `127.0.0.1:4174`. Validate the full config in its existing execution context. Stage a valid `agusai.grindcity.app` certificate before DNS, using the existing authorized TLS workflow. Keep PostgreSQL and Docker ports private. [Caddy validation and reload](https://caddyserver.com/docs/command-line)

```bash
# With the existing containerized Caddy and the full candidate staged in its existing mount:
EDGE=agus-crypto-devnet-edge-1
CANDIDATE_CFG=/etc/caddy/Caddyfile.candidate
sudo docker exec "$EDGE" caddy validate --adapter caddyfile --config "$CANDIDATE_CFG"
# Use only after live approval and only if the existing admin endpoint supports reload:
# sudo docker exec "$EDGE" caddy reload --adapter caddyfile --config "$CANDIDATE_CFG"
```

## 3. After separate live cutover approval

Back up the existing Caddy config, Name.com record, deployment 6 ZIP and runtime configuration first. The old Neon bundle does not implement the maintenance flag. Submit the maintenance-capable ZIP and `AGUS_NEON_API_MAINTENANCE=1` together. Verify **both** old URLs return the maintenance response on API requests and drain in-flight writes before starting the new production writer. If the custom Neon path still reaches the old deployment, stop.

```bash
cd "$RELEASE"
sudo docker compose --project-name agus-ai --env-file release.env \
  -f compose.yml -f compose.campaign-settlement.yml up -d --wait --wait-timeout 90
curl -fsS --max-time 10 http://127.0.0.1:4174/health
# Containerized Caddy only, after verifying the existing edge is the named container:
sudo docker network connect agus-ai-edge agus-crypto-devnet-edge-1
# Apply the validated vhost using the existing Caddy graceful reload procedure, then:
bash stockholm/verify-public.sh 13.48.206.202
# After changing only the agusai Name.com record to the verified Stockholm endpoint:
bash stockholm/verify-public.sh
sudo docker stats --no-stream agus-crypto-devnet-edge-1 agus-crypto-devnet-api-1 agus-crypto-devnet-worker-1
awk '/^MemAvailable:/ {print}' /proc/meminfo
```

Use the existing approved private-preview configuration and verified operator. Verify the worker acquires its existing PostgreSQL lease, reconciles the intended Devnet queue, and uses finalized RPC evidence for any existing obligations. The committed funded campaign and SAS evidence already cover end-to-end acceptance. A second funded campaign is unnecessary.

If anything fails, stop only the new writer and AGUS AI web before restoring writable Neon. Restore the previous Caddy configuration through its graceful reload and restore the original `agusai` CNAME. Leave the known Neon binding in place. Confirm healthy public PostgreSQL and financial HTTPS afterward. Keep settlement records, images and secrets for reconciliation.

```bash
cd "$RELEASE"
sudo docker compose --project-name agus-ai --env-file release.env \
  -f compose.yml -f compose.campaign-settlement.yml stop api web
curl -fsS --max-time 10 https://agus.grindcity.app/ -o /dev/null
```
