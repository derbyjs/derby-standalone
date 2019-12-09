// Includes full template and expression parsing in bundle
var parsing = require('derby/parsing');
var path = require('path');
var DerbyStandalone = require('derby/lib/DerbyStandalone');
var derby = new DerbyStandalone();
var App = derby.App;

global.derby = module.exports = derby;

// Can be overriden to customize how templates are loaded. However, it must be
// synchronous, because app.loadViews() is synchronous
App.prototype.getTemplate = function(filename) {
  return document.getElementById(filename);
};

App.prototype.loadViews = function(filename, namespace) {
  var resolved = this._resolveTemplate(filename);
  if (!resolved) {
    throw new Error('Cannot find template "' + filename + '"');
  }
  this._registerTemplate(resolved.template, namespace, resolved.filename);
};

App.prototype._registerTemplate = function(template, namespace, filename) {
  var file = typeof template === 'string' ? template : template.innerHTML;
  var app = this;
  function onImport(attrs) {
    var dir = path.dirname(filename);
    var sourceFilename = path.resolve(dir, attrs.src);
    var resolved = app._resolveTemplate(sourceFilename);
    if (!resolved) {
      throw new Error('Cannot find template "' + attrs.src + '" from "' + filename + '"');
    }
    importNamespace = parsing.getImportNamespace(namespace, attrs, resolved.filename);
    app._registerTemplate(resolved.template, importNamespace, resolved.filename);
  }
  var items = parsing.parseViews(file, namespace, filename, onImport);
  parsing.registerParsedViews(this, items);
};

App.prototype._resolveTemplate = function(filename) {
  var resolved;
  resolved = this._attemptResolveTemplate(filename);
  if (resolved) return resolved;
  resolved = this._attemptResolveTemplate(filename + '.html');
  if (resolved) return resolved;
  resolved = this._attemptResolveTemplate(filename + '/index');
  if (resolved) return resolved;
  resolved = this._attemptResolveTemplate(filename + '/index.html');
  return resolved;
};

App.prototype._attemptResolveTemplate = function(filename) {
  var template = this.getTemplate(filename);
  if (template) return {template: template, filename: filename};
};

// DEPRECATED: This function is a legacy format that should be removed. Use
// loadViews() instead.
App.prototype.registerViews = function(selector) {
  selector || (selector = 'script[type="text/template"]');
  var templates = document.querySelectorAll(selector);
  for (var i = 0; i < templates.length; i++) {
    var template = templates[i];
    this.views.register(template.id, template.innerHTML, template.dataset);
  }
};
