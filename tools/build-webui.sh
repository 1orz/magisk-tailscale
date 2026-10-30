#!/usr/bin/env bash
# Builds the KernelSU / APatch WebUI into webui/dist, which
# tools/package.sh ships as the module's webroot/.
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

cd "$ROOT/webui"
npm ci --no-audit --no-fund
npm run lint
npm run build
ls -l dist
