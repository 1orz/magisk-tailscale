#!/usr/bin/env bash
# Usage: tools/adb-deploy.sh [adb args...]
#
# Development shortcut: pushes the staged module (build/module, from
# tools/package.sh) straight into /data/adb/modules on a device or emulator
# with a root adb shell (`adb root`, e.g. a userdebug/google_apis emulator),
# then restarts the daemon. No root manager is needed.
#
# TS_TUN_MODE=tun|userspace|auto overrides the device's settings.conf.
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

STAGE="$BUILD_DIR/module"
[ -f "$STAGE/module.prop" ] || die "$STAGE missing; run tools/package.sh first"

ADB=(adb "$@")
MODDIR="/data/adb/modules/$MODULE_ID"
DATA_DIR="/data/adb/tailscale-next"

[ "$("${ADB[@]}" shell id -u | tr -d '\r')" = 0 ] || die "adb shell is not root; run: adb root"

"${ADB[@]}" shell "rm -rf /data/local/tmp/$MODULE_ID"
"${ADB[@]}" push -q "$STAGE" "/data/local/tmp/$MODULE_ID"
"${ADB[@]}" shell "
	set -e
	[ -x $MODDIR/system/bin/tsctl ] && $MODDIR/system/bin/tsctl stop >/dev/null || true
	mkdir -p /data/adb/modules $DATA_DIR/config $DATA_DIR/run
	rm -rf $MODDIR
	mv /data/local/tmp/$MODULE_ID $MODDIR
	ln -sf tailscaled $MODDIR/system/bin/tailscale
	chmod 0755 $MODDIR/*.sh $MODDIR/scripts/*.sh $MODDIR/system/bin/*
	[ -f $DATA_DIR/config/settings.conf ] || cp $MODDIR/defaults/settings.conf $DATA_DIR/config/settings.conf
	if [ -n '${TS_TUN_MODE:-}' ]; then
		sed -i 's/^TS_TUN_MODE=.*/TS_TUN_MODE=${TS_TUN_MODE:-}/' $DATA_DIR/config/settings.conf
	fi
	$MODDIR/system/bin/tsctl start
	$MODDIR/system/bin/tsctl status || true
"
