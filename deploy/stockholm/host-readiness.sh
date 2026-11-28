#!/usr/bin/env bash
set -euo pipefail

printf 'UTC snapshot: %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
printf 'Architecture: %s, available CPUs: %s\n' "$(uname -m)" "$(nproc)"
uptime
awk '/^(MemTotal|MemAvailable|SwapTotal|SwapFree):/ { print }' /proc/meminfo
printf '\nRoot filesystem and inode headroom\n'
df -hP /
df -iP /
if command -v vmstat >/dev/null; then
  printf '\nShort CPU and pressure sample (first row is since boot)\n'
  vmstat 2 4
fi
printf '\nTCP listeners\n'
ss -ltn

if command -v docker >/dev/null && docker info --format '{{.DockerRootDir}}' >/dev/null 2>&1; then
  docker_root=$(docker info --format '{{.DockerRootDir}}')
  printf '\nDocker filesystem and inode headroom\n'
  df -hP -- "$docker_root"
  df -iP -- "$docker_root"
  printf '\nRunning containers by Compose project\n'
  docker ps --format '{{.Names}}\t{{.Label "com.docker.compose.project"}}\t{{.Status}}\t{{.Ports}}'
  printf '\nContainer resource sample\n'
  docker stats --no-stream --format '{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.BlockIO}}'
  printf '\nCompose and Caddy availability\n'
  docker compose version
  if command -v caddy >/dev/null; then caddy version; fi
else
  printf '\nDocker statistics require access to the existing Docker daemon.\n'
fi
if command -v journalctl >/dev/null && command -v timeout >/dev/null; then
  printf '\nKernel OOM event count over the last 24 hours (journal permissions apply)\n'
  timeout 10 journalctl -q -k --since '24 hours ago' --no-pager |
    awk '/Out of memory|Killed process|oom-kill/ { count++ } END { print count + 0 }' ||
    printf 'Kernel history unavailable.\n'
fi
