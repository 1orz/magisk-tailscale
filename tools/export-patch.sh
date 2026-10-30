#!/usr/bin/env bash
# Usage: tools/export-patch.sh NAME "subject line"
#
# Commits the uncommitted changes in build/src and writes them to
# patches/NAME.patch, appending NAME.patch to patches/series if new.
# Start from a tree with the series applied and committed:
#
#   tools/fetch-upstream.sh && tools/apply-patches.sh --commit
#   ...edit build/src...
#   tools/export-patch.sh 0005-topic "pkg: what it does"
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

[ "$#" -eq 2 ] || die "usage: $0 NAME \"subject\""
name=${1%.patch}
[ -n "$(git -C "$SRC_DIR" status --porcelain)" ] || die "no changes in $SRC_DIR"
# The patch is the diff against HEAD, so HEAD must have the rest of the
# series committed, or it would be swept into this patch too.
if [ "$(git -C "$SRC_DIR" rev-parse 'HEAD^{commit}')" = "$(load_lock && echo "$TS_COMMIT")" ] &&
	grep -qv -e '^\s*$' -e '^#' -e "^$name.patch\$" "$ROOT/patches/series"; then
	die "commit the applied series first: tools/apply-patches.sh --commit"
fi

git -C "$SRC_DIR" add -A
git -C "$SRC_DIR" -c user.name=1orz -c user.email=noreply@github.com commit -qm "$2"
git -C "$SRC_DIR" format-patch -1 --stdout --no-signature --zero-commit |
	sed '/^Date: /d' >"$ROOT/patches/$name.patch"
grep -qx "$name.patch" "$ROOT/patches/series" || echo "$name.patch" >>"$ROOT/patches/series"
echo "wrote patches/$name.patch"
