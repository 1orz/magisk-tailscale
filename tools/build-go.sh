#!/usr/bin/env bash
# Builds the combined tailscaled+tailscale binary from the patched tree in
# build/src into build/out/tailscaled.
#
# GO selects the go command. It defaults to upstream's ./tool/go, which
# fetches the exact Tailscale Go toolchain the release was built with.
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
load_lock
# shellcheck source=../build.conf
. "$ROOT/build.conf"

[ -d "$SRC_DIR" ] || die "$SRC_DIR missing; run tools/fetch-upstream.sh first"
cd "$SRC_DIR" || exit
GO="${GO:-./tool/go}"

omit="$(echo "$TS_OMIT_FEATURES" | xargs | tr " " ",")"
tags="ts_include_cli,$(GOOS="" GOARCH="" CGO_ENABLED=0 $GO run ./cmd/featuretags --remove "$omit")"

eval "$(GOOS="" GOARCH="" CGO_ENABLED=0 $GO run ./cmd/mkversion)"
ldflags="-X tailscale.com/version.longStamp=${VERSION_LONG}"
ldflags+=" -X tailscale.com/version.shortStamp=${VERSION_SHORT}"
ldflags+=" -X tailscale.com/version.gitCommitStamp=${VERSION_GIT_HASH}"
ldflags+=" -s -w"

mkdir -p "$OUT_DIR"
echo "Building tailscaled $VERSION_LONG for $GOOS/$GOARCH"
echo "tags: $tags"
GOOS="$GOOS" GOARCH="$GOARCH" CGO_ENABLED=0 \
	$GO build -trimpath -tags="$tags" -ldflags="$ldflags" -o "$OUT_DIR/tailscaled" ./cmd/tailscaled

cat >"$OUT_DIR/buildinfo.txt" <<EOF
tailscale=$VERSION_LONG
commit=$VERSION_GIT_HASH
target=$GOOS/$GOARCH
module=$(module_version)
tags=$tags
EOF
ls -l "$OUT_DIR/tailscaled"
