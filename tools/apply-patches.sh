#!/usr/bin/env bash
# Applies patches/series, in order, to the pristine tree in build/src.
# On failure, the name of the offending patch is written to
# build/failed-patch so CI can report it.
#
# With --commit, the result is committed (new files included), as the base
# for writing the next patch with tools/export-patch.sh.
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

[ -d "$SRC_DIR/.git" ] || die "$SRC_DIR missing; run tools/fetch-upstream.sh first"
git -C "$SRC_DIR" diff --quiet || die "$SRC_DIR is not pristine; run tools/fetch-upstream.sh again"
rm -f "$BUILD_DIR/failed-patch"
commit=false
[ "${1:-}" = --commit ] && commit=true

count=0
while IFS= read -r patch || [ -n "$patch" ]; do
	case "$patch" in '' | '#'*) continue ;; esac
	if ! git -C "$SRC_DIR" apply --whitespace=nowarn "$ROOT/patches/$patch"; then
		echo "$patch" >"$BUILD_DIR/failed-patch"
		[ -n "${GITHUB_ACTIONS:-}" ] && echo "::error title=Patch does not apply::$patch"
		die "patch $patch does not apply to tailscale ${TS_VERSION:-}"
	fi
	echo "applied $patch"
	count=$((count + 1))
done <"$ROOT/patches/series"
echo "$count patch(es) applied"
if [ "$commit" = true ]; then
	git -C "$SRC_DIR" add -A
	git -C "$SRC_DIR" -c user.name=1orz -c user.email=noreply@github.com commit -qm "patch series" --allow-empty
	echo "committed as base"
fi
