#!/usr/bin/env bash
# Vets (for the Android target) and unit-tests (on the host) every Go
# package touched by patches/, so a patch that still applies but no
# longer compiles or breaks upstream's tests fails before packaging.
#
# Some upstream tests can't pass in every environment (e.g. linuxfw's need
# CAP_NET_ADMIN for network namespaces). When tests fail, the same packages
# are tested on the pristine upstream tree too, and only failures the
# patches introduced count.
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
load_lock
# shellcheck source=../build.conf
. "$ROOT/build.conf"

[ -d "$SRC_DIR" ] || die "$SRC_DIR missing; run tools/fetch-upstream.sh first"
GO="${GO:-./tool/go}"

pkgs=()
while IFS= read -r pkg; do
	pkgs+=("$pkg")
done < <(sed -n 's|^+++ b/\(.*\)/[^/]*\.go$|./\1|p' "$ROOT"/patches/*.patch | sort -u)
if [ "${#pkgs[@]}" -eq 0 ]; then
	echo "no patched Go packages"
	exit 0
fi

cd "$SRC_DIR" || exit
echo "Patched packages: ${pkgs[*]}"
GOOS="$GOOS" GOARCH="$GOARCH" CGO_ENABLED=0 $GO vet "${pkgs[@]}"

# failures DIR LOG tests the packages in DIR, writing the output to LOG and
# the sorted names of failing tests (or packages that didn't build) to stdout.
failures() {
	(cd "$1" && $GO test -count=1 "${pkgs[@]}" >"$2" 2>&1) || true
	sed -nE -e 's/^--- FAIL: ([^ ]*).*/\1/p' \
		-e 's/^FAIL[[:space:]]+([^ ]+) \[(build|setup) failed\]/\1/p' "$2" | sort -u
}

patched="$(failures "$SRC_DIR" "$BUILD_DIR/test-patched.log")"
if [ -z "$patched" ]; then
	grep -E '^(ok|FAIL|\?)' "$BUILD_DIR/test-patched.log" || true
	echo "all tests passed"
	exit 0
fi

echo "Failing on the patched tree: $(echo "$patched" | tr '\n' ' ')"
echo "Testing the pristine tree for comparison..."
BASE_DIR="$BUILD_DIR/baseline"
git -C "$SRC_DIR" worktree remove --force "$BASE_DIR" 2>/dev/null || rm -rf "$BASE_DIR"
git -C "$SRC_DIR" worktree add -q --detach "$BASE_DIR" "$TS_COMMIT"
baseline="$(failures "$BASE_DIR" "$BUILD_DIR/test-baseline.log")"
git -C "$SRC_DIR" worktree remove --force "$BASE_DIR"

introduced="$(comm -13 <(echo "$baseline") <(echo "$patched"))"
if [ -n "$introduced" ]; then
	grep -E -A20 "^--- FAIL: ($(echo "$introduced" | paste -sd'|' -))\b" "$BUILD_DIR/test-patched.log" || true
	die "patches introduced test failures: $(echo "$introduced" | tr '\n' ' ')"
fi
echo "No failures beyond those of pristine upstream in this environment."
