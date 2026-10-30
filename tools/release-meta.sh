#!/usr/bin/env bash
# Usage: tools/release-meta.sh REASON
# After upstream.lock has been updated for a release, writes:
#   update.json       - the root managers' update descriptor
#   changelog.md      - shown by the managers for the update
#   dist/notes.md     - GitHub release body
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
load_lock

REASON="${1:-}"
VERSION="$(module_version)"
VERSION_CODE="$(module_version_code)"
ZIP_NAME="$MODULE_ID-$VERSION-arm64.zip"
[ -f "$DIST_DIR/$ZIP_NAME" ] || die "$DIST_DIR/$ZIP_NAME missing"

cat >"$ROOT/update.json" <<EOF
{
  "version": "$VERSION",
  "versionCode": $VERSION_CODE,
  "zipUrl": "https://github.com/$GH_REPO/releases/download/$VERSION/$ZIP_NAME",
  "changelog": "https://raw.githubusercontent.com/$GH_REPO/main/changelog.md"
}
EOF

case "$REASON" in
upstream | unreleased) why="Built from Tailscale v$TS_VERSION." ;;
module) why="Module update on Tailscale v$TS_VERSION." ;;
forced) why="Rebuild of Tailscale v$TS_VERSION." ;;
*) why="Tailscale v$TS_VERSION." ;;
esac

prev="$(git -C "$ROOT" describe --tags --abbrev=0 2>/dev/null || true)"
if [ -n "$prev" ]; then
	commits="$(git -C "$ROOT" log --no-merges --format='- %s (%h)' "$prev..HEAD" -- . ':!update.json' ':!changelog.md' ':!upstream.lock')"
else
	commits=""
fi
patches="$(grep -v '^\s*\(#\|$\)' "$ROOT/patches/series" | sed 's/^/- /')"

{
	echo "## $VERSION"
	echo
	echo "$why"
	echo
	echo "Upstream notes: https://tailscale.com/changelog#client"
	if [ -n "$commits" ]; then
		echo
		echo "### Changes"
		echo "$commits"
	fi
	echo
	echo "### Patches on top of upstream"
	echo "${patches:-- (none)}"
} >"$ROOT/changelog.md"

{
	cat "$ROOT/changelog.md"
	echo
	echo "### Verify"
	echo '```'
	cat "$DIST_DIR/$ZIP_NAME.sha256"
	echo '```'
} >"$DIST_DIR/notes.md"

cat "$ROOT/update.json"
