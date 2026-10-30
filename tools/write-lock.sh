#!/usr/bin/env bash
# Usage: tools/write-lock.sh TS_VERSION TS_COMMIT MODULE_REV
# Rewrites upstream.lock with the given values.
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

[ "$#" -eq 3 ] || die "usage: $0 TS_VERSION TS_COMMIT MODULE_REV"
[[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "bad version: $1"
[[ "$2" =~ ^[0-9a-f]{40}$ ]] || die "bad commit: $2"
[[ "$3" =~ ^[0-9]+$ ]] || die "bad module rev: $3"

cat >"$ROOT/upstream.lock" <<EOF
# Upstream Tailscale release this module is built from.
# Rewritten by CI (tools/write-lock.sh); edit by hand only to pin a version.
TS_VERSION=$1
TS_COMMIT=$2
MODULE_REV=$3
EOF
cat "$ROOT/upstream.lock"
