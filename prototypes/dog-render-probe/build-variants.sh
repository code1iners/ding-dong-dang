#!/bin/bash
# hook.patch를 적용한 채 세 가지로 빌드해 /tmp/dog-probe/<방식>/ 에 둔다. 끝나면 패치를 되돌린다.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
git apply prototypes/dog-render-probe/hook.patch
trap 'git apply -R prototypes/dog-render-probe/hook.patch' EXIT
for v in base sprite waapi; do
  rm -rf out
  if [ "$v" = base ]; then npx electron-vite build >/dev/null; else VITE_DOG_PROBE=$v npx electron-vite build >/dev/null; fi
  dest=/tmp/dog-probe/$v
  rm -rf "$dest"; mkdir -p "$dest"
  cp -R out "$dest/out"; cp package.json "$dest/"; ln -s "$ROOT/node_modules" "$dest/node_modules"
  echo "built $v"
done
