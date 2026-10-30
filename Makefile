.PHONY: all fetch patch test build webui package smoke clean

all: package

fetch:
	tools/fetch-upstream.sh

patch: fetch
	tools/apply-patches.sh

test: patch
	tools/test-go.sh

build: test
	tools/build-go.sh

webui:
	tools/build-webui.sh

package: build webui
	tools/package.sh

smoke:
	tools/smoke.sh

clean:
	rm -rf build dist webui/dist
