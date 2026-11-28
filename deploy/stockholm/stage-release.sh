#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 || ! $2 =~ ^[a-f0-9]{40}$ ]]; then
  printf 'Usage: %s TRUSTED_RELEASE_DIRECTORY EXPECTED_COMMIT_SHA\n' "$0" >&2
  exit 2
fi
cd -- "$1"
revision=$(<revision.txt)
[[ $revision == "$2" ]] || { printf 'Unexpected release revision.\n' >&2; exit 1; }
grep -Eq '^[0-9a-f]{64}  images\.tar\.gz$' SHA256SUMS.txt
sha256sum --check --strict SHA256SUMS.txt

docker_root=$(docker info --format '{{.DockerRootDir}}')
# Docker may keep both layer blobs and expanded files during import.
expanded=$(python3 - images.tar.gz <<'PY'
import gzip, io, json, sys, tarfile
with tarfile.open(sys.argv[1], 'r:gz') as archive:
    manifests = json.load(archive.extractfile('manifest.json'))
    layers = {layer for item in manifests for layer in item['Layers']}
    total = 0
    entries = sorted((archive.getmember(name) for name in layers), key=lambda entry: entry.offset_data)
    for entry in entries:
        with io.BufferedReader(archive.extractfile(entry)) as stream:
            magic = stream.peek(4)[:4]
            if magic[:2] == b'\x1f\x8b':
                with gzip.GzipFile(fileobj=stream) as decoded:
                    total += sum(len(chunk) for chunk in iter(lambda: decoded.read(2**20), b''))
            elif magic == bytes.fromhex('28b52ffd'):
                raise SystemExit('Measure zstd layers separately before importing this archive.')
            else:
                total += entry.size
    print(total)
PY
)
free=$(df -PB1 -- "$docker_root" | awk 'NR == 2 {print $4}')
# Account for two layer copies, import overhead, and 2 GiB left for the existing host.
needed=$((2 * expanded + 256 * 1024 * 1024 + 2 * 1024 * 1024 * 1024))
printf 'Docker root available: %s bytes. Staging threshold: %s bytes.\n' "$free" "$needed"
if (( free < needed )); then
  printf 'Insufficient Docker disk headroom. Keep the staged archive and review exact image IDs with the financial operator.\n' >&2
  exit 1
fi

mem_kib=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
if (( mem_kib < 800 * 1024 )); then
  printf 'Wait for at least 800 MiB memory available before staging or running this stack.\n' >&2
  exit 1
fi
for image in "agus-ai-api:$revision" "agus-ai-web:$revision"; do
  if docker image inspect "$image" >/dev/null 2>&1; then
    printf 'Image %s already exists. Verify it before proceeding instead of replacing it.\n' "$image" >&2
    exit 1
  fi
done
docker image load --input images.tar.gz
df -hP -- "$docker_root"
printf 'Images staged. No containers or routes were started.\n'
