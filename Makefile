NODE_PATH ?= ./node_modules
BROWSERIFY = $(NODE_PATH)/.bin/browserify
JS_UGLIFIER = $(NODE_PATH)/uglify-js/bin/uglifyjs

all: Makefile build

#TODO make this named by the version
browserify:
	rm -f dist/derby-standalone.v0.js
	$(BROWSERIFY) index.js -o dist/derby-standalone.v0.js

uglify:
	rm -f dist/derby-standalone.v0.min.js
	$(JS_UGLIFIER) dist/derby-standalone.v0.js -o dist/derby-standalone.v0.min.js

build: browserify uglify

