NODE_PATH ?= ./node_modules
BROWSERIFY = $(NODE_PATH)/.bin/browserify
JS_UGLIFIER = $(NODE_PATH)/uglify-js/bin/uglifyjs

all: Makefile build

#TODO make this named by the version
browserify:
	rm dist/derby-standalone.js
	$(BROWSERIFY) index.js -o dist/derby-standalone.js

uglify:
	rm dist/derby-standalone.min.js
	$(JS_UGLIFIER) dist/derby-standalone.js -o dist/derby-standalone.min.js

build: browserify uglify

