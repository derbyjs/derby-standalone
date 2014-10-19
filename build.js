var fs = require('fs');
var path = require('path');
var exorcist = require('exorcist');
var browserify = require('browserify');
var mkdirp = require('mkdirp');

var version = require('derby/package.json').version;
var root = path.join(__dirname, 'dist', version);
mkdirp.sync(root);

browserify({debug: true})
  .require('derby-templates')
  .add(__dirname)
  .plugin('minifyify', {map: 'derby-standalone.min.map.json'})
  .bundle(function(err, src, map) {
    fs.writeFileSync(path.join(root, 'derby-standalone.min.js'), src);
    fs.writeFileSync(path.join(root, 'derby-standalone.min.map.json'), map);
  });

browserify({debug: true})
  .require('derby-templates')
  .add(__dirname)
  .bundle()
  .pipe(exorcist(path.join(root, 'derby-standalone.map.json')))
  .pipe(fs.createWriteStream(path.join(root, 'derby-standalone.js')));
