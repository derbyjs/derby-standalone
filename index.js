var DerbyStandalone = require('derby/lib/DerbyStandalone');
global.derby = module.exports = new DerbyStandalone();

// Include template and expression parsing
require('derby/node_modules/derby-parsing');
