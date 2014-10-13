var DerbyStandalone = require('derby/lib/DerbyStandalone');
global.derby = module.exports = new DerbyStandalone();

module.exports.App.prototype.registerViews = function(selector) {
  selector || (selector = 'script[type="text/template"]');
  var templates = document.querySelectorAll(selector);
  for (var i = 0; i < templates.length; i++) {
    var template = templates[i];
    this.views.register(template.id, template.innerHTML, template.dataset);
  }
};

// Include template and expression parsing
require('derby/node_modules/derby-parsing');
