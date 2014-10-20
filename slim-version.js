var DerbyStandalone = require('derby/lib/DerbyStandalone');
global.derby = module.exports = new DerbyStandalone();

module.exports.App.prototype.registerViews = function(fn) {
  fn(this.views);
};

// Include template and expression parsing
require('derby/node_modules/derby-parsing');
