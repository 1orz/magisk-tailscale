#!/usr/bin/env bash
# Assembles the flashable module zip from module/, the built binary and
# (when present) the WebUI build, into dist/.
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
load_lock

BIN="$OUT_DIR/tailscaled"
[ -x "$BIN" ] || die "$BIN missing; run tools/build-go.sh first"

VERSION="$(module_version)"
VERSION_CODE="$(module_version_code)"
STAGE="$BUILD_DIR/module"
ZIP_NAME="$MODULE_ID-$VERSION-arm64.zip"

rm -rf "$STAGE"
mkdir -p "$STAGE" "$DIST_DIR"
cp -R "$ROOT/module/." "$STAGE/"
rm -f "$STAGE/module.prop.in"
sed -e "s|@VERSION@|$VERSION|" \
	-e "s|@VERSION_CODE@|$VERSION_CODE|" \
	-e "s|@TS_VERSION@|$TS_VERSION|" \
	-e "s|@GH_REPO@|$GH_REPO|" \
	"$ROOT/module/module.prop.in" >"$STAGE/module.prop"
cp "$BIN" "$STAGE/system/bin/tailscaled"
cp "$OUT_DIR/buildinfo.txt" "$STAGE/buildinfo.txt"
if [ -f "$ROOT/webui/dist/index.html" ]; then
	cp -R "$ROOT/webui/dist" "$STAGE/webroot"
elif [ -n "${CI:-}" ]; then
	die "webui/dist missing; run tools/build-webui.sh first"
else
	echo "warning: webui/dist missing; packaging without the WebUI" >&2
fi

# Fixed timestamps and sorted entries keep the zip reproducible.
rm -f "$DIST_DIR/$ZIP_NAME"
(
	cd "$STAGE"
	find . -exec touch -h -t 198001010000 {} +
	find . -type f | LC_ALL=C sort | zip -X -9 -q "$DIST_DIR/$ZIP_NAME" -@
)
(cd "$DIST_DIR" && sha256 "$ZIP_NAME" >"$ZIP_NAME.sha256")

ls -l "$DIST_DIR/$ZIP_NAME"
gh_output version "$VERSION"
gh_output version_code "$VERSION_CODE"
gh_output zip "$ZIP_NAME"
