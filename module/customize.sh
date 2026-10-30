# shellcheck shell=sh
# Installer, sourced by the Magisk / KernelSU / APatch module installer with
# MODPATH, ZIPFILE, ARCH, BOOTMODE and the ui_print/abort/set_perm helpers
# in scope.

SKIPUNZIP=1

DATA_DIR=/data/adb/tailscale-next
LEGACY_ID=magisk-tailscaled
LEGACY_DATA_DIR=/data/adb/tailscale

[ "$BOOTMODE" = true ] || abort "! Install from the Magisk, KernelSU or APatch app; recovery is not supported."
[ "$ARCH" = arm64 ] || abort "! Unsupported architecture: $ARCH. Only arm64 is supported."

if [ "$KSU" = true ]; then
	ui_print "- KernelSU $KSU_VER ($KSU_VER_CODE)"
elif [ "$APATCH" = true ]; then
	ui_print "- APatch $APATCH_VER ($APATCH_VER_CODE)"
else
	ui_print "- Magisk $MAGISK_VER ($MAGISK_VER_CODE)"
fi

ui_print "- Extracting module files"
unzip -o "$ZIPFILE" -x 'META-INF/*' -d "$MODPATH" >&2 || abort "! Unable to extract module files"
ln -sf tailscaled "$MODPATH/system/bin/tailscale"

ui_print "- Preparing $DATA_DIR"
mkdir -p "$DATA_DIR/state" "$DATA_DIR/config" "$DATA_DIR/run" "$DATA_DIR/logs"
chmod 0700 "$DATA_DIR"
if [ ! -f "$DATA_DIR/config/settings.conf" ]; then
	cp "$MODPATH/defaults/settings.conf" "$DATA_DIR/config/settings.conf"
fi

# The legacy magisk-tailscaled module runs its own tailscaled on the same
# port. Carry its login over so this node keeps its identity, and disable
# it: two daemons sharing one identity would fight over the node.
if [ -d "/data/adb/modules/$LEGACY_ID" ]; then
	if [ ! -f "$DATA_DIR/state/tailscaled.state" ]; then
		for f in "$LEGACY_DATA_DIR/tailscaled.state" "$LEGACY_DATA_DIR/tmp/tailscaled.state"; do
			if [ -f "$f" ]; then
				ui_print "- Migrating login state from $LEGACY_ID"
				cp -p "$f" "$DATA_DIR/state/tailscaled.state"
				break
			fi
		done
	fi
	if [ ! -f "/data/adb/modules/$LEGACY_ID/disable" ]; then
		ui_print "- Disabling the $LEGACY_ID module; uninstall it when convenient"
		touch "/data/adb/modules/$LEGACY_ID/disable"
	fi
fi

ui_print "- Setting permissions"
# KernelSU and APatch set the WebUI's (webroot/) permissions and SELinux
# context themselves; set_perm would relabel it as system_file.
for f in "$MODPATH"/*; do
	[ "${f##*/}" = webroot ] && continue
	if [ -d "$f" ]; then
		set_perm_recursive "$f" 0 0 0755 0644
	else
		set_perm "$f" 0 0 0644
	fi
done
set_perm "$MODPATH" 0 0 0755
set_perm_recursive "$MODPATH/system/bin" 0 0 0755 0755
set_perm_recursive "$MODPATH/scripts" 0 0 0755 0755
for f in "$MODPATH"/*.sh; do
	set_perm "$f" 0 0 0755
done

ui_print "- Done. Reboot, then log in from the module's WebUI"
ui_print "  (KernelSU / APatch), or from a root shell:"
ui_print "    su -c tailscale up"
ui_print "  Manage the service with: su -c tsctl status"
