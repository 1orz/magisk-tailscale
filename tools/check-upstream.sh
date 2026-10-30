#!/usr/bin/env bash
# Decides whether a release is due, and of what.
#
#   upstream   - Tailscale published a newer stable release: build it as r1.
#   unreleased - the version in upstream.lock was never tagged here.
#   module     - module/patch/WebUI changes landed since the last tag: rN+1.
#   forced     - FORCE=true: rebuild the current version as rN+1.
#
# Tailscale's stable releases have an even minor version; odd minors are
# the unstable track and are ignored.
#
# Outputs (stdout, and $GITHUB_OUTPUT under Actions): release, reason,
# ts_version, ts_commit, module_rev.
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
load_lock

# Paths whose changes alter what ships in the zip.
RELEASE_PATHS=(module patches webui build.conf tools/build-go.sh tools/package.sh)

latest="$(
	git ls-remote --tags --refs "$UPSTREAM_REPO" 'v*' |
		sed -n 's|.*refs/tags/v\([0-9]*\.[0-9]*[02468]\.[0-9]*\)$|\1|p' |
		sort -V | tail -n1
)"
[ -n "$latest" ] || die "could not list upstream tags"
echo "upstream latest stable: $latest, locked: $TS_VERSION-r$MODULE_REV"

release=false reason="" version="$TS_VERSION" commit="$TS_COMMIT" rev="$MODULE_REV"
tag="$(module_version)"

if version_gt "$latest" "$TS_VERSION"; then
	release=true reason=upstream version="$latest" rev=1
	commit="$(git ls-remote "$UPSTREAM_REPO" "refs/tags/v$latest^{}" | cut -f1)"
	[ -n "$commit" ] || commit="$(git ls-remote "$UPSTREAM_REPO" "refs/tags/v$latest" | cut -f1)"
	[ -n "$commit" ] || die "could not resolve v$latest"
elif ! git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
	release=true reason=unreleased
elif [ "${FORCE:-false}" = true ]; then
	release=true reason=forced rev=$((MODULE_REV + 1))
elif ! git diff --quiet "$tag" HEAD -- "${RELEASE_PATHS[@]}"; then
	release=true reason=module rev=$((MODULE_REV + 1))
fi

gh_output release "$release"
gh_output reason "$reason"
gh_output ts_version "$version"
gh_output ts_commit "$commit"
gh_output module_rev "$rev"
