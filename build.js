var fs = require('fs');
var path = require('path');
var exorcist = require('exorcist');
var browserify = require('browserify');
var mkdirp = require('mkdirp');
var minifyStream = require('minify-stream')

var version = require('derby/package.json').version;
var root = path.join(__dirname, 'dist', version);
mkdirp.sync(root);

browserify({debug: true})
  .add(__dirname)
  .plugin('common-shakeify')
  .plugin('browser-pack-flat/plugin')
  .bundle()
  .pipe(minifyStream())
  .pipe(exorcist(path.join(root, 'derby-standalone.min.map.json')))
  .pipe(fs.createWriteStream(path.join(root, 'derby-standalone.min.js')));

browserify({debug: true})
  .add(__dirname)
  .bundle()
  .pipe(exorcist(path.join(root, 'derby-standalone.map.json')))
  .pipe(fs.createWriteStream(path.join(root, 'derby-standalone.js')));
