#!/system/bin/sh
# The manager's "Action" button: toggle tailscaled and show its status.
MODDIR=${0%/*}
TSCTL=$MODDIR/system/bin/tsctl

if "$TSCTL" is-running; then
	echo "Stopping Tailscale..."
	"$TSCTL" stop
else
	echo "Starting Tailscale..."
	"$TSCTL" start
fi
echo
"$TSCTL" status
