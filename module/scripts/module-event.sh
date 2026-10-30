#!/system/bin/sh
# inotifyd handler for the module directory: $1 = event, $2 = dir, $3 = file.
case "$3" in
disable | remove) exec "${0%/scripts/*}/system/bin/tsctl" module-event "$1" "$3" ;;
esac
