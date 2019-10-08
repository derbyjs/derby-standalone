var express = require('express');
var app = express();

app.use('/dist', express.static(__dirname + '/dist'));
app.use(express.static(__dirname + '/example'));

var port = process.env.PORT || 7777;
app.listen(port, function(err) {
  console.log('Derby test server running at http://localhost:' + port);
});
