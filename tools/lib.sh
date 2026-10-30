# shellcheck shell=bash
# Shared helpers for the build tooling. Source this file, don't execute it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${BUILD_DIR:-$ROOT/build}"
SRC_DIR="$BUILD_DIR/src"
OUT_DIR="$BUILD_DIR/out"
DIST_DIR="${DIST_DIR:-$ROOT/dist}"

UPSTREAM_REPO="https://github.com/tailscale/tailscale.git"
MODULE_ID="magisk-tailscale-next"
GH_REPO="${GH_REPO:-1orz/magisk-tailscale}"

die() {
	echo "error: $*" >&2
	exit 1
}

# gh_output KEY VALUE records a step output when running under GitHub Actions.
gh_output() {
	echo "$1=$2"
	if [ -n "${GITHUB_OUTPUT:-}" ]; then
		echo "$1=$2" >>"$GITHUB_OUTPUT"
	fi
}

load_lock() {
	# shellcheck source=../upstream.lock
	. "$ROOT/upstream.lock"
	: "${TS_VERSION:?upstream.lock: TS_VERSION missing}"
	: "${TS_COMMIT:?upstream.lock: TS_COMMIT missing}"
	: "${MODULE_REV:?upstream.lock: MODULE_REV missing}"
}

module_version() {
	echo "v${TS_VERSION}-r${MODULE_REV}"
}

# module_version_code packs MAJOR.MINOR.PATCH-rREV into a monotonically
# increasing integer: 1.104.4-r1 -> 11040401.
module_version_code() {
	local major minor patch
	IFS=. read -r major minor patch <<<"$TS_VERSION"
	if [ "$minor" -ge 1000 ] || [ "$patch" -ge 100 ] || [ "$MODULE_REV" -lt 1 ] || [ "$MODULE_REV" -ge 100 ]; then
		die "version $TS_VERSION-r$MODULE_REV does not fit the versionCode scheme"
	fi
	echo $((major * 10000000 + minor * 10000 + patch * 100 + MODULE_REV))
}

# version_gt A B reports whether dotted version A is newer than B.
version_gt() {
	[ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -n1)" = "$1" ]
}

sha256() {
	if command -v sha256sum >/dev/null 2>&1; then
		sha256sum "$@"
	else
		shasum -a 256 "$@"
	fi
}
