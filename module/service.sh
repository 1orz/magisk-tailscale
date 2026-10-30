#!/system/bin/sh
# Late-start service: start tailscaled once boot has completed.
MODDIR=${0%/*}

until [ "$(getprop sys.boot_completed)" = 1 ]; do
	sleep 2
done
exec "$MODDIR/system/bin/tsctl" boot
