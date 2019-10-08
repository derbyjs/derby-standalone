var fs = require('fs');
var path = require('path');
var exorcist = require('exorcist');
var browserify = require('browserify');
var minifyStream = require('minify-stream');

var root = path.join(__dirname, 'dist');

// Minify and bundle
browserify({debug: true})
  .add('./index.js')
  .plugin('common-shakeify')
  .plugin('browser-pack-flat/plugin')
  .bundle()
  .pipe(minifyStream())
  .pipe(exorcist(path.join(root, 'derby-standalone.min.map.json')))
  .pipe(fs.createWriteStream(path.join(root, 'derby-standalone.min.js')));

// Bundle unminified
browserify({debug: true})
  .add('./index.js')
  .bundle()
  .pipe(exorcist(path.join(root, 'derby-standalone.map.json')))
  .pipe(fs.createWriteStream(path.join(root, 'derby-standalone.js')));

// Make this npm package version match the version of derby
var package = require('./package.json');
package.version = require('derby/package.json').version;
var packageJson = JSON.stringify(package, null, 2) + '\n';
fs.writeFileSync('./package.json', packageJson);
