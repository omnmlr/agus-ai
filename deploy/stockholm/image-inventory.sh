#!/usr/bin/env bash
set -euo pipefail

printf 'All images, including untagged images\n'
docker image ls --all --digests --no-trunc
printf '\nImages pinned by any existing container (including stopped)\n'
mapfile -t containers < <(docker ps -aq)
if (( ${#containers[@]} )); then
  docker inspect --type container --format '{{.Name}} {{.State.Status}} {{.Image}} {{.Config.Image}}' "${containers[@]}"
fi
printf '\nDocker disk accounting\n'
docker system df -v
printf '\nExisting edge config and mounts\n'
docker inspect --type container --format +  'image={{.Image}} command={{.Path}}{{range .Mounts}}{{println}}{{.Source}} -> {{.Destination}}{{end}}' +  agus-crypto-devnet-edge-1
