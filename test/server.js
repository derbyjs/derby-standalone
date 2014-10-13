var fs = require('fs');
var path = require('path');
var browserify = require('browserify');
var express = require('express');

var app = express();

app.use(express.static('../example'));

app.get('/derby-standalone.js', function(req, res, next) {
  var b = browserify();
  b.add('../index');
  b.bundle().pipe(res);
});

var port = process.env.PORT || 7777;
app.listen(port, function(err) {
  console.log('Derby test server running at http://localhost:' + port);
});
