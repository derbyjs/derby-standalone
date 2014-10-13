var fs = require('fs');
var path = require('path');
var browserify = require('browserify');
var express = require('express');
var minifyify = require('minifyify');

var app = express();

app.use(express.static('../example'));

app.get('/derby-standalone.js', function(req, res, next) {
  res.type('javascript');
  var b = browserify();
  b.add('../index');
  b.bundle({debug: true}).pipe(res);
});

var minMap;
app.get('/derby-standalone.min.js', function(req, res, next) {
  res.type('javascript');
  var b = browserify();
  b.add('../index');
  b.bundle({debug: true}).pipe(minifyify({map: 'derby-standalone.min.map.json'}, function(err, code, map) {
    if (err) return next(err);
    minMap = map;
    res.send(code);
  }));
});
app.get('/derby-standalone.min.map.json', function(req, res, next) {
  res.type('json');
  res.send(minMap);
});

var port = process.env.PORT || 7777;
app.listen(port, function(err) {
  console.log('Derby test server running at http://localhost:' + port);
});
