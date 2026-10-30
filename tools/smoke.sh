#!/usr/bin/env bash
# Smoke-tests build/out/tailscaled: checks it is a static arm64 binary,
# that both the daemon and the CLI personality run, and that a userspace
# daemon comes up and answers the CLI over its socket.
#
# On a non-arm64 Linux host this needs qemu-aarch64-static.
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

BIN="$OUT_DIR/tailscaled"
[ -x "$BIN" ] || die "$BIN missing; run tools/build-go.sh first"

info="$(file "$BIN")"
grep -q 'ARM aarch64' <<<"$info" || die "not an arm64 binary: $info"
grep -q 'statically linked' <<<"$info" || die "not statically linked: $info"

run() {
	if [ "$(uname -m)" = aarch64 ]; then
		"$@"
	else
		qemu-aarch64-static "$@"
	fi
}

tmp="$(mktemp -d)"
daemon=""
cleanup() {
	if [ -n "$daemon" ]; then
		kill "$daemon" 2>/dev/null || true
	fi
	rm -rf "$tmp"
}
trap cleanup EXIT

echo "== tailscaled --version"
run "$BIN" --version

# The combined binary acts as the CLI when invoked as "tailscale".
ln -s "$BIN" "$tmp/tailscale"
echo "== tailscale version"
run "$tmp/tailscale" version

echo "== userspace daemon"
run "$BIN" --tun=userspace-networking --statedir="$tmp/state" \
	--socket="$tmp/tailscaled.sock" --port=0 --no-logs-no-support \
	>"$tmp/tailscaled.log" 2>&1 &
daemon=$!

for _ in $(seq 60); do
	[ -S "$tmp/tailscaled.sock" ] && break
	kill -0 "$daemon" 2>/dev/null || break
	sleep 1
done
if [ ! -S "$tmp/tailscaled.sock" ]; then
	cat "$tmp/tailscaled.log"
	die "daemon did not create its socket"
fi

state=""
for _ in $(seq 30); do
	state="$(run "$tmp/tailscale" --socket="$tmp/tailscaled.sock" status --json 2>/dev/null | jq -r .BackendState || true)"
	[ "$state" = NeedsLogin ] && break
	sleep 1
done
echo "BackendState=$state"
if [ "$state" != NeedsLogin ]; then
	cat "$tmp/tailscaled.log"
	die "unexpected backend state: ${state:-<none>}"
fi
echo "smoke test passed"
