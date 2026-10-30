#!/system/bin/sh
# Runs early in boot and blocks it: keep this short, no network, no sleeps.
DATA_DIR=/data/adb/tailscale-next

mkdir -p "$DATA_DIR/run" "$DATA_DIR/logs"
rm -f "$DATA_DIR/run/"*.pid "$DATA_DIR/run/tailscaled.sock"

# wireguard-go opens /dev/net/tun, but many Android builds only have /dev/tun.
if [ ! -e /dev/net/tun ] && [ -c /dev/tun ]; then
	mkdir -p /dev/net
	ln -sf /dev/tun /dev/net/tun
fi
