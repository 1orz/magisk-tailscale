#!/usr/bin/env bash
# Checks out the upstream Tailscale source pinned in upstream.lock into
# build/src, verifying that the tag still points at the pinned commit.
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
load_lock

if [ -d "$SRC_DIR/.git" ] && [ "$(git -C "$SRC_DIR" rev-parse 'HEAD^{commit}')" = "$TS_COMMIT" ]; then
	echo "Reusing $SRC_DIR at $TS_COMMIT"
	git -C "$SRC_DIR" reset -q --hard
	git -C "$SRC_DIR" clean -qfdx
else
	rm -rf "$SRC_DIR"
	mkdir -p "$BUILD_DIR"
	echo "Cloning tailscale v$TS_VERSION"
	git -c advice.detachedHead=false clone -q --depth 1 --branch "v$TS_VERSION" "$UPSTREAM_REPO" "$SRC_DIR"
fi

actual="$(git -C "$SRC_DIR" rev-parse 'HEAD^{commit}')"
# A release tag must never move. If it did, refuse to build rather than
# silently shipping different code under the same version.
[ "$actual" = "$TS_COMMIT" ] || die "tag v$TS_VERSION is at $actual, upstream.lock pins $TS_COMMIT"
echo "tailscale v$TS_VERSION ($TS_COMMIT)"
