.PHONY: all fetch patch test build package smoke clean

all: package

fetch:
	tools/fetch-upstream.sh

patch: fetch
	tools/apply-patches.sh

test: patch
	tools/test-go.sh

build: test
	tools/build-go.sh

package: build
	tools/package.sh

smoke:
	tools/smoke.sh

clean:
	rm -rf build dist
