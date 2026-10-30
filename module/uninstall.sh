#!/system/bin/sh
# Runs at boot after the module was removed in the manager.
DATA_DIR=/data/adb/tailscale-next

# The node identity (state/) and settings (config/) are kept so that a
# reinstall stays logged in. Create $DATA_DIR/purge-on-uninstall to have
# everything removed instead.
if [ -f "$DATA_DIR/purge-on-uninstall" ]; then
	rm -rf "$DATA_DIR"
else
	rm -rf "${DATA_DIR:?}/run" "${DATA_DIR:?}/logs"
fi
