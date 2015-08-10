(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wYXRoLWJyb3dzZXJpZnkvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbi8vIHJlc29sdmVzIC4gYW5kIC4uIGVsZW1lbnRzIGluIGEgcGF0aCBhcnJheSB3aXRoIGRpcmVjdG9yeSBuYW1lcyB0aGVyZVxuLy8gbXVzdCBiZSBubyBzbGFzaGVzLCBlbXB0eSBlbGVtZW50cywgb3IgZGV2aWNlIG5hbWVzIChjOlxcKSBpbiB0aGUgYXJyYXlcbi8vIChzbyBhbHNvIG5vIGxlYWRpbmcgYW5kIHRyYWlsaW5nIHNsYXNoZXMgLSBpdCBkb2VzIG5vdCBkaXN0aW5ndWlzaFxuLy8gcmVsYXRpdmUgYW5kIGFic29sdXRlIHBhdGhzKVxuZnVuY3Rpb24gbm9ybWFsaXplQXJyYXkocGFydHMsIGFsbG93QWJvdmVSb290KSB7XG4gIC8vIGlmIHRoZSBwYXRoIHRyaWVzIHRvIGdvIGFib3ZlIHRoZSByb290LCBgdXBgIGVuZHMgdXAgPiAwXG4gIHZhciB1cCA9IDA7XG4gIGZvciAodmFyIGkgPSBwYXJ0cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIHZhciBsYXN0ID0gcGFydHNbaV07XG4gICAgaWYgKGxhc3QgPT09ICcuJykge1xuICAgICAgcGFydHMuc3BsaWNlKGksIDEpO1xuICAgIH0gZWxzZSBpZiAobGFzdCA9PT0gJy4uJykge1xuICAgICAgcGFydHMuc3BsaWNlKGksIDEpO1xuICAgICAgdXArKztcbiAgICB9IGVsc2UgaWYgKHVwKSB7XG4gICAgICBwYXJ0cy5zcGxpY2UoaSwgMSk7XG4gICAgICB1cC0tO1xuICAgIH1cbiAgfVxuXG4gIC8vIGlmIHRoZSBwYXRoIGlzIGFsbG93ZWQgdG8gZ28gYWJvdmUgdGhlIHJvb3QsIHJlc3RvcmUgbGVhZGluZyAuLnNcbiAgaWYgKGFsbG93QWJvdmVSb290KSB7XG4gICAgZm9yICg7IHVwLS07IHVwKSB7XG4gICAgICBwYXJ0cy51bnNoaWZ0KCcuLicpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBwYXJ0cztcbn1cblxuLy8gU3BsaXQgYSBmaWxlbmFtZSBpbnRvIFtyb290LCBkaXIsIGJhc2VuYW1lLCBleHRdLCB1bml4IHZlcnNpb25cbi8vICdyb290JyBpcyBqdXN0IGEgc2xhc2gsIG9yIG5vdGhpbmcuXG52YXIgc3BsaXRQYXRoUmUgPVxuICAgIC9eKFxcLz98KShbXFxzXFxTXSo/KSgoPzpcXC57MSwyfXxbXlxcL10rP3wpKFxcLlteLlxcL10qfCkpKD86W1xcL10qKSQvO1xudmFyIHNwbGl0UGF0aCA9IGZ1bmN0aW9uKGZpbGVuYW1lKSB7XG4gIHJldHVybiBzcGxpdFBhdGhSZS5leGVjKGZpbGVuYW1lKS5zbGljZSgxKTtcbn07XG5cbi8vIHBhdGgucmVzb2x2ZShbZnJvbSAuLi5dLCB0bylcbi8vIHBvc2l4IHZlcnNpb25cbmV4cG9ydHMucmVzb2x2ZSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgcmVzb2x2ZWRQYXRoID0gJycsXG4gICAgICByZXNvbHZlZEFic29sdXRlID0gZmFsc2U7XG5cbiAgZm9yICh2YXIgaSA9IGFyZ3VtZW50cy5sZW5ndGggLSAxOyBpID49IC0xICYmICFyZXNvbHZlZEFic29sdXRlOyBpLS0pIHtcbiAgICB2YXIgcGF0aCA9IChpID49IDApID8gYXJndW1lbnRzW2ldIDogcHJvY2Vzcy5jd2QoKTtcblxuICAgIC8vIFNraXAgZW1wdHkgYW5kIGludmFsaWQgZW50cmllc1xuICAgIGlmICh0eXBlb2YgcGF0aCAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50cyB0byBwYXRoLnJlc29sdmUgbXVzdCBiZSBzdHJpbmdzJyk7XG4gICAgfSBlbHNlIGlmICghcGF0aCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgcmVzb2x2ZWRQYXRoID0gcGF0aCArICcvJyArIHJlc29sdmVkUGF0aDtcbiAgICByZXNvbHZlZEFic29sdXRlID0gcGF0aC5jaGFyQXQoMCkgPT09ICcvJztcbiAgfVxuXG4gIC8vIEF0IHRoaXMgcG9pbnQgdGhlIHBhdGggc2hvdWxkIGJlIHJlc29sdmVkIHRvIGEgZnVsbCBhYnNvbHV0ZSBwYXRoLCBidXRcbiAgLy8gaGFuZGxlIHJlbGF0aXZlIHBhdGhzIHRvIGJlIHNhZmUgKG1pZ2h0IGhhcHBlbiB3aGVuIHByb2Nlc3MuY3dkKCkgZmFpbHMpXG5cbiAgLy8gTm9ybWFsaXplIHRoZSBwYXRoXG4gIHJlc29sdmVkUGF0aCA9IG5vcm1hbGl6ZUFycmF5KGZpbHRlcihyZXNvbHZlZFBhdGguc3BsaXQoJy8nKSwgZnVuY3Rpb24ocCkge1xuICAgIHJldHVybiAhIXA7XG4gIH0pLCAhcmVzb2x2ZWRBYnNvbHV0ZSkuam9pbignLycpO1xuXG4gIHJldHVybiAoKHJlc29sdmVkQWJzb2x1dGUgPyAnLycgOiAnJykgKyByZXNvbHZlZFBhdGgpIHx8ICcuJztcbn07XG5cbi8vIHBhdGgubm9ybWFsaXplKHBhdGgpXG4vLyBwb3NpeCB2ZXJzaW9uXG5leHBvcnRzLm5vcm1hbGl6ZSA9IGZ1bmN0aW9uKHBhdGgpIHtcbiAgdmFyIGlzQWJzb2x1dGUgPSBleHBvcnRzLmlzQWJzb2x1dGUocGF0aCksXG4gICAgICB0cmFpbGluZ1NsYXNoID0gc3Vic3RyKHBhdGgsIC0xKSA9PT0gJy8nO1xuXG4gIC8vIE5vcm1hbGl6ZSB0aGUgcGF0aFxuICBwYXRoID0gbm9ybWFsaXplQXJyYXkoZmlsdGVyKHBhdGguc3BsaXQoJy8nKSwgZnVuY3Rpb24ocCkge1xuICAgIHJldHVybiAhIXA7XG4gIH0pLCAhaXNBYnNvbHV0ZSkuam9pbignLycpO1xuXG4gIGlmICghcGF0aCAmJiAhaXNBYnNvbHV0ZSkge1xuICAgIHBhdGggPSAnLic7XG4gIH1cbiAgaWYgKHBhdGggJiYgdHJhaWxpbmdTbGFzaCkge1xuICAgIHBhdGggKz0gJy8nO1xuICB9XG5cbiAgcmV0dXJuIChpc0Fic29sdXRlID8gJy8nIDogJycpICsgcGF0aDtcbn07XG5cbi8vIHBvc2l4IHZlcnNpb25cbmV4cG9ydHMuaXNBYnNvbHV0ZSA9IGZ1bmN0aW9uKHBhdGgpIHtcbiAgcmV0dXJuIHBhdGguY2hhckF0KDApID09PSAnLyc7XG59O1xuXG4vLyBwb3NpeCB2ZXJzaW9uXG5leHBvcnRzLmpvaW4gPSBmdW5jdGlvbigpIHtcbiAgdmFyIHBhdGhzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAwKTtcbiAgcmV0dXJuIGV4cG9ydHMubm9ybWFsaXplKGZpbHRlcihwYXRocywgZnVuY3Rpb24ocCwgaW5kZXgpIHtcbiAgICBpZiAodHlwZW9mIHAgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudHMgdG8gcGF0aC5qb2luIG11c3QgYmUgc3RyaW5ncycpO1xuICAgIH1cbiAgICByZXR1cm4gcDtcbiAgfSkuam9pbignLycpKTtcbn07XG5cblxuLy8gcGF0aC5yZWxhdGl2ZShmcm9tLCB0bylcbi8vIHBvc2l4IHZlcnNpb25cbmV4cG9ydHMucmVsYXRpdmUgPSBmdW5jdGlvbihmcm9tLCB0bykge1xuICBmcm9tID0gZXhwb3J0cy5yZXNvbHZlKGZyb20pLnN1YnN0cigxKTtcbiAgdG8gPSBleHBvcnRzLnJlc29sdmUodG8pLnN1YnN0cigxKTtcblxuICBmdW5jdGlvbiB0cmltKGFycikge1xuICAgIHZhciBzdGFydCA9IDA7XG4gICAgZm9yICg7IHN0YXJ0IDwgYXJyLmxlbmd0aDsgc3RhcnQrKykge1xuICAgICAgaWYgKGFycltzdGFydF0gIT09ICcnKSBicmVhaztcbiAgICB9XG5cbiAgICB2YXIgZW5kID0gYXJyLmxlbmd0aCAtIDE7XG4gICAgZm9yICg7IGVuZCA+PSAwOyBlbmQtLSkge1xuICAgICAgaWYgKGFycltlbmRdICE9PSAnJykgYnJlYWs7XG4gICAgfVxuXG4gICAgaWYgKHN0YXJ0ID4gZW5kKSByZXR1cm4gW107XG4gICAgcmV0dXJuIGFyci5zbGljZShzdGFydCwgZW5kIC0gc3RhcnQgKyAxKTtcbiAgfVxuXG4gIHZhciBmcm9tUGFydHMgPSB0cmltKGZyb20uc3BsaXQoJy8nKSk7XG4gIHZhciB0b1BhcnRzID0gdHJpbSh0by5zcGxpdCgnLycpKTtcblxuICB2YXIgbGVuZ3RoID0gTWF0aC5taW4oZnJvbVBhcnRzLmxlbmd0aCwgdG9QYXJ0cy5sZW5ndGgpO1xuICB2YXIgc2FtZVBhcnRzTGVuZ3RoID0gbGVuZ3RoO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGZyb21QYXJ0c1tpXSAhPT0gdG9QYXJ0c1tpXSkge1xuICAgICAgc2FtZVBhcnRzTGVuZ3RoID0gaTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHZhciBvdXRwdXRQYXJ0cyA9IFtdO1xuICBmb3IgKHZhciBpID0gc2FtZVBhcnRzTGVuZ3RoOyBpIDwgZnJvbVBhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgb3V0cHV0UGFydHMucHVzaCgnLi4nKTtcbiAgfVxuXG4gIG91dHB1dFBhcnRzID0gb3V0cHV0UGFydHMuY29uY2F0KHRvUGFydHMuc2xpY2Uoc2FtZVBhcnRzTGVuZ3RoKSk7XG5cbiAgcmV0dXJuIG91dHB1dFBhcnRzLmpvaW4oJy8nKTtcbn07XG5cbmV4cG9ydHMuc2VwID0gJy8nO1xuZXhwb3J0cy5kZWxpbWl0ZXIgPSAnOic7XG5cbmV4cG9ydHMuZGlybmFtZSA9IGZ1bmN0aW9uKHBhdGgpIHtcbiAgdmFyIHJlc3VsdCA9IHNwbGl0UGF0aChwYXRoKSxcbiAgICAgIHJvb3QgPSByZXN1bHRbMF0sXG4gICAgICBkaXIgPSByZXN1bHRbMV07XG5cbiAgaWYgKCFyb290ICYmICFkaXIpIHtcbiAgICAvLyBObyBkaXJuYW1lIHdoYXRzb2V2ZXJcbiAgICByZXR1cm4gJy4nO1xuICB9XG5cbiAgaWYgKGRpcikge1xuICAgIC8vIEl0IGhhcyBhIGRpcm5hbWUsIHN0cmlwIHRyYWlsaW5nIHNsYXNoXG4gICAgZGlyID0gZGlyLnN1YnN0cigwLCBkaXIubGVuZ3RoIC0gMSk7XG4gIH1cblxuICByZXR1cm4gcm9vdCArIGRpcjtcbn07XG5cblxuZXhwb3J0cy5iYXNlbmFtZSA9IGZ1bmN0aW9uKHBhdGgsIGV4dCkge1xuICB2YXIgZiA9IHNwbGl0UGF0aChwYXRoKVsyXTtcbiAgLy8gVE9ETzogbWFrZSB0aGlzIGNvbXBhcmlzb24gY2FzZS1pbnNlbnNpdGl2ZSBvbiB3aW5kb3dzP1xuICBpZiAoZXh0ICYmIGYuc3Vic3RyKC0xICogZXh0Lmxlbmd0aCkgPT09IGV4dCkge1xuICAgIGYgPSBmLnN1YnN0cigwLCBmLmxlbmd0aCAtIGV4dC5sZW5ndGgpO1xuICB9XG4gIHJldHVybiBmO1xufTtcblxuXG5leHBvcnRzLmV4dG5hbWUgPSBmdW5jdGlvbihwYXRoKSB7XG4gIHJldHVybiBzcGxpdFBhdGgocGF0aClbM107XG59O1xuXG5mdW5jdGlvbiBmaWx0ZXIgKHhzLCBmKSB7XG4gICAgaWYgKHhzLmZpbHRlcikgcmV0dXJuIHhzLmZpbHRlcihmKTtcbiAgICB2YXIgcmVzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB4cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoZih4c1tpXSwgaSwgeHMpKSByZXMucHVzaCh4c1tpXSk7XG4gICAgfVxuICAgIHJldHVybiByZXM7XG59XG5cbi8vIFN0cmluZy5wcm90b3R5cGUuc3Vic3RyIC0gbmVnYXRpdmUgaW5kZXggZG9uJ3Qgd29yayBpbiBJRThcbnZhciBzdWJzdHIgPSAnYWInLnN1YnN0cigtMSkgPT09ICdiJ1xuICAgID8gZnVuY3Rpb24gKHN0ciwgc3RhcnQsIGxlbikgeyByZXR1cm4gc3RyLnN1YnN0cihzdGFydCwgbGVuKSB9XG4gICAgOiBmdW5jdGlvbiAoc3RyLCBzdGFydCwgbGVuKSB7XG4gICAgICAgIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gc3RyLmxlbmd0aCArIHN0YXJ0O1xuICAgICAgICByZXR1cm4gc3RyLnN1YnN0cihzdGFydCwgbGVuKTtcbiAgICB9XG47XG4iXX0=
},{"_process":3}],3:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canMutationObserver = typeof window !== 'undefined'
    && window.MutationObserver;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    var queue = [];

    if (canMutationObserver) {
        var hiddenDiv = document.createElement("div");
        var observer = new MutationObserver(function () {
            var queueList = queue.slice();
            queue.length = 0;
            queueList.forEach(function (fn) {
                fn();
            });
        });

        observer.observe(hiddenDiv, { attributes: true });

        return function nextTick(fn) {
            if (!queue.length) {
                hiddenDiv.setAttribute('yes', 'no');
            }
            queue.push(fn);
        };
    }

    if (canPost) {
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],4:[function(require,module,exports){
(function (global){
/*! http://mths.be/punycode v1.2.4 by @mathias */
;(function(root) {

	/** Detect free variables */
	var freeExports = typeof exports == 'object' && exports;
	var freeModule = typeof module == 'object' && module &&
		module.exports == freeExports && module;
	var freeGlobal = typeof global == 'object' && global;
	if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
		root = freeGlobal;
	}

	/**
	 * The `punycode` object.
	 * @name punycode
	 * @type Object
	 */
	var punycode,

	/** Highest positive signed 32-bit float value */
	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'

	/** Regular expressions */
	regexPunycode = /^xn--/,
	regexNonASCII = /[^ -~]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /\x2E|\u3002|\uFF0E|\uFF61/g, // RFC 3490 separators

	/** Error messages */
	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},

	/** Convenience shortcuts */
	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,

	/** Temporary variable */
	key;

	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw RangeError(errors[type]);
	}

	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */
	function map(array, fn) {
		var length = array.length;
		while (length--) {
			array[length] = fn(array[length]);
		}
		return array;
	}

	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings.
	 * @private
	 * @param {String} domain The domain name.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */
	function mapDomain(string, fn) {
		return map(string.split(regexSeparators), fn).join('.');
	}

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <http://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */
	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}

	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	function digitToBasic(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * http://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}

	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	function decode(input) {
		// Don't use UCS-2
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,
		    /** Cached calculation results */
		    baseMinusT;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output
			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}

	/**
	 * Converts a string of Unicode symbols to a Punycode string of ASCII-only
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */
	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],
		    /** `inputLength` will hold the number of code points in `input`. */
		    inputLength,
		    /** Cached calculation results */
		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		// Convert the input in UCS-2 to Unicode
		input = ucs2decode(input);

		// Cache the length
		inputLength = input.length;

		// Initialize the state
		n = initialN;
		delta = 0;
		bias = initialBias;

		// Handle the basic code points
		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;

		// `handledCPCount` is the number of code points that have been handled;
		// `basicLength` is the number of basic code points.

		// Finish the basic string - if it is not empty - with a delimiter
		if (basicLength) {
			output.push(delimiter);
		}

		// Main encoding loop:
		while (handledCPCount < inputLength) {

			// All non-basic code points < n have been handled already. Find the next
			// larger one:
			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
			// but guard against overflow
			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					// Represent delta as a generalized variable-length integer
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}

	/**
	 * Converts a Punycode string representing a domain name to Unicode. Only the
	 * Punycoded parts of the domain name will be converted, i.e. it doesn't
	 * matter if you call it on a string that has already been converted to
	 * Unicode.
	 * @memberOf punycode
	 * @param {String} domain The Punycode domain name to convert to Unicode.
	 * @returns {String} The Unicode representation of the given Punycode
	 * string.
	 */
	function toUnicode(domain) {
		return mapDomain(domain, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}

	/**
	 * Converts a Unicode string representing a domain name to Punycode. Only the
	 * non-ASCII parts of the domain name will be converted, i.e. it doesn't
	 * matter if you call it with a domain that's already in ASCII.
	 * @memberOf punycode
	 * @param {String} domain The domain name to convert, as a Unicode string.
	 * @returns {String} The Punycode representation of the given domain name.
	 */
	function toASCII(domain) {
		return mapDomain(domain, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}

	/*--------------------------------------------------------------------------*/

	/** Define the public API */
	punycode = {
		/**
		 * A string representing the current Punycode.js version number.
		 * @memberOf punycode
		 * @type String
		 */
		'version': '1.2.4',
		/**
		 * An object of methods to convert from JavaScript's internal character
		 * representation (UCS-2) to Unicode code points, and back.
		 * @see <http://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode
		 * @type Object
		 */
		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};

	/** Expose `punycode` */
	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define('punycode', function() {
			return punycode;
		});
	} else if (freeExports && !freeExports.nodeType) {
		if (freeModule) { // in Node.js or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else { // in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else { // in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wdW55Y29kZS9wdW55Y29kZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIi8qISBodHRwOi8vbXRocy5iZS9wdW55Y29kZSB2MS4yLjQgYnkgQG1hdGhpYXMgKi9cbjsoZnVuY3Rpb24ocm9vdCkge1xuXG5cdC8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZXMgKi9cblx0dmFyIGZyZWVFeHBvcnRzID0gdHlwZW9mIGV4cG9ydHMgPT0gJ29iamVjdCcgJiYgZXhwb3J0cztcblx0dmFyIGZyZWVNb2R1bGUgPSB0eXBlb2YgbW9kdWxlID09ICdvYmplY3QnICYmIG1vZHVsZSAmJlxuXHRcdG1vZHVsZS5leHBvcnRzID09IGZyZWVFeHBvcnRzICYmIG1vZHVsZTtcblx0dmFyIGZyZWVHbG9iYWwgPSB0eXBlb2YgZ2xvYmFsID09ICdvYmplY3QnICYmIGdsb2JhbDtcblx0aWYgKGZyZWVHbG9iYWwuZ2xvYmFsID09PSBmcmVlR2xvYmFsIHx8IGZyZWVHbG9iYWwud2luZG93ID09PSBmcmVlR2xvYmFsKSB7XG5cdFx0cm9vdCA9IGZyZWVHbG9iYWw7XG5cdH1cblxuXHQvKipcblx0ICogVGhlIGBwdW55Y29kZWAgb2JqZWN0LlxuXHQgKiBAbmFtZSBwdW55Y29kZVxuXHQgKiBAdHlwZSBPYmplY3Rcblx0ICovXG5cdHZhciBwdW55Y29kZSxcblxuXHQvKiogSGlnaGVzdCBwb3NpdGl2ZSBzaWduZWQgMzItYml0IGZsb2F0IHZhbHVlICovXG5cdG1heEludCA9IDIxNDc0ODM2NDcsIC8vIGFrYS4gMHg3RkZGRkZGRiBvciAyXjMxLTFcblxuXHQvKiogQm9vdHN0cmluZyBwYXJhbWV0ZXJzICovXG5cdGJhc2UgPSAzNixcblx0dE1pbiA9IDEsXG5cdHRNYXggPSAyNixcblx0c2tldyA9IDM4LFxuXHRkYW1wID0gNzAwLFxuXHRpbml0aWFsQmlhcyA9IDcyLFxuXHRpbml0aWFsTiA9IDEyOCwgLy8gMHg4MFxuXHRkZWxpbWl0ZXIgPSAnLScsIC8vICdcXHgyRCdcblxuXHQvKiogUmVndWxhciBleHByZXNzaW9ucyAqL1xuXHRyZWdleFB1bnljb2RlID0gL154bi0tLyxcblx0cmVnZXhOb25BU0NJSSA9IC9bXiAtfl0vLCAvLyB1bnByaW50YWJsZSBBU0NJSSBjaGFycyArIG5vbi1BU0NJSSBjaGFyc1xuXHRyZWdleFNlcGFyYXRvcnMgPSAvXFx4MkV8XFx1MzAwMnxcXHVGRjBFfFxcdUZGNjEvZywgLy8gUkZDIDM0OTAgc2VwYXJhdG9yc1xuXG5cdC8qKiBFcnJvciBtZXNzYWdlcyAqL1xuXHRlcnJvcnMgPSB7XG5cdFx0J292ZXJmbG93JzogJ092ZXJmbG93OiBpbnB1dCBuZWVkcyB3aWRlciBpbnRlZ2VycyB0byBwcm9jZXNzJyxcblx0XHQnbm90LWJhc2ljJzogJ0lsbGVnYWwgaW5wdXQgPj0gMHg4MCAobm90IGEgYmFzaWMgY29kZSBwb2ludCknLFxuXHRcdCdpbnZhbGlkLWlucHV0JzogJ0ludmFsaWQgaW5wdXQnXG5cdH0sXG5cblx0LyoqIENvbnZlbmllbmNlIHNob3J0Y3V0cyAqL1xuXHRiYXNlTWludXNUTWluID0gYmFzZSAtIHRNaW4sXG5cdGZsb29yID0gTWF0aC5mbG9vcixcblx0c3RyaW5nRnJvbUNoYXJDb2RlID0gU3RyaW5nLmZyb21DaGFyQ29kZSxcblxuXHQvKiogVGVtcG9yYXJ5IHZhcmlhYmxlICovXG5cdGtleTtcblxuXHQvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuXHQvKipcblx0ICogQSBnZW5lcmljIGVycm9yIHV0aWxpdHkgZnVuY3Rpb24uXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlIFRoZSBlcnJvciB0eXBlLlxuXHQgKiBAcmV0dXJucyB7RXJyb3J9IFRocm93cyBhIGBSYW5nZUVycm9yYCB3aXRoIHRoZSBhcHBsaWNhYmxlIGVycm9yIG1lc3NhZ2UuXG5cdCAqL1xuXHRmdW5jdGlvbiBlcnJvcih0eXBlKSB7XG5cdFx0dGhyb3cgUmFuZ2VFcnJvcihlcnJvcnNbdHlwZV0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIEEgZ2VuZXJpYyBgQXJyYXkjbWFwYCB1dGlsaXR5IGZ1bmN0aW9uLlxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gaXRlcmF0ZSBvdmVyLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gdGhhdCBnZXRzIGNhbGxlZCBmb3IgZXZlcnkgYXJyYXlcblx0ICogaXRlbS5cblx0ICogQHJldHVybnMge0FycmF5fSBBIG5ldyBhcnJheSBvZiB2YWx1ZXMgcmV0dXJuZWQgYnkgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uLlxuXHQgKi9cblx0ZnVuY3Rpb24gbWFwKGFycmF5LCBmbikge1xuXHRcdHZhciBsZW5ndGggPSBhcnJheS5sZW5ndGg7XG5cdFx0d2hpbGUgKGxlbmd0aC0tKSB7XG5cdFx0XHRhcnJheVtsZW5ndGhdID0gZm4oYXJyYXlbbGVuZ3RoXSk7XG5cdFx0fVxuXHRcdHJldHVybiBhcnJheTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBIHNpbXBsZSBgQXJyYXkjbWFwYC1saWtlIHdyYXBwZXIgdG8gd29yayB3aXRoIGRvbWFpbiBuYW1lIHN0cmluZ3MuXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBkb21haW4gVGhlIGRvbWFpbiBuYW1lLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gdGhhdCBnZXRzIGNhbGxlZCBmb3IgZXZlcnlcblx0ICogY2hhcmFjdGVyLlxuXHQgKiBAcmV0dXJucyB7QXJyYXl9IEEgbmV3IHN0cmluZyBvZiBjaGFyYWN0ZXJzIHJldHVybmVkIGJ5IHRoZSBjYWxsYmFja1xuXHQgKiBmdW5jdGlvbi5cblx0ICovXG5cdGZ1bmN0aW9uIG1hcERvbWFpbihzdHJpbmcsIGZuKSB7XG5cdFx0cmV0dXJuIG1hcChzdHJpbmcuc3BsaXQocmVnZXhTZXBhcmF0b3JzKSwgZm4pLmpvaW4oJy4nKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGFuIGFycmF5IGNvbnRhaW5pbmcgdGhlIG51bWVyaWMgY29kZSBwb2ludHMgb2YgZWFjaCBVbmljb2RlXG5cdCAqIGNoYXJhY3RlciBpbiB0aGUgc3RyaW5nLiBXaGlsZSBKYXZhU2NyaXB0IHVzZXMgVUNTLTIgaW50ZXJuYWxseSxcblx0ICogdGhpcyBmdW5jdGlvbiB3aWxsIGNvbnZlcnQgYSBwYWlyIG9mIHN1cnJvZ2F0ZSBoYWx2ZXMgKGVhY2ggb2Ygd2hpY2hcblx0ICogVUNTLTIgZXhwb3NlcyBhcyBzZXBhcmF0ZSBjaGFyYWN0ZXJzKSBpbnRvIGEgc2luZ2xlIGNvZGUgcG9pbnQsXG5cdCAqIG1hdGNoaW5nIFVURi0xNi5cblx0ICogQHNlZSBgcHVueWNvZGUudWNzMi5lbmNvZGVgXG5cdCAqIEBzZWUgPGh0dHA6Ly9tYXRoaWFzYnluZW5zLmJlL25vdGVzL2phdmFzY3JpcHQtZW5jb2Rpbmc+XG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZS51Y3MyXG5cdCAqIEBuYW1lIGRlY29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gc3RyaW5nIFRoZSBVbmljb2RlIGlucHV0IHN0cmluZyAoVUNTLTIpLlxuXHQgKiBAcmV0dXJucyB7QXJyYXl9IFRoZSBuZXcgYXJyYXkgb2YgY29kZSBwb2ludHMuXG5cdCAqL1xuXHRmdW5jdGlvbiB1Y3MyZGVjb2RlKHN0cmluZykge1xuXHRcdHZhciBvdXRwdXQgPSBbXSxcblx0XHQgICAgY291bnRlciA9IDAsXG5cdFx0ICAgIGxlbmd0aCA9IHN0cmluZy5sZW5ndGgsXG5cdFx0ICAgIHZhbHVlLFxuXHRcdCAgICBleHRyYTtcblx0XHR3aGlsZSAoY291bnRlciA8IGxlbmd0aCkge1xuXHRcdFx0dmFsdWUgPSBzdHJpbmcuY2hhckNvZGVBdChjb3VudGVyKyspO1xuXHRcdFx0aWYgKHZhbHVlID49IDB4RDgwMCAmJiB2YWx1ZSA8PSAweERCRkYgJiYgY291bnRlciA8IGxlbmd0aCkge1xuXHRcdFx0XHQvLyBoaWdoIHN1cnJvZ2F0ZSwgYW5kIHRoZXJlIGlzIGEgbmV4dCBjaGFyYWN0ZXJcblx0XHRcdFx0ZXh0cmEgPSBzdHJpbmcuY2hhckNvZGVBdChjb3VudGVyKyspO1xuXHRcdFx0XHRpZiAoKGV4dHJhICYgMHhGQzAwKSA9PSAweERDMDApIHsgLy8gbG93IHN1cnJvZ2F0ZVxuXHRcdFx0XHRcdG91dHB1dC5wdXNoKCgodmFsdWUgJiAweDNGRikgPDwgMTApICsgKGV4dHJhICYgMHgzRkYpICsgMHgxMDAwMCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gdW5tYXRjaGVkIHN1cnJvZ2F0ZTsgb25seSBhcHBlbmQgdGhpcyBjb2RlIHVuaXQsIGluIGNhc2UgdGhlIG5leHRcblx0XHRcdFx0XHQvLyBjb2RlIHVuaXQgaXMgdGhlIGhpZ2ggc3Vycm9nYXRlIG9mIGEgc3Vycm9nYXRlIHBhaXJcblx0XHRcdFx0XHRvdXRwdXQucHVzaCh2YWx1ZSk7XG5cdFx0XHRcdFx0Y291bnRlci0tO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvdXRwdXQucHVzaCh2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBvdXRwdXQ7XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIHN0cmluZyBiYXNlZCBvbiBhbiBhcnJheSBvZiBudW1lcmljIGNvZGUgcG9pbnRzLlxuXHQgKiBAc2VlIGBwdW55Y29kZS51Y3MyLmRlY29kZWBcblx0ICogQG1lbWJlck9mIHB1bnljb2RlLnVjczJcblx0ICogQG5hbWUgZW5jb2RlXG5cdCAqIEBwYXJhbSB7QXJyYXl9IGNvZGVQb2ludHMgVGhlIGFycmF5IG9mIG51bWVyaWMgY29kZSBwb2ludHMuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBuZXcgVW5pY29kZSBzdHJpbmcgKFVDUy0yKS5cblx0ICovXG5cdGZ1bmN0aW9uIHVjczJlbmNvZGUoYXJyYXkpIHtcblx0XHRyZXR1cm4gbWFwKGFycmF5LCBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0dmFyIG91dHB1dCA9ICcnO1xuXHRcdFx0aWYgKHZhbHVlID4gMHhGRkZGKSB7XG5cdFx0XHRcdHZhbHVlIC09IDB4MTAwMDA7XG5cdFx0XHRcdG91dHB1dCArPSBzdHJpbmdGcm9tQ2hhckNvZGUodmFsdWUgPj4+IDEwICYgMHgzRkYgfCAweEQ4MDApO1xuXHRcdFx0XHR2YWx1ZSA9IDB4REMwMCB8IHZhbHVlICYgMHgzRkY7XG5cdFx0XHR9XG5cdFx0XHRvdXRwdXQgKz0gc3RyaW5nRnJvbUNoYXJDb2RlKHZhbHVlKTtcblx0XHRcdHJldHVybiBvdXRwdXQ7XG5cdFx0fSkuam9pbignJyk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBiYXNpYyBjb2RlIHBvaW50IGludG8gYSBkaWdpdC9pbnRlZ2VyLlxuXHQgKiBAc2VlIGBkaWdpdFRvQmFzaWMoKWBcblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGNvZGVQb2ludCBUaGUgYmFzaWMgbnVtZXJpYyBjb2RlIHBvaW50IHZhbHVlLlxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfSBUaGUgbnVtZXJpYyB2YWx1ZSBvZiBhIGJhc2ljIGNvZGUgcG9pbnQgKGZvciB1c2UgaW5cblx0ICogcmVwcmVzZW50aW5nIGludGVnZXJzKSBpbiB0aGUgcmFuZ2UgYDBgIHRvIGBiYXNlIC0gMWAsIG9yIGBiYXNlYCBpZlxuXHQgKiB0aGUgY29kZSBwb2ludCBkb2VzIG5vdCByZXByZXNlbnQgYSB2YWx1ZS5cblx0ICovXG5cdGZ1bmN0aW9uIGJhc2ljVG9EaWdpdChjb2RlUG9pbnQpIHtcblx0XHRpZiAoY29kZVBvaW50IC0gNDggPCAxMCkge1xuXHRcdFx0cmV0dXJuIGNvZGVQb2ludCAtIDIyO1xuXHRcdH1cblx0XHRpZiAoY29kZVBvaW50IC0gNjUgPCAyNikge1xuXHRcdFx0cmV0dXJuIGNvZGVQb2ludCAtIDY1O1xuXHRcdH1cblx0XHRpZiAoY29kZVBvaW50IC0gOTcgPCAyNikge1xuXHRcdFx0cmV0dXJuIGNvZGVQb2ludCAtIDk3O1xuXHRcdH1cblx0XHRyZXR1cm4gYmFzZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIGRpZ2l0L2ludGVnZXIgaW50byBhIGJhc2ljIGNvZGUgcG9pbnQuXG5cdCAqIEBzZWUgYGJhc2ljVG9EaWdpdCgpYFxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge051bWJlcn0gZGlnaXQgVGhlIG51bWVyaWMgdmFsdWUgb2YgYSBiYXNpYyBjb2RlIHBvaW50LlxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfSBUaGUgYmFzaWMgY29kZSBwb2ludCB3aG9zZSB2YWx1ZSAod2hlbiB1c2VkIGZvclxuXHQgKiByZXByZXNlbnRpbmcgaW50ZWdlcnMpIGlzIGBkaWdpdGAsIHdoaWNoIG5lZWRzIHRvIGJlIGluIHRoZSByYW5nZVxuXHQgKiBgMGAgdG8gYGJhc2UgLSAxYC4gSWYgYGZsYWdgIGlzIG5vbi16ZXJvLCB0aGUgdXBwZXJjYXNlIGZvcm0gaXNcblx0ICogdXNlZDsgZWxzZSwgdGhlIGxvd2VyY2FzZSBmb3JtIGlzIHVzZWQuIFRoZSBiZWhhdmlvciBpcyB1bmRlZmluZWRcblx0ICogaWYgYGZsYWdgIGlzIG5vbi16ZXJvIGFuZCBgZGlnaXRgIGhhcyBubyB1cHBlcmNhc2UgZm9ybS5cblx0ICovXG5cdGZ1bmN0aW9uIGRpZ2l0VG9CYXNpYyhkaWdpdCwgZmxhZykge1xuXHRcdC8vICAwLi4yNSBtYXAgdG8gQVNDSUkgYS4ueiBvciBBLi5aXG5cdFx0Ly8gMjYuLjM1IG1hcCB0byBBU0NJSSAwLi45XG5cdFx0cmV0dXJuIGRpZ2l0ICsgMjIgKyA3NSAqIChkaWdpdCA8IDI2KSAtICgoZmxhZyAhPSAwKSA8PCA1KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBCaWFzIGFkYXB0YXRpb24gZnVuY3Rpb24gYXMgcGVyIHNlY3Rpb24gMy40IG9mIFJGQyAzNDkyLlxuXHQgKiBodHRwOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMzNDkyI3NlY3Rpb24tMy40XG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRmdW5jdGlvbiBhZGFwdChkZWx0YSwgbnVtUG9pbnRzLCBmaXJzdFRpbWUpIHtcblx0XHR2YXIgayA9IDA7XG5cdFx0ZGVsdGEgPSBmaXJzdFRpbWUgPyBmbG9vcihkZWx0YSAvIGRhbXApIDogZGVsdGEgPj4gMTtcblx0XHRkZWx0YSArPSBmbG9vcihkZWx0YSAvIG51bVBvaW50cyk7XG5cdFx0Zm9yICgvKiBubyBpbml0aWFsaXphdGlvbiAqLzsgZGVsdGEgPiBiYXNlTWludXNUTWluICogdE1heCA+PiAxOyBrICs9IGJhc2UpIHtcblx0XHRcdGRlbHRhID0gZmxvb3IoZGVsdGEgLyBiYXNlTWludXNUTWluKTtcblx0XHR9XG5cdFx0cmV0dXJuIGZsb29yKGsgKyAoYmFzZU1pbnVzVE1pbiArIDEpICogZGVsdGEgLyAoZGVsdGEgKyBza2V3KSk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBQdW55Y29kZSBzdHJpbmcgb2YgQVNDSUktb25seSBzeW1ib2xzIHRvIGEgc3RyaW5nIG9mIFVuaWNvZGVcblx0ICogc3ltYm9scy5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dCBUaGUgUHVueWNvZGUgc3RyaW5nIG9mIEFTQ0lJLW9ubHkgc3ltYm9scy5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIHJlc3VsdGluZyBzdHJpbmcgb2YgVW5pY29kZSBzeW1ib2xzLlxuXHQgKi9cblx0ZnVuY3Rpb24gZGVjb2RlKGlucHV0KSB7XG5cdFx0Ly8gRG9uJ3QgdXNlIFVDUy0yXG5cdFx0dmFyIG91dHB1dCA9IFtdLFxuXHRcdCAgICBpbnB1dExlbmd0aCA9IGlucHV0Lmxlbmd0aCxcblx0XHQgICAgb3V0LFxuXHRcdCAgICBpID0gMCxcblx0XHQgICAgbiA9IGluaXRpYWxOLFxuXHRcdCAgICBiaWFzID0gaW5pdGlhbEJpYXMsXG5cdFx0ICAgIGJhc2ljLFxuXHRcdCAgICBqLFxuXHRcdCAgICBpbmRleCxcblx0XHQgICAgb2xkaSxcblx0XHQgICAgdyxcblx0XHQgICAgayxcblx0XHQgICAgZGlnaXQsXG5cdFx0ICAgIHQsXG5cdFx0ICAgIC8qKiBDYWNoZWQgY2FsY3VsYXRpb24gcmVzdWx0cyAqL1xuXHRcdCAgICBiYXNlTWludXNUO1xuXG5cdFx0Ly8gSGFuZGxlIHRoZSBiYXNpYyBjb2RlIHBvaW50czogbGV0IGBiYXNpY2AgYmUgdGhlIG51bWJlciBvZiBpbnB1dCBjb2RlXG5cdFx0Ly8gcG9pbnRzIGJlZm9yZSB0aGUgbGFzdCBkZWxpbWl0ZXIsIG9yIGAwYCBpZiB0aGVyZSBpcyBub25lLCB0aGVuIGNvcHlcblx0XHQvLyB0aGUgZmlyc3QgYmFzaWMgY29kZSBwb2ludHMgdG8gdGhlIG91dHB1dC5cblxuXHRcdGJhc2ljID0gaW5wdXQubGFzdEluZGV4T2YoZGVsaW1pdGVyKTtcblx0XHRpZiAoYmFzaWMgPCAwKSB7XG5cdFx0XHRiYXNpYyA9IDA7XG5cdFx0fVxuXG5cdFx0Zm9yIChqID0gMDsgaiA8IGJhc2ljOyArK2opIHtcblx0XHRcdC8vIGlmIGl0J3Mgbm90IGEgYmFzaWMgY29kZSBwb2ludFxuXHRcdFx0aWYgKGlucHV0LmNoYXJDb2RlQXQoaikgPj0gMHg4MCkge1xuXHRcdFx0XHRlcnJvcignbm90LWJhc2ljJyk7XG5cdFx0XHR9XG5cdFx0XHRvdXRwdXQucHVzaChpbnB1dC5jaGFyQ29kZUF0KGopKTtcblx0XHR9XG5cblx0XHQvLyBNYWluIGRlY29kaW5nIGxvb3A6IHN0YXJ0IGp1c3QgYWZ0ZXIgdGhlIGxhc3QgZGVsaW1pdGVyIGlmIGFueSBiYXNpYyBjb2RlXG5cdFx0Ly8gcG9pbnRzIHdlcmUgY29waWVkOyBzdGFydCBhdCB0aGUgYmVnaW5uaW5nIG90aGVyd2lzZS5cblxuXHRcdGZvciAoaW5kZXggPSBiYXNpYyA+IDAgPyBiYXNpYyArIDEgOiAwOyBpbmRleCA8IGlucHV0TGVuZ3RoOyAvKiBubyBmaW5hbCBleHByZXNzaW9uICovKSB7XG5cblx0XHRcdC8vIGBpbmRleGAgaXMgdGhlIGluZGV4IG9mIHRoZSBuZXh0IGNoYXJhY3RlciB0byBiZSBjb25zdW1lZC5cblx0XHRcdC8vIERlY29kZSBhIGdlbmVyYWxpemVkIHZhcmlhYmxlLWxlbmd0aCBpbnRlZ2VyIGludG8gYGRlbHRhYCxcblx0XHRcdC8vIHdoaWNoIGdldHMgYWRkZWQgdG8gYGlgLiBUaGUgb3ZlcmZsb3cgY2hlY2tpbmcgaXMgZWFzaWVyXG5cdFx0XHQvLyBpZiB3ZSBpbmNyZWFzZSBgaWAgYXMgd2UgZ28sIHRoZW4gc3VidHJhY3Qgb2ZmIGl0cyBzdGFydGluZ1xuXHRcdFx0Ly8gdmFsdWUgYXQgdGhlIGVuZCB0byBvYnRhaW4gYGRlbHRhYC5cblx0XHRcdGZvciAob2xkaSA9IGksIHcgPSAxLCBrID0gYmFzZTsgLyogbm8gY29uZGl0aW9uICovOyBrICs9IGJhc2UpIHtcblxuXHRcdFx0XHRpZiAoaW5kZXggPj0gaW5wdXRMZW5ndGgpIHtcblx0XHRcdFx0XHRlcnJvcignaW52YWxpZC1pbnB1dCcpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0ZGlnaXQgPSBiYXNpY1RvRGlnaXQoaW5wdXQuY2hhckNvZGVBdChpbmRleCsrKSk7XG5cblx0XHRcdFx0aWYgKGRpZ2l0ID49IGJhc2UgfHwgZGlnaXQgPiBmbG9vcigobWF4SW50IC0gaSkgLyB3KSkge1xuXHRcdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aSArPSBkaWdpdCAqIHc7XG5cdFx0XHRcdHQgPSBrIDw9IGJpYXMgPyB0TWluIDogKGsgPj0gYmlhcyArIHRNYXggPyB0TWF4IDogayAtIGJpYXMpO1xuXG5cdFx0XHRcdGlmIChkaWdpdCA8IHQpIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGJhc2VNaW51c1QgPSBiYXNlIC0gdDtcblx0XHRcdFx0aWYgKHcgPiBmbG9vcihtYXhJbnQgLyBiYXNlTWludXNUKSkge1xuXHRcdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dyAqPSBiYXNlTWludXNUO1xuXG5cdFx0XHR9XG5cblx0XHRcdG91dCA9IG91dHB1dC5sZW5ndGggKyAxO1xuXHRcdFx0YmlhcyA9IGFkYXB0KGkgLSBvbGRpLCBvdXQsIG9sZGkgPT0gMCk7XG5cblx0XHRcdC8vIGBpYCB3YXMgc3VwcG9zZWQgdG8gd3JhcCBhcm91bmQgZnJvbSBgb3V0YCB0byBgMGAsXG5cdFx0XHQvLyBpbmNyZW1lbnRpbmcgYG5gIGVhY2ggdGltZSwgc28gd2UnbGwgZml4IHRoYXQgbm93OlxuXHRcdFx0aWYgKGZsb29yKGkgLyBvdXQpID4gbWF4SW50IC0gbikge1xuXHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdH1cblxuXHRcdFx0biArPSBmbG9vcihpIC8gb3V0KTtcblx0XHRcdGkgJT0gb3V0O1xuXG5cdFx0XHQvLyBJbnNlcnQgYG5gIGF0IHBvc2l0aW9uIGBpYCBvZiB0aGUgb3V0cHV0XG5cdFx0XHRvdXRwdXQuc3BsaWNlKGkrKywgMCwgbik7XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gdWNzMmVuY29kZShvdXRwdXQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgc3RyaW5nIG9mIFVuaWNvZGUgc3ltYm9scyB0byBhIFB1bnljb2RlIHN0cmluZyBvZiBBU0NJSS1vbmx5XG5cdCAqIHN5bWJvbHMuXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gaW5wdXQgVGhlIHN0cmluZyBvZiBVbmljb2RlIHN5bWJvbHMuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSByZXN1bHRpbmcgUHVueWNvZGUgc3RyaW5nIG9mIEFTQ0lJLW9ubHkgc3ltYm9scy5cblx0ICovXG5cdGZ1bmN0aW9uIGVuY29kZShpbnB1dCkge1xuXHRcdHZhciBuLFxuXHRcdCAgICBkZWx0YSxcblx0XHQgICAgaGFuZGxlZENQQ291bnQsXG5cdFx0ICAgIGJhc2ljTGVuZ3RoLFxuXHRcdCAgICBiaWFzLFxuXHRcdCAgICBqLFxuXHRcdCAgICBtLFxuXHRcdCAgICBxLFxuXHRcdCAgICBrLFxuXHRcdCAgICB0LFxuXHRcdCAgICBjdXJyZW50VmFsdWUsXG5cdFx0ICAgIG91dHB1dCA9IFtdLFxuXHRcdCAgICAvKiogYGlucHV0TGVuZ3RoYCB3aWxsIGhvbGQgdGhlIG51bWJlciBvZiBjb2RlIHBvaW50cyBpbiBgaW5wdXRgLiAqL1xuXHRcdCAgICBpbnB1dExlbmd0aCxcblx0XHQgICAgLyoqIENhY2hlZCBjYWxjdWxhdGlvbiByZXN1bHRzICovXG5cdFx0ICAgIGhhbmRsZWRDUENvdW50UGx1c09uZSxcblx0XHQgICAgYmFzZU1pbnVzVCxcblx0XHQgICAgcU1pbnVzVDtcblxuXHRcdC8vIENvbnZlcnQgdGhlIGlucHV0IGluIFVDUy0yIHRvIFVuaWNvZGVcblx0XHRpbnB1dCA9IHVjczJkZWNvZGUoaW5wdXQpO1xuXG5cdFx0Ly8gQ2FjaGUgdGhlIGxlbmd0aFxuXHRcdGlucHV0TGVuZ3RoID0gaW5wdXQubGVuZ3RoO1xuXG5cdFx0Ly8gSW5pdGlhbGl6ZSB0aGUgc3RhdGVcblx0XHRuID0gaW5pdGlhbE47XG5cdFx0ZGVsdGEgPSAwO1xuXHRcdGJpYXMgPSBpbml0aWFsQmlhcztcblxuXHRcdC8vIEhhbmRsZSB0aGUgYmFzaWMgY29kZSBwb2ludHNcblx0XHRmb3IgKGogPSAwOyBqIDwgaW5wdXRMZW5ndGg7ICsraikge1xuXHRcdFx0Y3VycmVudFZhbHVlID0gaW5wdXRbal07XG5cdFx0XHRpZiAoY3VycmVudFZhbHVlIDwgMHg4MCkge1xuXHRcdFx0XHRvdXRwdXQucHVzaChzdHJpbmdGcm9tQ2hhckNvZGUoY3VycmVudFZhbHVlKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aGFuZGxlZENQQ291bnQgPSBiYXNpY0xlbmd0aCA9IG91dHB1dC5sZW5ndGg7XG5cblx0XHQvLyBgaGFuZGxlZENQQ291bnRgIGlzIHRoZSBudW1iZXIgb2YgY29kZSBwb2ludHMgdGhhdCBoYXZlIGJlZW4gaGFuZGxlZDtcblx0XHQvLyBgYmFzaWNMZW5ndGhgIGlzIHRoZSBudW1iZXIgb2YgYmFzaWMgY29kZSBwb2ludHMuXG5cblx0XHQvLyBGaW5pc2ggdGhlIGJhc2ljIHN0cmluZyAtIGlmIGl0IGlzIG5vdCBlbXB0eSAtIHdpdGggYSBkZWxpbWl0ZXJcblx0XHRpZiAoYmFzaWNMZW5ndGgpIHtcblx0XHRcdG91dHB1dC5wdXNoKGRlbGltaXRlcik7XG5cdFx0fVxuXG5cdFx0Ly8gTWFpbiBlbmNvZGluZyBsb29wOlxuXHRcdHdoaWxlIChoYW5kbGVkQ1BDb3VudCA8IGlucHV0TGVuZ3RoKSB7XG5cblx0XHRcdC8vIEFsbCBub24tYmFzaWMgY29kZSBwb2ludHMgPCBuIGhhdmUgYmVlbiBoYW5kbGVkIGFscmVhZHkuIEZpbmQgdGhlIG5leHRcblx0XHRcdC8vIGxhcmdlciBvbmU6XG5cdFx0XHRmb3IgKG0gPSBtYXhJbnQsIGogPSAwOyBqIDwgaW5wdXRMZW5ndGg7ICsraikge1xuXHRcdFx0XHRjdXJyZW50VmFsdWUgPSBpbnB1dFtqXTtcblx0XHRcdFx0aWYgKGN1cnJlbnRWYWx1ZSA+PSBuICYmIGN1cnJlbnRWYWx1ZSA8IG0pIHtcblx0XHRcdFx0XHRtID0gY3VycmVudFZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIEluY3JlYXNlIGBkZWx0YWAgZW5vdWdoIHRvIGFkdmFuY2UgdGhlIGRlY29kZXIncyA8bixpPiBzdGF0ZSB0byA8bSwwPixcblx0XHRcdC8vIGJ1dCBndWFyZCBhZ2FpbnN0IG92ZXJmbG93XG5cdFx0XHRoYW5kbGVkQ1BDb3VudFBsdXNPbmUgPSBoYW5kbGVkQ1BDb3VudCArIDE7XG5cdFx0XHRpZiAobSAtIG4gPiBmbG9vcigobWF4SW50IC0gZGVsdGEpIC8gaGFuZGxlZENQQ291bnRQbHVzT25lKSkge1xuXHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdH1cblxuXHRcdFx0ZGVsdGEgKz0gKG0gLSBuKSAqIGhhbmRsZWRDUENvdW50UGx1c09uZTtcblx0XHRcdG4gPSBtO1xuXG5cdFx0XHRmb3IgKGogPSAwOyBqIDwgaW5wdXRMZW5ndGg7ICsraikge1xuXHRcdFx0XHRjdXJyZW50VmFsdWUgPSBpbnB1dFtqXTtcblxuXHRcdFx0XHRpZiAoY3VycmVudFZhbHVlIDwgbiAmJiArK2RlbHRhID4gbWF4SW50KSB7XG5cdFx0XHRcdFx0ZXJyb3IoJ292ZXJmbG93Jyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoY3VycmVudFZhbHVlID09IG4pIHtcblx0XHRcdFx0XHQvLyBSZXByZXNlbnQgZGVsdGEgYXMgYSBnZW5lcmFsaXplZCB2YXJpYWJsZS1sZW5ndGggaW50ZWdlclxuXHRcdFx0XHRcdGZvciAocSA9IGRlbHRhLCBrID0gYmFzZTsgLyogbm8gY29uZGl0aW9uICovOyBrICs9IGJhc2UpIHtcblx0XHRcdFx0XHRcdHQgPSBrIDw9IGJpYXMgPyB0TWluIDogKGsgPj0gYmlhcyArIHRNYXggPyB0TWF4IDogayAtIGJpYXMpO1xuXHRcdFx0XHRcdFx0aWYgKHEgPCB0KSB7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cU1pbnVzVCA9IHEgLSB0O1xuXHRcdFx0XHRcdFx0YmFzZU1pbnVzVCA9IGJhc2UgLSB0O1xuXHRcdFx0XHRcdFx0b3V0cHV0LnB1c2goXG5cdFx0XHRcdFx0XHRcdHN0cmluZ0Zyb21DaGFyQ29kZShkaWdpdFRvQmFzaWModCArIHFNaW51c1QgJSBiYXNlTWludXNULCAwKSlcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0XHRxID0gZmxvb3IocU1pbnVzVCAvIGJhc2VNaW51c1QpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdG91dHB1dC5wdXNoKHN0cmluZ0Zyb21DaGFyQ29kZShkaWdpdFRvQmFzaWMocSwgMCkpKTtcblx0XHRcdFx0XHRiaWFzID0gYWRhcHQoZGVsdGEsIGhhbmRsZWRDUENvdW50UGx1c09uZSwgaGFuZGxlZENQQ291bnQgPT0gYmFzaWNMZW5ndGgpO1xuXHRcdFx0XHRcdGRlbHRhID0gMDtcblx0XHRcdFx0XHQrK2hhbmRsZWRDUENvdW50O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdCsrZGVsdGE7XG5cdFx0XHQrK247XG5cblx0XHR9XG5cdFx0cmV0dXJuIG91dHB1dC5qb2luKCcnKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIFB1bnljb2RlIHN0cmluZyByZXByZXNlbnRpbmcgYSBkb21haW4gbmFtZSB0byBVbmljb2RlLiBPbmx5IHRoZVxuXHQgKiBQdW55Y29kZWQgcGFydHMgb2YgdGhlIGRvbWFpbiBuYW1lIHdpbGwgYmUgY29udmVydGVkLCBpLmUuIGl0IGRvZXNuJ3Rcblx0ICogbWF0dGVyIGlmIHlvdSBjYWxsIGl0IG9uIGEgc3RyaW5nIHRoYXQgaGFzIGFscmVhZHkgYmVlbiBjb252ZXJ0ZWQgdG9cblx0ICogVW5pY29kZS5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBkb21haW4gVGhlIFB1bnljb2RlIGRvbWFpbiBuYW1lIHRvIGNvbnZlcnQgdG8gVW5pY29kZS5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIFVuaWNvZGUgcmVwcmVzZW50YXRpb24gb2YgdGhlIGdpdmVuIFB1bnljb2RlXG5cdCAqIHN0cmluZy5cblx0ICovXG5cdGZ1bmN0aW9uIHRvVW5pY29kZShkb21haW4pIHtcblx0XHRyZXR1cm4gbWFwRG9tYWluKGRvbWFpbiwgZnVuY3Rpb24oc3RyaW5nKSB7XG5cdFx0XHRyZXR1cm4gcmVnZXhQdW55Y29kZS50ZXN0KHN0cmluZylcblx0XHRcdFx0PyBkZWNvZGUoc3RyaW5nLnNsaWNlKDQpLnRvTG93ZXJDYXNlKCkpXG5cdFx0XHRcdDogc3RyaW5nO1xuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgVW5pY29kZSBzdHJpbmcgcmVwcmVzZW50aW5nIGEgZG9tYWluIG5hbWUgdG8gUHVueWNvZGUuIE9ubHkgdGhlXG5cdCAqIG5vbi1BU0NJSSBwYXJ0cyBvZiB0aGUgZG9tYWluIG5hbWUgd2lsbCBiZSBjb252ZXJ0ZWQsIGkuZS4gaXQgZG9lc24ndFxuXHQgKiBtYXR0ZXIgaWYgeW91IGNhbGwgaXQgd2l0aCBhIGRvbWFpbiB0aGF0J3MgYWxyZWFkeSBpbiBBU0NJSS5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBkb21haW4gVGhlIGRvbWFpbiBuYW1lIHRvIGNvbnZlcnQsIGFzIGEgVW5pY29kZSBzdHJpbmcuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBQdW55Y29kZSByZXByZXNlbnRhdGlvbiBvZiB0aGUgZ2l2ZW4gZG9tYWluIG5hbWUuXG5cdCAqL1xuXHRmdW5jdGlvbiB0b0FTQ0lJKGRvbWFpbikge1xuXHRcdHJldHVybiBtYXBEb21haW4oZG9tYWluLCBmdW5jdGlvbihzdHJpbmcpIHtcblx0XHRcdHJldHVybiByZWdleE5vbkFTQ0lJLnRlc3Qoc3RyaW5nKVxuXHRcdFx0XHQ/ICd4bi0tJyArIGVuY29kZShzdHJpbmcpXG5cdFx0XHRcdDogc3RyaW5nO1xuXHRcdH0pO1xuXHR9XG5cblx0LyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cblx0LyoqIERlZmluZSB0aGUgcHVibGljIEFQSSAqL1xuXHRwdW55Y29kZSA9IHtcblx0XHQvKipcblx0XHQgKiBBIHN0cmluZyByZXByZXNlbnRpbmcgdGhlIGN1cnJlbnQgUHVueWNvZGUuanMgdmVyc2lvbiBudW1iZXIuXG5cdFx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdFx0ICogQHR5cGUgU3RyaW5nXG5cdFx0ICovXG5cdFx0J3ZlcnNpb24nOiAnMS4yLjQnLFxuXHRcdC8qKlxuXHRcdCAqIEFuIG9iamVjdCBvZiBtZXRob2RzIHRvIGNvbnZlcnQgZnJvbSBKYXZhU2NyaXB0J3MgaW50ZXJuYWwgY2hhcmFjdGVyXG5cdFx0ICogcmVwcmVzZW50YXRpb24gKFVDUy0yKSB0byBVbmljb2RlIGNvZGUgcG9pbnRzLCBhbmQgYmFjay5cblx0XHQgKiBAc2VlIDxodHRwOi8vbWF0aGlhc2J5bmVucy5iZS9ub3Rlcy9qYXZhc2NyaXB0LWVuY29kaW5nPlxuXHRcdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHRcdCAqIEB0eXBlIE9iamVjdFxuXHRcdCAqL1xuXHRcdCd1Y3MyJzoge1xuXHRcdFx0J2RlY29kZSc6IHVjczJkZWNvZGUsXG5cdFx0XHQnZW5jb2RlJzogdWNzMmVuY29kZVxuXHRcdH0sXG5cdFx0J2RlY29kZSc6IGRlY29kZSxcblx0XHQnZW5jb2RlJzogZW5jb2RlLFxuXHRcdCd0b0FTQ0lJJzogdG9BU0NJSSxcblx0XHQndG9Vbmljb2RlJzogdG9Vbmljb2RlXG5cdH07XG5cblx0LyoqIEV4cG9zZSBgcHVueWNvZGVgICovXG5cdC8vIFNvbWUgQU1EIGJ1aWxkIG9wdGltaXplcnMsIGxpa2Ugci5qcywgY2hlY2sgZm9yIHNwZWNpZmljIGNvbmRpdGlvbiBwYXR0ZXJuc1xuXHQvLyBsaWtlIHRoZSBmb2xsb3dpbmc6XG5cdGlmIChcblx0XHR0eXBlb2YgZGVmaW5lID09ICdmdW5jdGlvbicgJiZcblx0XHR0eXBlb2YgZGVmaW5lLmFtZCA9PSAnb2JqZWN0JyAmJlxuXHRcdGRlZmluZS5hbWRcblx0KSB7XG5cdFx0ZGVmaW5lKCdwdW55Y29kZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHB1bnljb2RlO1xuXHRcdH0pO1xuXHR9IGVsc2UgaWYgKGZyZWVFeHBvcnRzICYmICFmcmVlRXhwb3J0cy5ub2RlVHlwZSkge1xuXHRcdGlmIChmcmVlTW9kdWxlKSB7IC8vIGluIE5vZGUuanMgb3IgUmluZ29KUyB2MC44LjArXG5cdFx0XHRmcmVlTW9kdWxlLmV4cG9ydHMgPSBwdW55Y29kZTtcblx0XHR9IGVsc2UgeyAvLyBpbiBOYXJ3aGFsIG9yIFJpbmdvSlMgdjAuNy4wLVxuXHRcdFx0Zm9yIChrZXkgaW4gcHVueWNvZGUpIHtcblx0XHRcdFx0cHVueWNvZGUuaGFzT3duUHJvcGVydHkoa2V5KSAmJiAoZnJlZUV4cG9ydHNba2V5XSA9IHB1bnljb2RlW2tleV0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fSBlbHNlIHsgLy8gaW4gUmhpbm8gb3IgYSB3ZWIgYnJvd3NlclxuXHRcdHJvb3QucHVueWNvZGUgPSBwdW55Y29kZTtcblx0fVxuXG59KHRoaXMpKTtcbiJdfQ==
},{}],5:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],6:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return map(obj[k], function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],7:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":5,"./encode":6}],8:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var punycode = require('punycode');

exports.parse = urlParse;
exports.resolve = urlResolve;
exports.resolveObject = urlResolveObject;
exports.format = urlFormat;

exports.Url = Url;

function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.host = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.query = null;
  this.pathname = null;
  this.path = null;
  this.href = null;
}

// Reference: RFC 3986, RFC 1808, RFC 2396

// define these here so at least they only have to be
// compiled once on the first module load.
var protocolPattern = /^([a-z0-9.+-]+:)/i,
    portPattern = /:[0-9]*$/,

    // RFC 2396: characters reserved for delimiting URLs.
    // We actually just auto-escape these.
    delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

    // RFC 2396: characters not allowed for various reasons.
    unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),

    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
    autoEscape = ['\''].concat(unwise),
    // Characters that are never ever allowed in a hostname.
    // Note that any invalid chars are also handled, but these
    // are the ones that are *expected* to be seen, so we fast-path
    // them.
    nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
    hostEndingChars = ['/', '?', '#'],
    hostnameMaxLen = 255,
    hostnamePartPattern = /^[a-z0-9A-Z_-]{0,63}$/,
    hostnamePartStart = /^([a-z0-9A-Z_-]{0,63})(.*)$/,
    // protocols that can allow "unsafe" and "unwise" chars.
    unsafeProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that never have a hostname.
    hostlessProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that always contain a // bit.
    slashedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'https:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    },
    querystring = require('querystring');

function urlParse(url, parseQueryString, slashesDenoteHost) {
  if (url && isObject(url) && url instanceof Url) return url;

  var u = new Url;
  u.parse(url, parseQueryString, slashesDenoteHost);
  return u;
}

Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
  if (!isString(url)) {
    throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
  }

  var rest = url;

  // trim before proceeding.
  // This is to support parse stuff like "  http://foo.com  \n"
  rest = rest.trim();

  var proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    var lowerProto = proto.toLowerCase();
    this.protocol = lowerProto;
    rest = rest.substr(proto.length);
  }

  // figure out if it's got a host
  // user@server is *always* interpreted as a hostname, and url
  // resolution will treat //foo/bar as host=foo,path=bar because that's
  // how the browser resolves relative URLs.
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    var slashes = rest.substr(0, 2) === '//';
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }

  if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {

    // there's a hostname.
    // the first instance of /, ?, ;, or # ends the host.
    //
    // If there is an @ in the hostname, then non-host chars *are* allowed
    // to the left of the last @ sign, unless some host-ending character
    // comes *before* the @-sign.
    // URLs are obnoxious.
    //
    // ex:
    // http://a@b@c/ => user:a@b host:c
    // http://a@b?@c => user:a host:c path:/?@c

    // v0.12 TODO(isaacs): This is not quite how Chrome does things.
    // Review our test case against browsers more comprehensively.

    // find the first instance of any hostEndingChars
    var hostEnd = -1;
    for (var i = 0; i < hostEndingChars.length; i++) {
      var hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }

    // at this point, either we have an explicit point where the
    // auth portion cannot go past, or the last @ char is the decider.
    var auth, atSign;
    if (hostEnd === -1) {
      // atSign can be anywhere.
      atSign = rest.lastIndexOf('@');
    } else {
      // atSign must be in auth portion.
      // http://a@b/c@d => host:b auth:a path:/c@d
      atSign = rest.lastIndexOf('@', hostEnd);
    }

    // Now we have a portion which is definitely the auth.
    // Pull that off.
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = decodeURIComponent(auth);
    }

    // the host is the remaining to the left of the first non-host char
    hostEnd = -1;
    for (var i = 0; i < nonHostChars.length; i++) {
      var hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }
    // if we still have not hit it, then the entire thing is a host.
    if (hostEnd === -1)
      hostEnd = rest.length;

    this.host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);

    // pull out port.
    this.parseHost();

    // we've indicated that there is a hostname,
    // so even if it's empty, it has to be present.
    this.hostname = this.hostname || '';

    // if hostname begins with [ and ends with ]
    // assume that it's an IPv6 address.
    var ipv6Hostname = this.hostname[0] === '[' &&
        this.hostname[this.hostname.length - 1] === ']';

    // validate a little.
    if (!ipv6Hostname) {
      var hostparts = this.hostname.split(/\./);
      for (var i = 0, l = hostparts.length; i < l; i++) {
        var part = hostparts[i];
        if (!part) continue;
        if (!part.match(hostnamePartPattern)) {
          var newpart = '';
          for (var j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              // we replace non-ASCII char with a temporary placeholder
              // we need this to make sure size of hostname is not
              // broken by replacing non-ASCII by nothing
              newpart += 'x';
            } else {
              newpart += part[j];
            }
          }
          // we test again with ASCII char only
          if (!newpart.match(hostnamePartPattern)) {
            var validParts = hostparts.slice(0, i);
            var notHost = hostparts.slice(i + 1);
            var bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = '/' + notHost.join('.') + rest;
            }
            this.hostname = validParts.join('.');
            break;
          }
        }
      }
    }

    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = '';
    } else {
      // hostnames are always lower case.
      this.hostname = this.hostname.toLowerCase();
    }

    if (!ipv6Hostname) {
      // IDNA Support: Returns a puny coded representation of "domain".
      // It only converts the part of the domain name that
      // has non ASCII characters. I.e. it dosent matter if
      // you call it with a domain that already is in ASCII.
      var domainArray = this.hostname.split('.');
      var newOut = [];
      for (var i = 0; i < domainArray.length; ++i) {
        var s = domainArray[i];
        newOut.push(s.match(/[^A-Za-z0-9_-]/) ?
            'xn--' + punycode.encode(s) : s);
      }
      this.hostname = newOut.join('.');
    }

    var p = this.port ? ':' + this.port : '';
    var h = this.hostname || '';
    this.host = h + p;
    this.href += this.host;

    // strip [ and ] from the hostname
    // the host field still retains them, though
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
      if (rest[0] !== '/') {
        rest = '/' + rest;
      }
    }
  }

  // now rest is set to the post-host stuff.
  // chop off any delim chars.
  if (!unsafeProtocol[lowerProto]) {

    // First, make 100% sure that any "autoEscape" chars get
    // escaped, even if encodeURIComponent doesn't think they
    // need to be.
    for (var i = 0, l = autoEscape.length; i < l; i++) {
      var ae = autoEscape[i];
      var esc = encodeURIComponent(ae);
      if (esc === ae) {
        esc = escape(ae);
      }
      rest = rest.split(ae).join(esc);
    }
  }


  // chop off from the tail first.
  var hash = rest.indexOf('#');
  if (hash !== -1) {
    // got a fragment string.
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  var qm = rest.indexOf('?');
  if (qm !== -1) {
    this.search = rest.substr(qm);
    this.query = rest.substr(qm + 1);
    if (parseQueryString) {
      this.query = querystring.parse(this.query);
    }
    rest = rest.slice(0, qm);
  } else if (parseQueryString) {
    // no query string, but parseQueryString still requested
    this.search = '';
    this.query = {};
  }
  if (rest) this.pathname = rest;
  if (slashedProtocol[lowerProto] &&
      this.hostname && !this.pathname) {
    this.pathname = '/';
  }

  //to support http.request
  if (this.pathname || this.search) {
    var p = this.pathname || '';
    var s = this.search || '';
    this.path = p + s;
  }

  // finally, reconstruct the href based on what has been validated.
  this.href = this.format();
  return this;
};

// format a parsed object into a url string
function urlFormat(obj) {
  // ensure it's an object, and not a string url.
  // If it's an obj, this is a no-op.
  // this way, you can call url_format() on strings
  // to clean up potentially wonky urls.
  if (isString(obj)) obj = urlParse(obj);
  if (!(obj instanceof Url)) return Url.prototype.format.call(obj);
  return obj.format();
}

Url.prototype.format = function() {
  var auth = this.auth || '';
  if (auth) {
    auth = encodeURIComponent(auth);
    auth = auth.replace(/%3A/i, ':');
    auth += '@';
  }

  var protocol = this.protocol || '',
      pathname = this.pathname || '',
      hash = this.hash || '',
      host = false,
      query = '';

  if (this.host) {
    host = auth + this.host;
  } else if (this.hostname) {
    host = auth + (this.hostname.indexOf(':') === -1 ?
        this.hostname :
        '[' + this.hostname + ']');
    if (this.port) {
      host += ':' + this.port;
    }
  }

  if (this.query &&
      isObject(this.query) &&
      Object.keys(this.query).length) {
    query = querystring.stringify(this.query);
  }

  var search = this.search || (query && ('?' + query)) || '';

  if (protocol && protocol.substr(-1) !== ':') protocol += ':';

  // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
  // unless they had them to begin with.
  if (this.slashes ||
      (!protocol || slashedProtocol[protocol]) && host !== false) {
    host = '//' + (host || '');
    if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
  } else if (!host) {
    host = '';
  }

  if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
  if (search && search.charAt(0) !== '?') search = '?' + search;

  pathname = pathname.replace(/[?#]/g, function(match) {
    return encodeURIComponent(match);
  });
  search = search.replace('#', '%23');

  return protocol + host + pathname + search + hash;
};

function urlResolve(source, relative) {
  return urlParse(source, false, true).resolve(relative);
}

Url.prototype.resolve = function(relative) {
  return this.resolveObject(urlParse(relative, false, true)).format();
};

function urlResolveObject(source, relative) {
  if (!source) return relative;
  return urlParse(source, false, true).resolveObject(relative);
}

Url.prototype.resolveObject = function(relative) {
  if (isString(relative)) {
    var rel = new Url();
    rel.parse(relative, false, true);
    relative = rel;
  }

  var result = new Url();
  Object.keys(this).forEach(function(k) {
    result[k] = this[k];
  }, this);

  // hash is always overridden, no matter what.
  // even href="" will remove it.
  result.hash = relative.hash;

  // if the relative url is empty, then there's nothing left to do here.
  if (relative.href === '') {
    result.href = result.format();
    return result;
  }

  // hrefs like //foo/bar always cut to the protocol.
  if (relative.slashes && !relative.protocol) {
    // take everything except the protocol from relative
    Object.keys(relative).forEach(function(k) {
      if (k !== 'protocol')
        result[k] = relative[k];
    });

    //urlParse appends trailing / to urls like http://www.example.com
    if (slashedProtocol[result.protocol] &&
        result.hostname && !result.pathname) {
      result.path = result.pathname = '/';
    }

    result.href = result.format();
    return result;
  }

  if (relative.protocol && relative.protocol !== result.protocol) {
    // if it's a known url protocol, then changing
    // the protocol does weird things
    // first, if it's not file:, then we MUST have a host,
    // and if there was a path
    // to begin with, then we MUST have a path.
    // if it is file:, then the host is dropped,
    // because that's known to be hostless.
    // anything else is assumed to be absolute.
    if (!slashedProtocol[relative.protocol]) {
      Object.keys(relative).forEach(function(k) {
        result[k] = relative[k];
      });
      result.href = result.format();
      return result;
    }

    result.protocol = relative.protocol;
    if (!relative.host && !hostlessProtocol[relative.protocol]) {
      var relPath = (relative.pathname || '').split('/');
      while (relPath.length && !(relative.host = relPath.shift()));
      if (!relative.host) relative.host = '';
      if (!relative.hostname) relative.hostname = '';
      if (relPath[0] !== '') relPath.unshift('');
      if (relPath.length < 2) relPath.unshift('');
      result.pathname = relPath.join('/');
    } else {
      result.pathname = relative.pathname;
    }
    result.search = relative.search;
    result.query = relative.query;
    result.host = relative.host || '';
    result.auth = relative.auth;
    result.hostname = relative.hostname || relative.host;
    result.port = relative.port;
    // to support http.request
    if (result.pathname || result.search) {
      var p = result.pathname || '';
      var s = result.search || '';
      result.path = p + s;
    }
    result.slashes = result.slashes || relative.slashes;
    result.href = result.format();
    return result;
  }

  var isSourceAbs = (result.pathname && result.pathname.charAt(0) === '/'),
      isRelAbs = (
          relative.host ||
          relative.pathname && relative.pathname.charAt(0) === '/'
      ),
      mustEndAbs = (isRelAbs || isSourceAbs ||
                    (result.host && relative.pathname)),
      removeAllDots = mustEndAbs,
      srcPath = result.pathname && result.pathname.split('/') || [],
      relPath = relative.pathname && relative.pathname.split('/') || [],
      psychotic = result.protocol && !slashedProtocol[result.protocol];

  // if the url is a non-slashed url, then relative
  // links like ../.. should be able
  // to crawl up to the hostname, as well.  This is strange.
  // result.protocol has already been set by now.
  // Later on, put the first path part into the host field.
  if (psychotic) {
    result.hostname = '';
    result.port = null;
    if (result.host) {
      if (srcPath[0] === '') srcPath[0] = result.host;
      else srcPath.unshift(result.host);
    }
    result.host = '';
    if (relative.protocol) {
      relative.hostname = null;
      relative.port = null;
      if (relative.host) {
        if (relPath[0] === '') relPath[0] = relative.host;
        else relPath.unshift(relative.host);
      }
      relative.host = null;
    }
    mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
  }

  if (isRelAbs) {
    // it's absolute.
    result.host = (relative.host || relative.host === '') ?
                  relative.host : result.host;
    result.hostname = (relative.hostname || relative.hostname === '') ?
                      relative.hostname : result.hostname;
    result.search = relative.search;
    result.query = relative.query;
    srcPath = relPath;
    // fall through to the dot-handling below.
  } else if (relPath.length) {
    // it's relative
    // throw away the existing file, and take the new path instead.
    if (!srcPath) srcPath = [];
    srcPath.pop();
    srcPath = srcPath.concat(relPath);
    result.search = relative.search;
    result.query = relative.query;
  } else if (!isNullOrUndefined(relative.search)) {
    // just pull out the search.
    // like href='?foo'.
    // Put this after the other two cases because it simplifies the booleans
    if (psychotic) {
      result.hostname = result.host = srcPath.shift();
      //occationaly the auth can get stuck only in host
      //this especialy happens in cases like
      //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
      var authInHost = result.host && result.host.indexOf('@') > 0 ?
                       result.host.split('@') : false;
      if (authInHost) {
        result.auth = authInHost.shift();
        result.host = result.hostname = authInHost.shift();
      }
    }
    result.search = relative.search;
    result.query = relative.query;
    //to support http.request
    if (!isNull(result.pathname) || !isNull(result.search)) {
      result.path = (result.pathname ? result.pathname : '') +
                    (result.search ? result.search : '');
    }
    result.href = result.format();
    return result;
  }

  if (!srcPath.length) {
    // no path at all.  easy.
    // we've already handled the other stuff above.
    result.pathname = null;
    //to support http.request
    if (result.search) {
      result.path = '/' + result.search;
    } else {
      result.path = null;
    }
    result.href = result.format();
    return result;
  }

  // if a url ENDs in . or .., then it must get a trailing slash.
  // however, if it ends in anything else non-slashy,
  // then it must NOT get a trailing slash.
  var last = srcPath.slice(-1)[0];
  var hasTrailingSlash = (
      (result.host || relative.host) && (last === '.' || last === '..') ||
      last === '');

  // strip single dots, resolve double dots to parent dir
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = srcPath.length; i >= 0; i--) {
    last = srcPath[i];
    if (last == '.') {
      srcPath.splice(i, 1);
    } else if (last === '..') {
      srcPath.splice(i, 1);
      up++;
    } else if (up) {
      srcPath.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (!mustEndAbs && !removeAllDots) {
    for (; up--; up) {
      srcPath.unshift('..');
    }
  }

  if (mustEndAbs && srcPath[0] !== '' &&
      (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
    srcPath.unshift('');
  }

  if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
    srcPath.push('');
  }

  var isAbsolute = srcPath[0] === '' ||
      (srcPath[0] && srcPath[0].charAt(0) === '/');

  // put the host back
  if (psychotic) {
    result.hostname = result.host = isAbsolute ? '' :
                                    srcPath.length ? srcPath.shift() : '';
    //occationaly the auth can get stuck only in host
    //this especialy happens in cases like
    //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
    var authInHost = result.host && result.host.indexOf('@') > 0 ?
                     result.host.split('@') : false;
    if (authInHost) {
      result.auth = authInHost.shift();
      result.host = result.hostname = authInHost.shift();
    }
  }

  mustEndAbs = mustEndAbs || (result.host && srcPath.length);

  if (mustEndAbs && !isAbsolute) {
    srcPath.unshift('');
  }

  if (!srcPath.length) {
    result.pathname = null;
    result.path = null;
  } else {
    result.pathname = srcPath.join('/');
  }

  //to support request.http
  if (!isNull(result.pathname) || !isNull(result.search)) {
    result.path = (result.pathname ? result.pathname : '') +
                  (result.search ? result.search : '');
  }
  result.auth = relative.auth || result.auth;
  result.slashes = result.slashes || relative.slashes;
  result.href = result.format();
  return result;
};

Url.prototype.parseHost = function() {
  var host = this.host;
  var port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ':') {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) this.hostname = host;
};

function isString(arg) {
  return typeof arg === "string";
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isNull(arg) {
  return arg === null;
}
function isNullOrUndefined(arg) {
  return  arg == null;
}

},{"punycode":4,"querystring":7}],9:[function(require,module,exports){
/*
 * App.js
 *
 * Provides the glue between views, controllers, and routes for an
 * application's functionality. Apps are responsible for creating pages.
 *
 */

var EventEmitter = require('events').EventEmitter;
var tracks = require('tracks');
var util = require('racer/lib/util');
var derbyTemplates = require('derby-templates');
var documentListeners = require('./documentListeners');
var Page = require('./Page');
var serializedViews = require('./_views');

module.exports = App;

function App(derby, name, filename) {
  EventEmitter.call(this);
  this.derby = derby;
  this.name = name;
  this.filename = filename;
  this.scriptHash = '{{DERBY_SCRIPT_HASH}}';
  this.bundledAt = '{{DERBY_BUNDLED_AT}}';
  this.Page = createAppPage();
  this.proto = this.Page.prototype;
  this.views = new derbyTemplates.templates.Views();
  this.tracksRoutes = tracks.setup(this);
  this.model = null;
  this.page = null;
  this._init();
}

function createAppPage() {
  // Inherit from Page so that we can add controller functions as prototype
  // methods on this app's pages
  function AppPage() {
    Page.apply(this, arguments);
  }
  AppPage.prototype = Object.create(Page.prototype);
  return AppPage;
}

util.mergeInto(App.prototype, EventEmitter.prototype);

// Overriden on server
App.prototype._init = function() {
  this._waitForAttach = true;
  this._cancelAttach = false;
  this.model = new this.derby.Model();
  this.model.createConnection();
  serializedViews(derbyTemplates, this.views);
  // Must init async so that app.on('model') listeners can be added.
  // Must also wait for content ready so that bundle is fully downloaded.
  this._contentReady();
};
App.prototype._finishInit = function() {
  this.emit('model', this.model);
  var script = this._getScript();
  var data = JSON.parse(script.nextSibling.innerHTML);
  util.isProduction = data.nodeEnv === 'production';
  if (!util.isProduction) this._autoRefresh();
  this.model.unbundle(data);
  var page = this.createPage();
  page.params = this.model.get('$render.params');
  this.emit('ready', page);
  this._waitForAttach = false;
  // Instead of attaching, do a route and render if a link was clicked before
  // the page finished attaching
  if (this._cancelAttach) {
    this.history.refresh();
    return;
  }
  // Since an attachment failure is *fatal* and could happen as a result of a
  // browser extension like AdBlock, an invalid template, or a small bug in
  // Derby or Saddle, re-render from scratch on production failures
  if (util.isProduction) {
    try {
      page.attach();
    } catch (err) {
      this.history.refresh();
      console.warn('attachment error', err.stack);
    }
  } else {
    page.attach();
  }
  this.emit('load', page);
};
// Modified from: https://github.com/addyosmani/jquery.parts/blob/master/jquery.documentReady.js
App.prototype._contentReady = function() {
  // Is the DOM ready to be used? Set to true once it occurs.
  var isReady = false;
  var app = this;

  // The ready event handler
  function onDOMContentLoaded() {
    if (document.addEventListener) {
      document.removeEventListener('DOMContentLoaded', onDOMContentLoaded, false);
    } else {
      // we're here because readyState !== 'loading' in oldIE
      // which is good enough for us to call the dom ready!
      document.detachEvent('onreadystatechange', onDOMContentLoaded);
    }
    onDOMReady();
  }

  // Handle when the DOM is ready
  function onDOMReady() {
    // Make sure that the DOM is not already loaded
    if (isReady) return;
    // Make sure body exists, at least, in case IE gets a little overzealous (ticket #5443).
    if (!document.body) return setTimeout(onDOMReady, 0);
    // Remember that the DOM is ready
    isReady = true;
    // Make sure this is always async and then finishin init
    setTimeout(function() {
      app._finishInit();
    }, 0);
  }

  // The DOM ready check for Internet Explorer
  function doScrollCheck() {
    if (isReady) return;
    try {
      // If IE is used, use the trick by Diego Perini
      // http://javascript.nwbox.com/IEContentLoaded/
      document.documentElement.doScroll('left');
    } catch (err) {
      setTimeout(doScrollCheck, 0);
      return;
    }
    // and execute any waiting functions
    onDOMReady();
  }

  // Catch cases where called after the browser event has already occurred.
  if (document.readyState !== 'loading') return onDOMReady();

  // Mozilla, Opera and webkit nightlies currently support this event
  if (document.addEventListener) {
    // Use the handy event callback
    document.addEventListener('DOMContentLoaded', onDOMContentLoaded, false);
    // A fallback to window.onload, that will always work
    window.addEventListener('load', onDOMContentLoaded, false);
    // If IE event model is used
  } else if (document.attachEvent) {
    // ensure firing before onload,
    // maybe late but safe also for iframes
    document.attachEvent('onreadystatechange', onDOMContentLoaded);
    // A fallback to window.onload, that will always work
    window.attachEvent('onload', onDOMContentLoaded);
    // If IE and not a frame
    // continually check to see if the document is ready
    var toplevel;
    try {
      toplevel = window.frameElement == null;
    } catch (err) {}
    if (document.documentElement.doScroll && toplevel) {
      doScrollCheck();
    }
  }
};

App.prototype._getScript = function() {
  return document.querySelector('script[src^="/derby/' + this.name + '"]');
};

App.prototype.use = util.use;
App.prototype.serverUse = util.serverUse;

App.prototype.loadViews = function() {};

App.prototype.loadStyles = function() {};

App.prototype.createPage = function() {
  if (this.page) {
    this.emit('destroyPage', this.page);
    this.page.destroy();
  }
  var page = new this.Page(this, this.model);
  this.page = page;
  return page;
};

App.prototype.onRoute = function(callback, page, next, done) {
  if (this._waitForAttach) {
    // Cancel any routing before the initial page attachment. Instead, do a
    // render once derby is ready
    this._cancelAttach = true;
    return;
  }
  this.emit('route', page);
  // HACK: To update render in transitional routes
  page.model.set('$render.params', page.params);
  page.model.set('$render.url', page.params.url);
  page.model.set('$render.query', page.params.query);
  // If transitional
  if (done) {
    var app = this;
    var _done = function() {
      app.emit('routeDone', page, 'transition');
      done();
    };
    callback.call(page, page, page.model, page.params, next, _done);
    return;
  }
  callback.call(page, page, page.model, page.params, next);
};

App.prototype._autoRefresh = function() {
  var app = this;
  this.model.on('change', '$connection.state', function(state) {
    if (state === 'connected') registerClient();
  });
  this.model.channel.on('derby:refreshViews', function(serializedViews) {
    var fn = new Function('return ' + serializedViews)(); // jshint ignore:line
    fn(derbyTemplates, app.views);
    var ns = app.model.get('$render.ns');
    app.page.render(ns);
  });
  this.model.channel.on('derby:refreshStyles', function(data) {
    var styleElement = document.querySelector('style[data-filename="' +
      data.filename + '"]');
    if (styleElement) styleElement.innerHTML = data.css;
  });
  function registerClient() {
    var data = {name: app.name, hash: app.scriptHash};
    app.model.channel.send('derby:app', data, function(err) {
      if (!err) return;
      // Reload in a timeout so that returning fetches have time to complete
      // in case an onbeforeunload handler is being used
      setTimeout(function() {
        window.location = window.location;
      }, 100);
    });
  }
  registerClient();
};

util.serverRequire(module, './App.server');

},{"./Page":13,"./_views":14,"./documentListeners":16,"derby-templates":23,"events":1,"racer/lib/util":46,"tracks":52}],10:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter;
var util = require('racer/lib/util');
var Dom = require('./Dom');

module.exports = Controller;

function Controller(app, page, model) {
  EventEmitter.call(this);
  this.dom = new Dom(this);
  this.app = app;
  this.page = page;
  this.model = model;
  model.data.$controller = this;
}

util.mergeInto(Controller.prototype, EventEmitter.prototype);

Controller.prototype.emitCancellable = function() {
  var cancelled = false;
  function cancel() {
    cancelled = true;
  }

  var args = Array.prototype.slice.call(arguments);
  args.push(cancel);
  this.emit.apply(this, args);

  return cancelled;
};

Controller.prototype.emitDelayable = function() {
  var args = Array.prototype.slice.call(arguments);
  var callback = args.pop();

  var delayed = false;
  function delay() {
    delayed = true;
    return callback;
  }

  args.push(delay);
  this.emit.apply(this, args);
  if (!delayed) callback();

  return delayed;
};

},{"./Dom":12,"events":1,"racer/lib/util":46}],11:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter;
var Model = require('racer/lib/Model/ModelStandalone');
var util = require('racer/lib/util');
var App = require('./App');
var Page = require('./Page');
var components = require('./components');

module.exports = DerbyStandalone;

require('./documentListeners').add(document);

// Standard Derby inherits from Racer, but we just do set up the event emitter
// and expose the Model and util here instead
function DerbyStandalone() {
  EventEmitter.call(this);
}
util.mergeInto(DerbyStandalone.prototype, EventEmitter.prototype);
DerbyStandalone.prototype.Model = Model;
DerbyStandalone.prototype.util = util;

DerbyStandalone.prototype.App = App;
DerbyStandalone.prototype.Page = Page;
DerbyStandalone.prototype.Component = components.Component;

DerbyStandalone.prototype.createApp = function() {
  return new App(this);
};

// Overriden on server
App.prototype._init = function() {
  this.model = new this.derby.Model();
  this.createPage();
};

},{"./App":9,"./Page":13,"./components":15,"./documentListeners":16,"events":1,"racer/lib/Model/ModelStandalone":35,"racer/lib/util":46}],12:[function(require,module,exports){
module.exports = Dom;

function Dom(controller) {
  this.controller = controller;
  this._listeners = null;
}

Dom.prototype._initListeners = function() {
  var dom = this;
  this.controller.on('destroy', function domOnDestroy() {
    var listeners = dom._listeners;
    if (!listeners) return;
    for (var i = listeners.length; i--;) {
      listeners[i].remove();
    }
    dom._listeners = null;
  });
  return this._listeners = [];
};

Dom.prototype._listenerIndex = function(domListener) {
  var listeners = this._listeners;
  if (!listeners) return -1;
  for (var i = listeners.length; i--;) {
    if (listeners[i].equals(domListener)) return i;
  }
  return -1;
};

Dom.prototype.addListener = function(type, target, listener, useCapture) {
  if (typeof target === 'function') {
    useCapture = listener;
    listener = target;
    target = document;
  }
  var domListener =
    (type === 'destroy') ? new DestroyListener(target, listener) :
    new DomListener(type, target, listener, useCapture);
  if (-1 === this._listenerIndex(domListener)) {
    var listeners = this._listeners || this._initListeners();
    listeners.push(domListener);
  }
  domListener.add();
};
Dom.prototype.on = Dom.prototype.addListener;

Dom.prototype.once = function(type, target, listener, useCapture) {
  if (typeof target === 'function') {
    useCapture = listener;
    listener = target;
    target = document;
  }
  this.addListener(type, target, wrappedListener, useCapture);
  var dom = this;
  function wrappedListener() {
    dom.removeListener(type, target, wrappedListener, useCapture);
    return listener.apply(this, arguments);
  }
};

Dom.prototype.removeListener = function(type, target, listener, useCapture) {
  if (typeof target === 'function') {
    useCapture = listener;
    listener = target;
    target = document;
  }
  var domListener = new DomListener(type, target, listener, useCapture);
  domListener.remove();
  var i = this._listenerIndex(domListener);
  if (i > -1) this._listeners.splice(i, 1);
};

function DomListener(type, target, listener, useCapture) {
  this.type = type;
  this.target = target;
  this.listener = listener;
  this.useCapture = !!useCapture;
}
DomListener.prototype.equals = function(domListener) {
  return this.listener === domListener.listener &&
    this.target === domListener.target &&
    this.type === domListener.type &&
    this.useCapture === domListener.useCapture;
};
DomListener.prototype.add = function() {
  this.target.addEventListener(this.type, this.listener, this.useCapture);
};
DomListener.prototype.remove = function() {
  this.target.removeEventListener(this.type, this.listener, this.useCapture);
};

function DestroyListener(target, listener) {
  DomListener.call(this, 'destroy', target, listener);
}
DestroyListener.prototype = new DomListener();
DestroyListener.prototype.add = function() {
  var listeners = this.target.$destroyListeners || (this.target.$destroyListeners = []);
  if (listeners.indexOf(this.listener) === -1) {
    listeners.push(this.listener);
  }
};
DestroyListener.prototype.remove = function() {
  var listeners = this.target.$destroyListeners;
  if (!listeners) return;
  var index = listeners.indexOf(this.listener);
  if (index !== -1) {
    listeners.splice(index, 1);
  }
};

},{}],13:[function(require,module,exports){
var derbyTemplates = require('derby-templates');
var contexts = derbyTemplates.contexts;
var expressions = derbyTemplates.expressions;
var templates = derbyTemplates.templates;
var util = require('racer/lib/util');
var EventModel = require('./eventmodel');
var textDiff = require('./textDiff');
var Controller = require('./Controller');
var documentListeners = require('./documentListeners');

module.exports = Page;

function Page(app, model, req, res) {
  Controller.call(this, app, this, model);
  this.req = req;
  this.res = res;
  this.params = null;
  if (this.init) this.init(model);
  this.context = this._createContext();
  this._eventModel = null;
  this._removeModelListeners = null;
  this._components = {};
  this._addListeners();
}

util.mergeInto(Page.prototype, Controller.prototype);

Page.prototype.$bodyClass = function(ns) {
  if (!ns) return;
  var classNames = [];
  var segments = ns.split(':');
  for (var i = 0, len = segments.length; i < len; i++) {
    var className = segments.slice(0, i + 1).join('-');
    classNames.push(className);
  }
  return classNames.join(' ');
};

Page.prototype.$preventDefault = function(e) {
  e.preventDefault();
};

Page.prototype.$stopPropagation = function(e) {
  e.stopPropagation();
};

Page.prototype._setRenderParams = function(ns) {
  this.model.set('$render.ns', ns);
  this.model.set('$render.params', this.params);
  this.model.set('$render.url', this.params && this.params.url);
  this.model.set('$render.query', this.params && this.params.query);
};

Page.prototype._setRenderPrefix = function(ns) {
  var prefix = (ns) ? ns + ':' : '';
  this.model.set('$render.prefix', prefix);
};

Page.prototype.get = function(viewName, ns, unescaped) {
  this._setRenderPrefix(ns);
  var view = this.getView(viewName, ns);
  return view.get(this.context, unescaped);
};

Page.prototype.getFragment = function(viewName, ns) {
  this._setRenderPrefix(ns);
  var view = this.getView(viewName, ns);
  return view.getFragment(this.context);
};

Page.prototype.getView = function(viewName, ns) {
  return this.app.views.find(viewName, ns);
};

Page.prototype.render = function(ns) {
  this.app.emit('render', this);
  this.context.pause();
  this._setRenderParams(ns);
  var titleFragment = this.getFragment('TitleElement', ns);
  var bodyFragment = this.getFragment('BodyElement', ns);
  var titleElement = document.getElementsByTagName('title')[0];
  titleElement.parentNode.replaceChild(titleFragment, titleElement);
  document.body.parentNode.replaceChild(bodyFragment, document.body);
  this.context.unpause();
  if (this.create) this.create(this.model, this.dom);
  this.app.emit('routeDone', this, 'render');
};

Page.prototype.attach = function() {
  this.context.pause();
  var ns = this.model.get('$render.ns');
  var titleView = this.getView('TitleElement', ns);
  var bodyView = this.getView('BodyElement', ns);
  var titleElement = document.getElementsByTagName('title')[0];
  titleView.attachTo(titleElement.parentNode, titleElement, this.context);
  bodyView.attachTo(document.body.parentNode, document.body, this.context);
  this.context.unpause();
  if (this.create) this.create(this.model, this.dom);
};

Page.prototype._createContext = function() {
  var contextMeta = new contexts.ContextMeta();
  contextMeta.views = this.app && this.app.views;
  var context = new contexts.Context(contextMeta, this);
  context.expression = new expressions.PathExpression([]);
  context.alias = '#root';
  return context;
};

Page.prototype._addListeners = function() {
  var eventModel = this._eventModel = new EventModel();
  this._addModelListeners(eventModel);
  this._addContextListeners(eventModel);
};

Page.prototype.destroy = function() {
  this.emit('destroy');
  this._removeModelListeners();
  for (var id in this._components) {
    var component = this._components[id];
    component.destroy();
  }
  // Remove all data, refs, listeners, and reactive functions
  // for the previous page
  var silentModel = this.model.silent();
  silentModel.destroy('_page');
  silentModel.destroy('$components');
  // Unfetch and unsubscribe from all queries and documents
  silentModel.unloadAll && silentModel.unloadAll();
};

Page.prototype._addModelListeners = function(eventModel) {
  var model = this.model;
  if (!model) return;

  var context = this.context;
  var changeListener = model.on('change', '**', function onChange(path, value, previous, pass) {
    var segments = util.castSegments(path.split('.'));
    // The pass parameter is passed in for special handling of updates
    // resulting from stringInsert or stringRemove
    eventModel.set(segments, previous, pass);
  });
  var loadListener = model.on('load', '**', function onLoad(path) {
    var segments = util.castSegments(path.split('.'));
    eventModel.set(segments);
  });
  var unloadListener = model.on('unload', '**', function onUnload(path) {
    var segments = util.castSegments(path.split('.'));
    eventModel.set(segments);
  });
  var insertListener = model.on('insert', '**', function onInsert(path, index, values) {
    var segments = util.castSegments(path.split('.'));
    eventModel.insert(segments, index, values.length);
  });
  var removeListener = model.on('remove', '**', function onRemove(path, index, values) {
    var segments = util.castSegments(path.split('.'));
    eventModel.remove(segments, index, values.length);
  });
  var moveListener = model.on('move', '**', function onMove(path, from, to, howMany) {
    var segments = util.castSegments(path.split('.'));
    eventModel.move(segments, from, to, howMany);
  });

  this._removeModelListeners = function() {
    model.removeListener('change', changeListener);
    model.removeListener('load', loadListener);
    model.removeListener('unload', unloadListener);
    model.removeListener('insert', insertListener);
    model.removeListener('remove', removeListener);
    model.removeListener('move', moveListener);
  };
};

Page.prototype._addContextListeners = function(eventModel) {
  this.context.meta.addBinding = addBinding;
  this.context.meta.removeBinding = removeBinding;
  this.context.meta.removeNode = removeNode;
  this.context.meta.addItemContext = addItemContext;
  this.context.meta.removeItemContext = removeItemContext;

  function addItemContext(context) {
    var segments = context.expression.resolve(context);
    eventModel.addItemContext(segments, context);
  }
  function removeItemContext(context) {
    // TODO
  }
  function addBinding(binding) {
    patchTextBinding(binding);
    var expressions = binding.template.expressions;
    if (expressions) {
      for (var i = 0, len = expressions.length; i < len; i++) {
        addDependencies(eventModel, expressions[i], binding);
      }
    } else {
      var expression = binding.template.expression;
      addDependencies(eventModel, expression, binding);
    }
  }
  function removeBinding(binding) {
    var bindingWrappers = binding.meta;
    if (!bindingWrappers) return;
    for (var i = bindingWrappers.length; i--;) {
      eventModel.removeBinding(bindingWrappers[i]);
    }
  }
  function removeNode(node) {
    var component = node.$component;
    if (component && !component.singleton) {
      component.destroy();
    }
    var destroyListeners = node.$destroyListeners;
    if (destroyListeners) {
      for (var i = 0; i < destroyListeners.length; i++) {
        destroyListeners[i]();
      }
    }
  }
};

function addDependencies(eventModel, expression, binding) {
  var bindingWrapper = new BindingWrapper(eventModel, expression, binding);
  bindingWrapper.updateDependencies();
}

// The code here uses object-based set pattern where objects are keyed using
// sequentially generated IDs.
var nextId = 1;
function BindingWrapper(eventModel, expression, binding) {
  this.eventModel = eventModel;
  this.expression = expression;
  this.binding = binding;
  this.id = nextId++;
  this.eventModels = null;
  this.dependencies = null;
  if (binding.meta) {
    binding.meta.push(this);
  } else {
    binding.meta = [this];
  }
}
BindingWrapper.prototype.updateDependencies = function() {
  var dependencies = this.expression.dependencies(this.binding.context);
  if (this.dependencies) {
    // Do nothing if dependencies haven't changed
    if (equalDependencies(this.dependencies, dependencies)) return;
    // Otherwise, remove current dependencies
    this.eventModel.removeBinding(this);
  }
  // Add new dependencies
  if (!dependencies) return;
  this.dependencies = dependencies;
  for (var i = 0, len = dependencies.length; i < len; i++) {
    var dependency = dependencies[i];
    if (dependency) this.eventModel.addBinding(dependency, this);
  }
};
BindingWrapper.prototype.update = function(previous, pass) {
  this.binding.update(previous, pass);
  this.updateDependencies();
};
BindingWrapper.prototype.insert = function(index, howMany) {
  this.binding.insert(index, howMany);
};
BindingWrapper.prototype.remove = function(index, howMany) {
  this.binding.remove(index, howMany);
};
BindingWrapper.prototype.move = function(from, to, howMany) {
  this.binding.move(from, to, howMany);
};

function equalDependencies(a, b) {
  var lenA = a ? a.length : -1;
  var lenB = b ? b.length : -1;
  if (lenA !== lenB) return false;
  for (var i = 0; i < lenA; i++) {
    var itemA = a[i];
    var itemB = b[i];
    var lenItemA = itemA ? itemA.length : -1;
    var lenItemB = itemB ? itemB.length : -1;
    if (lenItemA !== lenItemB) return false;
    for (var j = 0; j < lenItemB; j++) {
      if (itemA[j] !== itemB[j]) return false;
    }
  }
  return true;
}

function patchTextBinding(binding) {
  if (
    binding instanceof templates.AttributeBinding &&
    binding.name === 'value' &&
    binding.element.tagName === 'INPUT' &&
    documentListeners.inputSupportsSelection(binding.element) &&
    binding.template.expression.resolve(binding.context)
  ) {
    binding.update = textInputUpdate;

  } else if (
    binding instanceof templates.NodeBinding &&
    binding.node.parentNode.tagName === 'TEXTAREA' &&
    binding.template.expression.resolve(binding.context)
  ) {
    binding.update = textAreaUpdate;
  }
}

function textInputUpdate(previous, pass) {
  textUpdate(this, this.element, previous, pass);
}
function textAreaUpdate(previous, pass) {
  var element = this.node.parentNode;
  if (element) textUpdate(this, element, previous, pass);
}
function textUpdate(binding, element, previous, pass) {
  if (pass) {
    if (pass.$event && pass.$event.target === element) {
      return;
    } else if (pass.$stringInsert) {
      return textDiff.onStringInsert(
        element,
        previous,
        pass.$stringInsert.index,
        pass.$stringInsert.text
      );
    } else if (pass.$stringRemove) {
      return textDiff.onStringRemove(
        element,
        previous,
        pass.$stringRemove.index,
        pass.$stringRemove.howMany
      );
    }
  }

  if (element.tagName === 'TEXTAREA') {
    var template = binding.template;
    var value = template.expression.get(binding.context);
    return element.value = template.stringify(value);
  }

  binding.template.update(binding.context, binding);
}

util.serverRequire(module, './Page.server');

},{"./Controller":10,"./documentListeners":16,"./eventmodel":17,"./textDiff":18,"derby-templates":23,"racer/lib/util":46}],14:[function(require,module,exports){
// This file is intentionally empty.
// It's used in browserifying as the placeholder for serialized views.

},{}],15:[function(require,module,exports){
/*
 * components.js
 *
 * Components associate custom script functionality with a view. They can be
 * distributed as standalone modules containing templates, scripts, and styles.
 * They can also be used to modularize application functionality.
 *
 */

var path = require('path');
var util = require('racer/lib/util');
var derbyTemplates = require('derby-templates');
var templates = derbyTemplates.templates;
var expressions = derbyTemplates.expressions;
var App = require('./App');
var Controller = require('./Controller');

exports.Component = Component;
exports.ComponentFactory = ComponentFactory;
exports.SingletonComponentFactory = SingletonComponentFactory;
exports.createFactory = createFactory;

function Component(parent, context, id, scope) {
  this.parent = parent;
  this.context = context;
  this.id = id;
  this._scope = scope;
}

util.mergeInto(Component.prototype, Controller.prototype);

Component.prototype.destroy = function() {
  this.emit('destroy');
  this.model.removeContextListeners();
  this.model.destroy();
  delete this.page._components[this.id];
  var components = this.page._eventModel.object.$components;
  if (components) delete components.object[this.id];
};

Component.prototype.get = function(viewName, unescaped) {
  var view = this.getView(viewName);
  return view.get(this.context, unescaped);
};

Component.prototype.getFragment = function(viewName) {
  var view = this.getView(viewName);
  return view.getFragment(this.context);
};

Component.prototype.getView = function(viewName) {
  var contextView = this.context.getView();
  return (viewName) ?
    this.app.views.find(viewName, contextView.namespace) : contextView;
};

Component.prototype.getAttribute = function(key) {
  var attributeContext = this.context.forAttribute(key);
  if (!attributeContext) return;
  var value = attributeContext.attributes[key];
  return value && expressions.renderValue(value, attributeContext);
};

Component.prototype.setAttribute = function(key, value) {
  this.context.parent.attributes[key] = value;
};

Component.prototype.setNullAttribute = function(key, value) {
  var attributes = this.context.parent.attributes;
  if (attributes[key] == null) attributes[key] = value;
};

function initComponent(context, component, parent, model, id, scope) {
  // Do generic controller initialization
  var componentContext = context.componentChild(component);
  Controller.call(component, parent.app, parent.page, model);
  Component.call(component, parent, componentContext, id, scope);

  // Do the user-specific initialization. The component constructor should be
  // an empty function and the actual initialization code should be done in the
  // component's init method. This means that we don't have to rely on users
  // properly calling the Component constructor method and avoids having to
  // play nice with how CoffeeScript extends class constructors
  emitInitHooks(context, component);
  component.emit('init', component);
  if (component.init) component.init(model);

  return componentContext;
}

function emitInitHooks(context, component) {
  if (!context.initHooks) return;
  // Run initHooks for `on` listeners immediately before init
  for (var i = 0, len = context.initHooks.length; i < len; i++) {
    context.initHooks[i].emit(context, component);
  }
}

function setAttributes(context, model) {
  if (!context.attributes) return;
  // Set attribute values on component model
  for (var key in context.attributes) {
    var attribute = context.attributes[key];
    var segments = (
      attribute instanceof templates.ParentWrapper &&
      attribute.expression &&
      attribute.expression.pathSegments(context)
    );
    if (segments) {
      model.root.ref(model._at + '.' + key, segments.join('.'), {updateIndices: true});
    } else {
      model.set(key, attribute);
    }
  }
}

function createFactory(constructor) {
  return (constructor.prototype.singleton) ?
    new SingletonComponentFactory(constructor) :
    new ComponentFactory(constructor);
}

function ComponentFactory(constructor) {
  this.constructor = constructor;
}
ComponentFactory.prototype.init = function(context) {
  var component = new this.constructor();

  var parent = context.controller;
  var id = context.id();
  var scope = ['$components', id];
  var model = parent.model.root.eventContext(component);
  model._at = scope.join('.');
  model.set('id', id);
  setAttributes(context, model);
  // Store a reference to the component's scope such that the expression
  // getters are relative to the component
  model.data = model.get();
  parent.page._components[id] = component;

  return initComponent(context, component, parent, model, id, scope);
};
ComponentFactory.prototype.create = function(context) {
  var component = context.controller;
  component.emit('create', component);
  // Call the component's create function after its view is rendered
  if (component.create) {
    component.create(component.model, component.dom);
  }
};

function SingletonComponentFactory(constructor) {
  this.constructor = constructor;
  this.component = null;
}
SingletonComponentFactory.prototype.init = function(context) {
  if (!this.component) this.component = new this.constructor();
  return context.componentChild(this.component);
};
// Don't call the create method for singleton components
SingletonComponentFactory.prototype.create = function() {};

App.prototype.component = function(viewName, constructor) {
  if (typeof viewName === 'function') {
    constructor = viewName;
    viewName = null;
  }

  // Inherit from Component
  extendComponent(constructor);

  // Load template view from filename
  if (constructor.prototype.view) {
    var viewFilename = constructor.prototype.view;
    viewName = constructor.prototype.name || path.basename(viewFilename, '.html');
    this.loadViews(viewFilename, viewName);

  } else if (!viewName) {
    if (constructor.prototype.name) {
      viewName = constructor.prototype.name;
      var view = this.views.register(viewName);
      view.template = templates.emptyTemplate;
    } else {
      throw new Error('No view name specified for component');
    }
  }

  // Associate the appropriate view with the component type
  var view = this.views.find(viewName);
  if (!view) {
    var message = this.views.findErrorMessage(viewName);
    throw new Error(message);
  }
  view.componentFactory = createFactory(constructor);

  // Make chainable
  return this;
};

function extendComponent(constructor) {
  // Don't do anything if the constructor already extends Component
  if (constructor.prototype instanceof Component) return;
  // Otherwise, replace its prototype with an instance of Component
  var oldPrototype = constructor.prototype;
  constructor.prototype = new Component();
  util.mergeInto(constructor.prototype, oldPrototype);
}

},{"./App":9,"./Controller":10,"derby-templates":23,"path":2,"racer/lib/util":46}],16:[function(require,module,exports){
var textDiff = require('./textDiff');

exports.add = addDocumentListeners;
exports.inputSupportsSelection = inputSupportsSelection;

// http://www.whatwg.org/specs/web-apps/current-work/multipage/the-input-element.html#do-not-apply
// TODO: Date types support
function inputSupportsSelection(input) {
  var type = input.type;
  return (
    type === 'text' ||
    type === 'search' ||
    type === 'url' ||
    type === 'tel' ||
    type === 'password'
  );
}
function inputIsNumberValue(input) {
  var type = input.type;
  return (type === 'number' || (type === 'range' && !input.multiple));
}
function inputValue(input) {
  return inputIsNumberValue(input) ? input.valueAsNumber : input.value;
}

function addDocumentListeners(doc) {
  doc.addEventListener('input', documentInput, true);
  doc.addEventListener('change', documentChange, true);

  // Listen to more events for versions of IE with buggy input event implementations
  if (parseFloat(window.navigator.appVersion.split('MSIE ')[1]) <= 9) {
    // We're listening on selectionchange because there's no other event emitted when
    // the user clicks 'delete' from a context menu when right clicking on selected text.
    // So although this event fires overly aggressively, it's the only real way
    // to ensure that we can detect all changes to the input value in IE <= 9
    doc.addEventListener('selectionchange', function(e){
      if (document.activeElement) {
        documentInput({target: document.activeElement}); // selectionchange evts don't have the e.target we need
      }
    }, true);
  }

  // For some reason valueAsNumber returns NaN for number inputs in IE
  // until a new IE version that handles this is released, parse input.value as a fallback
  var input = document.createElement('input');
  input.type = 'number';
  input.value = '7';
  if (input.valueAsNumber !== input.valueAsNumber) {
    var oldInputValue = inputValue;
    inputValue = function(input) {
      if (input.type === 'number') {
        return inputIsNumberValue(input) ? parseFloat(input.value) : input.value;
      } else {
        return oldInputValue.apply(this, arguments);
      }
    };
  }
}

function documentInput(e) {
  var target = e.target;

  if (target.tagName === 'INPUT') {
    setInputValue(e, target);

  } else if (target.tagName === 'TEXTAREA' && target.childNodes.length === 1) {
    var binding = target.firstChild && target.firstChild.$bindNode;
    if (!binding || binding.isUnbound()) return;

    var pass = {$event: e};
    textDiffBinding(binding, target.value, pass);
  }
}

function documentChange(e) {
  var target = e.target;

  if (target.tagName === 'INPUT') {
    setBoundProperty(target, 'checked');
    setInputValue(e, target);

  } else if (target.tagName === 'SELECT') {
    setOptionBindings(target);
  }
}

function setBoundProperty(node, property) {
  var binding = node.$bindAttributes && node.$bindAttributes[property];
  if (!binding || binding.isUnbound()) return;

  var value = node[property];
  binding.template.expression.set(binding.context, value);
}

function setInputValue(e, target) {
  var binding = target.$bindAttributes && target.$bindAttributes.value;
  if (!binding || binding.isUnbound()) return;

  if (inputSupportsSelection(target)) {
    var pass = {$event: e};
    textDiffBinding(binding, target.value, pass);
  } else {
    var value = inputValue(target);
    binding.template.expression.set(binding.context, value);
  }
}

function textDiffBinding(binding, value, pass) {
  var expression = binding.template.expression;
  var segments = expression.pathSegments(binding.context);
  if (segments) {
    var model = binding.context.controller.model.pass(pass);
    textDiff.onTextInput(model, segments, value);
  } else if (expression.set) {
    expression.set(binding.context, value);
  }
}

function setOptionBindings(parent) {
  for (var node = parent.firstChild; node; node = node.nextSibling) {
    if (node.tagName === 'OPTION') {
      setBoundProperty(node, 'selected');
    } else if (node.hasChildNodes()) {
      setOptionBindings(node);
    }
  }
}

},{"./textDiff":18}],17:[function(require,module,exports){
var expressions = require('derby-templates').expressions;

// The many trees of bindings:
//
// - Model tree, containing your actual data. Eg:
//    {users:{fred:{age:40}, wilma:{age:37}}}
//
// - Event model tree, whose structure mirrors the model tree. The event model
//   tree lets us annotate the model tree with listeners which fire when events
//   change. I think there are three types of listeners:
//
//   1. Reference binding binds to whatever is referred to by the path. Eg,
//   {{each items as item}} binds item by reference as it goes through the
//   list.
//   2. Fixed path bindings explicitly bind to whatever is at that path
//   regardless of how the model changes underneath the event model
//   3. Listen on a subtree and fire when anything in the subtree changes. This
//   is used for custom functions.
//
// {{foo.id}} would listen on the fixed path ['foo', 'id'].
//
//
// - Context tree represents the changing (embedded) contexts of the templating
//   engine. This maps to the tree of templates and allows templates to reference
//   anything in any of their enclosing template scopes.
//

module.exports = EventModel;

// The code here uses object-based set pattern where objects are keyed using
// sequentially generated IDs.
var nextId = 1;

// A binding object is something with update(), insert()/move()/remove() defined.


// Given x[y] with model.get(y) == 5:
//  item = 5
//  segments = ['y']
//  outside = the EventModel for x.
//
// Note that item could be a Context or another ModelRef - eg:
//
// {{ each foo as bar }} ... {{ x[bar] }}  -or-  {{ x[y[z]] }}
function ModelRef(model, item, segments, outside) {
  this.id = nextId++;

  // We need a reference to the model & our segment list so we can update our
  // value.
  this.model = model;
  this.segments = segments;

  // Our current value.
  this.item = item;

  // outside is a reference to the EventModel of the thing on the lhs of the
  // brackets. For example, in x[y].z, outside is the EventModel of x.
  this.outside = outside;

  // result is the EventModel of the evaluated version of the brackets. In
  // x[y].z, its the EventModel of x[y].
  this.result = outside.child(item).refChild(this);
}

ModelRef.prototype.update = function() {
  var segments = expressions.pathSegments(this.segments);
  var newItem = expressions.lookup(segments, this.model.data);
  if (this.item === newItem) return;

  // First remove myself.
  delete this.outside.child(this.item).refChildren[this.id];

  this.item = newItem;

  var container = this.outside.child(this.item);
  // I want to just call refChild but that would create a new EM. Instead I
  // want to just implant my current EM there.
  if (!container.refChildren) container.refChildren = new RefChildrenMap();
  container.refChildren[this.id] = this.result;

  // Finally, update all the bindings in the tree.
  this.result.update();
};


function RefOutMap() {}
function RefChildrenMap() {}
function BindingsMap() {}
function ItemContextsMap() {}
function EventModelsMap() {}

function EventModel() {
  this.id = nextId++;

  // Most of these won't ever be filled in, so I'm just leaving them null.
  //
  // These contain our EventModel children.
  this.object = null;
  this.array = null;

  // This contains any EventModel children which have floating references.
  this.arrayByReference = null;

  // If the data stored here is ever used to lookup other values, this is an
  // object mapping remote child ID -> ref.
  //
  // Eg given x[y], y.refOut[x.id] = <Binding>
  this.refOut = null;

  // This is a map from ref id -> event model for events bound to this
  // EventModel but via a ref. We could just merge them into the main tree, but
  // this way they're easy to move.
  //
  // Eg, given x[y] (y=1), x.1.refChildren[ref id] is an EventModel.
  this.refChildren = null;

  this.bindings = null;

  // Item contexts are contexts which need their item number changed as this
  // EventModel object moves around its surrounding list.
  this.itemContexts = null;
}

EventModel.prototype.refChild = function(ref) {
  if (!this.refChildren) this.refChildren = new RefChildrenMap();
  var id = ref.id;

  if (!this.refChildren[id]) {
    this.refChildren[id] = new EventModel();
  }
  return this.refChildren[id];
};

EventModel.prototype.arrayLookup = function(model, segmentsBefore, segmentsInside) {
  var segments = expressions.pathSegments(segmentsInside);
  var item = expressions.lookup(segments, model.data);

  var source = this.at(segmentsInside);

  // What the array currently resolves to. Given x[y] with y=1, container is
  // the EM for x
  var container = this.at(segmentsBefore);

  if (!source.refOut) source.refOut = new RefOutMap();

  var ref = source.refOut[container.id];
  if (ref == null) {
    ref = new ModelRef(model, item, segmentsInside, container);
    source.refOut[container.id] = ref;
  }

  return ref;
};

// Returns the EventModel node of the named child.
EventModel.prototype.child = function(segment) {
  var container;
  if (typeof segment === 'string') {
    // Object
    if (!this.object) this.object = {};
    container = this.object;

  } else if (typeof segment === 'number') {
    // Array by value
    if (!this.array) this.array = [];
    container = this.array;

  } else if (segment instanceof ModelRef) {
    // Array reference. We'll need to lookup the child with the right
    // value, then look inside its ref children for the right EventModel
    // (so we can update it later). This is pretty janky, but should be
    // *correct* even in the face of recursive array accessors.
    //
    // This will calculate it based on the current segment values, but refs
    // cache the EM anyway.
    //return this.child(segment.item).refChild(segment);
    return segment.result;

  } else {
    // Array by reference
    if (!this.arrayByReference) this.arrayByReference = [];
    container = this.arrayByReference;
    segment = segment.item;
  }

  return container[segment] || (container[segment] = new EventModel());
};

// Returns the EventModel node at the given segments list. Note that although
// EventModel nodes are unique, its possible for multiple EventModel nodes to
// refer to the same section of the model because of references.
//
// If you want to update the bindings that refer to a specific path, use
// each().
//
// EventModel objects are created as needed.
EventModel.prototype.at = function(segments) {
  // For unbound dependancies.
  if (segments == null) return this;

  var eventModel = this;

  for (var i = 0; i < segments.length; i++) {
    eventModel = eventModel.child(segments[i]);
  }

  return eventModel;
};

EventModel.prototype.isEmpty = function() {
  if (hasKeys(this.dependancies)) return false;
  if (hasKeys(this.itemContexts)) return false;

  if (this.object) {
    if (hasKeys(this.object)) return false;
    this.object = null;
  }

  if (this.arrayByReference) {
    for (var i = 0; i < this.arrayByReference.length; i++) {
      if (this.arrayByReference[i] != null) return false;
    }
    this.arrayByReference = null;
  }

  if (this.array) {
    for (var i = 0; i < this.array.length; i++) {
      if (this.array[i] != null) return false;
    }
    this.array = null;
  }

  return true;
};

function hasKeys(object) {
  for (var key in object) {
    return true;
  }
  return false;
}


// **** Updating the EventModel

EventModel.prototype._addItemContext = function(context) {
  if (!context._id) context._id = nextId++;
  if (!this.itemContexts) this.itemContexts = new ItemContextsMap();
  this.itemContexts[context._id] = context;
};

EventModel.prototype._removeItemContext = function(context) {
  if (this.itemContexts) {
    delete this.itemContexts[context._id];
  }
};

EventModel.prototype._addBinding = function(binding) {
  var bindings = this.bindings || (this.bindings = new BindingsMap());
  binding.eventModels || (binding.eventModels = new EventModelsMap());
  bindings[binding.id] = binding;
  binding.eventModels[this.id] = this;
};

// This is the main hook to add bindings to the event model tree. It should
// only be called on the root EventModel object.
EventModel.prototype.addBinding = function(segments, binding) {
  this.at(segments)._addBinding(binding);
};

// This is used for objects (contexts in derby's case) that have a .item
// property which refers to an array index.
EventModel.prototype.addItemContext = function(segments, context) {
  this.at(segments)._addItemContext(context);
};

EventModel.prototype.removeBinding = function(binding) {
  if (!binding.eventModels) return;
  for (var id in binding.eventModels) {
    var eventModel = binding.eventModels[id];
    if (eventModel.bindings) delete eventModel.bindings[binding.id];
  }
  binding.eventModels = null;
};

EventModel.prototype._each = function(segments, pos, fn) {
  // Our refChildren are effectively merged into this object.
  if (this.refChildren) {
    for (var id in this.refChildren) {
      var refChild = this.refChildren[id];
      if (refChild) refChild._each(segments, pos, fn);
    }
  }

  if (segments.length === pos) {
    fn(this);
    return;
  }

  var segment = segments[pos];
  var child;
  if (typeof segment === 'string') {
    // Object. Just recurse into our objects set. Its possible to rewrite this
    // function to simply loop in the case of object lookups, but I don't think
    // it'll buy us much.
    child = this.object && this.object[segment];
    if (child) child._each(segments, pos + 1, fn);

  } else {
    // Number. Recurse both into the fixed list and the reference list.
    child = this.array && this.array[segment];
    if (child) child._each(segments, pos + 1, fn);

    child = this.arrayByReference && this.arrayByReference[segment];
    if (child) child._each(segments, pos + 1, fn);
  }
};

// Called when the scalar value at the path changes. This only calls update()
// on this node. See update() below if you want to update entire
// subtrees.
EventModel.prototype.localUpdate = function(previous, pass) {
  if (this.bindings) {
    for (var id in this.bindings) {
      var binding = this.bindings[id];
      if (binding) binding.update(previous, pass);
    }
  }

  // If our value changed, we also need to update anything that depends on it
  // via refOut.
  if (this.refOut) {
    for (var id in this.refOut) {
      var ref = this.refOut[id];
      if (ref) ref.update();
    }
  }
};

// This is used when an object subtree is replaced / removed.
EventModel.prototype.update = function(previous, pass) {
  this.localUpdate(previous, pass);

  if (this.object) {
    for (var key in this.object) {
      var binding = this.object[key];
      if (binding) binding.update();
    }
  }

  if (this.array) {
    for (var i = 0; i < this.array.length; i++) {
      var binding = this.array[i];
      if (binding) binding.update();
    }
  }

  if (this.arrayByReference) {
    for (var i = 0; i < this.arrayByReference.length; i++) {
      var binding = this.arrayByReference[i];
      if (binding) binding.update();
    }
  }
};

// Updates the indexes in itemContexts of our children in the range of
// [from, to). from and to both optional.
EventModel.prototype._updateChildItemContexts = function(from, to) {
  if (!this.arrayByReference) return;

  if (from == null) from = 0;
  if (to == null) to = this.arrayByReference.length;

  for (var i = from; i < to; i++) {
    var contexts = this.arrayByReference[i] &&
      this.arrayByReference[i].itemContexts;
    if (contexts) {
      for (var key in contexts) {
        contexts[key].item = i;
      }
    }
  }
};

// Updates our array-by-value values. They have to recursively update every
// binding in their children. Sad.
EventModel.prototype._updateArray = function(from, to) {
  if (!this.array) return;

  if (from == null) from = 0;
  if (to == null) to = this.array.length;

  for (var i = from; i < to; i++) {
    var binding = this.array[i];
    if (binding) binding.update();
  }
};

EventModel.prototype._updateObject = function() {
  if (this.object) {
    for (var key in this.object) {
      var binding = this.object[key];
      if (binding) binding.update();
    }
  }
};

EventModel.prototype._set = function(previous, pass) {
  // This just updates anything thats bound to the whole subtree. An alternate
  // implementation could be passed in the new value at this node (which we
  // cache), then compare with the old version and only update parts of the
  // subtree which are relevant. I don't know if thats an important
  // optimization - it really depends on your use case.
  this.update(previous, pass);
};

// Insert into this EventModel node.
EventModel.prototype._insert = function(index, howMany) {
  // Update fixed paths
  this._updateArray(index);

  // Update relative paths
  if (this.arrayByReference && this.arrayByReference.length > index) {
    // Shift the actual items in the array references array.

    // This probably isn't the best way to implement insert. Other options are
    // using concat() on slices or though constructing a temporary array and
    // using splice.call. Hopefully if this method is slow it'll come up during
    // profiling.
    for (var i = 0; i < howMany; i++) {
      this.arrayByReference.splice(index, 0, null);
    }

    // Update the path in the contexts
    this._updateChildItemContexts(index + howMany);
  }

  // Finally call our bindings.
  if (this.bindings) {
    for (var id in this.bindings) {
      var binding = this.bindings[id];
      if (binding) binding.insert(index, howMany);
    }
  }
  this._updateObject();
};

// Remove howMany child elements from this EventModel at index.
EventModel.prototype._remove = function(index, howMany) {
  // Update fixed paths. Both the removed items and items after it may have changed.
  this._updateArray(index);

  if (this.arrayByReference) {
    // Update relative paths. First throw away all the children which have been removed.
    this.arrayByReference.splice(index, howMany);

    this._updateChildItemContexts(index);
  }

  // Call bindings.
  if (this.bindings) {
    for (var id in this.bindings) {
      var binding = this.bindings[id];
      if (binding) binding.remove(index, howMany);
    }
  }
  this._updateObject();
};

// Move howMany items from `from` to `to`.
EventModel.prototype._move = function(from, to, howMany) {
  // first points to the first element that was moved. end points to the list
  // element past the end of the changed region.
  var first, end;
  if (from < to) {
    first = from;
    end = to + howMany;
  } else {
    first = to;
    end = from + howMany;
  }

  // Update fixed paths.
  this._updateArray(first, end);

  // Update relative paths
  var arr = this.arrayByReference;
  if (arr && arr.length > first) {
    // Remove from the old location
    var values = arr.splice(from, howMany);

    // Insert at the new location
    arr.splice.apply(arr, [to, 0].concat(values));

    // Update the path in the contexts
    this._updateChildItemContexts(first, end);
  }

  // Finally call our bindings.
  if (this.bindings) {
    for (var id in this.bindings) {
      var binding = this.bindings[id];
      if (binding) binding.move(from, to, howMany);
    }
  }
  this._updateObject();
};


// Helpers.

EventModel.prototype.mutate = function(segments, fn) {
  // This finds & returns a list of all event models which exist and could match
  // the specified path. The path cannot contain contexts like derby expression
  // segment lists (just because I don't think thats a useful feature and its not
  // implemented)
  this._each(segments, 0, fn);

  // Also emit all mutations as sets on star paths, which are how dependencies
  // for view helper functions are represented. They should react to a path
  // or any child path being modified
  for (var i = 0, len = segments.length; i++ < len;) {
    var wildcardSegments = segments.slice(0, i);
    wildcardSegments.push('*');
    this._each(wildcardSegments, 0, childSetWildcard);
  }
};

function childSetWildcard(child) {
  child._set();
}

EventModel.prototype.set = function(segments, previous, pass) {
  this.mutate(segments, function childSet(child) {
    child._set(previous, pass);
  });
};

EventModel.prototype.insert = function(segments, index, howMany) {
  this.mutate(segments, function childInsert(child) {
    child._insert(index, howMany);
  });
};

EventModel.prototype.remove = function(segments, index, howMany) {
  this.mutate(segments, function childRemove(child) {
    child._remove(index, howMany);
  });
};

EventModel.prototype.move = function(segments, from, to, howMany) {
  this.mutate(segments, function childMove(child) {
    child._move(from, to, howMany);
  });
};

},{"derby-templates":23}],18:[function(require,module,exports){
exports.onStringInsert = onStringInsert;
exports.onStringRemove = onStringRemove;
exports.onTextInput = onTextInput;

function onStringInsert(el, previous, index, text) {
  function transformCursor(cursor) {
    return (index < cursor) ? cursor + text.length : cursor;
  }
  previous || (previous = '');
  var newText = previous.slice(0, index) + text + previous.slice(index);
  replaceText(el, newText, transformCursor);
}

function onStringRemove(el, previous, index, howMany) {
  function transformCursor(cursor) {
    return (index < cursor) ? cursor - Math.min(howMany, cursor - index) : cursor;
  }
  previous || (previous = '');
  var newText = previous.slice(0, index) + previous.slice(index + howMany);
  replaceText(el, newText, transformCursor);
}

function replaceText(el, newText, transformCursor) {
  var selectionStart = transformCursor(el.selectionStart);
  var selectionEnd = transformCursor(el.selectionEnd);

  var scrollTop = el.scrollTop;
  el.value = newText;
  if (el.scrollTop !== scrollTop) {
    el.scrollTop = scrollTop;
  }
  if (document.activeElement === el) {
    el.selectionStart = selectionStart;
    el.selectionEnd = selectionEnd;
  }
}

function onTextInput(model, segments, value) {
  var previous = model._get(segments) || '';
  if (previous === value) return;
  var start = 0;
  while (previous.charAt(start) === value.charAt(start)) {
    start++;
  }
  var end = 0;
  while (
    previous.charAt(previous.length - 1 - end) === value.charAt(value.length - 1 - end) &&
    end + start < previous.length &&
    end + start < value.length
  ) {
    end++;
  }

  if (previous.length !== start + end) {
    var howMany = previous.length - start - end;
    model._stringRemove(segments, start, howMany);
  }
  if (value.length !== start + end) {
    var inserted = value.slice(start, value.length - end);
    model._stringInsert(segments, start, inserted);
  }
}

},{}],19:[function(require,module,exports){
var derbyTemplates = require('derby-templates');
var expressions = derbyTemplates.expressions;
var operatorFns = derbyTemplates.operatorFns;
var esprima = require('esprima-derby');
var Syntax = esprima.Syntax;

module.exports = createPathExpression;

function createPathExpression(source) {
  var node = esprima.parse(source).expression;
  return reduce(node);
}

function reduce(node) {
  var type = node.type;
  if (type === Syntax.MemberExpression) {
    return reduceMemberExpression(node);
  } else if (type === Syntax.Identifier) {
    return reduceIdentifier(node);
  } else if (type === Syntax.ThisExpression) {
    return reduceThis(node);
  } else if (type === Syntax.CallExpression) {
    return reduceCallExpression(node);
  } else if (type === Syntax.Literal) {
    return reduceLiteral(node);
  } else if (type === Syntax.UnaryExpression) {
    return reduceUnaryExpression(node);
  } else if (type === Syntax.BinaryExpression || type === Syntax.LogicalExpression) {
    return reduceBinaryExpression(node);
  } else if (type === Syntax.ConditionalExpression) {
    return reduceConditionalExpression(node);
  } else if (type === Syntax.ArrayExpression) {
    return reduceArrayExpression(node);
  } else if (type === Syntax.ObjectExpression) {
    return reduceObjectExpression(node);
  } else if (type === Syntax.SequenceExpression) {
    return reduceSequenceExpression(node);
  } else if (type === Syntax.NewExpression) {
    return reduceNewExpression(node);
  }
  unexpected(node);
}

function reduceMemberExpression(node, afterSegments) {
  if (node.computed) {
    // Square brackets
    if (node.property.type === Syntax.Literal) {
      return reducePath(node, node.property.value, afterSegments);
    }
    var before = reduce(node.object);
    var inside = reduce(node.property);
    return new expressions.BracketsExpression(before, inside, afterSegments);
  }
  // Dot notation
  if (node.property.type === Syntax.Identifier) {
    return reducePath(node, node.property.name);
  }
  unexpected(node);
}

function reducePath(node, segment, afterSegments) {
  var segments = [segment];
  if (afterSegments) segments = segments.concat(afterSegments);
  var relative = false;
  while (node = node.object) {
    if (node.type === Syntax.MemberExpression) {
      if (node.computed) {
        return reduceMemberExpression(node, segments);
      } else if (node.property.type === Syntax.Identifier) {
        segments.unshift(node.property.name);
      } else {
        unexpected(node);
      }
    } else if (node.type === Syntax.Identifier) {
      segments.unshift(node.name);
    } else if (node.type === Syntax.ThisExpression) {
      relative = true;
    } else if (node.type === Syntax.CallExpression) {
      return reduceCallExpression(node, segments);
    } else if (node.type === Syntax.SequenceExpression) {
      return reduceSequenceExpression(node, segments);
    } else if (node.type === Syntax.NewExpression) {
      return reduceNewExpression(node, segments);
    } else {
      unexpected(node);
    }
  }
  return (relative) ?
    new expressions.RelativePathExpression(segments) :
    createSegmentsExpression(segments);
}

function reduceIdentifier(node) {
  var segments = [node.name];
  return createSegmentsExpression(segments);
}

function reduceThis(node) {
  var segments = [];
  return new expressions.RelativePathExpression(segments);
}

function createSegmentsExpression(segments) {
  var firstSegment = segments[0];
  var firstChar = firstSegment.charAt && firstSegment.charAt(0);

  if (firstChar === '#') {
    var alias = firstSegment;
    segments.shift();
    return new expressions.AliasPathExpression(alias, segments);

  } else if (firstChar === '@') {
    var attribute = firstSegment.slice(1);
    segments.shift();
    return new expressions.AttributePathExpression(attribute, segments);

  } else {
    return new expressions.PathExpression(segments);
  }
}

function reduceCallExpression(node, afterSegments) {
  return reduceFnExpression(node, afterSegments, expressions.FnExpression);
}

function reduceNewExpression(node, afterSegments) {
  return reduceFnExpression(node, afterSegments, expressions.NewExpression);
}

function reduceFnExpression(node, afterSegments, Constructor) {
  var args = node.arguments.map(reduce);
  var callee = node.callee;
  if (callee.type === Syntax.Identifier) {
    if (callee.name === '$at') {
      return new expressions.ScopedModelExpression(args[0]);
    }
    var segments = [callee.name];
    return new Constructor(segments, args, afterSegments);
  } else if (callee.type === Syntax.MemberExpression) {
    var segments = reduceMemberExpression(callee).segments;
    return new Constructor(segments, args, afterSegments);
  } else {
    unexpected(node);
  }
}

function reduceLiteral(node) {
  return new expressions.LiteralExpression(node.value);
}

function reduceUnaryExpression(node) {
  // `-` and `+` can be either unary or binary, so all unary operators are
  // postfixed with `U` to differentiate
  var operator = node.operator + 'U';
  var expression = reduce(node.argument);
  if (expression instanceof expressions.LiteralExpression) {
    var fn = operatorFns.get[operator];
    expression.value = fn(expression.value);
    return expression;
  }
  return new expressions.OperatorExpression(operator, [expression]);
}

function reduceBinaryExpression(node) {
  var operator = node.operator;
  var left = reduce(node.left);
  var right = reduce(node.right);
  if (
    left instanceof expressions.LiteralExpression &&
    right instanceof expressions.LiteralExpression
  ) {
    var fn = operatorFns.get[operator];
    var value = fn(left.value, right.value);
    return new expressions.LiteralExpression(value);
  }
  return new expressions.OperatorExpression(operator, [left, right]);
}

function reduceConditionalExpression(node) {
  var test = reduce(node.test);
  var consequent = reduce(node.consequent);
  var alternate = reduce(node.alternate);
  if (
    test instanceof expressions.LiteralExpression &&
    consequent instanceof expressions.LiteralExpression &&
    alternate instanceof expressions.LiteralExpression
  ) {
    var value = (test.value) ? consequent.value : alternate.value;
    return new expressions.LiteralExpression(value);
  }
  return new expressions.OperatorExpression('?', [test, consequent, alternate]);
}

function reduceArrayExpression(node) {
  var elements = node.elements;
  var literal = [];
  var args = [];
  var isLiteral = true;
  for (var i = 0, len = elements.length; i < len; i++) {
    var expression = reduce(elements[i]);
    args.push(expression);
    if (isLiteral && expression instanceof expressions.LiteralExpression) {
      literal.push(expression.value);
    } else {
      isLiteral = false;
    }
  }
  return (isLiteral) ?
    new expressions.LiteralExpression(literal) :
    new expressions.OperatorExpression('[]', args);
}

function reduceObjectExpression(node) {
  var properties = node.properties;
  var literal = {};
  var args = [];
  var isLiteral = true;
  for (var i = 0, len = properties.length; i < len; i++) {
    var property = properties[i];
    var key = getKeyName(property.key);
    var keyExpression = new expressions.LiteralExpression(key);
    var expression = reduce(property.value);
    args.push(keyExpression, expression);
    if (isLiteral && expression instanceof expressions.LiteralExpression) {
      literal[key] = expression.value;
    } else {
      isLiteral = false;
    }
  }
  return (isLiteral) ?
    new expressions.LiteralExpression(literal) :
    new expressions.OperatorExpression('{}', args);
}

function getKeyName(key) {
  return (key.type === Syntax.Identifier) ? key.name :
    (key.type === Syntax.Literal) ? key.value :
    unexpected(key);
}

function reduceSequenceExpression(node, afterSegments) {
  // Note that sequence expressions are not reduced to a literal if they only
  // contain literals. There isn't any utility to such an expression, so it
  // isn't worth optimizing.
  //
  // The fact that expressions separated by commas always parse into a sequence
  // is relied upon in parsing template tags that have comma-separated
  // arguments following a keyword
  var args = node.expressions.map(reduce);
  return new expressions.SequenceExpression(args, afterSegments);
}

function unexpected(node) {
  throw new Error('Unexpected Esprima node: ' + JSON.stringify(node, null, 2));
}

},{"derby-templates":23,"esprima-derby":22}],20:[function(require,module,exports){
var htmlUtil = require('html-util');
var derbyTemplates = require('derby-templates');
var templates = derbyTemplates.templates;
var expressions = derbyTemplates.expressions;
var createPathExpression = require('./createPathExpression');
var markup = require('./markup');

exports.createTemplate = createTemplate;
exports.createStringTemplate = createStringTemplate;
exports.createExpression = createExpression;
exports.createPathExpression = createPathExpression;
exports.markup = markup;

// View.prototype._parse is defined here, so that it doesn't have to
// be included in the client if templates are all parsed server-side
templates.View.prototype._parse = function() {
  // Wrap parsing in a try / catch to add context to message when throwing
  var template;
  try {
    if (this.string) {
      template = createStringTemplate(this.source, this);
    } else {
      var source = (this.unminified) ? this.source :
        htmlUtil.minify(this.source).replace(/&sp;/g, ' ');
      template = createTemplate(source, this);
    }
  } catch (err) {
    var message = '\n\nWithin template "' + this.name + '":\n' + this.source;
    throw appendErrorMessage(err, message);
  }
  this.template = template;
  return template;
};

// Modified and shared among the following parse functions. It's OK for this
// to be shared at the module level, since it is only used by synchronous code
var parseNode;

function createTemplate(source, view) {
  source = escapeBraced(source);
  parseNode = new ParseNode(view);
  htmlUtil.parse(source, {
    start: parseHtmlStart
  , end: parseHtmlEnd
  , text: parseHtmlText
  , comment: parseHtmlComment
  , other: parseHtmlOther
  });
  // Allow for elements at the end of a template to not be closed. This is
  // especially important so that the </body> and </html> tags can be omitted,
  // since Derby sends an additional script tag after the HTML for the page
  while (parseNode.parent) {
    parseNode = parseNode.parent;
    var last = parseNode.last();
    if (last instanceof templates.Element) {
      last.notClosed = true;
      last.endTag = '';
      continue;
    }
    unexpected();
  }
  return new templates.Template(parseNode.content);
}

function createStringTemplate(source, view) {
  source = escapeBraced(source);
  parseNode = new ParseNode(view);
  parseText(source, parseTextLiteral, parseTextExpression, 'string');
  return new templates.Template(parseNode.content);
}

function parseHtmlStart(tag, tagName, attributes, selfClosing) {
  var lowerTagName = tagName.toLowerCase();
  var hooks;
  if (lowerTagName !== 'view' && !viewForTagName(lowerTagName)) {
    hooks = elementHooksFromAttributes(attributes);
  }
  var attributesMap = parseAttributes(attributes);
  var namespaceUri = (lowerTagName === 'svg') ?
    templates.NAMESPACE_URIS.svg : parseNode.namespaceUri;
  var Constructor = templates.Element;
  if (lowerTagName === 'tag') {
    Constructor = templates.DynamicElement;
    tagName = attributesMap.is;
    delete attributesMap.is;
  }
  if (selfClosing || templates.VOID_ELEMENTS[lowerTagName]) {
    var element = new Constructor(tagName, attributesMap, null, hooks, selfClosing, null, namespaceUri);
    parseNode.content.push(element);
    parseElementClose(lowerTagName);
  } else {
    parseNode = parseNode.child();
    parseNode.namespaceUri = namespaceUri;
    var element = new Constructor(tagName, attributesMap, parseNode.content, hooks, selfClosing, null, namespaceUri);
    parseNode.parent.content.push(element);
  }
}

function parseAttributes(attributes) {
  var attributesMap;
  for (var key in attributes) {
    if (!attributesMap) attributesMap = {};

    var value = attributes[key];
    var match = /([^:]+):[^:]/.exec(key);
    var nsUri = match && templates.NAMESPACE_URIS[match[1]];
    if (value === '' || typeof value !== 'string') {
      attributesMap[key] = new templates.Attribute(value, nsUri);
      continue;
    }

    parseNode = parseNode.child();
    parseText(value, parseTextLiteral, parseTextExpression, 'attribute');

    if (parseNode.content.length === 1) {
      var item = parseNode.content[0];
      attributesMap[key] =
        (item instanceof templates.Text) ? new templates.Attribute(item.data, nsUri) :
        (item instanceof templates.DynamicText) ?
          (item.expression instanceof expressions.LiteralExpression) ?
            new templates.Attribute(item.expression.value, nsUri) :
            new templates.DynamicAttribute(item.expression, nsUri) :
          new templates.DynamicAttribute(item, nsUri);

    } else if (parseNode.content.length > 1) {
      var template = new templates.Template(parseNode.content);
      attributesMap[key] = new templates.DynamicAttribute(template, nsUri);

    } else {
      throw new Error('Error parsing ' + key + ' attribute: ' + value);
    }

    parseNode = parseNode.parent;
  }
  return attributesMap;
}

function parseHtmlEnd(tag, tagName) {
  parseNode = parseNode.parent;
  var last = parseNode.last();
  if (!(
    (last instanceof templates.DynamicElement && tagName.toLowerCase() === 'tag') ||
    (last instanceof templates.Element && last.tagName === tagName)
  )) {
    throw new Error('Mismatched closing HTML tag: ' + tag);
  }
  parseElementClose(tagName);
}

function parseElementClose(tagName) {
  if (tagName === 'view') {
    var element = parseNode.content.pop();
    parseViewElement(element);
    return;
  }
  var view = viewForTagName(tagName);
  if (view) {
    var element = parseNode.content.pop();
    parseNamedViewElement(element, view, view.name);
    return;
  }
  var element = parseNode.last();
  markup.emit('element', element);
  markup.emit('element:' + tagName, element);
}

function viewForTagName(tagName) {
  return parseNode.view && parseNode.view.views.tagMap[tagName];
}

function parseHtmlText(data, isRawText) {
  var environment = (isRawText) ? 'string' : 'html';
  parseText(data, parseTextLiteral, parseTextExpression, environment);
}

function parseHtmlComment(tag, data) {
  // Only output comments that start with `<!--[` and end with `]-->`
  if (!htmlUtil.isConditionalComment(tag)) return;
  var comment = new templates.Comment(data);
  parseNode.content.push(comment);
}

var doctypeRegExp = /^<!DOCTYPE\s+([^\s]+)(?:\s+(PUBLIC|SYSTEM)\s+"([^"]+)"(?:\s+"([^"]+)")?)?\s*>/i;

function parseHtmlOther(tag) {
  var match = doctypeRegExp.exec(tag);
  if (match) {
    var name = match[1];
    var idType = match[2] && match[2].toLowerCase();
    var publicId, systemId;
    if (idType === 'public') {
      publicId = match[3];
      systemId = match[4];
    } else if (idType === 'system') {
      systemId = match[3];
    }
    var doctype = new templates.Doctype(name, publicId, systemId);
    parseNode.content.push(doctype);
  } else {
    unexpected(tag);
  }
}

function parseTextLiteral(data) {
  var text = new templates.Text(data);
  parseNode.content.push(text);
}

function parseTextExpression(source, environment) {
  var expression = createExpression(source);
  if (expression.meta.blockType) {
    parseBlockExpression(expression);
  } else if (expression.meta.valueType === 'view') {
    parseViewExpression(expression);
  } else if (expression.meta.unescaped && environment === 'html') {
    var html = new templates.DynamicHtml(expression);
    parseNode.content.push(html);
  } else {
    var text = new templates.DynamicText(expression);
    parseNode.content.push(text);
  }
}

function parseBlockExpression(expression) {
  var blockType = expression.meta.blockType;

  // Block ending
  if (expression.meta.isEnd) {
    parseNode = parseNode.parent;
    // Validate that the block ending matches an appropriate block start
    var last = parseNode.last();
    var lastExpression = last && (last.expression || (last.expressions && last.expressions[0]));
    if (!(
      lastExpression &&
      (blockType === 'end' && lastExpression.meta.blockType) ||
      (blockType === lastExpression.meta.blockType)
    )) {
      throw new Error('Mismatched closing template tag: ' + expression.meta.source);
    }

  // Continuing block
  } else if (blockType === 'else' || blockType === 'else if') {
    parseNode = parseNode.parent;
    var last = parseNode.last();
    parseNode = parseNode.child();

    if (last instanceof templates.ConditionalBlock) {
      last.expressions.push(expression);
      last.contents.push(parseNode.content);
    } else if (last instanceof templates.EachBlock) {
      if (blockType !== 'else') unexpected(expression.meta.source);
      last.elseContent = parseNode.content;
    } else {
      unexpected(expression.meta.source);
    }

  // Block start
  } else {
    var nextNode = parseNode.child();
    var block;
    if (blockType === 'if' || blockType === 'unless') {
      block = new templates.ConditionalBlock([expression], [nextNode.content]);
    } else if (blockType === 'each') {
      block = new templates.EachBlock(expression, nextNode.content);
    } else {
      block = new templates.Block(expression, nextNode.content);
    }
    parseNode.content.push(block);
    parseNode = nextNode;
  }
}

function parseViewElement(element) {
  // TODO: "name" is deprecated in lieu of "is". Remove "name" in Derby 0.6.0
  var nameAttribute = element.attributes.is || element.attributes.name;
  if (!nameAttribute) {
    throw new Error('The <view> element requires an "is" attribute');
  }
  delete element.attributes.is;
  delete element.attributes.name;

  if (nameAttribute.expression) {
    var viewAttributes = viewAttributesFromElement(element);
    var componentHooks = componentHooksFromAttributes(viewAttributes);
    var remaining = element.content || [];
    var viewInstance = createDynamicViewInstance(nameAttribute.expression, viewAttributes, componentHooks.hooks, componentHooks.initHooks);
    finishParseViewElement(viewAttributes, remaining, viewInstance);
  } else {
    var name = nameAttribute.data;
    var view = findView(name);
    parseNamedViewElement(element, view, name);
  }
}

function findView(name) {
  var view = parseNode.view.views.find(name, parseNode.view.namespace);
  if (!view) {
    var message = parseNode.view.views.findErrorMessage(name);
    throw new Error(message);
  }
  return view;
}

function parseNamedViewElement(element, view, name) {
  var viewAttributes = viewAttributesFromElement(element);
  var componentHooks = componentHooksFromAttributes(viewAttributes);
  var remaining = parseContentAttributes(element.content, view, viewAttributes);
  var viewInstance = new templates.ViewInstance(view.registeredName, viewAttributes, componentHooks.hooks, componentHooks.initHooks);
  finishParseViewElement(viewAttributes, remaining, viewInstance);
}

function createDynamicViewInstance(expression, attributes, hooks, initHooks) {
  var viewInstance = new templates.DynamicViewInstance(expression, attributes, hooks, initHooks);
  // Wrap the viewInstance in a block with the same expression, so that it is
  // re-rendered when any of its dependencies change
  return new templates.Block(expression, [viewInstance]);
}

function finishParseViewElement(viewAttributes, remaining, viewInstance) {
  if (!viewAttributes.hasOwnProperty('content') && remaining.length) {
    var template = new templates.Template(remaining);
    viewAttributes.content = (viewAttributes.within) ? template :
      new templates.ParentWrapper(template);
  }
  parseNode.content.push(viewInstance);
}

function viewAttributesFromElement(element) {
  var viewAttributes = {};
  for (var key in element.attributes) {
    var attribute = element.attributes[key];
    var camelCased = dashToCamelCase(key);
    viewAttributes[camelCased] =
      (attribute.expression instanceof templates.Template) ?
        new templates.ParentWrapper(attribute.expression) :
      (attribute.expression instanceof expressions.Expression) ?
        new templates.ParentWrapper(new templates.DynamicText(attribute.expression), attribute.expression) :
      attribute.data;
  }
  return viewAttributes;
}

function parseAsAttribute(key, value) {
  var expression = createPathExpression(value);
  if (!(expression instanceof expressions.PathExpression)) {
    throw new Error(key + ' attribute must be a path: ' + key + '="' + value + '"');
  }
  return expression.segments;
}

function parseAsObjectAttribute(key, value) {
  var expression = createPathExpression(value);
  if (!(
    expression instanceof expressions.SequenceExpression &&
    expression.args.length === 2 &&
    expression.args[0] instanceof expressions.PathExpression
  )) {
    throw new Error(key + ' attribute requires a path and a key argument: ' + key + '="' + value + '"');
  }
  var segments = expression.args[0].segments;
  var expression = expression.args[1];
  return {segments: segments, expression: expression};
}

function parseOnAttribute(key, value) {
  // TODO: Argument checking
  return createPathExpression(value);
}

function elementHooksFromAttributes(attributes, type) {
  if (!attributes) return;
  var hooks = [];

  for (var key in attributes) {
    var value = attributes[key];

    // Parse `as` assignments
    if (key === 'as') {
      var segments = parseAsAttribute(key, value);
      hooks.push(new templates.AsProperty(segments));
      delete attributes[key];
      continue;
    }
    if (key === 'as-array') {
      var segments = parseAsAttribute(key, value);
      hooks.push(new templates.AsArray(segments));
      delete attributes[key];
      continue;
    }
    if (key === 'as-object') {
      var parsed = parseAsObjectAttribute(key, value);
      hooks.push(new templates.AsObject(parsed.segments, parsed.expression));
      delete attributes[key];
      continue;
    }

    // Parse event listeners
    var match = /^on-(.+)/.exec(key);
    var eventName = match && match[1];
    if (eventName) {
      var expression = parseOnAttribute(key, value);
      hooks.push(new templates.ElementOn(eventName, expression));
      delete attributes[key];
    }
  }

  if (hooks.length) return hooks;
}

function componentHooksFromAttributes(attributes) {
  if (!attributes) return {};
  var hooks = [];
  var initHooks = [];

  for (var key in attributes) {
    var value = attributes[key];

    // Parse `as` assignments
    if (key === 'as') {
      var segments = parseAsAttribute(key, value);
      hooks.push(new templates.AsProperty(segments));
      delete attributes[key];
      continue;
    }
    if (key === 'asArray') {
      var segments = parseAsAttribute('as-array', value);
      hooks.push(new templates.AsArrayComponent(segments));
      delete attributes[key];
      continue;
    }
    if (key === 'asObject') {
      var parsed = parseAsObjectAttribute('as-object', value);
      hooks.push(new templates.AsObjectComponent(parsed.segments, parsed.expression));
      delete attributes[key];
      continue;
    }

    // Parse event listeners
    var match = /^on([A-Z_].*)/.exec(key);
    var eventName = match && match[1].charAt(0).toLowerCase() + match[1].slice(1);
    if (eventName) {
      var expression = parseOnAttribute(key, value);
      initHooks.push(new templates.ComponentOn(eventName, expression));
      delete attributes[key];
    }
  }

  return {
    hooks: (hooks.length) ? hooks : null,
    initHooks: (initHooks.length) ? initHooks : null
  };
}

function dashToCamelCase(string) {
  return string.replace(/-./g, function(match) {
    return match.charAt(1).toUpperCase();
  });
}

function parseContentAttributes(content, view, viewAttributes) {
  var remaining = [];
  if (!content) return remaining;
  for (var i = 0, len = content.length; i < len; i++) {
    var item = content[i];
    var name = (item instanceof templates.Element) && item.tagName;

    if (name === 'attribute') {
      var name = parseNameAttribute(item);
      parseAttributeElement(item, name, viewAttributes);

    } else if (view.attributesMap && view.attributesMap[name]) {
      parseAttributeElement(item, name, viewAttributes);

    } else if (name === 'array') {
      var name = parseNameAttribute(item);
      parseArrayElement(item, name, viewAttributes);

    } else if (view.arraysMap && view.arraysMap[name]) {
      parseArrayElement(item, view.arraysMap[name], viewAttributes);

    } else {
      remaining.push(item);
    }
  }
  return remaining;
}

function parseNameAttribute(element) {
  // TODO: "name" is deprecated in lieu of "is". Remove "name" in Derby 0.6.0
  var nameAttribute = element.attributes.is || element.attributes.name;
  var name = nameAttribute.data;
  if (!name) {
    throw new Error('The <' + element.tagName + '> element requires a literal "is" attribute');
  }
  delete element.attributes.is;
  delete element.attributes.name;
  return name;
}

function parseAttributeElement(element, name, viewAttributes) {
  var camelName = dashToCamelCase(name);
  var content = new templates.Template(element.content);
  viewAttributes[camelName] = (element.attributes && element.attributes.within) ?
    content : new templates.ParentWrapper(content);
}

function parseArrayElement(element, name, viewAttributes) {
  var item = viewAttributesFromElement(element);
  if (!item.hasOwnProperty('content') && element.content.length) {
    item.content = new templates.ParentWrapper(
      new templates.Template(element.content)
    );
  }
  var camelName = dashToCamelCase(name);
  var viewAttribute = viewAttributes[camelName] ||
    (viewAttributes[camelName] = []);
  viewAttribute.push(item);
}

function parseViewExpression(expression) {
  // If there are multiple arguments separated by commas, they will get parsed
  // as a SequenceExpression
  var nameExpression, attributesExpression;
  if (expression instanceof expressions.SequenceExpression) {
    nameExpression = expression.args[0];
    attributesExpression = expression.args[1];
  } else {
    nameExpression = expression;
  }

  var viewAttributes = viewAttributesFromExpression(attributesExpression);
  var componentHooks = componentHooksFromAttributes(viewAttributes);

  // A ViewInstance has a static name, and a DynamicViewInstance gets its name
  // at render time
  var viewInstance;
  if (nameExpression instanceof expressions.LiteralExpression) {
    var name = nameExpression.get();
    // Will throw if the view can't be found immediately
    findView(name);
    viewInstance = new templates.ViewInstance(name, viewAttributes, componentHooks.hooks, componentHooks.initHooks);
  } else {
    viewInstance = createDynamicViewInstance(nameExpression, viewAttributes, componentHooks.hooks, componentHooks.initHooks);
  }
  parseNode.content.push(viewInstance);
}

function viewAttributesFromExpression(expression) {
  if (!expression) return;
  var object = objectFromObjectExpression(expression);

  var viewAttributes = {};
  for (var key in object) {
    var value = object[key];
    viewAttributes[key] =
      (value instanceof expressions.LiteralExpression) ? value.value :
      (value instanceof expressions.Expression) ?
        new templates.ParentWrapper(new templates.DynamicText(value), value) :
      value;
  }
  return viewAttributes;
}

function objectFromObjectExpression(expression) {
  if (expression instanceof expressions.LiteralExpression) {
    var object = expression.value;
    if (typeof object !== 'object') unexpected();
    return object;

  // Get the expressions and keys from a OperatorExpression that would have been
  // created for an object literal with non-literal properties
  } else if (expression instanceof expressions.OperatorExpression && expression.name === '{}') {
    var object = {};
    var args = expression.args;
    for (var i = 0, len = args.length; i < len; i += 2) {
      var key = args[i].value;
      var value = args[i + 1];
      object[key] = value;
    }
    return object;

  } else {
    unexpected();
  }
}

function ParseNode(view, parent) {
  this.view = view;
  this.parent = parent;
  this.content = [];
  this.namespaceUri = parent && parent.namespaceUri;
}
ParseNode.prototype.child = function() {
  return new ParseNode(this.view, this);
};
ParseNode.prototype.last = function() {
  return this.content[this.content.length - 1];
};

function escapeBraced(source) {
  var out = '';
  parseText(source, onLiteral, onExpression, 'string');
  function onLiteral(text) {
    out += text;
  }
  function onExpression(text) {
    var escaped = text.replace(/[&<]/g, function(match) {
      return (match === '&') ? '&amp;' : '&lt;';
    });
    out += '{{' + escaped + '}}';
  }
  return out;
}

function unescapeBraced(source) {
  return source.replace(/(?:&amp;|&lt;)/g, function(match) {
    return (match === '&amp;') ? '&' : '<';
  });
}

function unescapeTextLiteral(text, environment) {
  return (environment === 'html' || environment === 'attribute') ?
    htmlUtil.unescapeEntities(text) :
    text;
}

function parseText(data, onLiteral, onExpression, environment) {
  var current = data;
  var last;
  while (current) {
    if (current === last) throw new Error('Error parsing template text: ' + data);
    last = current;

    var start = current.indexOf('{{');
    if (start === -1) {
      var unescapedCurrent = unescapeTextLiteral(current, environment);
      onLiteral(unescapedCurrent);
      return;
    }

    var end = matchBraces(current, 2, start, '{', '}');
    if (end === -1) throw new Error('Mismatched braces in: ' + data);

    if (start > 0) {
      var before = current.slice(0, start);
      var unescapedBefore = unescapeTextLiteral(before, environment);
      onLiteral(unescapedBefore);
    }

    var inside = current.slice(start + 2, end - 2);
    if (inside) {
      var unescapedInside = unescapeBraced(inside);
      unescapedInside = unescapeTextLiteral(unescapedInside, environment);
      onExpression(unescapedInside, environment);
    }

    current = current.slice(end);
  }
}

function matchBraces(text, num, i, openChar, closeChar) {
  i += num;
  while (num) {
    var close = text.indexOf(closeChar, i);
    var open = text.indexOf(openChar, i);
    var hasClose = close !== -1;
    var hasOpen = open !== -1;
    if (hasClose && (!hasOpen || (close < open))) {
      i = close + 1;
      num--;
      continue;
    } else if (hasOpen) {
      i = open + 1;
      num++;
      continue;
    } else {
      return -1;
    }
  }
  return i;
}

var blockRegExp = /^(if|unless|else if|each|with|on)\s+([\s\S]+?)(?:\s+as\s+([^,\s]+)\s*(?:,\s*(\S+))?)?$/;
var valueRegExp = /^(?:(view|unbound|bound|unescaped)\s+)?([\s\S]*)/;

function createExpression(source) {
  source = source.trim();
  var meta = new expressions.ExpressionMeta(source);

  // Parse block expression //

  // The block expressions `if`, `unless`, `else if`, `each`, `with`, and `on`
  // must have a single blockType keyword and a path. They may have an optional
  // alias assignment
  var match = blockRegExp.exec(source);
  var path;
  if (match) {
    meta.blockType = match[1];
    path = match[2];
    meta.as = match[3];
    meta.keyAs = match[4];

  // The blocks `else`, `unbound`, and `bound` may not have a path or alias
  } else if (source === 'else' || source === 'unbound' || source === 'bound') {
    meta.blockType = source;

  // Any source that starts with a `/` is treated as an end block. Either a
  // `{{/}}` with no following characters or a `{{/if}}` style ending is valid
  } else if (source.charAt(0) === '/') {
    meta.isEnd = true;
    meta.blockType = source.slice(1).trim() || 'end';


  // Parse value expression //

  // A value expression has zero or many keywords and an expression
  } else {
    path = source;
    var keyword;
    do {
      match = valueRegExp.exec(path);
      keyword = match[1];
      path = match[2];
      if (keyword === 'unescaped') {
        meta.unescaped = true;
      } else if (keyword === 'unbound' || keyword === 'bound') {
        meta.bindType = keyword;
      } else if (keyword) {
        meta.valueType = keyword;
      }
    } while (keyword);
  }

  // Wrap parsing in a try / catch to add context to message when throwing
  var expression;
  try {
    expression = (path) ?
      createPathExpression(path) :
      new expressions.Expression();
  } catch (err) {
    var message = '\n\nWithin expression: ' + source;
    throw appendErrorMessage(err, message);
  }
  expression.meta = meta;
  return expression;
}

function unexpected(source) {
  throw new Error('Error parsing template: ' + source);
}

function appendErrorMessage(err, message) {
  if (err instanceof Error) {
    err.message += message;
    return err;
  }
  return new Error(err + message);
}

},{"./createPathExpression":19,"./markup":21,"derby-templates":23,"html-util":30}],21:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter;
var templates = require('derby-templates').templates;
var createPathExpression = require('./createPathExpression');

// TODO: Should be its own module

var markup = module.exports = new MarkupParser();

function MarkupParser() {
  EventEmitter.call(this);
}
mergeInto(MarkupParser.prototype, EventEmitter.prototype);

markup.on('element:a', function(template) {
  if (hasListenerFor(template, 'click')) {
    var attributes = template.attributes || (template.attributes = {});
    if (!attributes.href) {
      attributes.href = new templates.Attribute('#');
      addListener(template, 'click', '$preventDefault($event)');
    }
  }
});

markup.on('element:form', function(template) {
  if (hasListenerFor(template, 'submit')) {
    addListener(template, 'submit', '$preventDefault($event)');
  }
});

function hasListenerFor(template, eventName) {
  var hooks = template.hooks;
  if (!hooks) return false;
  for (var i = 0, len = hooks.length; i < len; i++) {
    var hook = hooks[i];
    if (hook instanceof templates.ElementOn && hook.name === eventName) {
      return true;
    }
  }
  return false;
}

function addListener(template, eventName, source) {
  var hooks = template.hooks || (template.hooks = []);
  var expression = createPathExpression(source);
  hooks.push(new templates.ElementOn(eventName, expression));
}

function mergeInto(to, from) {
  for (var key in from) {
    to[key] = from[key];
  }
  return to;
}

},{"./createPathExpression":19,"derby-templates":23,"events":1}],22:[function(require,module,exports){
/*
  Copyright (C) 2013 Ariya Hidayat <ariya.hidayat@gmail.com>
  Copyright (C) 2013 Thaddee Tyl <thaddee.tyl@gmail.com>
  Copyright (C) 2013 Mathias Bynens <mathias@qiwi.be>
  Copyright (C) 2012 Ariya Hidayat <ariya.hidayat@gmail.com>
  Copyright (C) 2012 Mathias Bynens <mathias@qiwi.be>
  Copyright (C) 2012 Joost-Wim Boekesteijn <joost-wim@boekesteijn.nl>
  Copyright (C) 2012 Kris Kowal <kris.kowal@cixar.com>
  Copyright (C) 2012 Yusuke Suzuki <utatane.tea@gmail.com>
  Copyright (C) 2012 Arpad Borsos <arpad.borsos@googlemail.com>
  Copyright (C) 2011 Ariya Hidayat <ariya.hidayat@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/*jslint bitwise:true plusplus:true */
/*global esprima:true, define:true, exports:true, window: true,
createLocationMarker: true,
throwError: true, generateStatement: true, peek: true,
parseAssignmentExpression: true, parseBlock: true, parseExpression: true,
parseFunctionDeclaration: true, parseFunctionExpression: true,
parseFunctionSourceElements: true, parseVariableIdentifier: true,
parseLeftHandSideExpression: true,
parseUnaryExpression: true,
parseStatement: true, parseSourceElement: true */

(function (root, factory) {
    'use strict';

    // Universal Module Definition (UMD) to support AMD, CommonJS/Node.js,
    // Rhino, and plain browser loading.
    if (typeof define === 'function' && define.amd) {
        define(['exports'], factory);
    } else if (typeof exports !== 'undefined') {
        factory(exports);
    } else {
        factory((root.esprima = {}));
    }
}(this, function (exports) {
    'use strict';

    var Token,
        TokenName,
        FnExprTokens,
        Syntax,
        PropertyKind,
        Messages,
        Regex,
        SyntaxTreeDelegate,
        source,
        strict,
        index,
        lineNumber,
        lineStart,
        length,
        delegate,
        lookahead,
        state,
        extra;

    Token = {
        UndefinedLiteral: -1,  // DERBY
        BooleanLiteral: 1,
        EOF: 2,
        Identifier: 3,
        Keyword: 4,
        NullLiteral: 5,
        NumericLiteral: 6,
        Punctuator: 7,
        StringLiteral: 8,
        RegularExpression: 9
    };

    TokenName = {};
    TokenName[Token.UndefinedLiteral] = 'Undefined';  // DERBY
    TokenName[Token.BooleanLiteral] = 'Boolean';
    TokenName[Token.EOF] = '<end>';
    TokenName[Token.Identifier] = 'Identifier';
    TokenName[Token.Keyword] = 'Keyword';
    TokenName[Token.NullLiteral] = 'Null';
    TokenName[Token.NumericLiteral] = 'Numeric';
    TokenName[Token.Punctuator] = 'Punctuator';
    TokenName[Token.StringLiteral] = 'String';
    TokenName[Token.RegularExpression] = 'RegularExpression';

    // A function following one of those tokens is an expression.
    FnExprTokens = ['(', '{', '[', 'in', 'typeof', 'instanceof', 'new',
                    'return', 'case', 'delete', 'throw', 'void',
                    // assignment operators
                    '=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '>>>=',
                    '&=', '|=', '^=', ',',
                    // binary/unary operators
                    '+', '-', '*', '/', '%', '++', '--', '<<', '>>', '>>>', '&',
                    '|', '^', '!', '~', '&&', '||', '?', ':', '===', '==', '>=',
                    '<=', '<', '>', '!=', '!=='];

    Syntax = {
        AssignmentExpression: 'AssignmentExpression',
        ArrayExpression: 'ArrayExpression',
        BinaryExpression: 'BinaryExpression',
        CallExpression: 'CallExpression',
        ConditionalExpression: 'ConditionalExpression',
        ExpressionStatement: 'ExpressionStatement',
        FunctionExpression: 'FunctionExpression',
        Identifier: 'Identifier',
        Literal: 'Literal',
        LogicalExpression: 'LogicalExpression',
        MemberExpression: 'MemberExpression',
        NewExpression: 'NewExpression',
        ObjectExpression: 'ObjectExpression',
        Property: 'Property',
        SequenceExpression: 'SequenceExpression',
        ThisExpression: 'ThisExpression',
        UnaryExpression: 'UnaryExpression',
        UpdateExpression: 'UpdateExpression'
    };

    PropertyKind = {
        Data: 1,
        Get: 2,
        Set: 4
    };

    // Error messages should be identical to V8.
    Messages = {
        UnexpectedToken:  'Unexpected token %0',
        UnexpectedNumber:  'Unexpected number',
        UnexpectedString:  'Unexpected string',
        UnexpectedIdentifier:  'Unexpected identifier',
        UnexpectedReserved:  'Unexpected reserved word',
        UnexpectedEOS:  'Unexpected end of input',
        NewlineAfterThrow:  'Illegal newline after throw',
        InvalidRegExp: 'Invalid regular expression',
        UnterminatedRegExp:  'Invalid regular expression: missing /',
        InvalidLHSInAssignment:  'Invalid left-hand side in assignment',
        InvalidLHSInForIn:  'Invalid left-hand side in for-in',
        MultipleDefaultsInSwitch: 'More than one default clause in switch statement',
        NoCatchOrFinally:  'Missing catch or finally after try',
        UnknownLabel: 'Undefined label \'%0\'',
        Redeclaration: '%0 \'%1\' has already been declared',
        IllegalContinue: 'Illegal continue statement',
        IllegalBreak: 'Illegal break statement',
        IllegalReturn: 'Illegal return statement',
        StrictModeWith:  'Strict mode code may not include a with statement',
        StrictCatchVariable:  'Catch variable may not be eval or arguments in strict mode',
        StrictVarName:  'Variable name may not be eval or arguments in strict mode',
        StrictParamName:  'Parameter name eval or arguments is not allowed in strict mode',
        StrictParamDupe: 'Strict mode function may not have duplicate parameter names',
        StrictFunctionName:  'Function name may not be eval or arguments in strict mode',
        StrictOctalLiteral:  'Octal literals are not allowed in strict mode.',
        StrictDelete:  'Delete of an unqualified identifier in strict mode.',
        StrictDuplicateProperty:  'Duplicate data property in object literal not allowed in strict mode',
        AccessorDataProperty:  'Object literal may not have data and accessor property with the same name',
        AccessorGetSet:  'Object literal may not have multiple get/set accessors with the same name',
        StrictLHSAssignment:  'Assignment to eval or arguments is not allowed in strict mode',
        StrictLHSPostfix:  'Postfix increment/decrement may not have eval or arguments operand in strict mode',
        StrictLHSPrefix:  'Prefix increment/decrement may not have eval or arguments operand in strict mode',
        StrictReservedWord:  'Use of future reserved word in strict mode'
    };

    // See also tools/generate-unicode-regex.py.
    Regex = {
        NonAsciiIdentifierStart: new RegExp('[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0\u08A2-\u08AC\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097F\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F0\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191C\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA697\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA793\uA7A0-\uA7AA\uA7F8-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA80-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]'),
        NonAsciiIdentifierPart: new RegExp('[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u0527\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0\u08A2-\u08AC\u08E4-\u08FE\u0900-\u0963\u0966-\u096F\u0971-\u0977\u0979-\u097F\u0981-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C01-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58\u0C59\u0C60-\u0C63\u0C66-\u0C6F\u0C82\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D02\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D57\u0D60-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F0\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191C\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1CD0-\u1CD2\u1CD4-\u1CF6\u1D00-\u1DE6\u1DFC-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA697\uA69F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA793\uA7A0-\uA7AA\uA7F8-\uA827\uA840-\uA873\uA880-\uA8C4\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A\uAA7B\uAA80-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE26\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]')
    };

    // Ensure the condition is true, otherwise throw an error.
    // This is only to have a better contract semantic, i.e. another safety net
    // to catch a logic error. The condition shall be fulfilled in normal case.
    // Do NOT use this to enforce a certain condition on any user input.

    function assert(condition, message) {
        if (!condition) {
            throw new Error('ASSERT: ' + message);
        }
    }

    function isDecimalDigit(ch) {
        return (ch >= 48 && ch <= 57);   // 0..9
    }

    function isHexDigit(ch) {
        return '0123456789abcdefABCDEF'.indexOf(ch) >= 0;
    }

    function isOctalDigit(ch) {
        return '01234567'.indexOf(ch) >= 0;
    }


    // 7.2 White Space

    function isWhiteSpace(ch) {
        return (ch === 0x20) || (ch === 0x09) || (ch === 0x0B) || (ch === 0x0C) || (ch === 0xA0) ||
            (ch >= 0x1680 && [0x1680, 0x180E, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x202F, 0x205F, 0x3000, 0xFEFF].indexOf(ch) >= 0);
    }

    // 7.3 Line Terminators

    function isLineTerminator(ch) {
        return (ch === 0x0A) || (ch === 0x0D) || (ch === 0x2028) || (ch === 0x2029);
    }

    // 7.6 Identifier Names and Identifiers

    function isIdentifierStart(ch) {
        return (ch === 0x24) || (ch === 0x5F) ||  // $ (dollar) and _ (underscore)
            (ch === 0x40) || (ch === 0x23) ||     // DERBY: @ (at sign) and # (number sign)
            (ch >= 0x41 && ch <= 0x5A) ||         // A..Z
            (ch >= 0x61 && ch <= 0x7A) ||         // a..z
            (ch === 0x5C) ||                      // \ (backslash)
            ((ch >= 0x80) && Regex.NonAsciiIdentifierStart.test(String.fromCharCode(ch)));
    }

    function isIdentifierPart(ch) {
        return (ch === 0x24) || (ch === 0x5F) ||  // $ (dollar) and _ (underscore)
            (ch >= 0x41 && ch <= 0x5A) ||         // A..Z
            (ch >= 0x61 && ch <= 0x7A) ||         // a..z
            (ch >= 0x30 && ch <= 0x39) ||         // 0..9
            (ch === 0x5C) ||                      // \ (backslash)
            ((ch >= 0x80) && Regex.NonAsciiIdentifierPart.test(String.fromCharCode(ch)));
    }

    // 7.6.1.2 Future Reserved Words

    function isFutureReservedWord(id) {
        return false;
    }

    function isStrictModeReservedWord(id) {
        return false;
    }

    function isRestrictedWord(id) {
        return false;
    }

    // 7.6.1.1 Keywords

    function isKeyword(id) {
        return (id === 'this') ||
            (id === 'typeof') ||
            (id === 'instanceof') ||
            (id === 'in') ||
            (id === 'new');
    }

    // 7.4 Comments

    function addComment(type, value, start, end, loc) {
        var comment, attacher;

        assert(typeof start === 'number', 'Comment must have valid position');

        // Because the way the actual token is scanned, often the comments
        // (if any) are skipped twice during the lexical analysis.
        // Thus, we need to skip adding a comment if the comment array already
        // handled it.
        if (state.lastCommentStart >= start) {
            return;
        }
        state.lastCommentStart = start;

        comment = {
            type: type,
            value: value
        };
        if (extra.range) {
            comment.range = [start, end];
        }
        if (extra.loc) {
            comment.loc = loc;
        }
        extra.comments.push(comment);

        if (extra.attachComment) {
            attacher = {
                comment: comment,
                leading: null,
                trailing: null,
                range: [start, end]
            };
            extra.pendingComments.push(attacher);
        }
    }

    function skipSingleLineComment() {
        var start, loc, ch, comment;

        start = index - 2;
        loc = {
            start: {
                line: lineNumber,
                column: index - lineStart - 2
            }
        };

        while (index < length) {
            ch = source.charCodeAt(index);
            ++index;
            if (isLineTerminator(ch)) {
                if (extra.comments) {
                    comment = source.slice(start + 2, index - 1);
                    loc.end = {
                        line: lineNumber,
                        column: index - lineStart - 1
                    };
                    addComment('Line', comment, start, index - 1, loc);
                }
                if (ch === 13 && source.charCodeAt(index) === 10) {
                    ++index;
                }
                ++lineNumber;
                lineStart = index;
                return;
            }
        }

        if (extra.comments) {
            comment = source.slice(start + 2, index);
            loc.end = {
                line: lineNumber,
                column: index - lineStart
            };
            addComment('Line', comment, start, index, loc);
        }
    }

    function skipMultiLineComment() {
        var start, loc, ch, comment;

        if (extra.comments) {
            start = index - 2;
            loc = {
                start: {
                    line: lineNumber,
                    column: index - lineStart - 2
                }
            };
        }

        while (index < length) {
            ch = source.charCodeAt(index);
            if (isLineTerminator(ch)) {
                if (ch === 0x0D && source.charCodeAt(index + 1) === 0x0A) {
                    ++index;
                }
                ++lineNumber;
                ++index;
                lineStart = index;
                if (index >= length) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
            } else if (ch === 0x2A) {
                // Block comment ends with '*/'.
                if (source.charCodeAt(index + 1) === 0x2F) {
                    ++index;
                    ++index;
                    if (extra.comments) {
                        comment = source.slice(start + 2, index - 2);
                        loc.end = {
                            line: lineNumber,
                            column: index - lineStart
                        };
                        addComment('Block', comment, start, index, loc);
                    }
                    return;
                }
                ++index;
            } else {
                ++index;
            }
        }

        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
    }

    function skipComment() {
        var ch, start;

        start = (index === 0);
        while (index < length) {
            ch = source.charCodeAt(index);

            if (isWhiteSpace(ch)) {
                ++index;
            } else if (isLineTerminator(ch)) {
                ++index;
                if (ch === 0x0D && source.charCodeAt(index) === 0x0A) {
                    ++index;
                }
                ++lineNumber;
                lineStart = index;
                start = true;
            } else if (ch === 0x2F) { // U+002F is '/'
                ch = source.charCodeAt(index + 1);
                if (ch === 0x2F) {
                    ++index;
                    ++index;
                    skipSingleLineComment();
                    start = true;
                } else if (ch === 0x2A) {  // U+002A is '*'
                    ++index;
                    ++index;
                    skipMultiLineComment();
                } else {
                    break;
                }
            } else if (start && ch === 0x2D) { // U+002D is '-'
                // U+003E is '>'
                if ((source.charCodeAt(index + 1) === 0x2D) && (source.charCodeAt(index + 2) === 0x3E)) {
                    // '-->' is a single-line comment
                    index += 3;
                    skipSingleLineComment();
                } else {
                    break;
                }
            } else if (ch === 0x3C) { // U+003C is '<'
                if (source.slice(index + 1, index + 4) === '!--') {
                    ++index; // `<`
                    ++index; // `!`
                    ++index; // `-`
                    ++index; // `-`
                    skipSingleLineComment();
                } else {
                    break;
                }
            } else {
                break;
            }
        }
    }

    function scanHexEscape(prefix) {
        var i, len, ch, code = 0;

        len = (prefix === 'u') ? 4 : 2;
        for (i = 0; i < len; ++i) {
            if (index < length && isHexDigit(source[index])) {
                ch = source[index++];
                code = code * 16 + '0123456789abcdef'.indexOf(ch.toLowerCase());
            } else {
                return '';
            }
        }
        return String.fromCharCode(code);
    }

    function getEscapedIdentifier() {
        var ch, id;

        ch = source.charCodeAt(index++);
        id = String.fromCharCode(ch);

        // '\u' (U+005C, U+0075) denotes an escaped character.
        if (ch === 0x5C) {
            if (source.charCodeAt(index) !== 0x75) {
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }
            ++index;
            ch = scanHexEscape('u');
            if (!ch || ch === '\\' || !isIdentifierStart(ch.charCodeAt(0))) {
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }
            id = ch;
        }

        while (index < length) {
            ch = source.charCodeAt(index);
            if (!isIdentifierPart(ch)) {
                break;
            }
            ++index;
            id += String.fromCharCode(ch);

            // '\u' (U+005C, U+0075) denotes an escaped character.
            if (ch === 0x5C) {
                id = id.substr(0, id.length - 1);
                if (source.charCodeAt(index) !== 0x75) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
                ++index;
                ch = scanHexEscape('u');
                if (!ch || ch === '\\' || !isIdentifierPart(ch.charCodeAt(0))) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
                id += ch;
            }
        }

        return id;
    }

    function getIdentifier() {
        var start, ch;

        start = index++;
        while (index < length) {
            ch = source.charCodeAt(index);
            if (ch === 0x5C) {
                // Blackslash (U+005C) marks Unicode escape sequence.
                index = start;
                return getEscapedIdentifier();
            }
            if (isIdentifierPart(ch)) {
                ++index;
            } else {
                break;
            }
        }

        return source.slice(start, index);
    }

    function scanIdentifier() {
        var start, id, type;

        start = index;

        // Backslash (U+005C) starts an escaped character.
        id = (source.charCodeAt(index) === 0x5C) ? getEscapedIdentifier() : getIdentifier();

        // There is no keyword or literal with only one character.
        // Thus, it must be an identifier.
        if (id.length === 1) {
            type = Token.Identifier;
        } else if (isKeyword(id)) {
            type = Token.Keyword;
        } else if (id === 'undefined') {  // DERBY
            type = Token.Undefined;
        } else if (id === 'null') {
            type = Token.NullLiteral;
        } else if (id === 'true' || id === 'false') {
            type = Token.BooleanLiteral;
        } else {
            type = Token.Identifier;
        }

        return {
            type: type,
            value: id,
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }


    // 7.7 Punctuators

    function scanPunctuator() {
        var start = index,
            code = source.charCodeAt(index),
            code2,
            ch1 = source[index],
            ch2,
            ch3,
            ch4;

        switch (code) {

        // Check for most common single-character punctuators.
        case 0x2E:  // . dot
        case 0x28:  // ( open bracket
        case 0x29:  // ) close bracket
        case 0x3B:  // ; semicolon
        case 0x2C:  // , comma
        case 0x7B:  // { open curly brace
        case 0x7D:  // } close curly brace
        case 0x5B:  // [
        case 0x5D:  // ]
        case 0x3A:  // :
        case 0x3F:  // ?
        case 0x7E:  // ~
            ++index;
            if (extra.tokenize) {
                if (code === 0x28) {
                    extra.openParenToken = extra.tokens.length;
                } else if (code === 0x7B) {
                    extra.openCurlyToken = extra.tokens.length;
                }
            }
            return {
                type: Token.Punctuator,
                value: String.fromCharCode(code),
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };

        default:
            code2 = source.charCodeAt(index + 1);

            // '=' (U+003D) marks an assignment or comparison operator.
            if (code2 === 0x3D) {
                switch (code) {
                case 0x25:  // %
                case 0x26:  // &
                case 0x2A:  // *:
                case 0x2B:  // +
                case 0x2D:  // -
                case 0x2F:  // /
                case 0x3C:  // <
                case 0x3E:  // >
                case 0x5E:  // ^
                case 0x7C:  // |
                    index += 2;
                    return {
                        type: Token.Punctuator,
                        value: String.fromCharCode(code) + String.fromCharCode(code2),
                        lineNumber: lineNumber,
                        lineStart: lineStart,
                        range: [start, index]
                    };

                case 0x21: // !
                case 0x3D: // =
                    index += 2;

                    // !== and ===
                    if (source.charCodeAt(index) === 0x3D) {
                        ++index;
                    }
                    return {
                        type: Token.Punctuator,
                        value: source.slice(start, index),
                        lineNumber: lineNumber,
                        lineStart: lineStart,
                        range: [start, index]
                    };
                default:
                    break;
                }
            }
            break;
        }

        // Peek more characters.

        ch2 = source[index + 1];
        ch3 = source[index + 2];
        ch4 = source[index + 3];

        // 4-character punctuator: >>>=

        if (ch1 === '>' && ch2 === '>' && ch3 === '>') {
            if (ch4 === '=') {
                index += 4;
                return {
                    type: Token.Punctuator,
                    value: '>>>=',
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [start, index]
                };
            }
        }

        // 3-character punctuators: === !== >>> <<= >>=

        if (ch1 === '>' && ch2 === '>' && ch3 === '>') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '>>>',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === '<' && ch2 === '<' && ch3 === '=') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '<<=',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === '>' && ch2 === '>' && ch3 === '=') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '>>=',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        // Other 2-character punctuators: ++ -- << >> && ||

        if (ch1 === ch2 && ('+-<>&|'.indexOf(ch1) >= 0)) {
            index += 2;
            return {
                type: Token.Punctuator,
                value: ch1 + ch2,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if ('<>=!+-*%&|^/'.indexOf(ch1) >= 0) {
            ++index;
            return {
                type: Token.Punctuator,
                value: ch1,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
    }

    // 7.8.3 Numeric Literals

    function scanHexLiteral(start) {
        var number = '';

        while (index < length) {
            if (!isHexDigit(source[index])) {
                break;
            }
            number += source[index++];
        }

        if (number.length === 0) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        if (isIdentifierStart(source.charCodeAt(index))) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.NumericLiteral,
            value: parseInt('0x' + number, 16),
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    function scanOctalLiteral(start) {
        var number = '0' + source[index++];
        while (index < length) {
            if (!isOctalDigit(source[index])) {
                break;
            }
            number += source[index++];
        }

        if (isIdentifierStart(source.charCodeAt(index)) || isDecimalDigit(source.charCodeAt(index))) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.NumericLiteral,
            value: parseInt(number, 8),
            octal: true,
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    function scanNumericLiteral() {
        var number, start, ch;

        ch = source[index];
        assert(isDecimalDigit(ch.charCodeAt(0)) || (ch === '.'),
            'Numeric literal must start with a decimal digit or a decimal point');

        start = index;
        number = '';
        if (ch !== '.') {
            number = source[index++];
            ch = source[index];

            // Hex number starts with '0x'.
            // Octal number starts with '0'.
            if (number === '0') {
                if (ch === 'x' || ch === 'X') {
                    ++index;
                    return scanHexLiteral(start);
                }
                if (isOctalDigit(ch)) {
                    return scanOctalLiteral(start);
                }

                // decimal number starts with '0' such as '09' is illegal.
                if (ch && isDecimalDigit(ch.charCodeAt(0))) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
            }

            while (isDecimalDigit(source.charCodeAt(index))) {
                number += source[index++];
            }
            ch = source[index];
        }

        if (ch === '.') {
            number += source[index++];
            while (isDecimalDigit(source.charCodeAt(index))) {
                number += source[index++];
            }
            ch = source[index];
        }

        if (ch === 'e' || ch === 'E') {
            number += source[index++];

            ch = source[index];
            if (ch === '+' || ch === '-') {
                number += source[index++];
            }
            if (isDecimalDigit(source.charCodeAt(index))) {
                while (isDecimalDigit(source.charCodeAt(index))) {
                    number += source[index++];
                }
            } else {
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }
        }

        if (isIdentifierStart(source.charCodeAt(index))) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.NumericLiteral,
            value: parseFloat(number),
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    // 7.8.4 String Literals

    function scanStringLiteral() {
        var str = '', quote, start, ch, code, unescaped, restore, octal = false;

        quote = source[index];
        assert((quote === '\'' || quote === '"'),
            'String literal must starts with a quote');

        start = index;
        ++index;

        while (index < length) {
            ch = source[index++];

            if (ch === quote) {
                quote = '';
                break;
            } else if (ch === '\\') {
                ch = source[index++];
                if (!ch || !isLineTerminator(ch.charCodeAt(0))) {
                    switch (ch) {
                    case 'n':
                        str += '\n';
                        break;
                    case 'r':
                        str += '\r';
                        break;
                    case 't':
                        str += '\t';
                        break;
                    case 'u':
                    case 'x':
                        restore = index;
                        unescaped = scanHexEscape(ch);
                        if (unescaped) {
                            str += unescaped;
                        } else {
                            index = restore;
                            str += ch;
                        }
                        break;
                    case 'b':
                        str += '\b';
                        break;
                    case 'f':
                        str += '\f';
                        break;
                    case 'v':
                        str += '\x0B';
                        break;

                    default:
                        if (isOctalDigit(ch)) {
                            code = '01234567'.indexOf(ch);

                            // \0 is not octal escape sequence
                            if (code !== 0) {
                                octal = true;
                            }

                            if (index < length && isOctalDigit(source[index])) {
                                octal = true;
                                code = code * 8 + '01234567'.indexOf(source[index++]);

                                // 3 digits are only allowed when string starts
                                // with 0, 1, 2, 3
                                if ('0123'.indexOf(ch) >= 0 &&
                                        index < length &&
                                        isOctalDigit(source[index])) {
                                    code = code * 8 + '01234567'.indexOf(source[index++]);
                                }
                            }
                            str += String.fromCharCode(code);
                        } else {
                            str += ch;
                        }
                        break;
                    }
                } else {
                    ++lineNumber;
                    if (ch ===  '\r' && source[index] === '\n') {
                        ++index;
                    }
                }
            } else if (isLineTerminator(ch.charCodeAt(0))) {
                break;
            } else {
                str += ch;
            }
        }

        if (quote !== '') {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.StringLiteral,
            value: str,
            octal: octal,
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    function scanRegExp() {
        var str, ch, start, pattern, flags, value, classMarker = false, restore, terminated = false;

        lookahead = null;
        skipComment();

        start = index;
        ch = source[index];
        assert(ch === '/', 'Regular expression literal must start with a slash');
        str = source[index++];

        while (index < length) {
            ch = source[index++];
            str += ch;
            if (ch === '\\') {
                ch = source[index++];
                // ECMA-262 7.8.5
                if (isLineTerminator(ch.charCodeAt(0))) {
                    throwError({}, Messages.UnterminatedRegExp);
                }
                str += ch;
            } else if (isLineTerminator(ch.charCodeAt(0))) {
                throwError({}, Messages.UnterminatedRegExp);
            } else if (classMarker) {
                if (ch === ']') {
                    classMarker = false;
                }
            } else {
                if (ch === '/') {
                    terminated = true;
                    break;
                } else if (ch === '[') {
                    classMarker = true;
                }
            }
        }

        if (!terminated) {
            throwError({}, Messages.UnterminatedRegExp);
        }

        // Exclude leading and trailing slash.
        pattern = str.substr(1, str.length - 2);

        flags = '';
        while (index < length) {
            ch = source[index];
            if (!isIdentifierPart(ch.charCodeAt(0))) {
                break;
            }

            ++index;
            if (ch === '\\' && index < length) {
                ch = source[index];
                if (ch === 'u') {
                    ++index;
                    restore = index;
                    ch = scanHexEscape('u');
                    if (ch) {
                        flags += ch;
                        for (str += '\\u'; restore < index; ++restore) {
                            str += source[restore];
                        }
                    } else {
                        index = restore;
                        flags += 'u';
                        str += '\\u';
                    }
                } else {
                    str += '\\';
                }
            } else {
                flags += ch;
                str += ch;
            }
        }

        try {
            value = new RegExp(pattern, flags);
        } catch (e) {
            throwError({}, Messages.InvalidRegExp);
        }



        if (extra.tokenize) {
            return {
                type: Token.RegularExpression,
                value: value,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }
        return {
            literal: str,
            value: value,
            range: [start, index]
        };
    }

    function collectRegex() {
        var pos, loc, regex, token;

        skipComment();

        pos = index;
        loc = {
            start: {
                line: lineNumber,
                column: index - lineStart
            }
        };

        regex = scanRegExp();
        loc.end = {
            line: lineNumber,
            column: index - lineStart
        };

        if (!extra.tokenize) {
            // Pop the previous token, which is likely '/' or '/='
            if (extra.tokens.length > 0) {
                token = extra.tokens[extra.tokens.length - 1];
                if (token.range[0] === pos && token.type === 'Punctuator') {
                    if (token.value === '/' || token.value === '/=') {
                        extra.tokens.pop();
                    }
                }
            }

            extra.tokens.push({
                type: 'RegularExpression',
                value: regex.literal,
                range: [pos, index],
                loc: loc
            });
        }

        return regex;
    }

    function isIdentifierName(token) {
        return token.type === Token.Identifier ||
            token.type === Token.Keyword ||
            token.type === Token.BooleanLiteral ||
            token.type === Token.Undefined ||  // DERBY
            token.type === Token.NullLiteral;
    }

    function advanceSlash() {
        var prevToken,
            checkToken;
        // Using the following algorithm:
        // https://github.com/mozilla/sweet.js/wiki/design
        prevToken = extra.tokens[extra.tokens.length - 1];
        if (!prevToken) {
            // Nothing before that: it cannot be a division.
            return collectRegex();
        }
        if (prevToken.type === 'Punctuator') {
            if (prevToken.value === ')') {
                checkToken = extra.tokens[extra.openParenToken - 1];
                if (checkToken &&
                        checkToken.type === 'Keyword' &&
                        (checkToken.value === 'if' ||
                         checkToken.value === 'while' ||
                         checkToken.value === 'for' ||
                         checkToken.value === 'with')) {
                    return collectRegex();
                }
                return scanPunctuator();
            }
            if (prevToken.value === '}') {
                // Dividing a function by anything makes little sense,
                // but we have to check for that.
                if (extra.tokens[extra.openCurlyToken - 3] &&
                        extra.tokens[extra.openCurlyToken - 3].type === 'Keyword') {
                    // Anonymous function.
                    checkToken = extra.tokens[extra.openCurlyToken - 4];
                    if (!checkToken) {
                        return scanPunctuator();
                    }
                } else if (extra.tokens[extra.openCurlyToken - 4] &&
                        extra.tokens[extra.openCurlyToken - 4].type === 'Keyword') {
                    // Named function.
                    checkToken = extra.tokens[extra.openCurlyToken - 5];
                    if (!checkToken) {
                        return collectRegex();
                    }
                } else {
                    return scanPunctuator();
                }
                // checkToken determines whether the function is
                // a declaration or an expression.
                if (FnExprTokens.indexOf(checkToken.value) >= 0) {
                    // It is an expression.
                    return scanPunctuator();
                }
                // It is a declaration.
                return collectRegex();
            }
            return collectRegex();
        }
        if (prevToken.type === 'Keyword') {
            return collectRegex();
        }
        return scanPunctuator();
    }

    function advance() {
        var ch;

        skipComment();

        if (index >= length) {
            return {
                type: Token.EOF,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [index, index]
            };
        }

        ch = source.charCodeAt(index);

        // Very common: ( and ) and ;
        if (ch === 0x28 || ch === 0x29 || ch === 0x3A) {
            return scanPunctuator();
        }

        // String literal starts with single quote (U+0027) or double quote (U+0022).
        if (ch === 0x27 || ch === 0x22) {
            return scanStringLiteral();
        }

        if (isIdentifierStart(ch)) {
            return scanIdentifier();
        }

        // Dot (.) U+002E can also start a floating-point number, hence the need
        // to check the next character.
        if (ch === 0x2E) {
            if (isDecimalDigit(source.charCodeAt(index + 1))) {
                return scanNumericLiteral();
            }
            return scanPunctuator();
        }

        if (isDecimalDigit(ch)) {
            return scanNumericLiteral();
        }

        // Slash (/) U+002F can also start a regex.
        if (extra.tokenize && ch === 0x2F) {
            return advanceSlash();
        }

        return scanPunctuator();
    }

    function collectToken() {
        var start, loc, token, range, value;

        skipComment();
        start = index;
        loc = {
            start: {
                line: lineNumber,
                column: index - lineStart
            }
        };

        token = advance();
        loc.end = {
            line: lineNumber,
            column: index - lineStart
        };

        if (token.type !== Token.EOF) {
            range = [token.range[0], token.range[1]];
            value = source.slice(token.range[0], token.range[1]);
            extra.tokens.push({
                type: TokenName[token.type],
                value: value,
                range: range,
                loc: loc
            });
        }

        return token;
    }

    function lex() {
        var token;

        token = lookahead;
        index = token.range[1];
        lineNumber = token.lineNumber;
        lineStart = token.lineStart;

        lookahead = (typeof extra.tokens !== 'undefined') ? collectToken() : advance();

        index = token.range[1];
        lineNumber = token.lineNumber;
        lineStart = token.lineStart;

        return token;
    }

    function peek() {
        var pos, line, start;

        pos = index;
        line = lineNumber;
        start = lineStart;
        lookahead = (typeof extra.tokens !== 'undefined') ? collectToken() : advance();
        index = pos;
        lineNumber = line;
        lineStart = start;
    }

    SyntaxTreeDelegate = {

        name: 'SyntaxTree',

        markStart: function () {
            if (extra.loc) {
                state.markerStack.push(index - lineStart);
                state.markerStack.push(lineNumber);
            }
            if (extra.range) {
                state.markerStack.push(index);
            }
        },

        processComment: function (node) {
            var i, attacher, pos, len, candidate;

            if (typeof node.type === 'undefined' || node.type === Syntax.Program) {
                return;
            }

            // Check for possible additional trailing comments.
            peek();

            for (i = 0; i < extra.pendingComments.length; ++i) {
                attacher = extra.pendingComments[i];
                if (node.range[0] >= attacher.comment.range[1]) {
                    candidate = attacher.leading;
                    if (candidate) {
                        pos = candidate.range[0];
                        len = candidate.range[1] - pos;
                        if (node.range[0] <= pos && (node.range[1] - node.range[0] >= len)) {
                            attacher.leading = node;
                        }
                    } else {
                        attacher.leading = node;
                    }
                }
                if (node.range[1] <= attacher.comment.range[0]) {
                    candidate = attacher.trailing;
                    if (candidate) {
                        pos = candidate.range[0];
                        len = candidate.range[1] - pos;
                        if (node.range[0] <= pos && (node.range[1] - node.range[0] >= len)) {
                            attacher.trailing = node;
                        }
                    } else {
                        attacher.trailing = node;
                    }
                }
            }
        },

        markEnd: function (node) {
            if (extra.range) {
                node.range = [state.markerStack.pop(), index];
            }
            if (extra.loc) {
                node.loc = {
                    start: {
                        line: state.markerStack.pop(),
                        column: state.markerStack.pop()
                    },
                    end: {
                        line: lineNumber,
                        column: index - lineStart
                    }
                };
                this.postProcess(node);
            }
            if (extra.attachComment) {
                this.processComment(node);
            }
            return node;
        },

        markEndIf: function (node) {
            if (node.range || node.loc) {
                if (extra.loc) {
                    state.markerStack.pop();
                    state.markerStack.pop();
                }
                if (extra.range) {
                    state.markerStack.pop();
                }
            } else {
                this.markEnd(node);
            }
            return node;
        },

        postProcess: function (node) {
            if (extra.source) {
                node.loc.source = extra.source;
            }
            return node;
        },

        createArrayExpression: function (elements) {
            return {
                type: Syntax.ArrayExpression,
                elements: elements
            };
        },

        createAssignmentExpression: function (operator, left, right) {
            return {
                type: Syntax.AssignmentExpression,
                operator: operator,
                left: left,
                right: right
            };
        },

        createBinaryExpression: function (operator, left, right) {
            var type = (operator === '||' || operator === '&&') ? Syntax.LogicalExpression :
                        Syntax.BinaryExpression;
            return {
                type: type,
                operator: operator,
                left: left,
                right: right
            };
        },

        createCallExpression: function (callee, args) {
            return {
                type: Syntax.CallExpression,
                callee: callee,
                'arguments': args
            };
        },

        createConditionalExpression: function (test, consequent, alternate) {
            return {
                type: Syntax.ConditionalExpression,
                test: test,
                consequent: consequent,
                alternate: alternate
            };
        },

        createExpressionStatement: function (expression) {
            return {
                type: Syntax.ExpressionStatement,
                expression: expression
            };
        },

        createFunctionExpression: function (id, params, defaults, body) {
            return {
                type: Syntax.FunctionExpression,
                id: id,
                params: params,
                defaults: defaults,
                body: body,
                rest: null,
                generator: false,
                expression: false
            };
        },

        createIdentifier: function (name) {
            return {
                type: Syntax.Identifier,
                name: name
            };
        },

        createLiteral: function (token) {
            return {
                type: Syntax.Literal,
                value: token.value,
                raw: source.slice(token.range[0], token.range[1])
            };
        },

        createMemberExpression: function (accessor, object, property) {
            return {
                type: Syntax.MemberExpression,
                computed: accessor === '[',
                object: object,
                property: property
            };
        },

        createNewExpression: function (callee, args) {
            return {
                type: Syntax.NewExpression,
                callee: callee,
                'arguments': args
            };
        },

        createObjectExpression: function (properties) {
            return {
                type: Syntax.ObjectExpression,
                properties: properties
            };
        },

        createPostfixExpression: function (operator, argument) {
            return {
                type: Syntax.UpdateExpression,
                operator: operator,
                argument: argument,
                prefix: false
            };
        },

        createProperty: function (kind, key, value) {
            return {
                type: Syntax.Property,
                key: key,
                value: value,
                kind: kind
            };
        },

        createSequenceExpression: function (expressions) {
            return {
                type: Syntax.SequenceExpression,
                expressions: expressions
            };
        },

        createThisExpression: function () {
            return {
                type: Syntax.ThisExpression
            };
        },

        createUnaryExpression: function (operator, argument) {
            if (operator === '++' || operator === '--') {
                return {
                    type: Syntax.UpdateExpression,
                    operator: operator,
                    argument: argument,
                    prefix: true
                };
            }
            return {
                type: Syntax.UnaryExpression,
                operator: operator,
                argument: argument,
                prefix: true
            };
        }
    };

    // Return true if there is a line terminator before the next token.

    function peekLineTerminator() {
        var pos, line, start, found;

        pos = index;
        line = lineNumber;
        start = lineStart;
        skipComment();
        found = lineNumber !== line;
        index = pos;
        lineNumber = line;
        lineStart = start;

        return found;
    }

    // Throw an exception

    function throwError(token, messageFormat) {
        var error,
            args = Array.prototype.slice.call(arguments, 2),
            msg = messageFormat.replace(
                /%(\d)/g,
                function (whole, index) {
                    assert(index < args.length, 'Message reference must be in range');
                    return args[index];
                }
            );

        if (typeof token.lineNumber === 'number') {
            error = new Error('Line ' + token.lineNumber + ': ' + msg);
            error.index = token.range[0];
            error.lineNumber = token.lineNumber;
            error.column = token.range[0] - lineStart + 1;
        } else {
            error = new Error('Line ' + lineNumber + ': ' + msg);
            error.index = index;
            error.lineNumber = lineNumber;
            error.column = index - lineStart + 1;
        }

        error.description = msg;
        throw error;
    }

    function throwErrorTolerant() {
        try {
            throwError.apply(null, arguments);
        } catch (e) {
            if (extra.errors) {
                extra.errors.push(e);
            } else {
                throw e;
            }
        }
    }


    // Throw an exception because of the token.

    function throwUnexpected(token) {
        if (token.type === Token.EOF) {
            throwError(token, Messages.UnexpectedEOS);
        }

        if (token.type === Token.NumericLiteral) {
            throwError(token, Messages.UnexpectedNumber);
        }

        if (token.type === Token.StringLiteral) {
            throwError(token, Messages.UnexpectedString);
        }

        if (token.type === Token.Identifier) {
            throwError(token, Messages.UnexpectedIdentifier);
        }

        if (token.type === Token.Keyword) {
            if (isFutureReservedWord(token.value)) {
                throwError(token, Messages.UnexpectedReserved);
            } else if (strict && isStrictModeReservedWord(token.value)) {
                throwErrorTolerant(token, Messages.StrictReservedWord);
                return;
            }
            throwError(token, Messages.UnexpectedToken, token.value);
        }

        // BooleanLiteral, NullLiteral, or Punctuator.
        throwError(token, Messages.UnexpectedToken, token.value);
    }

    // Expect the next token to match the specified punctuator.
    // If not, an exception will be thrown.

    function expect(value) {
        var token = lex();
        if (token.type !== Token.Punctuator || token.value !== value) {
            throwUnexpected(token);
        }
    }

    // Expect the next token to match the specified keyword.
    // If not, an exception will be thrown.

    function expectKeyword(keyword) {
        var token = lex();
        if (token.type !== Token.Keyword || token.value !== keyword) {
            throwUnexpected(token);
        }
    }

    // Return true if the next token matches the specified punctuator.

    function match(value) {
        return lookahead.type === Token.Punctuator && lookahead.value === value;
    }

    // Return true if the next token matches the specified keyword

    function matchKeyword(keyword) {
        return lookahead.type === Token.Keyword && lookahead.value === keyword;
    }

    // Return true if the next token is an assignment operator

    function matchAssign() {
        var op;

        if (lookahead.type !== Token.Punctuator) {
            return false;
        }
        op = lookahead.value;
        return op === '=' ||
            op === '*=' ||
            op === '/=' ||
            op === '%=' ||
            op === '+=' ||
            op === '-=' ||
            op === '<<=' ||
            op === '>>=' ||
            op === '>>>=' ||
            op === '&=' ||
            op === '^=' ||
            op === '|=';
    }

    function consumeSemicolon() {
        var line;

        // Catch the very common case first: immediately a semicolon (U+003B).
        if (source.charCodeAt(index) === 0x3B) {
            lex();
            return;
        }

        line = lineNumber;
        skipComment();
        if (lineNumber !== line) {
            return;
        }

        if (match(';')) {
            lex();
            return;
        }

        if (lookahead.type !== Token.EOF && !match('}')) {
            throwUnexpected(lookahead);
        }
    }

    // Return true if provided expression is LeftHandSideExpression

    function isLeftHandSide(expr) {
        return expr.type === Syntax.Identifier || expr.type === Syntax.MemberExpression;
    }

    // 11.1.4 Array Initialiser

    function parseArrayInitialiser() {
        var elements = [];

        expect('[');

        while (!match(']')) {
            if (match(',')) {
                lex();
                elements.push(null);
            } else {
                elements.push(parseAssignmentExpression());

                if (!match(']')) {
                    expect(',');
                }
            }
        }

        expect(']');

        return delegate.createArrayExpression(elements);
    }

    // 11.1.5 Object Initialiser

    function parsePropertyFunction(param, first) {
        var previousStrict, body;

        previousStrict = strict;
        skipComment();
        delegate.markStart();
        body = parseFunctionSourceElements();
        if (first && strict && isRestrictedWord(param[0].name)) {
            throwErrorTolerant(first, Messages.StrictParamName);
        }
        strict = previousStrict;
        return delegate.markEnd(delegate.createFunctionExpression(null, param, [], body));
    }

    function parseObjectPropertyKey() {
        var token;

        skipComment();
        delegate.markStart();
        token = lex();

        // Note: This function is called only from parseObjectProperty(), where
        // EOF and Punctuator tokens are already filtered out.

        if (token.type === Token.StringLiteral || token.type === Token.NumericLiteral) {
            if (strict && token.octal) {
                throwErrorTolerant(token, Messages.StrictOctalLiteral);
            }
            return delegate.markEnd(delegate.createLiteral(token));
        }

        return delegate.markEnd(delegate.createIdentifier(token.value));
    }

    function parseObjectProperty() {
        var token, key, id, value, param;

        token = lookahead;
        skipComment();
        delegate.markStart();

        if (token.type === Token.Identifier) {

            id = parseObjectPropertyKey();

            // Property Assignment: Getter and Setter.

            if (token.value === 'get' && !match(':')) {
                key = parseObjectPropertyKey();
                expect('(');
                expect(')');
                value = parsePropertyFunction([]);
                return delegate.markEnd(delegate.createProperty('get', key, value));
            }
            if (token.value === 'set' && !match(':')) {
                key = parseObjectPropertyKey();
                expect('(');
                token = lookahead;
                if (token.type !== Token.Identifier) {
                    expect(')');
                    throwErrorTolerant(token, Messages.UnexpectedToken, token.value);
                    value = parsePropertyFunction([]);
                } else {
                    param = [ parseVariableIdentifier() ];
                    expect(')');
                    value = parsePropertyFunction(param, token);
                }
                return delegate.markEnd(delegate.createProperty('set', key, value));
            }
            expect(':');
            value = parseAssignmentExpression();
            return delegate.markEnd(delegate.createProperty('init', id, value));
        }
        if (token.type === Token.EOF || token.type === Token.Punctuator) {
            throwUnexpected(token);
        } else {
            key = parseObjectPropertyKey();
            expect(':');
            value = parseAssignmentExpression();
            return delegate.markEnd(delegate.createProperty('init', key, value));
        }
    }

    function parseObjectInitialiser() {
        var properties = [], property, name, key, kind, map = {}, toString = String;

        expect('{');

        while (!match('}')) {
            property = parseObjectProperty();

            if (property.key.type === Syntax.Identifier) {
                name = property.key.name;
            } else {
                name = toString(property.key.value);
            }
            kind = (property.kind === 'init') ? PropertyKind.Data : (property.kind === 'get') ? PropertyKind.Get : PropertyKind.Set;

            key = '$' + name;
            if (Object.prototype.hasOwnProperty.call(map, key)) {
                if (map[key] === PropertyKind.Data) {
                    if (strict && kind === PropertyKind.Data) {
                        throwErrorTolerant({}, Messages.StrictDuplicateProperty);
                    } else if (kind !== PropertyKind.Data) {
                        throwErrorTolerant({}, Messages.AccessorDataProperty);
                    }
                } else {
                    if (kind === PropertyKind.Data) {
                        throwErrorTolerant({}, Messages.AccessorDataProperty);
                    } else if (map[key] & kind) {
                        throwErrorTolerant({}, Messages.AccessorGetSet);
                    }
                }
                map[key] |= kind;
            } else {
                map[key] = kind;
            }

            properties.push(property);

            if (!match('}')) {
                expect(',');
            }
        }

        expect('}');

        return delegate.createObjectExpression(properties);
    }

    // 11.1.6 The Grouping Operator

    function parseGroupExpression() {
        var expr;

        expect('(');

        expr = parseExpression();

        expect(')');

        return expr;
    }


    // 11.1 Primary Expressions

    function parsePrimaryExpression() {
        var type, token, expr;

        if (match('(')) {
            return parseGroupExpression();
        }

        type = lookahead.type;
        delegate.markStart();

        if (type === Token.Identifier) {
            expr =  delegate.createIdentifier(lex().value);
        } else if (type === Token.StringLiteral || type === Token.NumericLiteral) {
            if (strict && lookahead.octal) {
                throwErrorTolerant(lookahead, Messages.StrictOctalLiteral);
            }
            expr = delegate.createLiteral(lex());
        } else if (type === Token.Keyword) {
            if (matchKeyword('this')) {
                lex();
                expr = delegate.createThisExpression();
            } else if (matchKeyword('function')) {
                expr = parseFunctionExpression();
            }
        } else if (type === Token.BooleanLiteral) {
            token = lex();
            token.value = (token.value === 'true');
            expr = delegate.createLiteral(token);
        } else if (type === Token.Undefined) {  // DERBY
            token = lex();
            token.value = void 0;
            expr = delegate.createLiteral(token);
        } else if (type === Token.NullLiteral) {
            token = lex();
            token.value = null;
            expr = delegate.createLiteral(token);
        } else if (match('[')) {
            expr = parseArrayInitialiser();
        } else if (match('{')) {
            expr = parseObjectInitialiser();
        } else if (match('/') || match('/=')) {
            if (typeof extra.tokens !== 'undefined') {
                expr = delegate.createLiteral(collectRegex());
            } else {
                expr = delegate.createLiteral(scanRegExp());
            }
            peek();
        }

        if (expr) {
            return delegate.markEnd(expr);
        }

        throwUnexpected(lex());
    }

    // 11.2 Left-Hand-Side Expressions

    function parseArguments() {
        var args = [];

        expect('(');

        if (!match(')')) {
            while (index < length) {
                args.push(parseAssignmentExpression());
                if (match(')')) {
                    break;
                }
                expect(',');
            }
        }

        expect(')');

        return args;
    }

    function parseNonComputedProperty() {
        var token;

        delegate.markStart();
        token = lex();

        if (!isIdentifierName(token)) {
            throwUnexpected(token);
        }

        return delegate.markEnd(delegate.createIdentifier(token.value));
    }

    function parseNonComputedMember() {
        expect('.');

        return parseNonComputedProperty();
    }

    function parseComputedMember() {
        var expr;

        expect('[');

        expr = parseExpression();

        expect(']');

        return expr;
    }

    function parseNewExpression() {
        var callee, args;

        delegate.markStart();
        expectKeyword('new');
        callee = parseLeftHandSideExpression();
        args = match('(') ? parseArguments() : [];

        return delegate.markEnd(delegate.createNewExpression(callee, args));
    }

    function parseLeftHandSideExpressionAllowCall() {
        var marker, previousAllowIn, expr, args, property;

        marker = createLocationMarker();

        previousAllowIn = state.allowIn;
        state.allowIn = true;
        expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();
        state.allowIn = previousAllowIn;

        while (match('.') || match('[') || match('(')) {
            if (match('(')) {
                args = parseArguments();
                expr = delegate.createCallExpression(expr, args);
            } else if (match('[')) {
                property = parseComputedMember();
                expr = delegate.createMemberExpression('[', expr, property);
            } else {
                property = parseNonComputedMember();
                expr = delegate.createMemberExpression('.', expr, property);
            }
            if (marker) {
                marker.end();
                marker.apply(expr);
            }
        }

        return expr;
    }

    function parseLeftHandSideExpression() {
        var marker, previousAllowIn, expr, property;

        marker = createLocationMarker();

        previousAllowIn = state.allowIn;
        expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();
        state.allowIn = previousAllowIn;

        while (match('.') || match('[')) {
            if (match('[')) {
                property = parseComputedMember();
                expr = delegate.createMemberExpression('[', expr, property);
            } else {
                property = parseNonComputedMember();
                expr = delegate.createMemberExpression('.', expr, property);
            }
            if (marker) {
                marker.end();
                marker.apply(expr);
            }
        }

        return expr;
    }

    // 11.3 Postfix Expressions

    function parsePostfixExpression() {
        var expr, token;

        delegate.markStart();
        expr = parseLeftHandSideExpressionAllowCall();

        if (lookahead.type === Token.Punctuator) {
            if ((match('++') || match('--')) && !peekLineTerminator()) {
                // 11.3.1, 11.3.2
                if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                    throwErrorTolerant({}, Messages.StrictLHSPostfix);
                }

                if (!isLeftHandSide(expr)) {
                    throwErrorTolerant({}, Messages.InvalidLHSInAssignment);
                }

                token = lex();
                expr = delegate.createPostfixExpression(token.value, expr);
            }
        }

        return delegate.markEndIf(expr);
    }

    // 11.4 Unary Operators

    function parseUnaryExpression() {
        var token, expr;

        delegate.markStart();

        if (lookahead.type !== Token.Punctuator && lookahead.type !== Token.Keyword) {
            expr = parsePostfixExpression();
        } else if (match('++') || match('--')) {
            token = lex();
            expr = parseUnaryExpression();
            // 11.4.4, 11.4.5
            if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                throwErrorTolerant({}, Messages.StrictLHSPrefix);
            }

            if (!isLeftHandSide(expr)) {
                throwErrorTolerant({}, Messages.InvalidLHSInAssignment);
            }

            expr = delegate.createUnaryExpression(token.value, expr);
        } else if (match('+') || match('-') || match('~') || match('!')) {
            token = lex();
            expr = parseUnaryExpression();
            expr = delegate.createUnaryExpression(token.value, expr);
        } else if (matchKeyword('delete') || matchKeyword('void') || matchKeyword('typeof')) {
            token = lex();
            expr = parseUnaryExpression();
            expr = delegate.createUnaryExpression(token.value, expr);
            if (strict && expr.operator === 'delete' && expr.argument.type === Syntax.Identifier) {
                throwErrorTolerant({}, Messages.StrictDelete);
            }
        } else {
            expr = parsePostfixExpression();
        }

        return delegate.markEndIf(expr);
    }

    function binaryPrecedence(token, allowIn) {
        var prec = 0;

        if (token.type !== Token.Punctuator && token.type !== Token.Keyword) {
            return 0;
        }

        switch (token.value) {
        case '||':
            prec = 1;
            break;

        case '&&':
            prec = 2;
            break;

        case '|':
            prec = 3;
            break;

        case '^':
            prec = 4;
            break;

        case '&':
            prec = 5;
            break;

        case '==':
        case '!=':
        case '===':
        case '!==':
            prec = 6;
            break;

        case '<':
        case '>':
        case '<=':
        case '>=':
        case 'instanceof':
            prec = 7;
            break;

        case 'in':
            prec = allowIn ? 7 : 0;
            break;

        case '<<':
        case '>>':
        case '>>>':
            prec = 8;
            break;

        case '+':
        case '-':
            prec = 9;
            break;

        case '*':
        case '/':
        case '%':
            prec = 11;
            break;

        default:
            break;
        }

        return prec;
    }

    // 11.5 Multiplicative Operators
    // 11.6 Additive Operators
    // 11.7 Bitwise Shift Operators
    // 11.8 Relational Operators
    // 11.9 Equality Operators
    // 11.10 Binary Bitwise Operators
    // 11.11 Binary Logical Operators

    function parseBinaryExpression() {
        var marker, markers, expr, token, prec, stack, right, operator, left, i;

        marker = createLocationMarker();
        left = parseUnaryExpression();

        token = lookahead;
        prec = binaryPrecedence(token, state.allowIn);
        if (prec === 0) {
            return left;
        }
        token.prec = prec;
        lex();

        markers = [marker, createLocationMarker()];
        right = parseUnaryExpression();

        stack = [left, token, right];

        while ((prec = binaryPrecedence(lookahead, state.allowIn)) > 0) {

            // Reduce: make a binary expression from the three topmost entries.
            while ((stack.length > 2) && (prec <= stack[stack.length - 2].prec)) {
                right = stack.pop();
                operator = stack.pop().value;
                left = stack.pop();
                expr = delegate.createBinaryExpression(operator, left, right);
                markers.pop();
                marker = markers.pop();
                if (marker) {
                    marker.end();
                    marker.apply(expr);
                }
                stack.push(expr);
                markers.push(marker);
            }

            // Shift.
            token = lex();
            token.prec = prec;
            stack.push(token);
            markers.push(createLocationMarker());
            expr = parseUnaryExpression();
            stack.push(expr);
        }

        // Final reduce to clean-up the stack.
        i = stack.length - 1;
        expr = stack[i];
        markers.pop();
        while (i > 1) {
            expr = delegate.createBinaryExpression(stack[i - 1].value, stack[i - 2], expr);
            i -= 2;
            marker = markers.pop();
            if (marker) {
                marker.end();
                marker.apply(expr);
            }
        }

        return expr;
    }


    // 11.12 Conditional Operator

    function parseConditionalExpression() {
        var expr, previousAllowIn, consequent, alternate;

        delegate.markStart();
        expr = parseBinaryExpression();

        if (match('?')) {
            lex();
            previousAllowIn = state.allowIn;
            state.allowIn = true;
            consequent = parseAssignmentExpression();
            state.allowIn = previousAllowIn;
            expect(':');
            alternate = parseAssignmentExpression();

            expr = delegate.markEnd(delegate.createConditionalExpression(expr, consequent, alternate));
        } else {
            delegate.markEnd({});
        }

        return expr;
    }

    // 11.13 Assignment Operators

    function parseAssignmentExpression() {
        var token, left, right, node;

        token = lookahead;
        delegate.markStart();
        node = left = parseConditionalExpression();

        if (matchAssign()) {
            // LeftHandSideExpression
            if (!isLeftHandSide(left)) {
                throwErrorTolerant({}, Messages.InvalidLHSInAssignment);
            }

            // 11.13.1
            if (strict && left.type === Syntax.Identifier && isRestrictedWord(left.name)) {
                throwErrorTolerant(token, Messages.StrictLHSAssignment);
            }

            token = lex();
            right = parseAssignmentExpression();
            node = delegate.createAssignmentExpression(token.value, left, right);
        }

        return delegate.markEndIf(node);
    }

    // 11.14 Comma Operator

    function parseExpression() {
        var expr;

        delegate.markStart();
        expr = parseAssignmentExpression();

        if (match(',')) {
            expr = delegate.createSequenceExpression([ expr ]);

            while (index < length) {
                if (!match(',')) {
                    break;
                }
                lex();
                expr.expressions.push(parseAssignmentExpression());
            }
        }

        return delegate.markEndIf(expr);
    }

    // 12.4 Expression Statement

    function parseExpressionStatement() {
        var expr = parseExpression();
        consumeSemicolon();
        return delegate.createExpressionStatement(expr);
    }

    function parseProgram() {
        skipComment();
        delegate.markStart();
        strict = false;
        peek();
        return delegate.markEnd(parseExpressionStatement());
    }

    function attachComments() {
        var i, attacher, comment, leading, trailing;

        for (i = 0; i < extra.pendingComments.length; ++i) {
            attacher = extra.pendingComments[i];
            comment = attacher.comment;
            leading = attacher.leading;
            if (leading) {
                if (typeof leading.leadingComments === 'undefined') {
                    leading.leadingComments = [];
                }
                leading.leadingComments.push(attacher.comment);
            }
            trailing = attacher.trailing;
            if (trailing) {
                if (typeof trailing.trailingComments === 'undefined') {
                    trailing.trailingComments = [];
                }
                trailing.trailingComments.push(attacher.comment);
            }
        }
        extra.pendingComments = [];
    }

    function filterTokenLocation() {
        var i, entry, token, tokens = [];

        for (i = 0; i < extra.tokens.length; ++i) {
            entry = extra.tokens[i];
            token = {
                type: entry.type,
                value: entry.value
            };
            if (extra.range) {
                token.range = entry.range;
            }
            if (extra.loc) {
                token.loc = entry.loc;
            }
            tokens.push(token);
        }

        extra.tokens = tokens;
    }

    function LocationMarker() {
        this.marker = [index, lineNumber, index - lineStart, 0, 0, 0];
    }

    LocationMarker.prototype = {
        constructor: LocationMarker,

        end: function () {
            this.marker[3] = index;
            this.marker[4] = lineNumber;
            this.marker[5] = index - lineStart;
        },

        apply: function (node) {
            if (extra.range) {
                node.range = [this.marker[0], this.marker[3]];
            }
            if (extra.loc) {
                node.loc = {
                    start: {
                        line: this.marker[1],
                        column: this.marker[2]
                    },
                    end: {
                        line: this.marker[4],
                        column: this.marker[5]
                    }
                };
                node = delegate.postProcess(node);
            }
            if (extra.attachComment) {
                delegate.processComment(node);
            }
        }
    };

    function createLocationMarker() {
        if (!extra.loc && !extra.range) {
            return null;
        }

        skipComment();

        return new LocationMarker();
    }

    function tokenize(code, options) {
        var toString,
            token,
            tokens;

        toString = String;
        if (typeof code !== 'string' && !(code instanceof String)) {
            code = toString(code);
        }

        delegate = SyntaxTreeDelegate;
        source = code;
        index = 0;
        lineNumber = (source.length > 0) ? 1 : 0;
        lineStart = 0;
        length = source.length;
        lookahead = null;
        state = {
            allowIn: true,
            labelSet: {},
            inFunctionBody: false,
            inIteration: false,
            inSwitch: false,
            lastCommentStart: -1
        };

        extra = {};

        // Options matching.
        options = options || {};

        // Of course we collect tokens here.
        options.tokens = true;
        extra.tokens = [];
        extra.tokenize = true;
        // The following two fields are necessary to compute the Regex tokens.
        extra.openParenToken = -1;
        extra.openCurlyToken = -1;

        extra.range = (typeof options.range === 'boolean') && options.range;
        extra.loc = (typeof options.loc === 'boolean') && options.loc;

        if (typeof options.comment === 'boolean' && options.comment) {
            extra.comments = [];
        }
        if (typeof options.tolerant === 'boolean' && options.tolerant) {
            extra.errors = [];
        }

        if (length > 0) {
            if (typeof source[0] === 'undefined') {
                // Try first to convert to a string. This is good as fast path
                // for old IE which understands string indexing for string
                // literals only and not for string object.
                if (code instanceof String) {
                    source = code.valueOf();
                }
            }
        }

        try {
            peek();
            if (lookahead.type === Token.EOF) {
                return extra.tokens;
            }

            token = lex();
            while (lookahead.type !== Token.EOF) {
                try {
                    token = lex();
                } catch (lexError) {
                    token = lookahead;
                    if (extra.errors) {
                        extra.errors.push(lexError);
                        // We have to break on the first error
                        // to avoid infinite loops.
                        break;
                    } else {
                        throw lexError;
                    }
                }
            }

            filterTokenLocation();
            tokens = extra.tokens;
            if (typeof extra.comments !== 'undefined') {
                tokens.comments = extra.comments;
            }
            if (typeof extra.errors !== 'undefined') {
                tokens.errors = extra.errors;
            }
        } catch (e) {
            throw e;
        } finally {
            extra = {};
        }
        return tokens;
    }

    function parse(code, options) {
        var program, toString;

        toString = String;
        if (typeof code !== 'string' && !(code instanceof String)) {
            code = toString(code);
        }

        delegate = SyntaxTreeDelegate;
        source = code;
        index = 0;
        lineNumber = (source.length > 0) ? 1 : 0;
        lineStart = 0;
        length = source.length;
        lookahead = null;
        state = {
            allowIn: true,
            labelSet: {},
            inFunctionBody: false,
            inIteration: false,
            inSwitch: false,
            lastCommentStart: -1,
            markerStack: []
        };

        extra = {};
        if (typeof options !== 'undefined') {
            extra.range = (typeof options.range === 'boolean') && options.range;
            extra.loc = (typeof options.loc === 'boolean') && options.loc;
            extra.attachComment = (typeof options.attachComment === 'boolean') && options.attachComment;

            if (extra.loc && options.source !== null && options.source !== undefined) {
                extra.source = toString(options.source);
            }

            if (typeof options.tokens === 'boolean' && options.tokens) {
                extra.tokens = [];
            }
            if (typeof options.comment === 'boolean' && options.comment) {
                extra.comments = [];
            }
            if (typeof options.tolerant === 'boolean' && options.tolerant) {
                extra.errors = [];
            }
            if (extra.attachComment) {
                extra.range = true;
                extra.pendingComments = [];
                extra.comments = [];
            }
        }

        if (length > 0) {
            if (typeof source[0] === 'undefined') {
                // Try first to convert to a string. This is good as fast path
                // for old IE which understands string indexing for string
                // literals only and not for string object.
                if (code instanceof String) {
                    source = code.valueOf();
                }
            }
        }

        try {
            program = parseProgram();
            if (typeof extra.comments !== 'undefined') {
                program.comments = extra.comments;
            }
            if (typeof extra.tokens !== 'undefined') {
                filterTokenLocation();
                program.tokens = extra.tokens;
            }
            if (typeof extra.errors !== 'undefined') {
                program.errors = extra.errors;
            }
            if (extra.attachComment) {
                attachComments();
            }
        } catch (e) {
            throw e;
        } finally {
            extra = {};
        }

        return program;
    }

    // Sync with *.json manifests.
    exports.version = '1.1.0-dev';

    exports.tokenize = tokenize;

    exports.parse = parse;

    // Deep copy.
    exports.Syntax = (function () {
        var name, types = {};

        if (typeof Object.create === 'function') {
            types = Object.create(null);
        }

        for (name in Syntax) {
            if (Syntax.hasOwnProperty(name)) {
                types[name] = Syntax[name];
            }
        }

        if (typeof Object.freeze === 'function') {
            Object.freeze(types);
        }

        return types;
    }());

}));
/* vim: set sw=4 ts=4 et tw=80 : */

},{}],23:[function(require,module,exports){
exports.contexts = require('./lib/contexts');
exports.expressions = require('./lib/expressions');
exports.operatorFns = require('./lib/operatorFns');
exports.templates = require('./lib/templates');

},{"./lib/contexts":24,"./lib/expressions":25,"./lib/operatorFns":26,"./lib/templates":27}],24:[function(require,module,exports){
exports.ContextMeta = ContextMeta;
exports.Context = Context;

function noop() {}

// TODO:
// Implement removeItemContext

function ContextMeta() {
  this.addBinding = noop;
  this.removeBinding = noop;
  this.removeNode = noop;
  this.addItemContext = noop;
  this.removeItemContext = noop;
  this.views = null;
  this.idNamespace = '';
  this.idCount = 0;
  this.pending = [];
  this.pauseCount = 0;
}

function Context(meta, controller, parent, unbound, expression, item, view, attributes, hooks, initHooks) {
  // Required properties //

  // Properties which are globally inherited for the entire page
  this.meta = meta;
  // The page or component. Must have a `model` property with a `data` property
  this.controller = controller;

  // Optional properties //

  // Containing context
  this.parent = parent;
  // Boolean set to true when bindings should be ignored
  this.unbound = unbound;
  // The expression for a block
  this.expression = expression;
  // Alias name for the given expression
  this.alias = expression && expression.meta && expression.meta.as;
  // Alias name for the index or iterated key
  this.keyAlias = expression && expression.meta && expression.meta.keyAs;

  // For Context::eachChild
  // The index of the each at render time
  this.item = item;

  // For Context::viewChild
  // Reference to the current view
  this.view = view;
  // Attribute values passed to the view instance
  this.attributes = attributes;
  // MarkupHooks to be called after insert into DOM of component
  this.hooks = hooks;
  // MarkupHooks to be called immediately before init of component
  this.initHooks = initHooks;

  // Used in EventModel
  this._id = null;
}

Context.prototype.id = function() {
  var count = ++this.meta.idCount;
  return this.meta.idNamespace + '_' + count.toString(36);
};

Context.prototype.addBinding = function(binding) {
  // Don't add bindings that wrap list items. Only their outer range is needed
  if (binding.itemFor) return;
  var expression = binding.template.expression;
  // Don't rerender in unbound sections
  if (expression ? expression.isUnbound(this) : this.unbound) return;
  // Don't rerender to changes in a with expression
  if (expression && expression.meta && expression.meta.blockType === 'with') return;
  this.meta.addBinding(binding);
};
Context.prototype.removeBinding = function(binding) {
  this.meta.removeBinding(binding);
};
Context.prototype.removeNode = function(node) {
  this.meta.removeNode(node);
};

Context.prototype.child = function(expression) {
  // Set or inherit the binding mode
  var blockType = expression.meta && expression.meta.blockType;
  var unbound = (blockType === 'unbound') ? true :
    (blockType === 'bound') ? false :
    this.unbound;
  return new Context(this.meta, this.controller, this, unbound, expression);
};

Context.prototype.componentChild = function(component) {
  return new Context(this.meta, component, this, this.unbound);
};

// Make a context for an item in an each block
Context.prototype.eachChild = function(expression, index) {
  var context = new Context(this.meta, this.controller, this, this.unbound, expression, index);
  this.meta.addItemContext(context);
  return context;
};

Context.prototype.viewChild = function(view, attributes, hooks, initHooks) {
  return new Context(this.meta, this.controller, this, this.unbound, null, null, view, attributes, hooks, initHooks);
};

Context.prototype.forRelative = function(expression) {
  var context = this;
  while (context && context.expression === expression || context.view) {
    context = context.parent;
  }
  return context;
};

// Returns the closest context which defined the named alias
Context.prototype.forAlias = function(alias) {
  var context = this;
  while (context) {
    if (context.alias === alias || context.keyAlias === alias) return context;
    context = context.parent;
  }
};

// Returns the closest containing context for a view attribute name or nothing
Context.prototype.forAttribute = function(attribute) {
  var context = this;
  while (context) {
    // Find the closest context associated with a view
    if (context.view) {
      var attributes = context.attributes;
      if (!attributes) return;
      if (attributes.hasOwnProperty(attribute)) return context;
      // If the attribute isn't found, but the attributes inherit, continue
      // looking in the next closest view context
      if (!attributes.inherit && !attributes.extend) return;
    }
    context = context.parent;
  }
};

Context.prototype.forViewParent = function() {
  var context = this;
  while (context) {
    // Find the closest view
    if (context.view) return context.parent;
    context = context.parent;
  }
};

Context.prototype.getView = function() {
  var context = this;
  while (context) {
    // Find the closest view
    if (context.view) return context.view;
    context = context.parent;
  }
};

// Returns the `this` value for a context
Context.prototype.get = function() {
  return (this.expression) ? this.expression.get(this) : this.controller.model.data;
};

Context.prototype.pause = function() {
  this.meta.pauseCount++;
};

Context.prototype.unpause = function() {
  if (--this.meta.pauseCount) return;
  this.flush();
};

Context.prototype.flush = function() {
  var pending = this.meta.pending;
  var len = pending.length;
  if (!len) return;
  this.meta.pending = [];
  for (var i = 0; i < len; i++) {
    pending[i]();
  }
};

Context.prototype.queue = function(cb) {
  this.meta.pending.push(cb);
};

},{}],25:[function(require,module,exports){
(function (global){
var serializeObject = require('serialize-object');
var operatorFns = require('./operatorFns');
var templates = require('./templates');

exports.lookup = lookup;
exports.templateTruthy = templateTruthy;
exports.pathSegments = pathSegments;
exports.renderValue = renderValue;
exports.ExpressionMeta = ExpressionMeta;

exports.Expression = Expression;
exports.LiteralExpression = LiteralExpression;
exports.PathExpression = PathExpression;
exports.RelativePathExpression = RelativePathExpression;
exports.AliasPathExpression = AliasPathExpression;
exports.AttributePathExpression = AttributePathExpression;
exports.BracketsExpression = BracketsExpression;
exports.FnExpression = FnExpression;
exports.OperatorExpression = OperatorExpression;
exports.NewExpression = NewExpression;
exports.SequenceExpression = SequenceExpression;
exports.ScopedModelExpression = ScopedModelExpression;

function lookup(segments, value) {
  if (!segments) return value;

  for (var i = 0, len = segments.length; i < len; i++) {
    if (value == null) return value;
    value = value[segments[i]];
  }
  return value;
}

// Unlike JS, `[]` is falsey. Otherwise, truthiness is the same as JS
function templateTruthy(value) {
  return (Array.isArray(value)) ? value.length > 0 : !!value;
}

function pathSegments(segments) {
  var result = [];
  for (var i = 0; i < segments.length; i++) {
    var segment = segments[i];
    result[i] = (typeof segment === 'object') ? segment.item : segment;
  }
  return result;
}

function renderValue(value, context) {
  return (typeof value !== 'object') ? value :
    (value instanceof templates.Template) ? renderTemplate(value, context) :
    (Array.isArray(value)) ? renderArray(value, context) :
    renderObject(value, context);
}
function renderTemplate(value, context) {
  var i = 1000;
  while (value instanceof templates.Template) {
    if (--i < 0) throw new Error('Maximum template render passes exceeded');
    value = value.get(context, true);
  }
  return value;
}
function renderArray(array, context) {
  for (var i = 0, len = array.length; i < len; i++) {
    if (hasTemplateProperty(array[i])) {
      return renderArrayProperties(array, context);
    }
  }
  return array;
}
function renderObject(object, context) {
  return (hasTemplateProperty(object)) ?
    renderObjectProperties(object, context) : object;
}
function hasTemplateProperty(object) {
  if (!object) return false;
  if (global.Node && object instanceof global.Node) return false;
  for (var key in object) {
    if (object[key] instanceof templates.Template) return true;
  }
  return false;
}
function renderArrayProperties(array, context) {
  var out = [];
  for (var i = 0, len = array.length; i < len; i++) {
    var item = renderObject(array[i], context);
    out.push(item);
  }
  return out;
}
function renderObjectProperties(object, context) {
  var out = {};
  for (var key in object) {
    var value = object[key];
    out[key] = renderTemplate(value, context);
  }
  return out;
}

function ExpressionMeta(source, blockType, isEnd, as, keyAs, unescaped, bindType, valueType) {
  this.source = source;
  this.blockType = blockType;
  this.isEnd = isEnd;
  this.as = as;
  this.keyAs = keyAs;
  this.unescaped = unescaped;
  this.bindType = bindType;
  this.valueType = valueType;
}
ExpressionMeta.prototype.module = 'expressions';
ExpressionMeta.prototype.type = 'ExpressionMeta';
ExpressionMeta.prototype.serialize = function() {
  return serializeObject.instance(
    this
  , this.source
  , this.blockType
  , this.isEnd
  , this.as
  , this.keyAs
  , this.unescaped
  , this.bindType
  , this.valueType
  );
};

function Expression(meta) {
  this.meta = meta;
}
Expression.prototype.module = 'expressions';
Expression.prototype.type = 'Expression';
Expression.prototype.serialize = function() {
  return serializeObject.instance(this, this.meta);
};
Expression.prototype.toString = function() {
  return this.meta && this.meta.source;
};
Expression.prototype.truthy = function(context) {
  var blockType = this.meta.blockType;
  if (blockType === 'else') return true;
  var value = this.get(context, true);
  var truthy = templateTruthy(value);
  return (blockType === 'unless') ? !truthy : truthy;
};
Expression.prototype.get = function() {};
// Return the expression's segment list with context objects
Expression.prototype.resolve = function() {};
// Return a list of segment lists or null
Expression.prototype.dependencies = function() {};
// Return the pathSegments that the expression currently resolves to or null
Expression.prototype.pathSegments = function(context) {
  var segments = this.resolve(context);
  return segments && pathSegments(segments);
};
Expression.prototype.set = function(context, value) {
  var segments = this.pathSegments(context);
  if (!segments) throw new Error('Expression does not support setting');
  context.controller.model._set(segments, value);
};
Expression.prototype._getPatch = function(context, value) {
  if (this.meta && this.meta.blockType) {
    value = renderTemplate(value, context);
  }
  return (context && context.expression === this && context.item != null) ?
    value && value[context.item] : value;
};
Expression.prototype._resolvePatch = function(context, segments) {
  return (context && context.expression === this && context.item != null) ?
    segments.concat(context) : segments;
};
Expression.prototype.isUnbound = function(context) {
  // If the template being rendered has an explicit bindType keyword, such as:
  // {{unbound #item.text}}
  var bindType = this.meta && this.meta.bindType;
  if (bindType === 'unbound') return true;
  if (bindType === 'bound') return false;
  // Otherwise, inherit from the context
  return context.unbound;
};


function LiteralExpression(value, meta) {
  this.value = value;
  this.meta = meta;
}
LiteralExpression.prototype = new Expression();
LiteralExpression.prototype.type = 'LiteralExpression';
LiteralExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.value, this.meta);
};
LiteralExpression.prototype.get = function(context) {
  return this._getPatch(context, this.value);
};

function PathExpression(segments, meta) {
  this.segments = segments;
  this.meta = meta;
}
PathExpression.prototype = new Expression();
PathExpression.prototype.type = 'PathExpression';
PathExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.segments, this.meta);
};
PathExpression.prototype.get = function(context) {
  var value = lookup(this.segments, context.controller.model.data);
  return this._getPatch(context, value);
};
PathExpression.prototype.resolve = function(context) {
  var segments = concat(context.controller._scope, this.segments);
  return this._resolvePatch(context, segments);
};
PathExpression.prototype.dependencies = function(context, forInnerPath) {
  return outerDependency(this, context, forInnerPath);
};

function RelativePathExpression(segments, meta) {
  this.segments = segments;
  this.meta = meta;
}
RelativePathExpression.prototype = new Expression();
RelativePathExpression.prototype.type = 'RelativePathExpression';
RelativePathExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.segments, this.meta);
};
RelativePathExpression.prototype.get = function(context) {
  var relativeContext = context.forRelative(this);
  var value = relativeContext.get();
  if (this.segments.length) {
    value = renderTemplate(value, relativeContext);
    value = lookup(this.segments, value);
  }
  return this._getPatch(context, value);
};
RelativePathExpression.prototype.resolve = function(context) {
  var relativeContext = context.forRelative(this);
  var base = (relativeContext.expression) ?
    relativeContext.expression.resolve(relativeContext) :
    [];
  if (!base) return;
  var segments = base.concat(this.segments);
  return this._resolvePatch(context, segments);
};
RelativePathExpression.prototype.dependencies = function(context, forInnerPath) {
  // Return inner dependencies from our ancestor
  // (e.g., {{ with foo[bar] }} ... {{ this.x }} has 'bar' as a dependency.)
  var relativeContext = context.forRelative(this);
  var inner = relativeContext.expression &&
    relativeContext.expression.dependencies(relativeContext, true);
  var outer = outerDependency(this, context, forInnerPath);
  return concat(outer, inner);
};

function AliasPathExpression(alias, segments, meta) {
  this.alias = alias;
  this.segments = segments;
  this.meta = meta;
}
AliasPathExpression.prototype = new Expression();
AliasPathExpression.prototype.type = 'AliasPathExpression';
AliasPathExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.alias, this.segments, this.meta);
};
AliasPathExpression.prototype.get = function(context) {
  var aliasContext = context.forAlias(this.alias);
  if (!aliasContext) return;
  if (aliasContext.keyAlias === this.alias) {
    return aliasContext.item;
  }
  var value = aliasContext.get();
  if (this.segments.length) {
    value = renderTemplate(value, aliasContext);
    value = lookup(this.segments, value);
  }
  return this._getPatch(context, value);
};
AliasPathExpression.prototype.resolve = function(context) {
  var aliasContext = context.forAlias(this.alias);
  if (!aliasContext) return;
  if (aliasContext.keyAlias === this.alias) return;
  var base = aliasContext.expression.resolve(aliasContext);
  if (!base) return;
  var segments = base.concat(this.segments);
  return this._resolvePatch(context, segments);
};
AliasPathExpression.prototype.dependencies = function(context, forInnerPath) {
  var aliasContext = context.forAlias(this.alias);
  if (!aliasContext) return;
  if (aliasContext.keyAlias === this.alias) {
    // For keyAliases, use a dependency of the entire list, so that it will
    // always update when the list changes in any way. This is over-binding,
    // but would otherwise be much more complex
    var base = aliasContext.expression.resolve(aliasContext.parent);
    return [base];
  }
  var inner = aliasContext.expression.dependencies(aliasContext, true);
  var outer = outerDependency(this, context, forInnerPath);
  return concat(outer, inner);
};

function AttributePathExpression(attribute, segments, meta) {
  this.attribute = attribute;
  this.segments = segments;
  this.meta = meta;
}
AttributePathExpression.prototype = new Expression();
AttributePathExpression.prototype.type = 'AttributePathExpression';
AttributePathExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.attribute, this.segments, this.meta);
};
AttributePathExpression.prototype.get = function(context) {
  var attributeContext = context.forAttribute(this.attribute);
  if (!attributeContext) return;
  var value = attributeContext.attributes[this.attribute];
  if (this.segments.length) {
    value = renderTemplate(value, attributeContext);
    value = lookup(this.segments, value);
  }
  return this._getPatch(context, value);
};
AttributePathExpression.prototype.resolve = function(context) {
  var attributeContext = context.forAttribute(this.attribute);
  // Attributes are either a ParentWrapper or a literal value
  var value = attributeContext && attributeContext.attributes[this.attribute];
  var base = value && (typeof value.resolve === 'function') &&
    value.resolve(attributeContext);
  if (!base) return;
  var segments = base.concat(this.segments);
  return this._resolvePatch(context, segments);
};
AttributePathExpression.prototype.dependencies = function(context, forInnerPath) {
  var attributeContext = context.forAttribute(this.attribute);
  // Attributes are either a ParentWrapper or a literal value
  var value = attributeContext && attributeContext.attributes[this.attribute];
  var inner = value && (typeof value.dependencies === 'function') &&
    value.dependencies(attributeContext, true);
  var outer = outerDependency(this, context, forInnerPath);
  return concat(outer, inner);
};

function BracketsExpression(before, inside, afterSegments, meta) {
  this.before = before;
  this.inside = inside;
  this.afterSegments = afterSegments;
  this.meta = meta;
}
BracketsExpression.prototype = new Expression();
BracketsExpression.prototype.type = 'BracketsExpression';
BracketsExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.before, this.inside, this.afterSegments, this.meta);
};
BracketsExpression.prototype.get = function(context) {
  var inside = this.inside.get(context);
  if (inside == null) return;
  var before = this.before.get(context);
  if (!before) return;
  var base = before[inside];
  var value = (this.afterSegments) ? lookup(this.afterSegments, base) : base;
  return this._getPatch(context, value);
};
BracketsExpression.prototype.resolve = function(context) {
  // Get and split the current value of the expression inside the brackets
  var inside = this.inside.get(context);
  if (inside == null) return;

  // Concat the before, inside, and optional after segments
  var base = this.before.resolve(context);
  if (!base) return;
  var segments = (this.afterSegments) ?
    base.concat(inside, this.afterSegments) :
    base.concat(inside);
  return this._resolvePatch(context, segments);
};
BracketsExpression.prototype.dependencies = function(context, forInnerPath) {
  var before = this.before.dependencies(context, true);
  var inner = this.inside.dependencies(context);
  var outer = outerDependency(this, context, forInnerPath);
  return concat(concat(outer, inner), before);
};

function FnExpression(segments, args, afterSegments, meta) {
  this.segments = segments;
  this.args = args;
  this.afterSegments = afterSegments;
  this.meta = meta;
  var parentSegments = segments && segments.slice();
  this.lastSegment = parentSegments && parentSegments.pop();
  this.parentSegments = (parentSegments && parentSegments.length) ? parentSegments : null;
}
FnExpression.prototype = new Expression();
FnExpression.prototype.type = 'FnExpression';
FnExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.segments, this.args, this.afterSegments, this.meta);
};
FnExpression.prototype.get = function(context) {
  var value = this.apply(context);
  // Lookup property underneath computed value if needed
  if (this.afterSegments) {
    value = lookup(this.afterSegments, value);
  }
  return this._getPatch(context, value);
};
FnExpression.prototype.apply = function(context, extraInputs) {
  var parent = this._lookupParent(context);
  var fn = parent[this.lastSegment];
  var getFn = fn.get || fn;
  var out = this._applyFn(getFn, context, extraInputs, parent);
  return out;
};
FnExpression.prototype._lookupParent = function(context) {
  // Lookup function on current controller
  var controller = context.controller;
  var segments = this.parentSegments;
  var parent = (segments) ? lookup(segments, controller) : controller;
  if (parent && parent[this.lastSegment]) return parent;
  // Otherwise lookup function on page
  var page = controller.page;
  if (controller !== page) {
    parent = (segments) ? lookup(segments, page) : page;
    if (parent && parent[this.lastSegment]) return parent;
  }
  // Otherwise lookup function on global
  parent = (segments) ? lookup(segments, global) : global;
  if (parent && parent[this.lastSegment]) return parent;
  // Throw if not found
  throw new Error('Function not found for: ' + this.segments.join('.'));
};
FnExpression.prototype._getInputs = function(context) {
  var inputs = [];
  for (var i = 0, len = this.args.length; i < len; i++) {
    var value = this.args[i].get(context);
    inputs.push(renderValue(value, context));
  }
  return inputs;
};
FnExpression.prototype._applyFn = function(fn, context, extraInputs, thisArg) {
  // Apply if there are no path inputs
  if (!this.args) {
    return (extraInputs) ?
      fn.apply(thisArg, extraInputs) :
      fn.call(thisArg);
  }
  // Otherwise, get the current value for path inputs and apply
  var inputs = this._getInputs(context);
  if (extraInputs) {
    for (var i = 0, len = extraInputs.length; i < len; i++) {
      inputs.push(extraInputs[i]);
    }
  }
  return fn.apply(thisArg, inputs);
};
FnExpression.prototype.dependencies = function(context) {
  var dependencies = [];
  if (!this.args) return dependencies;
  for (var i = 0, len = this.args.length; i < len; i++) {
    var argDependencies = this.args[i].dependencies(context);
    var firstDependency = argDependencies && argDependencies[0];
    if (!firstDependency) continue;
    if (firstDependency[firstDependency.length - 1] !== '*') {
      argDependencies[0] = argDependencies[0].concat('*');
    }
    for (var j = 0, jLen = argDependencies.length; j < jLen; j++) {
      dependencies.push(argDependencies[j]);
    }
  }
  return dependencies;
};
FnExpression.prototype.set = function(context, value) {
  var controller = context.controller;
  var fn, parent;
  while (controller) {
    parent = (this.parentSegments) ?
      lookup(this.parentSegments, controller) :
      controller;
    fn = parent && parent[this.lastSegment];
    if (fn) break;
    controller = controller.parent;
  }
  var setFn = fn && fn.set;
  if (!setFn) throw new Error('No setter function for: ' + this.segments.join('.'));
  var inputs = this._getInputs(context);
  inputs.unshift(value);
  var out = setFn.apply(parent, inputs);
  for (var i in out) {
    this.args[i].set(context, out[i]);
  }
};

function NewExpression(segments, args, afterSegments, meta) {
  FnExpression.call(this, segments, args, afterSegments, meta);
}
NewExpression.prototype = new FnExpression();
NewExpression.prototype.type = 'NewExpression';
NewExpression.prototype._applyFn = function(Fn, context) {
  // Apply if there are no path inputs
  if (!this.args) return new Fn();
  // Otherwise, get the current value for path inputs and apply
  var inputs = this._getInputs(context);
  inputs.unshift(null);
  return new (Fn.bind.apply(Fn, inputs))();
};

function OperatorExpression(name, args, afterSegments, meta) {
  this.name = name;
  this.args = args;
  this.afterSegments = afterSegments;
  this.meta = meta;
  this.getFn = operatorFns.get[name];
  this.setFn = operatorFns.set[name];
}
OperatorExpression.prototype = new FnExpression();
OperatorExpression.prototype.type = 'OperatorExpression';
OperatorExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.name, this.args, this.afterSegments, this.meta);
};
OperatorExpression.prototype.apply = function(context) {
  var inputs = this._getInputs(context);
  return this.getFn.apply(null, inputs);
};
OperatorExpression.prototype.set = function(context, value) {
  var inputs = this._getInputs(context);
  inputs.unshift(value);
  var out = this.setFn.apply(null, inputs);
  for (var i in out) {
    this.args[i].set(context, out[i]);
  }
};

function SequenceExpression(args, afterSegments, meta) {
  this.args = args;
  this.afterSegments = afterSegments;
  this.meta = meta;
}
SequenceExpression.prototype = new OperatorExpression();
SequenceExpression.prototype.type = 'SequenceExpression';
SequenceExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.args, this.afterSegments, this.meta);
};
SequenceExpression.prototype.name = ',';
SequenceExpression.prototype.getFn = operatorFns.get[','];
SequenceExpression.prototype.resolve = function(context) {
  var last = this.args[this.args.length - 1];
  return last.resolve(context);
};
SequenceExpression.prototype.dependencies = function(context, forInnerPath) {
  var dependencies = [];
  for (var i = 0, len = this.args.length; i < len; i++) {
    var argDependencies = this.args[i].dependencies(context, forInnerPath);
    for (var j = 0, jLen = argDependencies.length; j < jLen; j++) {
      dependencies.push(argDependencies[j]);
    }
  }
  return dependencies;
};

function ScopedModelExpression(expression, meta) {
  this.expression = expression;
  this.meta = meta;
}
ScopedModelExpression.prototype = new Expression();
ScopedModelExpression.prototype.type = 'ScopedModelExpression';
ScopedModelExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.expression, this.meta);
};
// Return a scoped model instead of the value
ScopedModelExpression.prototype.get = function(context) {
  var segments = this.pathSegments(context);
  if (!segments) return;
  return context.controller.model.scope(segments.join('.'));
};
// Delegate other methods to the inner expression
ScopedModelExpression.prototype.resolve = function(context) {
  return this.expression.resolve(context);
};
ScopedModelExpression.prototype.dependencies = function(context, forInnerPath) {
  return this.expression.dependencies(context, forInnerPath);
};
ScopedModelExpression.prototype.pathSegments = function(context) {
  return this.expression.pathSegments(context);
};
ScopedModelExpression.prototype.set = function(context, value) {
  return this.expression.set(context, value);
};

function outerDependency(expression, context, forInnerPath) {
  if (forInnerPath) return;
  return [expression.resolve(context)];
}

function concat(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a.concat(b);
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9kZXJieS9ub2RlX21vZHVsZXMvZGVyYnktdGVtcGxhdGVzL2xpYi9leHByZXNzaW9ucy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbInZhciBzZXJpYWxpemVPYmplY3QgPSByZXF1aXJlKCdzZXJpYWxpemUtb2JqZWN0Jyk7XG52YXIgb3BlcmF0b3JGbnMgPSByZXF1aXJlKCcuL29wZXJhdG9yRm5zJyk7XG52YXIgdGVtcGxhdGVzID0gcmVxdWlyZSgnLi90ZW1wbGF0ZXMnKTtcblxuZXhwb3J0cy5sb29rdXAgPSBsb29rdXA7XG5leHBvcnRzLnRlbXBsYXRlVHJ1dGh5ID0gdGVtcGxhdGVUcnV0aHk7XG5leHBvcnRzLnBhdGhTZWdtZW50cyA9IHBhdGhTZWdtZW50cztcbmV4cG9ydHMucmVuZGVyVmFsdWUgPSByZW5kZXJWYWx1ZTtcbmV4cG9ydHMuRXhwcmVzc2lvbk1ldGEgPSBFeHByZXNzaW9uTWV0YTtcblxuZXhwb3J0cy5FeHByZXNzaW9uID0gRXhwcmVzc2lvbjtcbmV4cG9ydHMuTGl0ZXJhbEV4cHJlc3Npb24gPSBMaXRlcmFsRXhwcmVzc2lvbjtcbmV4cG9ydHMuUGF0aEV4cHJlc3Npb24gPSBQYXRoRXhwcmVzc2lvbjtcbmV4cG9ydHMuUmVsYXRpdmVQYXRoRXhwcmVzc2lvbiA9IFJlbGF0aXZlUGF0aEV4cHJlc3Npb247XG5leHBvcnRzLkFsaWFzUGF0aEV4cHJlc3Npb24gPSBBbGlhc1BhdGhFeHByZXNzaW9uO1xuZXhwb3J0cy5BdHRyaWJ1dGVQYXRoRXhwcmVzc2lvbiA9IEF0dHJpYnV0ZVBhdGhFeHByZXNzaW9uO1xuZXhwb3J0cy5CcmFja2V0c0V4cHJlc3Npb24gPSBCcmFja2V0c0V4cHJlc3Npb247XG5leHBvcnRzLkZuRXhwcmVzc2lvbiA9IEZuRXhwcmVzc2lvbjtcbmV4cG9ydHMuT3BlcmF0b3JFeHByZXNzaW9uID0gT3BlcmF0b3JFeHByZXNzaW9uO1xuZXhwb3J0cy5OZXdFeHByZXNzaW9uID0gTmV3RXhwcmVzc2lvbjtcbmV4cG9ydHMuU2VxdWVuY2VFeHByZXNzaW9uID0gU2VxdWVuY2VFeHByZXNzaW9uO1xuZXhwb3J0cy5TY29wZWRNb2RlbEV4cHJlc3Npb24gPSBTY29wZWRNb2RlbEV4cHJlc3Npb247XG5cbmZ1bmN0aW9uIGxvb2t1cChzZWdtZW50cywgdmFsdWUpIHtcbiAgaWYgKCFzZWdtZW50cykgcmV0dXJuIHZhbHVlO1xuXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBzZWdtZW50cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGlmICh2YWx1ZSA9PSBudWxsKSByZXR1cm4gdmFsdWU7XG4gICAgdmFsdWUgPSB2YWx1ZVtzZWdtZW50c1tpXV07XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufVxuXG4vLyBVbmxpa2UgSlMsIGBbXWAgaXMgZmFsc2V5LiBPdGhlcndpc2UsIHRydXRoaW5lc3MgaXMgdGhlIHNhbWUgYXMgSlNcbmZ1bmN0aW9uIHRlbXBsYXRlVHJ1dGh5KHZhbHVlKSB7XG4gIHJldHVybiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpID8gdmFsdWUubGVuZ3RoID4gMCA6ICEhdmFsdWU7XG59XG5cbmZ1bmN0aW9uIHBhdGhTZWdtZW50cyhzZWdtZW50cykge1xuICB2YXIgcmVzdWx0ID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc2VnbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgc2VnbWVudCA9IHNlZ21lbnRzW2ldO1xuICAgIHJlc3VsdFtpXSA9ICh0eXBlb2Ygc2VnbWVudCA9PT0gJ29iamVjdCcpID8gc2VnbWVudC5pdGVtIDogc2VnbWVudDtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiByZW5kZXJWYWx1ZSh2YWx1ZSwgY29udGV4dCkge1xuICByZXR1cm4gKHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpID8gdmFsdWUgOlxuICAgICh2YWx1ZSBpbnN0YW5jZW9mIHRlbXBsYXRlcy5UZW1wbGF0ZSkgPyByZW5kZXJUZW1wbGF0ZSh2YWx1ZSwgY29udGV4dCkgOlxuICAgIChBcnJheS5pc0FycmF5KHZhbHVlKSkgPyByZW5kZXJBcnJheSh2YWx1ZSwgY29udGV4dCkgOlxuICAgIHJlbmRlck9iamVjdCh2YWx1ZSwgY29udGV4dCk7XG59XG5mdW5jdGlvbiByZW5kZXJUZW1wbGF0ZSh2YWx1ZSwgY29udGV4dCkge1xuICB2YXIgaSA9IDEwMDA7XG4gIHdoaWxlICh2YWx1ZSBpbnN0YW5jZW9mIHRlbXBsYXRlcy5UZW1wbGF0ZSkge1xuICAgIGlmICgtLWkgPCAwKSB0aHJvdyBuZXcgRXJyb3IoJ01heGltdW0gdGVtcGxhdGUgcmVuZGVyIHBhc3NlcyBleGNlZWRlZCcpO1xuICAgIHZhbHVlID0gdmFsdWUuZ2V0KGNvbnRleHQsIHRydWUpO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn1cbmZ1bmN0aW9uIHJlbmRlckFycmF5KGFycmF5LCBjb250ZXh0KSB7XG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBhcnJheS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGlmIChoYXNUZW1wbGF0ZVByb3BlcnR5KGFycmF5W2ldKSkge1xuICAgICAgcmV0dXJuIHJlbmRlckFycmF5UHJvcGVydGllcyhhcnJheSwgY29udGV4dCk7XG4gICAgfVxuICB9XG4gIHJldHVybiBhcnJheTtcbn1cbmZ1bmN0aW9uIHJlbmRlck9iamVjdChvYmplY3QsIGNvbnRleHQpIHtcbiAgcmV0dXJuIChoYXNUZW1wbGF0ZVByb3BlcnR5KG9iamVjdCkpID9cbiAgICByZW5kZXJPYmplY3RQcm9wZXJ0aWVzKG9iamVjdCwgY29udGV4dCkgOiBvYmplY3Q7XG59XG5mdW5jdGlvbiBoYXNUZW1wbGF0ZVByb3BlcnR5KG9iamVjdCkge1xuICBpZiAoIW9iamVjdCkgcmV0dXJuIGZhbHNlO1xuICBpZiAoZ2xvYmFsLk5vZGUgJiYgb2JqZWN0IGluc3RhbmNlb2YgZ2xvYmFsLk5vZGUpIHJldHVybiBmYWxzZTtcbiAgZm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuICAgIGlmIChvYmplY3Rba2V5XSBpbnN0YW5jZW9mIHRlbXBsYXRlcy5UZW1wbGF0ZSkgcmV0dXJuIHRydWU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuZnVuY3Rpb24gcmVuZGVyQXJyYXlQcm9wZXJ0aWVzKGFycmF5LCBjb250ZXh0KSB7XG4gIHZhciBvdXQgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGFycmF5Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgdmFyIGl0ZW0gPSByZW5kZXJPYmplY3QoYXJyYXlbaV0sIGNvbnRleHQpO1xuICAgIG91dC5wdXNoKGl0ZW0pO1xuICB9XG4gIHJldHVybiBvdXQ7XG59XG5mdW5jdGlvbiByZW5kZXJPYmplY3RQcm9wZXJ0aWVzKG9iamVjdCwgY29udGV4dCkge1xuICB2YXIgb3V0ID0ge307XG4gIGZvciAodmFyIGtleSBpbiBvYmplY3QpIHtcbiAgICB2YXIgdmFsdWUgPSBvYmplY3Rba2V5XTtcbiAgICBvdXRba2V5XSA9IHJlbmRlclRlbXBsYXRlKHZhbHVlLCBjb250ZXh0KTtcbiAgfVxuICByZXR1cm4gb3V0O1xufVxuXG5mdW5jdGlvbiBFeHByZXNzaW9uTWV0YShzb3VyY2UsIGJsb2NrVHlwZSwgaXNFbmQsIGFzLCBrZXlBcywgdW5lc2NhcGVkLCBiaW5kVHlwZSwgdmFsdWVUeXBlKSB7XG4gIHRoaXMuc291cmNlID0gc291cmNlO1xuICB0aGlzLmJsb2NrVHlwZSA9IGJsb2NrVHlwZTtcbiAgdGhpcy5pc0VuZCA9IGlzRW5kO1xuICB0aGlzLmFzID0gYXM7XG4gIHRoaXMua2V5QXMgPSBrZXlBcztcbiAgdGhpcy51bmVzY2FwZWQgPSB1bmVzY2FwZWQ7XG4gIHRoaXMuYmluZFR5cGUgPSBiaW5kVHlwZTtcbiAgdGhpcy52YWx1ZVR5cGUgPSB2YWx1ZVR5cGU7XG59XG5FeHByZXNzaW9uTWV0YS5wcm90b3R5cGUubW9kdWxlID0gJ2V4cHJlc3Npb25zJztcbkV4cHJlc3Npb25NZXRhLnByb3RvdHlwZS50eXBlID0gJ0V4cHJlc3Npb25NZXRhJztcbkV4cHJlc3Npb25NZXRhLnByb3RvdHlwZS5zZXJpYWxpemUgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHNlcmlhbGl6ZU9iamVjdC5pbnN0YW5jZShcbiAgICB0aGlzXG4gICwgdGhpcy5zb3VyY2VcbiAgLCB0aGlzLmJsb2NrVHlwZVxuICAsIHRoaXMuaXNFbmRcbiAgLCB0aGlzLmFzXG4gICwgdGhpcy5rZXlBc1xuICAsIHRoaXMudW5lc2NhcGVkXG4gICwgdGhpcy5iaW5kVHlwZVxuICAsIHRoaXMudmFsdWVUeXBlXG4gICk7XG59O1xuXG5mdW5jdGlvbiBFeHByZXNzaW9uKG1ldGEpIHtcbiAgdGhpcy5tZXRhID0gbWV0YTtcbn1cbkV4cHJlc3Npb24ucHJvdG90eXBlLm1vZHVsZSA9ICdleHByZXNzaW9ucyc7XG5FeHByZXNzaW9uLnByb3RvdHlwZS50eXBlID0gJ0V4cHJlc3Npb24nO1xuRXhwcmVzc2lvbi5wcm90b3R5cGUuc2VyaWFsaXplID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBzZXJpYWxpemVPYmplY3QuaW5zdGFuY2UodGhpcywgdGhpcy5tZXRhKTtcbn07XG5FeHByZXNzaW9uLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5tZXRhICYmIHRoaXMubWV0YS5zb3VyY2U7XG59O1xuRXhwcmVzc2lvbi5wcm90b3R5cGUudHJ1dGh5ID0gZnVuY3Rpb24oY29udGV4dCkge1xuICB2YXIgYmxvY2tUeXBlID0gdGhpcy5tZXRhLmJsb2NrVHlwZTtcbiAgaWYgKGJsb2NrVHlwZSA9PT0gJ2Vsc2UnKSByZXR1cm4gdHJ1ZTtcbiAgdmFyIHZhbHVlID0gdGhpcy5nZXQoY29udGV4dCwgdHJ1ZSk7XG4gIHZhciB0cnV0aHkgPSB0ZW1wbGF0ZVRydXRoeSh2YWx1ZSk7XG4gIHJldHVybiAoYmxvY2tUeXBlID09PSAndW5sZXNzJykgPyAhdHJ1dGh5IDogdHJ1dGh5O1xufTtcbkV4cHJlc3Npb24ucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uKCkge307XG4vLyBSZXR1cm4gdGhlIGV4cHJlc3Npb24ncyBzZWdtZW50IGxpc3Qgd2l0aCBjb250ZXh0IG9iamVjdHNcbkV4cHJlc3Npb24ucHJvdG90eXBlLnJlc29sdmUgPSBmdW5jdGlvbigpIHt9O1xuLy8gUmV0dXJuIGEgbGlzdCBvZiBzZWdtZW50IGxpc3RzIG9yIG51bGxcbkV4cHJlc3Npb24ucHJvdG90eXBlLmRlcGVuZGVuY2llcyA9IGZ1bmN0aW9uKCkge307XG4vLyBSZXR1cm4gdGhlIHBhdGhTZWdtZW50cyB0aGF0IHRoZSBleHByZXNzaW9uIGN1cnJlbnRseSByZXNvbHZlcyB0byBvciBudWxsXG5FeHByZXNzaW9uLnByb3RvdHlwZS5wYXRoU2VnbWVudHMgPSBmdW5jdGlvbihjb250ZXh0KSB7XG4gIHZhciBzZWdtZW50cyA9IHRoaXMucmVzb2x2ZShjb250ZXh0KTtcbiAgcmV0dXJuIHNlZ21lbnRzICYmIHBhdGhTZWdtZW50cyhzZWdtZW50cyk7XG59O1xuRXhwcmVzc2lvbi5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24oY29udGV4dCwgdmFsdWUpIHtcbiAgdmFyIHNlZ21lbnRzID0gdGhpcy5wYXRoU2VnbWVudHMoY29udGV4dCk7XG4gIGlmICghc2VnbWVudHMpIHRocm93IG5ldyBFcnJvcignRXhwcmVzc2lvbiBkb2VzIG5vdCBzdXBwb3J0IHNldHRpbmcnKTtcbiAgY29udGV4dC5jb250cm9sbGVyLm1vZGVsLl9zZXQoc2VnbWVudHMsIHZhbHVlKTtcbn07XG5FeHByZXNzaW9uLnByb3RvdHlwZS5fZ2V0UGF0Y2ggPSBmdW5jdGlvbihjb250ZXh0LCB2YWx1ZSkge1xuICBpZiAodGhpcy5tZXRhICYmIHRoaXMubWV0YS5ibG9ja1R5cGUpIHtcbiAgICB2YWx1ZSA9IHJlbmRlclRlbXBsYXRlKHZhbHVlLCBjb250ZXh0KTtcbiAgfVxuICByZXR1cm4gKGNvbnRleHQgJiYgY29udGV4dC5leHByZXNzaW9uID09PSB0aGlzICYmIGNvbnRleHQuaXRlbSAhPSBudWxsKSA/XG4gICAgdmFsdWUgJiYgdmFsdWVbY29udGV4dC5pdGVtXSA6IHZhbHVlO1xufTtcbkV4cHJlc3Npb24ucHJvdG90eXBlLl9yZXNvbHZlUGF0Y2ggPSBmdW5jdGlvbihjb250ZXh0LCBzZWdtZW50cykge1xuICByZXR1cm4gKGNvbnRleHQgJiYgY29udGV4dC5leHByZXNzaW9uID09PSB0aGlzICYmIGNvbnRleHQuaXRlbSAhPSBudWxsKSA/XG4gICAgc2VnbWVudHMuY29uY2F0KGNvbnRleHQpIDogc2VnbWVudHM7XG59O1xuRXhwcmVzc2lvbi5wcm90b3R5cGUuaXNVbmJvdW5kID0gZnVuY3Rpb24oY29udGV4dCkge1xuICAvLyBJZiB0aGUgdGVtcGxhdGUgYmVpbmcgcmVuZGVyZWQgaGFzIGFuIGV4cGxpY2l0IGJpbmRUeXBlIGtleXdvcmQsIHN1Y2ggYXM6XG4gIC8vIHt7dW5ib3VuZCAjaXRlbS50ZXh0fX1cbiAgdmFyIGJpbmRUeXBlID0gdGhpcy5tZXRhICYmIHRoaXMubWV0YS5iaW5kVHlwZTtcbiAgaWYgKGJpbmRUeXBlID09PSAndW5ib3VuZCcpIHJldHVybiB0cnVlO1xuICBpZiAoYmluZFR5cGUgPT09ICdib3VuZCcpIHJldHVybiBmYWxzZTtcbiAgLy8gT3RoZXJ3aXNlLCBpbmhlcml0IGZyb20gdGhlIGNvbnRleHRcbiAgcmV0dXJuIGNvbnRleHQudW5ib3VuZDtcbn07XG5cblxuZnVuY3Rpb24gTGl0ZXJhbEV4cHJlc3Npb24odmFsdWUsIG1ldGEpIHtcbiAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB0aGlzLm1ldGEgPSBtZXRhO1xufVxuTGl0ZXJhbEV4cHJlc3Npb24ucHJvdG90eXBlID0gbmV3IEV4cHJlc3Npb24oKTtcbkxpdGVyYWxFeHByZXNzaW9uLnByb3RvdHlwZS50eXBlID0gJ0xpdGVyYWxFeHByZXNzaW9uJztcbkxpdGVyYWxFeHByZXNzaW9uLnByb3RvdHlwZS5zZXJpYWxpemUgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHNlcmlhbGl6ZU9iamVjdC5pbnN0YW5jZSh0aGlzLCB0aGlzLnZhbHVlLCB0aGlzLm1ldGEpO1xufTtcbkxpdGVyYWxFeHByZXNzaW9uLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbihjb250ZXh0KSB7XG4gIHJldHVybiB0aGlzLl9nZXRQYXRjaChjb250ZXh0LCB0aGlzLnZhbHVlKTtcbn07XG5cbmZ1bmN0aW9uIFBhdGhFeHByZXNzaW9uKHNlZ21lbnRzLCBtZXRhKSB7XG4gIHRoaXMuc2VnbWVudHMgPSBzZWdtZW50cztcbiAgdGhpcy5tZXRhID0gbWV0YTtcbn1cblBhdGhFeHByZXNzaW9uLnByb3RvdHlwZSA9IG5ldyBFeHByZXNzaW9uKCk7XG5QYXRoRXhwcmVzc2lvbi5wcm90b3R5cGUudHlwZSA9ICdQYXRoRXhwcmVzc2lvbic7XG5QYXRoRXhwcmVzc2lvbi5wcm90b3R5cGUuc2VyaWFsaXplID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBzZXJpYWxpemVPYmplY3QuaW5zdGFuY2UodGhpcywgdGhpcy5zZWdtZW50cywgdGhpcy5tZXRhKTtcbn07XG5QYXRoRXhwcmVzc2lvbi5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24oY29udGV4dCkge1xuICB2YXIgdmFsdWUgPSBsb29rdXAodGhpcy5zZWdtZW50cywgY29udGV4dC5jb250cm9sbGVyLm1vZGVsLmRhdGEpO1xuICByZXR1cm4gdGhpcy5fZ2V0UGF0Y2goY29udGV4dCwgdmFsdWUpO1xufTtcblBhdGhFeHByZXNzaW9uLnByb3RvdHlwZS5yZXNvbHZlID0gZnVuY3Rpb24oY29udGV4dCkge1xuICB2YXIgc2VnbWVudHMgPSBjb25jYXQoY29udGV4dC5jb250cm9sbGVyLl9zY29wZSwgdGhpcy5zZWdtZW50cyk7XG4gIHJldHVybiB0aGlzLl9yZXNvbHZlUGF0Y2goY29udGV4dCwgc2VnbWVudHMpO1xufTtcblBhdGhFeHByZXNzaW9uLnByb3RvdHlwZS5kZXBlbmRlbmNpZXMgPSBmdW5jdGlvbihjb250ZXh0LCBmb3JJbm5lclBhdGgpIHtcbiAgcmV0dXJuIG91dGVyRGVwZW5kZW5jeSh0aGlzLCBjb250ZXh0LCBmb3JJbm5lclBhdGgpO1xufTtcblxuZnVuY3Rpb24gUmVsYXRpdmVQYXRoRXhwcmVzc2lvbihzZWdtZW50cywgbWV0YSkge1xuICB0aGlzLnNlZ21lbnRzID0gc2VnbWVudHM7XG4gIHRoaXMubWV0YSA9IG1ldGE7XG59XG5SZWxhdGl2ZVBhdGhFeHByZXNzaW9uLnByb3RvdHlwZSA9IG5ldyBFeHByZXNzaW9uKCk7XG5SZWxhdGl2ZVBhdGhFeHByZXNzaW9uLnByb3RvdHlwZS50eXBlID0gJ1JlbGF0aXZlUGF0aEV4cHJlc3Npb24nO1xuUmVsYXRpdmVQYXRoRXhwcmVzc2lvbi5wcm90b3R5cGUuc2VyaWFsaXplID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBzZXJpYWxpemVPYmplY3QuaW5zdGFuY2UodGhpcywgdGhpcy5zZWdtZW50cywgdGhpcy5tZXRhKTtcbn07XG5SZWxhdGl2ZVBhdGhFeHByZXNzaW9uLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbihjb250ZXh0KSB7XG4gIHZhciByZWxhdGl2ZUNvbnRleHQgPSBjb250ZXh0LmZvclJlbGF0aXZlKHRoaXMpO1xuICB2YXIgdmFsdWUgPSByZWxhdGl2ZUNvbnRleHQuZ2V0KCk7XG4gIGlmICh0aGlzLnNlZ21lbnRzLmxlbmd0aCkge1xuICAgIHZhbHVlID0gcmVuZGVyVGVtcGxhdGUodmFsdWUsIHJlbGF0aXZlQ29udGV4dCk7XG4gICAgdmFsdWUgPSBsb29rdXAodGhpcy5zZWdtZW50cywgdmFsdWUpO1xuICB9XG4gIHJldHVybiB0aGlzLl9nZXRQYXRjaChjb250ZXh0LCB2YWx1ZSk7XG59O1xuUmVsYXRpdmVQYXRoRXhwcmVzc2lvbi5wcm90b3R5cGUucmVzb2x2ZSA9IGZ1bmN0aW9uKGNvbnRleHQpIHtcbiAgdmFyIHJlbGF0aXZlQ29udGV4dCA9IGNvbnRleHQuZm9yUmVsYXRpdmUodGhpcyk7XG4gIHZhciBiYXNlID0gKHJlbGF0aXZlQ29udGV4dC5leHByZXNzaW9uKSA/XG4gICAgcmVsYXRpdmVDb250ZXh0LmV4cHJlc3Npb24ucmVzb2x2ZShyZWxhdGl2ZUNvbnRleHQpIDpcbiAgICBbXTtcbiAgaWYgKCFiYXNlKSByZXR1cm47XG4gIHZhciBzZWdtZW50cyA9IGJhc2UuY29uY2F0KHRoaXMuc2VnbWVudHMpO1xuICByZXR1cm4gdGhpcy5fcmVzb2x2ZVBhdGNoKGNvbnRleHQsIHNlZ21lbnRzKTtcbn07XG5SZWxhdGl2ZVBhdGhFeHByZXNzaW9uLnByb3RvdHlwZS5kZXBlbmRlbmNpZXMgPSBmdW5jdGlvbihjb250ZXh0LCBmb3JJbm5lclBhdGgpIHtcbiAgLy8gUmV0dXJuIGlubmVyIGRlcGVuZGVuY2llcyBmcm9tIG91ciBhbmNlc3RvclxuICAvLyAoZS5nLiwge3sgd2l0aCBmb29bYmFyXSB9fSAuLi4ge3sgdGhpcy54IH19IGhhcyAnYmFyJyBhcyBhIGRlcGVuZGVuY3kuKVxuICB2YXIgcmVsYXRpdmVDb250ZXh0ID0gY29udGV4dC5mb3JSZWxhdGl2ZSh0aGlzKTtcbiAgdmFyIGlubmVyID0gcmVsYXRpdmVDb250ZXh0LmV4cHJlc3Npb24gJiZcbiAgICByZWxhdGl2ZUNvbnRleHQuZXhwcmVzc2lvbi5kZXBlbmRlbmNpZXMocmVsYXRpdmVDb250ZXh0LCB0cnVlKTtcbiAgdmFyIG91dGVyID0gb3V0ZXJEZXBlbmRlbmN5KHRoaXMsIGNvbnRleHQsIGZvcklubmVyUGF0aCk7XG4gIHJldHVybiBjb25jYXQob3V0ZXIsIGlubmVyKTtcbn07XG5cbmZ1bmN0aW9uIEFsaWFzUGF0aEV4cHJlc3Npb24oYWxpYXMsIHNlZ21lbnRzLCBtZXRhKSB7XG4gIHRoaXMuYWxpYXMgPSBhbGlhcztcbiAgdGhpcy5zZWdtZW50cyA9IHNlZ21lbnRzO1xuICB0aGlzLm1ldGEgPSBtZXRhO1xufVxuQWxpYXNQYXRoRXhwcmVzc2lvbi5wcm90b3R5cGUgPSBuZXcgRXhwcmVzc2lvbigpO1xuQWxpYXNQYXRoRXhwcmVzc2lvbi5wcm90b3R5cGUudHlwZSA9ICdBbGlhc1BhdGhFeHByZXNzaW9uJztcbkFsaWFzUGF0aEV4cHJlc3Npb24ucHJvdG90eXBlLnNlcmlhbGl6ZSA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gc2VyaWFsaXplT2JqZWN0Lmluc3RhbmNlKHRoaXMsIHRoaXMuYWxpYXMsIHRoaXMuc2VnbWVudHMsIHRoaXMubWV0YSk7XG59O1xuQWxpYXNQYXRoRXhwcmVzc2lvbi5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24oY29udGV4dCkge1xuICB2YXIgYWxpYXNDb250ZXh0ID0gY29udGV4dC5mb3JBbGlhcyh0aGlzLmFsaWFzKTtcbiAgaWYgKCFhbGlhc0NvbnRleHQpIHJldHVybjtcbiAgaWYgKGFsaWFzQ29udGV4dC5rZXlBbGlhcyA9PT0gdGhpcy5hbGlhcykge1xuICAgIHJldHVybiBhbGlhc0NvbnRleHQuaXRlbTtcbiAgfVxuICB2YXIgdmFsdWUgPSBhbGlhc0NvbnRleHQuZ2V0KCk7XG4gIGlmICh0aGlzLnNlZ21lbnRzLmxlbmd0aCkge1xuICAgIHZhbHVlID0gcmVuZGVyVGVtcGxhdGUodmFsdWUsIGFsaWFzQ29udGV4dCk7XG4gICAgdmFsdWUgPSBsb29rdXAodGhpcy5zZWdtZW50cywgdmFsdWUpO1xuICB9XG4gIHJldHVybiB0aGlzLl9nZXRQYXRjaChjb250ZXh0LCB2YWx1ZSk7XG59O1xuQWxpYXNQYXRoRXhwcmVzc2lvbi5wcm90b3R5cGUucmVzb2x2ZSA9IGZ1bmN0aW9uKGNvbnRleHQpIHtcbiAgdmFyIGFsaWFzQ29udGV4dCA9IGNvbnRleHQuZm9yQWxpYXModGhpcy5hbGlhcyk7XG4gIGlmICghYWxpYXNDb250ZXh0KSByZXR1cm47XG4gIGlmIChhbGlhc0NvbnRleHQua2V5QWxpYXMgPT09IHRoaXMuYWxpYXMpIHJldHVybjtcbiAgdmFyIGJhc2UgPSBhbGlhc0NvbnRleHQuZXhwcmVzc2lvbi5yZXNvbHZlKGFsaWFzQ29udGV4dCk7XG4gIGlmICghYmFzZSkgcmV0dXJuO1xuICB2YXIgc2VnbWVudHMgPSBiYXNlLmNvbmNhdCh0aGlzLnNlZ21lbnRzKTtcbiAgcmV0dXJuIHRoaXMuX3Jlc29sdmVQYXRjaChjb250ZXh0LCBzZWdtZW50cyk7XG59O1xuQWxpYXNQYXRoRXhwcmVzc2lvbi5wcm90b3R5cGUuZGVwZW5kZW5jaWVzID0gZnVuY3Rpb24oY29udGV4dCwgZm9ySW5uZXJQYXRoKSB7XG4gIHZhciBhbGlhc0NvbnRleHQgPSBjb250ZXh0LmZvckFsaWFzKHRoaXMuYWxpYXMpO1xuICBpZiAoIWFsaWFzQ29udGV4dCkgcmV0dXJuO1xuICBpZiAoYWxpYXNDb250ZXh0LmtleUFsaWFzID09PSB0aGlzLmFsaWFzKSB7XG4gICAgLy8gRm9yIGtleUFsaWFzZXMsIHVzZSBhIGRlcGVuZGVuY3kgb2YgdGhlIGVudGlyZSBsaXN0LCBzbyB0aGF0IGl0IHdpbGxcbiAgICAvLyBhbHdheXMgdXBkYXRlIHdoZW4gdGhlIGxpc3QgY2hhbmdlcyBpbiBhbnkgd2F5LiBUaGlzIGlzIG92ZXItYmluZGluZyxcbiAgICAvLyBidXQgd291bGQgb3RoZXJ3aXNlIGJlIG11Y2ggbW9yZSBjb21wbGV4XG4gICAgdmFyIGJhc2UgPSBhbGlhc0NvbnRleHQuZXhwcmVzc2lvbi5yZXNvbHZlKGFsaWFzQ29udGV4dC5wYXJlbnQpO1xuICAgIHJldHVybiBbYmFzZV07XG4gIH1cbiAgdmFyIGlubmVyID0gYWxpYXNDb250ZXh0LmV4cHJlc3Npb24uZGVwZW5kZW5jaWVzKGFsaWFzQ29udGV4dCwgdHJ1ZSk7XG4gIHZhciBvdXRlciA9IG91dGVyRGVwZW5kZW5jeSh0aGlzLCBjb250ZXh0LCBmb3JJbm5lclBhdGgpO1xuICByZXR1cm4gY29uY2F0KG91dGVyLCBpbm5lcik7XG59O1xuXG5mdW5jdGlvbiBBdHRyaWJ1dGVQYXRoRXhwcmVzc2lvbihhdHRyaWJ1dGUsIHNlZ21lbnRzLCBtZXRhKSB7XG4gIHRoaXMuYXR0cmlidXRlID0gYXR0cmlidXRlO1xuICB0aGlzLnNlZ21lbnRzID0gc2VnbWVudHM7XG4gIHRoaXMubWV0YSA9IG1ldGE7XG59XG5BdHRyaWJ1dGVQYXRoRXhwcmVzc2lvbi5wcm90b3R5cGUgPSBuZXcgRXhwcmVzc2lvbigpO1xuQXR0cmlidXRlUGF0aEV4cHJlc3Npb24ucHJvdG90eXBlLnR5cGUgPSAnQXR0cmlidXRlUGF0aEV4cHJlc3Npb24nO1xuQXR0cmlidXRlUGF0aEV4cHJlc3Npb24ucHJvdG90eXBlLnNlcmlhbGl6ZSA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gc2VyaWFsaXplT2JqZWN0Lmluc3RhbmNlKHRoaXMsIHRoaXMuYXR0cmlidXRlLCB0aGlzLnNlZ21lbnRzLCB0aGlzLm1ldGEpO1xufTtcbkF0dHJpYnV0ZVBhdGhFeHByZXNzaW9uLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbihjb250ZXh0KSB7XG4gIHZhciBhdHRyaWJ1dGVDb250ZXh0ID0gY29udGV4dC5mb3JBdHRyaWJ1dGUodGhpcy5hdHRyaWJ1dGUpO1xuICBpZiAoIWF0dHJpYnV0ZUNvbnRleHQpIHJldHVybjtcbiAgdmFyIHZhbHVlID0gYXR0cmlidXRlQ29udGV4dC5hdHRyaWJ1dGVzW3RoaXMuYXR0cmlidXRlXTtcbiAgaWYgKHRoaXMuc2VnbWVudHMubGVuZ3RoKSB7XG4gICAgdmFsdWUgPSByZW5kZXJUZW1wbGF0ZSh2YWx1ZSwgYXR0cmlidXRlQ29udGV4dCk7XG4gICAgdmFsdWUgPSBsb29rdXAodGhpcy5zZWdtZW50cywgdmFsdWUpO1xuICB9XG4gIHJldHVybiB0aGlzLl9nZXRQYXRjaChjb250ZXh0LCB2YWx1ZSk7XG59O1xuQXR0cmlidXRlUGF0aEV4cHJlc3Npb24ucHJvdG90eXBlLnJlc29sdmUgPSBmdW5jdGlvbihjb250ZXh0KSB7XG4gIHZhciBhdHRyaWJ1dGVDb250ZXh0ID0gY29udGV4dC5mb3JBdHRyaWJ1dGUodGhpcy5hdHRyaWJ1dGUpO1xuICAvLyBBdHRyaWJ1dGVzIGFyZSBlaXRoZXIgYSBQYXJlbnRXcmFwcGVyIG9yIGEgbGl0ZXJhbCB2YWx1ZVxuICB2YXIgdmFsdWUgPSBhdHRyaWJ1dGVDb250ZXh0ICYmIGF0dHJpYnV0ZUNvbnRleHQuYXR0cmlidXRlc1t0aGlzLmF0dHJpYnV0ZV07XG4gIHZhciBiYXNlID0gdmFsdWUgJiYgKHR5cGVvZiB2YWx1ZS5yZXNvbHZlID09PSAnZnVuY3Rpb24nKSAmJlxuICAgIHZhbHVlLnJlc29sdmUoYXR0cmlidXRlQ29udGV4dCk7XG4gIGlmICghYmFzZSkgcmV0dXJuO1xuICB2YXIgc2VnbWVudHMgPSBiYXNlLmNvbmNhdCh0aGlzLnNlZ21lbnRzKTtcbiAgcmV0dXJuIHRoaXMuX3Jlc29sdmVQYXRjaChjb250ZXh0LCBzZWdtZW50cyk7XG59O1xuQXR0cmlidXRlUGF0aEV4cHJlc3Npb24ucHJvdG90eXBlLmRlcGVuZGVuY2llcyA9IGZ1bmN0aW9uKGNvbnRleHQsIGZvcklubmVyUGF0aCkge1xuICB2YXIgYXR0cmlidXRlQ29udGV4dCA9IGNvbnRleHQuZm9yQXR0cmlidXRlKHRoaXMuYXR0cmlidXRlKTtcbiAgLy8gQXR0cmlidXRlcyBhcmUgZWl0aGVyIGEgUGFyZW50V3JhcHBlciBvciBhIGxpdGVyYWwgdmFsdWVcbiAgdmFyIHZhbHVlID0gYXR0cmlidXRlQ29udGV4dCAmJiBhdHRyaWJ1dGVDb250ZXh0LmF0dHJpYnV0ZXNbdGhpcy5hdHRyaWJ1dGVdO1xuICB2YXIgaW5uZXIgPSB2YWx1ZSAmJiAodHlwZW9mIHZhbHVlLmRlcGVuZGVuY2llcyA9PT0gJ2Z1bmN0aW9uJykgJiZcbiAgICB2YWx1ZS5kZXBlbmRlbmNpZXMoYXR0cmlidXRlQ29udGV4dCwgdHJ1ZSk7XG4gIHZhciBvdXRlciA9IG91dGVyRGVwZW5kZW5jeSh0aGlzLCBjb250ZXh0LCBmb3JJbm5lclBhdGgpO1xuICByZXR1cm4gY29uY2F0KG91dGVyLCBpbm5lcik7XG59O1xuXG5mdW5jdGlvbiBCcmFja2V0c0V4cHJlc3Npb24oYmVmb3JlLCBpbnNpZGUsIGFmdGVyU2VnbWVudHMsIG1ldGEpIHtcbiAgdGhpcy5iZWZvcmUgPSBiZWZvcmU7XG4gIHRoaXMuaW5zaWRlID0gaW5zaWRlO1xuICB0aGlzLmFmdGVyU2VnbWVudHMgPSBhZnRlclNlZ21lbnRzO1xuICB0aGlzLm1ldGEgPSBtZXRhO1xufVxuQnJhY2tldHNFeHByZXNzaW9uLnByb3RvdHlwZSA9IG5ldyBFeHByZXNzaW9uKCk7XG5CcmFja2V0c0V4cHJlc3Npb24ucHJvdG90eXBlLnR5cGUgPSAnQnJhY2tldHNFeHByZXNzaW9uJztcbkJyYWNrZXRzRXhwcmVzc2lvbi5wcm90b3R5cGUuc2VyaWFsaXplID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBzZXJpYWxpemVPYmplY3QuaW5zdGFuY2UodGhpcywgdGhpcy5iZWZvcmUsIHRoaXMuaW5zaWRlLCB0aGlzLmFmdGVyU2VnbWVudHMsIHRoaXMubWV0YSk7XG59O1xuQnJhY2tldHNFeHByZXNzaW9uLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbihjb250ZXh0KSB7XG4gIHZhciBpbnNpZGUgPSB0aGlzLmluc2lkZS5nZXQoY29udGV4dCk7XG4gIGlmIChpbnNpZGUgPT0gbnVsbCkgcmV0dXJuO1xuICB2YXIgYmVmb3JlID0gdGhpcy5iZWZvcmUuZ2V0KGNvbnRleHQpO1xuICBpZiAoIWJlZm9yZSkgcmV0dXJuO1xuICB2YXIgYmFzZSA9IGJlZm9yZVtpbnNpZGVdO1xuICB2YXIgdmFsdWUgPSAodGhpcy5hZnRlclNlZ21lbnRzKSA/IGxvb2t1cCh0aGlzLmFmdGVyU2VnbWVudHMsIGJhc2UpIDogYmFzZTtcbiAgcmV0dXJuIHRoaXMuX2dldFBhdGNoKGNvbnRleHQsIHZhbHVlKTtcbn07XG5CcmFja2V0c0V4cHJlc3Npb24ucHJvdG90eXBlLnJlc29sdmUgPSBmdW5jdGlvbihjb250ZXh0KSB7XG4gIC8vIEdldCBhbmQgc3BsaXQgdGhlIGN1cnJlbnQgdmFsdWUgb2YgdGhlIGV4cHJlc3Npb24gaW5zaWRlIHRoZSBicmFja2V0c1xuICB2YXIgaW5zaWRlID0gdGhpcy5pbnNpZGUuZ2V0KGNvbnRleHQpO1xuICBpZiAoaW5zaWRlID09IG51bGwpIHJldHVybjtcblxuICAvLyBDb25jYXQgdGhlIGJlZm9yZSwgaW5zaWRlLCBhbmQgb3B0aW9uYWwgYWZ0ZXIgc2VnbWVudHNcbiAgdmFyIGJhc2UgPSB0aGlzLmJlZm9yZS5yZXNvbHZlKGNvbnRleHQpO1xuICBpZiAoIWJhc2UpIHJldHVybjtcbiAgdmFyIHNlZ21lbnRzID0gKHRoaXMuYWZ0ZXJTZWdtZW50cykgP1xuICAgIGJhc2UuY29uY2F0KGluc2lkZSwgdGhpcy5hZnRlclNlZ21lbnRzKSA6XG4gICAgYmFzZS5jb25jYXQoaW5zaWRlKTtcbiAgcmV0dXJuIHRoaXMuX3Jlc29sdmVQYXRjaChjb250ZXh0LCBzZWdtZW50cyk7XG59O1xuQnJhY2tldHNFeHByZXNzaW9uLnByb3RvdHlwZS5kZXBlbmRlbmNpZXMgPSBmdW5jdGlvbihjb250ZXh0LCBmb3JJbm5lclBhdGgpIHtcbiAgdmFyIGJlZm9yZSA9IHRoaXMuYmVmb3JlLmRlcGVuZGVuY2llcyhjb250ZXh0LCB0cnVlKTtcbiAgdmFyIGlubmVyID0gdGhpcy5pbnNpZGUuZGVwZW5kZW5jaWVzKGNvbnRleHQpO1xuICB2YXIgb3V0ZXIgPSBvdXRlckRlcGVuZGVuY3kodGhpcywgY29udGV4dCwgZm9ySW5uZXJQYXRoKTtcbiAgcmV0dXJuIGNvbmNhdChjb25jYXQob3V0ZXIsIGlubmVyKSwgYmVmb3JlKTtcbn07XG5cbmZ1bmN0aW9uIEZuRXhwcmVzc2lvbihzZWdtZW50cywgYXJncywgYWZ0ZXJTZWdtZW50cywgbWV0YSkge1xuICB0aGlzLnNlZ21lbnRzID0gc2VnbWVudHM7XG4gIHRoaXMuYXJncyA9IGFyZ3M7XG4gIHRoaXMuYWZ0ZXJTZWdtZW50cyA9IGFmdGVyU2VnbWVudHM7XG4gIHRoaXMubWV0YSA9IG1ldGE7XG4gIHZhciBwYXJlbnRTZWdtZW50cyA9IHNlZ21lbnRzICYmIHNlZ21lbnRzLnNsaWNlKCk7XG4gIHRoaXMubGFzdFNlZ21lbnQgPSBwYXJlbnRTZWdtZW50cyAmJiBwYXJlbnRTZWdtZW50cy5wb3AoKTtcbiAgdGhpcy5wYXJlbnRTZWdtZW50cyA9IChwYXJlbnRTZWdtZW50cyAmJiBwYXJlbnRTZWdtZW50cy5sZW5ndGgpID8gcGFyZW50U2VnbWVudHMgOiBudWxsO1xufVxuRm5FeHByZXNzaW9uLnByb3RvdHlwZSA9IG5ldyBFeHByZXNzaW9uKCk7XG5GbkV4cHJlc3Npb24ucHJvdG90eXBlLnR5cGUgPSAnRm5FeHByZXNzaW9uJztcbkZuRXhwcmVzc2lvbi5wcm90b3R5cGUuc2VyaWFsaXplID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBzZXJpYWxpemVPYmplY3QuaW5zdGFuY2UodGhpcywgdGhpcy5zZWdtZW50cywgdGhpcy5hcmdzLCB0aGlzLmFmdGVyU2VnbWVudHMsIHRoaXMubWV0YSk7XG59O1xuRm5FeHByZXNzaW9uLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbihjb250ZXh0KSB7XG4gIHZhciB2YWx1ZSA9IHRoaXMuYXBwbHkoY29udGV4dCk7XG4gIC8vIExvb2t1cCBwcm9wZXJ0eSB1bmRlcm5lYXRoIGNvbXB1dGVkIHZhbHVlIGlmIG5lZWRlZFxuICBpZiAodGhpcy5hZnRlclNlZ21lbnRzKSB7XG4gICAgdmFsdWUgPSBsb29rdXAodGhpcy5hZnRlclNlZ21lbnRzLCB2YWx1ZSk7XG4gIH1cbiAgcmV0dXJuIHRoaXMuX2dldFBhdGNoKGNvbnRleHQsIHZhbHVlKTtcbn07XG5GbkV4cHJlc3Npb24ucHJvdG90eXBlLmFwcGx5ID0gZnVuY3Rpb24oY29udGV4dCwgZXh0cmFJbnB1dHMpIHtcbiAgdmFyIHBhcmVudCA9IHRoaXMuX2xvb2t1cFBhcmVudChjb250ZXh0KTtcbiAgdmFyIGZuID0gcGFyZW50W3RoaXMubGFzdFNlZ21lbnRdO1xuICB2YXIgZ2V0Rm4gPSBmbi5nZXQgfHwgZm47XG4gIHZhciBvdXQgPSB0aGlzLl9hcHBseUZuKGdldEZuLCBjb250ZXh0LCBleHRyYUlucHV0cywgcGFyZW50KTtcbiAgcmV0dXJuIG91dDtcbn07XG5GbkV4cHJlc3Npb24ucHJvdG90eXBlLl9sb29rdXBQYXJlbnQgPSBmdW5jdGlvbihjb250ZXh0KSB7XG4gIC8vIExvb2t1cCBmdW5jdGlvbiBvbiBjdXJyZW50IGNvbnRyb2xsZXJcbiAgdmFyIGNvbnRyb2xsZXIgPSBjb250ZXh0LmNvbnRyb2xsZXI7XG4gIHZhciBzZWdtZW50cyA9IHRoaXMucGFyZW50U2VnbWVudHM7XG4gIHZhciBwYXJlbnQgPSAoc2VnbWVudHMpID8gbG9va3VwKHNlZ21lbnRzLCBjb250cm9sbGVyKSA6IGNvbnRyb2xsZXI7XG4gIGlmIChwYXJlbnQgJiYgcGFyZW50W3RoaXMubGFzdFNlZ21lbnRdKSByZXR1cm4gcGFyZW50O1xuICAvLyBPdGhlcndpc2UgbG9va3VwIGZ1bmN0aW9uIG9uIHBhZ2VcbiAgdmFyIHBhZ2UgPSBjb250cm9sbGVyLnBhZ2U7XG4gIGlmIChjb250cm9sbGVyICE9PSBwYWdlKSB7XG4gICAgcGFyZW50ID0gKHNlZ21lbnRzKSA/IGxvb2t1cChzZWdtZW50cywgcGFnZSkgOiBwYWdlO1xuICAgIGlmIChwYXJlbnQgJiYgcGFyZW50W3RoaXMubGFzdFNlZ21lbnRdKSByZXR1cm4gcGFyZW50O1xuICB9XG4gIC8vIE90aGVyd2lzZSBsb29rdXAgZnVuY3Rpb24gb24gZ2xvYmFsXG4gIHBhcmVudCA9IChzZWdtZW50cykgPyBsb29rdXAoc2VnbWVudHMsIGdsb2JhbCkgOiBnbG9iYWw7XG4gIGlmIChwYXJlbnQgJiYgcGFyZW50W3RoaXMubGFzdFNlZ21lbnRdKSByZXR1cm4gcGFyZW50O1xuICAvLyBUaHJvdyBpZiBub3QgZm91bmRcbiAgdGhyb3cgbmV3IEVycm9yKCdGdW5jdGlvbiBub3QgZm91bmQgZm9yOiAnICsgdGhpcy5zZWdtZW50cy5qb2luKCcuJykpO1xufTtcbkZuRXhwcmVzc2lvbi5wcm90b3R5cGUuX2dldElucHV0cyA9IGZ1bmN0aW9uKGNvbnRleHQpIHtcbiAgdmFyIGlucHV0cyA9IFtdO1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gdGhpcy5hcmdzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgdmFyIHZhbHVlID0gdGhpcy5hcmdzW2ldLmdldChjb250ZXh0KTtcbiAgICBpbnB1dHMucHVzaChyZW5kZXJWYWx1ZSh2YWx1ZSwgY29udGV4dCkpO1xuICB9XG4gIHJldHVybiBpbnB1dHM7XG59O1xuRm5FeHByZXNzaW9uLnByb3RvdHlwZS5fYXBwbHlGbiA9IGZ1bmN0aW9uKGZuLCBjb250ZXh0LCBleHRyYUlucHV0cywgdGhpc0FyZykge1xuICAvLyBBcHBseSBpZiB0aGVyZSBhcmUgbm8gcGF0aCBpbnB1dHNcbiAgaWYgKCF0aGlzLmFyZ3MpIHtcbiAgICByZXR1cm4gKGV4dHJhSW5wdXRzKSA/XG4gICAgICBmbi5hcHBseSh0aGlzQXJnLCBleHRyYUlucHV0cykgOlxuICAgICAgZm4uY2FsbCh0aGlzQXJnKTtcbiAgfVxuICAvLyBPdGhlcndpc2UsIGdldCB0aGUgY3VycmVudCB2YWx1ZSBmb3IgcGF0aCBpbnB1dHMgYW5kIGFwcGx5XG4gIHZhciBpbnB1dHMgPSB0aGlzLl9nZXRJbnB1dHMoY29udGV4dCk7XG4gIGlmIChleHRyYUlucHV0cykge1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBleHRyYUlucHV0cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgaW5wdXRzLnB1c2goZXh0cmFJbnB1dHNbaV0pO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZm4uYXBwbHkodGhpc0FyZywgaW5wdXRzKTtcbn07XG5GbkV4cHJlc3Npb24ucHJvdG90eXBlLmRlcGVuZGVuY2llcyA9IGZ1bmN0aW9uKGNvbnRleHQpIHtcbiAgdmFyIGRlcGVuZGVuY2llcyA9IFtdO1xuICBpZiAoIXRoaXMuYXJncykgcmV0dXJuIGRlcGVuZGVuY2llcztcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHRoaXMuYXJncy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIHZhciBhcmdEZXBlbmRlbmNpZXMgPSB0aGlzLmFyZ3NbaV0uZGVwZW5kZW5jaWVzKGNvbnRleHQpO1xuICAgIHZhciBmaXJzdERlcGVuZGVuY3kgPSBhcmdEZXBlbmRlbmNpZXMgJiYgYXJnRGVwZW5kZW5jaWVzWzBdO1xuICAgIGlmICghZmlyc3REZXBlbmRlbmN5KSBjb250aW51ZTtcbiAgICBpZiAoZmlyc3REZXBlbmRlbmN5W2ZpcnN0RGVwZW5kZW5jeS5sZW5ndGggLSAxXSAhPT0gJyonKSB7XG4gICAgICBhcmdEZXBlbmRlbmNpZXNbMF0gPSBhcmdEZXBlbmRlbmNpZXNbMF0uY29uY2F0KCcqJyk7XG4gICAgfVxuICAgIGZvciAodmFyIGogPSAwLCBqTGVuID0gYXJnRGVwZW5kZW5jaWVzLmxlbmd0aDsgaiA8IGpMZW47IGorKykge1xuICAgICAgZGVwZW5kZW5jaWVzLnB1c2goYXJnRGVwZW5kZW5jaWVzW2pdKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGRlcGVuZGVuY2llcztcbn07XG5GbkV4cHJlc3Npb24ucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uKGNvbnRleHQsIHZhbHVlKSB7XG4gIHZhciBjb250cm9sbGVyID0gY29udGV4dC5jb250cm9sbGVyO1xuICB2YXIgZm4sIHBhcmVudDtcbiAgd2hpbGUgKGNvbnRyb2xsZXIpIHtcbiAgICBwYXJlbnQgPSAodGhpcy5wYXJlbnRTZWdtZW50cykgP1xuICAgICAgbG9va3VwKHRoaXMucGFyZW50U2VnbWVudHMsIGNvbnRyb2xsZXIpIDpcbiAgICAgIGNvbnRyb2xsZXI7XG4gICAgZm4gPSBwYXJlbnQgJiYgcGFyZW50W3RoaXMubGFzdFNlZ21lbnRdO1xuICAgIGlmIChmbikgYnJlYWs7XG4gICAgY29udHJvbGxlciA9IGNvbnRyb2xsZXIucGFyZW50O1xuICB9XG4gIHZhciBzZXRGbiA9IGZuICYmIGZuLnNldDtcbiAgaWYgKCFzZXRGbikgdGhyb3cgbmV3IEVycm9yKCdObyBzZXR0ZXIgZnVuY3Rpb24gZm9yOiAnICsgdGhpcy5zZWdtZW50cy5qb2luKCcuJykpO1xuICB2YXIgaW5wdXRzID0gdGhpcy5fZ2V0SW5wdXRzKGNvbnRleHQpO1xuICBpbnB1dHMudW5zaGlmdCh2YWx1ZSk7XG4gIHZhciBvdXQgPSBzZXRGbi5hcHBseShwYXJlbnQsIGlucHV0cyk7XG4gIGZvciAodmFyIGkgaW4gb3V0KSB7XG4gICAgdGhpcy5hcmdzW2ldLnNldChjb250ZXh0LCBvdXRbaV0pO1xuICB9XG59O1xuXG5mdW5jdGlvbiBOZXdFeHByZXNzaW9uKHNlZ21lbnRzLCBhcmdzLCBhZnRlclNlZ21lbnRzLCBtZXRhKSB7XG4gIEZuRXhwcmVzc2lvbi5jYWxsKHRoaXMsIHNlZ21lbnRzLCBhcmdzLCBhZnRlclNlZ21lbnRzLCBtZXRhKTtcbn1cbk5ld0V4cHJlc3Npb24ucHJvdG90eXBlID0gbmV3IEZuRXhwcmVzc2lvbigpO1xuTmV3RXhwcmVzc2lvbi5wcm90b3R5cGUudHlwZSA9ICdOZXdFeHByZXNzaW9uJztcbk5ld0V4cHJlc3Npb24ucHJvdG90eXBlLl9hcHBseUZuID0gZnVuY3Rpb24oRm4sIGNvbnRleHQpIHtcbiAgLy8gQXBwbHkgaWYgdGhlcmUgYXJlIG5vIHBhdGggaW5wdXRzXG4gIGlmICghdGhpcy5hcmdzKSByZXR1cm4gbmV3IEZuKCk7XG4gIC8vIE90aGVyd2lzZSwgZ2V0IHRoZSBjdXJyZW50IHZhbHVlIGZvciBwYXRoIGlucHV0cyBhbmQgYXBwbHlcbiAgdmFyIGlucHV0cyA9IHRoaXMuX2dldElucHV0cyhjb250ZXh0KTtcbiAgaW5wdXRzLnVuc2hpZnQobnVsbCk7XG4gIHJldHVybiBuZXcgKEZuLmJpbmQuYXBwbHkoRm4sIGlucHV0cykpKCk7XG59O1xuXG5mdW5jdGlvbiBPcGVyYXRvckV4cHJlc3Npb24obmFtZSwgYXJncywgYWZ0ZXJTZWdtZW50cywgbWV0YSkge1xuICB0aGlzLm5hbWUgPSBuYW1lO1xuICB0aGlzLmFyZ3MgPSBhcmdzO1xuICB0aGlzLmFmdGVyU2VnbWVudHMgPSBhZnRlclNlZ21lbnRzO1xuICB0aGlzLm1ldGEgPSBtZXRhO1xuICB0aGlzLmdldEZuID0gb3BlcmF0b3JGbnMuZ2V0W25hbWVdO1xuICB0aGlzLnNldEZuID0gb3BlcmF0b3JGbnMuc2V0W25hbWVdO1xufVxuT3BlcmF0b3JFeHByZXNzaW9uLnByb3RvdHlwZSA9IG5ldyBGbkV4cHJlc3Npb24oKTtcbk9wZXJhdG9yRXhwcmVzc2lvbi5wcm90b3R5cGUudHlwZSA9ICdPcGVyYXRvckV4cHJlc3Npb24nO1xuT3BlcmF0b3JFeHByZXNzaW9uLnByb3RvdHlwZS5zZXJpYWxpemUgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHNlcmlhbGl6ZU9iamVjdC5pbnN0YW5jZSh0aGlzLCB0aGlzLm5hbWUsIHRoaXMuYXJncywgdGhpcy5hZnRlclNlZ21lbnRzLCB0aGlzLm1ldGEpO1xufTtcbk9wZXJhdG9yRXhwcmVzc2lvbi5wcm90b3R5cGUuYXBwbHkgPSBmdW5jdGlvbihjb250ZXh0KSB7XG4gIHZhciBpbnB1dHMgPSB0aGlzLl9nZXRJbnB1dHMoY29udGV4dCk7XG4gIHJldHVybiB0aGlzLmdldEZuLmFwcGx5KG51bGwsIGlucHV0cyk7XG59O1xuT3BlcmF0b3JFeHByZXNzaW9uLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbihjb250ZXh0LCB2YWx1ZSkge1xuICB2YXIgaW5wdXRzID0gdGhpcy5fZ2V0SW5wdXRzKGNvbnRleHQpO1xuICBpbnB1dHMudW5zaGlmdCh2YWx1ZSk7XG4gIHZhciBvdXQgPSB0aGlzLnNldEZuLmFwcGx5KG51bGwsIGlucHV0cyk7XG4gIGZvciAodmFyIGkgaW4gb3V0KSB7XG4gICAgdGhpcy5hcmdzW2ldLnNldChjb250ZXh0LCBvdXRbaV0pO1xuICB9XG59O1xuXG5mdW5jdGlvbiBTZXF1ZW5jZUV4cHJlc3Npb24oYXJncywgYWZ0ZXJTZWdtZW50cywgbWV0YSkge1xuICB0aGlzLmFyZ3MgPSBhcmdzO1xuICB0aGlzLmFmdGVyU2VnbWVudHMgPSBhZnRlclNlZ21lbnRzO1xuICB0aGlzLm1ldGEgPSBtZXRhO1xufVxuU2VxdWVuY2VFeHByZXNzaW9uLnByb3RvdHlwZSA9IG5ldyBPcGVyYXRvckV4cHJlc3Npb24oKTtcblNlcXVlbmNlRXhwcmVzc2lvbi5wcm90b3R5cGUudHlwZSA9ICdTZXF1ZW5jZUV4cHJlc3Npb24nO1xuU2VxdWVuY2VFeHByZXNzaW9uLnByb3RvdHlwZS5zZXJpYWxpemUgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHNlcmlhbGl6ZU9iamVjdC5pbnN0YW5jZSh0aGlzLCB0aGlzLmFyZ3MsIHRoaXMuYWZ0ZXJTZWdtZW50cywgdGhpcy5tZXRhKTtcbn07XG5TZXF1ZW5jZUV4cHJlc3Npb24ucHJvdG90eXBlLm5hbWUgPSAnLCc7XG5TZXF1ZW5jZUV4cHJlc3Npb24ucHJvdG90eXBlLmdldEZuID0gb3BlcmF0b3JGbnMuZ2V0WycsJ107XG5TZXF1ZW5jZUV4cHJlc3Npb24ucHJvdG90eXBlLnJlc29sdmUgPSBmdW5jdGlvbihjb250ZXh0KSB7XG4gIHZhciBsYXN0ID0gdGhpcy5hcmdzW3RoaXMuYXJncy5sZW5ndGggLSAxXTtcbiAgcmV0dXJuIGxhc3QucmVzb2x2ZShjb250ZXh0KTtcbn07XG5TZXF1ZW5jZUV4cHJlc3Npb24ucHJvdG90eXBlLmRlcGVuZGVuY2llcyA9IGZ1bmN0aW9uKGNvbnRleHQsIGZvcklubmVyUGF0aCkge1xuICB2YXIgZGVwZW5kZW5jaWVzID0gW107XG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSB0aGlzLmFyZ3MubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICB2YXIgYXJnRGVwZW5kZW5jaWVzID0gdGhpcy5hcmdzW2ldLmRlcGVuZGVuY2llcyhjb250ZXh0LCBmb3JJbm5lclBhdGgpO1xuICAgIGZvciAodmFyIGogPSAwLCBqTGVuID0gYXJnRGVwZW5kZW5jaWVzLmxlbmd0aDsgaiA8IGpMZW47IGorKykge1xuICAgICAgZGVwZW5kZW5jaWVzLnB1c2goYXJnRGVwZW5kZW5jaWVzW2pdKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGRlcGVuZGVuY2llcztcbn07XG5cbmZ1bmN0aW9uIFNjb3BlZE1vZGVsRXhwcmVzc2lvbihleHByZXNzaW9uLCBtZXRhKSB7XG4gIHRoaXMuZXhwcmVzc2lvbiA9IGV4cHJlc3Npb247XG4gIHRoaXMubWV0YSA9IG1ldGE7XG59XG5TY29wZWRNb2RlbEV4cHJlc3Npb24ucHJvdG90eXBlID0gbmV3IEV4cHJlc3Npb24oKTtcblNjb3BlZE1vZGVsRXhwcmVzc2lvbi5wcm90b3R5cGUudHlwZSA9ICdTY29wZWRNb2RlbEV4cHJlc3Npb24nO1xuU2NvcGVkTW9kZWxFeHByZXNzaW9uLnByb3RvdHlwZS5zZXJpYWxpemUgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHNlcmlhbGl6ZU9iamVjdC5pbnN0YW5jZSh0aGlzLCB0aGlzLmV4cHJlc3Npb24sIHRoaXMubWV0YSk7XG59O1xuLy8gUmV0dXJuIGEgc2NvcGVkIG1vZGVsIGluc3RlYWQgb2YgdGhlIHZhbHVlXG5TY29wZWRNb2RlbEV4cHJlc3Npb24ucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uKGNvbnRleHQpIHtcbiAgdmFyIHNlZ21lbnRzID0gdGhpcy5wYXRoU2VnbWVudHMoY29udGV4dCk7XG4gIGlmICghc2VnbWVudHMpIHJldHVybjtcbiAgcmV0dXJuIGNvbnRleHQuY29udHJvbGxlci5tb2RlbC5zY29wZShzZWdtZW50cy5qb2luKCcuJykpO1xufTtcbi8vIERlbGVnYXRlIG90aGVyIG1ldGhvZHMgdG8gdGhlIGlubmVyIGV4cHJlc3Npb25cblNjb3BlZE1vZGVsRXhwcmVzc2lvbi5wcm90b3R5cGUucmVzb2x2ZSA9IGZ1bmN0aW9uKGNvbnRleHQpIHtcbiAgcmV0dXJuIHRoaXMuZXhwcmVzc2lvbi5yZXNvbHZlKGNvbnRleHQpO1xufTtcblNjb3BlZE1vZGVsRXhwcmVzc2lvbi5wcm90b3R5cGUuZGVwZW5kZW5jaWVzID0gZnVuY3Rpb24oY29udGV4dCwgZm9ySW5uZXJQYXRoKSB7XG4gIHJldHVybiB0aGlzLmV4cHJlc3Npb24uZGVwZW5kZW5jaWVzKGNvbnRleHQsIGZvcklubmVyUGF0aCk7XG59O1xuU2NvcGVkTW9kZWxFeHByZXNzaW9uLnByb3RvdHlwZS5wYXRoU2VnbWVudHMgPSBmdW5jdGlvbihjb250ZXh0KSB7XG4gIHJldHVybiB0aGlzLmV4cHJlc3Npb24ucGF0aFNlZ21lbnRzKGNvbnRleHQpO1xufTtcblNjb3BlZE1vZGVsRXhwcmVzc2lvbi5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24oY29udGV4dCwgdmFsdWUpIHtcbiAgcmV0dXJuIHRoaXMuZXhwcmVzc2lvbi5zZXQoY29udGV4dCwgdmFsdWUpO1xufTtcblxuZnVuY3Rpb24gb3V0ZXJEZXBlbmRlbmN5KGV4cHJlc3Npb24sIGNvbnRleHQsIGZvcklubmVyUGF0aCkge1xuICBpZiAoZm9ySW5uZXJQYXRoKSByZXR1cm47XG4gIHJldHVybiBbZXhwcmVzc2lvbi5yZXNvbHZlKGNvbnRleHQpXTtcbn1cblxuZnVuY3Rpb24gY29uY2F0KGEsIGIpIHtcbiAgaWYgKCFhKSByZXR1cm4gYjtcbiAgaWYgKCFiKSByZXR1cm4gYTtcbiAgcmV0dXJuIGEuY29uY2F0KGIpO1xufVxuIl19
},{"./operatorFns":26,"./templates":27,"serialize-object":29}],26:[function(require,module,exports){
// `-` and `+` can be either unary or binary, so all unary operators are
// postfixed with `U` to differentiate

exports.get = {
  // Unary operators
  '!U': function(value) {
    return !value;
  }
, '-U': function(value) {
    return -value;
  }
, '+U': function(value) {
    return +value;
  }
, '~U': function(value) {
    return ~value;
  }
, 'typeofU': function(value) {
    return typeof value;
  }
  // Binary operators
, '||': function(left, right) {
    return left || right;
  }
, '&&': function(left, right) {
    return left && right;
  }
, '|': function(left, right) {
    return left | right;
  }
, '^': function(left, right) {
    return left ^ right;
  }
, '&': function(left, right) {
    return left & right;
  }
, '==': function(left, right) {
    return left == right; // jshint ignore:line
  }
, '!=': function(left, right) {
    return left != right; // jshint ignore:line
  }
, '===': function(left, right) {
    return left === right;
  }
, '!==': function(left, right) {
    return left !== right;
  }
, '<': function(left, right) {
    return left < right;
  }
, '>': function(left, right) {
    return left > right;
  }
, '<=': function(left, right) {
    return left <= right;
  }
, '>=': function(left, right) {
    return left >= right;
  }
, 'instanceof': function(left, right) {
    return left instanceof right;
  }
, 'in': function(left, right) {
    return left in right;
  }
, '<<': function(left, right) {
    return left << right;
  }
, '>>': function(left, right) {
    return left >> right;
  }
, '>>>': function(left, right) {
    return left >>> right;
  }
, '+': function(left, right) {
    return left + right;
  }
, '-': function(left, right) {
    return left - right;
  }
, '*': function(left, right) {
    return left * right;
  }
, '/': function(left, right) {
    return left / right;
  }
, '%': function(left, right) {
    return left % right;
  }
  // Conditional operator
, '?': function(test, consequent, alternate) {
    return (test) ? consequent : alternate;
  }
, // Sequence
  ',': function() {
    return arguments[arguments.length - 1];
  }
  // Array literal
, '[]': function() {
    return Array.prototype.slice.call(arguments);
  }
  // Object literal
, '{}': function() {
    var value = {};
    for (var i = 0, len = arguments.length; i < len; i += 2) {
      var key = arguments[i];
      value[key] = arguments[i + 1];
    }
    return value;
  }
};

exports.set = {
  // Unary operators
  '!U': function(value) {
    return [!value];
  }
, '-U': function(value) {
    return [-value];
  }
  // Binary operators
, '==': function(value, left, right) {
    if (value) return [right];
  }
, '===': function(value, left, right) {
    if (value) return [right];
  }
, 'in': function(value, left, right) {
    right[left] = true;
    return {1: right};
  }
, '+': function(value, left, right) {
    return [value - right];
  }
, '-': function(value, left, right) {
    return [value + right];
  }
, '*': function(value, left, right) {
    return [value / right];
  }
, '/': function(value, left, right) {
    return [value * right];
  }
};

},{}],27:[function(require,module,exports){
var saddle = require('saddle');
var serializeObject = require('serialize-object');

(function() {
  for (var key in saddle) {
    exports[key] = saddle[key];
  }
})();

exports.View = View;
exports.ViewInstance = ViewInstance;
exports.DynamicViewInstance = DynamicViewInstance;
exports.ParentWrapper = ParentWrapper;

exports.Views = Views;

exports.MarkupHook = MarkupHook;
exports.ElementOn = ElementOn;
exports.ComponentOn = ComponentOn;
exports.ComponentMarker = ComponentMarker;
exports.AsProperty = AsProperty;
exports.AsObject = AsObject;
exports.AsObjectComponent = AsObjectComponent;
exports.AsArray = AsArray;
exports.AsArrayComponent = AsArrayComponent;

exports.emptyTemplate = new saddle.Template([]);

// Add ::isUnbound to Template && Binding
saddle.Template.prototype.isUnbound = function(context) {
  return context.unbound;
};
saddle.Binding.prototype.isUnbound = function() {
  return this.template.expression.isUnbound(this.context);
};

// Add Template::resolve
saddle.Template.prototype.resolve = function() {};

// The Template::dependencies method is specific to how Derby bindings work,
// so extend all of the Saddle Template types here
saddle.Template.prototype.dependencies = function(context) {
  return getArrayDependencies(this.content, context);
};
saddle.Doctype.prototype.dependencies = function() {};
saddle.Text.prototype.dependencies = function() {};
saddle.DynamicText.prototype.dependencies = function(context) {
  return getDependencies(this.expression, context);
};
saddle.Comment.prototype.dependencies = function() {};
saddle.DynamicComment.prototype.dependencies = function(context) {
  return getDependencies(this.expression, context);
};
saddle.Element.prototype.dependencies = function(context) {
  var items = getMapDependencies(this.attributes, context);
  return getArrayDependencies(this.content, context, items);
};
saddle.Block.prototype.dependencies = function(context) {
  var items = getDependencies(this.expression, context);
  return getArrayDependencies(this.content, context, items);
};
saddle.ConditionalBlock.prototype.dependencies = function(context) {
  var items = getArrayDependencies(this.expressions, context);
  return getArrayOfArrayDependencies(this.contents, context, items);
};
saddle.EachBlock.prototype.dependencies = function(context) {
  var items = getDependencies(this.expression, context);
  items = getArrayDependencies(this.content, context, items);
  return getArrayDependencies(this.elseContent, context, items);
};
saddle.Attribute.prototype.dependencies = function() {};
saddle.DynamicAttribute.prototype.dependencies = function(context) {
  return getDependencies(this.expression, context);
};

function getArrayOfArrayDependencies(expressions, context, items) {
  if (!expressions) return items;
  for (var i = 0, len = expressions.length; i < len; i++) {
    items = getArrayDependencies(expressions[i], context, items);
  }
  return items;
}
function getArrayDependencies(expressions, context, items) {
  if (!expressions) return items;
  for (var i = 0, len = expressions.length; i < len; i++) {
    items = getDependencies(expressions[i], context, items);
  }
  return items;
}
function getMapDependencies(expressions, context, items) {
  if (!expressions) return items;
  for (var key in expressions) {
    items = getDependencies(expressions[key], context, items);
  }
  return items;
}
function getDependencies(expression, context, items) {
  var dependencies = expression && expression.dependencies(context);
  if (!dependencies) return items;
  for (var i = 0, len = dependencies.length; i < len; i++) {
    items || (items = []);
    items.push(dependencies[i]);
  }
  return items;
}

function ViewAttributesMap(source) {
  var items = source.split(/\s+/);
  for (var i = 0, len = items.length; i < len; i++) {
    this[items[i]] = true;
  }
}
function ViewArraysMap(source) {
  var items = source.split(/\s+/);
  for (var i = 0, len = items.length; i < len; i++) {
    var item = items[i].split('/');
    this[item[0]] = item[1] || item[0];
  }
}
function View(views, name, source, options) {
  this.views = views;
  this.name = name;
  this.source = source;
  this.options = options;

  var nameSegments = (this.name || '').split(':');
  var lastSegment = nameSegments.pop();
  this.namespace = nameSegments.join(':');
  this.registeredName = (lastSegment === 'index') ? this.namespace : this.name;

  this.attributesMap = options && options.attributes &&
    new ViewAttributesMap(options.attributes);
  this.arraysMap = options && options.arrays &&
    new ViewArraysMap(options.arrays);
  // The empty string is considered true for easier HTML attribute parsing
  this.unminified = options && (options.unminified || options.unminified === '');
  this.string = options && (options.string || options.string === '');
  this.template = null;
  this.componentFactory = null;
}
View.prototype = Object.create(saddle.Template.prototype);
View.prototype.type = 'View';
View.prototype.serialize = function() {
  return null;
};
View.prototype._isComponent = function(context) {
  return this.componentFactory &&
    context.attributes && !context.attributes.extend;
};
View.prototype._initComponent = function(context) {
  return (this._isComponent(context)) ?
    this.componentFactory.init(context) : context;
};
View.prototype._queueCreate = function(context, viewContext) {
  if (this._isComponent(context)) {
    var componentFactory = this.componentFactory;
    context.queue(function queuedCreate() {
      componentFactory.create(viewContext);
    });

    if (!context.hooks) return;
    context.queue(function queuedComponentHooks() {
      // Kick off hooks if view instance specified `on` or `as` attributes
      for (var i = 0, len = context.hooks.length; i < len; i++) {
        context.hooks[i].emit(context, viewContext.controller);
      }
    });
  }
};
View.prototype.get = function(context, unescaped) {
  var viewContext = this._initComponent(context);
  var template = this.template || this.parse();
  return template.get(viewContext, unescaped);
};
View.prototype.getFragment = function(context, binding) {
  var viewContext = this._initComponent(context);
  var template = this.template || this.parse();
  var fragment = template.getFragment(viewContext, binding);
  this._queueCreate(context, viewContext);
  return fragment;
};
View.prototype.appendTo = function(parent, context) {
  var viewContext = this._initComponent(context);
  var template = this.template || this.parse();
  template.appendTo(parent, viewContext);
  this._queueCreate(context, viewContext);
};
View.prototype.attachTo = function(parent, node, context) {
  var viewContext = this._initComponent(context);
  var template = this.template || this.parse();
  var node = template.attachTo(parent, node, viewContext);
  this._queueCreate(context, viewContext);
  return node;
};
View.prototype.dependencies = function(context) {
  var template = this.template || this.parse();
  return template.dependencies(context);
};
View.prototype.parse = function() {
  this._parse();
  if (this.componentFactory) {
    var hooks = [new ComponentMarker()];
    var marker = new saddle.Comment(this.name, hooks);
    this.template.content.unshift(marker);
  }
  return this.template;
};
// View.prototype._parse is defined in parsing.js, so that it doesn't have to
// be included in the client if templates are all parsed server-side
View.prototype._parse = function() {
  throw new Error('View parsing not available');
};

function ViewInstance(name, attributes, hooks, initHooks) {
  this.name = name;
  this.attributes = attributes;
  this.hooks = hooks;
  this.initHooks = initHooks;
  this.view = null;
}
ViewInstance.prototype = Object.create(saddle.Template.prototype);
ViewInstance.prototype.type = 'ViewInstance';
ViewInstance.prototype.serialize = function() {
  return serializeObject.instance(this, this.name, this.attributes, this.hooks, this.initHooks);
};
ViewInstance.prototype.get = function(context, unescaped) {
  var view = this._find(context);
  var viewContext = context.viewChild(view, this.attributes, this.hooks, this.initHooks);
  return view.get(viewContext, unescaped);
};
ViewInstance.prototype.getFragment = function(context, binding) {
  var view = this._find(context);
  var viewContext = context.viewChild(view, this.attributes, this.hooks, this.initHooks);
  return view.getFragment(viewContext, binding);
};
ViewInstance.prototype.appendTo = function(parent, context) {
  var view = this._find(context);
  var viewContext = context.viewChild(view, this.attributes, this.hooks, this.initHooks);
  view.appendTo(parent, viewContext);
};
ViewInstance.prototype.attachTo = function(parent, node, context) {
  var view = this._find(context);
  var viewContext = context.viewChild(view, this.attributes, this.hooks, this.initHooks);
  return view.attachTo(parent, node, viewContext);
};
ViewInstance.prototype.dependencies = function(context) {
  var view = this._find(context);
  var viewContext = context.viewChild(view, this.attributes, this.hooks, this.initHooks);
  return view.dependencies(viewContext);
};
ViewInstance.prototype._find = function(context) {
  if (this.view) return this.view;
  var contextView = context.getView();
  var namespace = contextView && contextView.namespace;
  this.view = context.meta.views.find(this.name, namespace);
  if (!this.view) {
    var message = context.meta.views.findErrorMessage(this.name, contextView);
    throw new Error(message);
  }
  return this.view;
};

function DynamicViewInstance(nameExpression, attributes, hooks, initHooks) {
  this.nameExpression = nameExpression;
  this.attributes = attributes;
  this.hooks = hooks;
  this.initHooks = initHooks;
}
DynamicViewInstance.prototype = Object.create(ViewInstance.prototype);
DynamicViewInstance.prototype.type = 'DynamicViewInstance';
DynamicViewInstance.prototype.serialize = function() {
  return serializeObject.instance(this, this.nameExpression, this.attributes, this.hooks, this.initHooks);
};
DynamicViewInstance.prototype._find = function(context) {
  var name = this.nameExpression.get(context);
  var contextView = context.getView();
  var namespace = contextView && contextView.namespace;
  var view = name && context.meta.views.find(name, namespace);
  return view || exports.emptyTemplate;
};

function ParentWrapper(template, expression) {
  this.template = template;
  this.expression = expression;
}
ParentWrapper.prototype = Object.create(saddle.Template.prototype);
ParentWrapper.prototype.type = 'ParentWrapper';
ParentWrapper.prototype.serialize = function() {
  return serializeObject.instance(this, this.template, this.expression);
};
ParentWrapper.prototype.get = function(context, unescaped) {
  return (this.expression || this.template).get(context.forViewParent(), unescaped);
};
ParentWrapper.prototype.getFragment = function(context, binding) {
  return this.template.getFragment(context.forViewParent(), binding);
};
ParentWrapper.prototype.appendTo = function(parent, context) {
  this.template.appendTo(parent, context.forViewParent());
};
ParentWrapper.prototype.attachTo = function(parent, node, context) {
  return this.template.attachTo(parent, node, context.forViewParent());
};
ParentWrapper.prototype.resolve = function(context) {
  return this.expression && this.expression.resolve(context.forViewParent());
};
ParentWrapper.prototype.dependencies = function(context, forInnerPath) {
  return (this.expression || this.template).dependencies(context.forViewParent(), forInnerPath);
};

function ViewsMap() {}
function Views() {
  this.nameMap = new ViewsMap();
  this.tagMap = new ViewsMap();
  // TODO: elementMap is deprecated and should be removed with Derby 0.6.0
  this.elementMap = this.tagMap;
}
Views.prototype.find = function(name, namespace) {
  var map = this.nameMap;

  // Exact match lookup
  var exactName = (namespace) ? namespace + ':' + name : name;
  var match = map[exactName];
  if (match) return match;

  // Relative lookup
  var segments = name.split(':');
  var segmentsDepth = segments.length;
  if (namespace) segments = namespace.split(':').concat(segments);
  // Iterate through segments, leaving the `segmentsDepth` segments and
  // removing the second to `segmentsDepth` segment to traverse up the
  // namespaces. Decrease `segmentsDepth` if not found and repeat again.
  while (segmentsDepth > 0) {
    var testSegments = segments.slice();
    while (testSegments.length > segmentsDepth) {
      testSegments.splice(-1 - segmentsDepth, 1);
      var testName = testSegments.join(':');
      var match = map[testName];
      if (match) return match;
    }
    segmentsDepth--;
  }
};
Views.prototype.register = function(name, source, options) {
  var mapName = name.replace(/:index$/, '');
  var view = this.nameMap[mapName];
  if (view) {
    // Recreate the view if it already exists. We re-apply the constructor
    // instead of creating a new view object so that references to object
    // can be cached after finding the first time
    var componentFactory = view.componentFactory;
    View.call(view, this, name, source, options);
    view.componentFactory = componentFactory;
  } else {
    view = new View(this, name, source, options);
  }
  this.nameMap[mapName] = view;
  // TODO: element is deprecated and should be removed with Derby 0.6.0
  var tagName = options && (options.tag || options.element);
  if (tagName) this.tagMap[tagName] = view;
  return view;
};
Views.prototype.serialize = function(options) {
  var out = 'function(derbyTemplates, views) {' +
    'var expressions = derbyTemplates.expressions;' +
    'var templates = derbyTemplates.templates;';
  for (var name in this.nameMap) {
    var view = this.nameMap[name];
    if (options && !options.server && view.options && view.options.serverOnly) continue;
    var template = view.template || view.parse();
    out += 'views.register(' + serializeObject.args([
      view.name
    , (options && options.minify) ? null : view.source
    , (hasKeys(view.options)) ? view.options : null
    ]) + ').template = ' + template.serialize() + ';';
  }
  return out + '}';
};
Views.prototype.findErrorMessage = function(name, contextView) {
  var names = Object.keys(this.nameMap);
  var message = 'Cannot find view "' + name + '" in' +
    [''].concat(names).join('\n  ') + '\n';
  if (contextView) {
    message += '\nWithin template "' + contextView.name + '":\n' + contextView.source;
  }
  return message;
};


function MarkupHook() {}
MarkupHook.prototype.module = saddle.Template.prototype.module;

function ElementOn(name, expression) {
  this.name = name;
  this.expression = expression;
}
ElementOn.prototype = Object.create(MarkupHook.prototype);
ElementOn.prototype.type = 'ElementOn';
ElementOn.prototype.serialize = function() {
  return serializeObject.instance(this, this.name, this.expression);
};
ElementOn.prototype.emit = function(context, element) {
  var elementOn = this;
  if (this.name === 'create') {
    this.apply(context, element);

  } else if (this.name === 'destroy') {
    var destroyListeners = element.$destroyListeners || (element.$destroyListeners = []);
    destroyListeners.push(function elementOnDestroy() {
      elementOn.apply(context, element);
    });

  } else {
    element.addEventListener(this.name, function elementOnListener(event) {
      return elementOn.apply(context, element, event);
    }, false);
  }
};
ElementOn.prototype.apply = function(context, element, event) {
  var modelData = context.controller.model.data;
  modelData.$event = event;
  modelData.$element = element;
  var out = this.expression.apply(context);
  delete modelData.$event;
  delete modelData.$element;
  return out;
};

function ComponentOn(name, expression) {
  this.name = name;
  this.expression = expression;
}
ComponentOn.prototype = Object.create(MarkupHook.prototype);
ComponentOn.prototype.type = 'ComponentOn';
ComponentOn.prototype.serialize = function() {
  return serializeObject.instance(this, this.name, this.expression);
};
ComponentOn.prototype.emit = function(context, component) {
  var expression = this.expression;
  component.on(this.name, function componentOnListener() {
    var args = arguments.length && Array.prototype.slice.call(arguments);
    return expression.apply(context, args);
  });
};

function ComponentMarker() {}
ComponentMarker.prototype = Object.create(MarkupHook.prototype);
ComponentMarker.prototype.type = 'ComponentMarker';
ComponentMarker.prototype.serialize = function() {
  return serializeObject.instance(this);
};
ComponentMarker.prototype.emit = function(context, node) {
  node.$component = context.controller;
  context.controller.markerNode = node;
};

function AsProperty(segments) {
  this.segments = segments;
  this.lastSegment = segments.pop();
}
AsProperty.prototype = Object.create(MarkupHook.prototype);
AsProperty.prototype.type = 'AsProperty';
AsProperty.prototype.serialize = function() {
  var segments = this.segments.concat(this.lastSegment);
  return serializeObject.instance(this, segments);
};
AsProperty.prototype.emit = function(context, target) {
  var node = traverseAndCreate(context.controller, this.segments);
  node[this.lastSegment] = target;
};

function AsObject(segments, keyExpression) {
  AsProperty.call(this, segments);
  this.keyExpression = keyExpression;
}
AsObject.prototype = Object.create(AsProperty.prototype);
AsObject.prototype.type = 'AsObject';
AsObject.prototype.emit = function(context, target) {
  var node = traverseAndCreate(context.controller, this.segments);
  var object = node[this.lastSegment] || (node[this.lastSegment] = {});
  var key = this.keyExpression.get(context);
  object[key] = target;
  this.addListeners(target, object, key);
};
AsObject.prototype.addListeners = function(target, object, key) {
  this.addDestroyListener(target, function asObjectDestroy() {
    delete object[key];
  });
};
AsObject.prototype.addDestroyListener = function(target, listener) {
  var listeners = target.$destroyListeners || (target.$destroyListeners = []);
  listeners.push(listener);
};

function AsObjectComponent(segments, keyExpression) {
  AsObject.call(this, segments, keyExpression);
}
AsObjectComponent.prototype = Object.create(AsObject.prototype);
AsObjectComponent.prototype.type = 'AsObjectComponent';
AsObjectComponent.prototype.addDestroyListener = function(target, listener) {
  target.on('destroy', listener);
};

function AsArray(segments) {
  AsProperty.call(this, segments);
}
AsArray.prototype = Object.create(AsProperty.prototype);
AsArray.prototype.type = 'AsArray';
AsArray.prototype.emit = function(context, target) {
  var node = traverseAndCreate(context.controller, this.segments);
  var array = node[this.lastSegment] || (node[this.lastSegment] = []);

  // Iterate backwards, since rendering will usually append
  for (var i = array.length; i--;) {
    var item = array[i];
    // Don't add an item if already in the array
    if (item === target) return;
    var mask = this.comparePosition(target, item);
    // If the emitted target is after the current item in the document,
    // insert it next in the array
    // Node.DOCUMENT_POSITION_FOLLOWING = 4
    if (mask & 4) {
      array.splice(i + 1, 0, target);
      this.addListeners(target, array);
      return;
    }
  }
  // Add to the beginning if before all items
  array.unshift(target);
  this.addListeners(target, array);
};
AsArray.prototype.addListeners = function(target, array) {
  this.addDestroyListener(target, function asArrayDestroy() {
    var index = array.indexOf(target);
    if (index !== -1) array.splice(index, 1);
  });
};
AsArray.prototype.comparePosition = function(target, item) {
  return item.compareDocumentPosition(target);
};
AsArray.prototype.addDestroyListener = AsObject.prototype.addDestroyListener;

function AsArrayComponent(segments) {
  AsArray.call(this, segments);
}
AsArrayComponent.prototype = Object.create(AsArray.prototype);
AsArrayComponent.prototype.type = 'AsArrayComponent';
AsArrayComponent.prototype.comparePosition = function(target, item) {
  return item.markerNode.compareDocumentPosition(target.markerNode);
};
AsArrayComponent.prototype.addDestroyListener = AsObjectComponent.prototype.addDestroyListener;

function traverseAndCreate(node, segments) {
  var len = segments.length;
  if (!len) return node;
  for (var i = 0; i < len; i++) {
    var segment = segments[i];
    node = node[segment] || (node[segment] = {});
  }
  return node;
}

function hasKeys(value) {
  if (!value) return false;
  for (var key in value) {
    return true;
  }
  return false;
}

},{"saddle":28,"serialize-object":29}],28:[function(require,module,exports){
if (typeof require === 'function') {
  var serializeObject = require('serialize-object');
}

// UPDATE_PROPERTIES map HTML attribute names to an Element DOM property that
// should be used for setting on bindings updates instead of s'test'Attribute.
//
// https://github.com/jquery/jquery/blob/1.x-master/src/attributes/prop.js
// https://github.com/jquery/jquery/blob/master/src/attributes/prop.js
// http://webbugtrack.blogspot.com/2007/08/bug-242-setattribute-doesnt-always-work.html
var UPDATE_PROPERTIES = {
  checked: 'checked'
, disabled: 'disabled'
, selected: 'selected'
, type: 'type'
, value: 'value'
, 'class': 'className'
, 'for': 'htmlFor'
, tabindex: 'tabIndex'
, readonly: 'readOnly'
, maxlength: 'maxLength'
, cellspacing: 'cellSpacing'
, cellpadding: 'cellPadding'
, rowspan: 'rowSpan'
, colspan: 'colSpan'
, usemap: 'useMap'
, frameborder: 'frameBorder'
, contenteditable: 'contentEditable'
, enctype: 'encoding'
, id: 'id'
, title: 'title'
};
// CREATE_PROPERTIES map HTML attribute names to an Element DOM property that
// should be used for setting on Element rendering instead of setAttribute.
// input.defaultChecked and input.defaultValue affect the attribute, so we want
// to use these for initial dynamic rendering. For binding updates,
// input.checked and input.value are modified.
var CREATE_PROPERTIES = {};
mergeInto(UPDATE_PROPERTIES, CREATE_PROPERTIES);
CREATE_PROPERTIES.checked = 'defaultChecked';
CREATE_PROPERTIES.value = 'defaultValue';

// http://www.w3.org/html/wg/drafts/html/master/syntax.html#void-elements
var VOID_ELEMENTS = {
  area: true
, base: true
, br: true
, col: true
, embed: true
, hr: true
, img: true
, input: true
, keygen: true
, link: true
, menuitem: true
, meta: true
, param: true
, source: true
, track: true
, wbr: true
};

var NAMESPACE_URIS = {
  svg: 'http://www.w3.org/2000/svg'
, xlink: 'http://www.w3.org/1999/xlink'
, xmlns: 'http://www.w3.org/2000/xmlns/'
};

exports.CREATE_PROPERTIES = CREATE_PROPERTIES;
exports.UPDATE_PROPERTIES = UPDATE_PROPERTIES;
exports.VOID_ELEMENTS = VOID_ELEMENTS;
exports.NAMESPACE_URIS = NAMESPACE_URIS;

// Template Classes
exports.Template = Template;
exports.Doctype = Doctype;
exports.Text = Text;
exports.DynamicText = DynamicText;
exports.Comment = Comment;
exports.DynamicComment = DynamicComment;
exports.Html = Html;
exports.DynamicHtml = DynamicHtml;
exports.Element = Element;
exports.DynamicElement = DynamicElement;
exports.Block = Block;
exports.ConditionalBlock = ConditionalBlock;
exports.EachBlock = EachBlock;

exports.Attribute = Attribute;
exports.DynamicAttribute = DynamicAttribute;

// Binding Classes
exports.Binding = Binding;
exports.NodeBinding = NodeBinding;
exports.AttributeBinding = AttributeBinding;
exports.RangeBinding = RangeBinding;

function Template(content) {
  this.content = content;
}
Template.prototype.get = function(context, unescaped) {
  return contentHtml(this.content, context, unescaped);
};
Template.prototype.getFragment = function(context, binding) {
  var fragment = document.createDocumentFragment();
  this.appendTo(fragment, context, binding);
  return fragment;
};
Template.prototype.appendTo = function(parent, context) {
  context.pause();
  appendContent(parent, this.content, context);
  context.unpause();
};
Template.prototype.attachTo = function(parent, node, context) {
  context.pause();
  var node = attachContent(parent, node, this.content, context);
  context.unpause();
  return node;
};
Template.prototype.update = function() {};
Template.prototype.stringify = function(value) {
  return (value == null) ? '' : value + '';
};
Template.prototype.module = 'templates';
Template.prototype.type = 'Template';
Template.prototype.serialize = function() {
  return serializeObject.instance(this, this.content);
};


function Doctype(name, publicId, systemId) {
  this.name = name;
  this.publicId = publicId;
  this.systemId = systemId;
}
Doctype.prototype = new Template();
Doctype.prototype.get = function() {
  var publicText = (this.publicId) ?
    ' PUBLIC "' + this.publicId  + '"' :
    '';
  var systemText = (this.systemId) ?
    (this.publicId) ?
      ' "' + this.systemId + '"' :
      ' SYSTEM "' + this.systemId + '"' :
    '';
  return '<!DOCTYPE ' + this.name + publicText + systemText + '>';
};
Doctype.prototype.appendTo = function() {
  // Doctype could be created via:
  //   document.implementation.createDocumentType(this.name, this.publicId, this.systemId)
  // However, it does not appear possible or useful to append it to the
  // document fragment. Therefore, just don't render it in the browser
};
Doctype.prototype.attachTo = function(parent, node) {
  if (!node || node.nodeType !== 10) {
    throw attachError(parent, node);
  }
  return node.nextSibling;
};
Doctype.prototype.type = 'Doctype';
Doctype.prototype.serialize = function() {
  return serializeObject.instance(this, this.name, this.publicId, this.systemId);
};

function Text(data) {
  this.data = data;
  this.escaped = escapeHtml(data);
}
Text.prototype = new Template();
Text.prototype.get = function(context, unescaped) {
  return (unescaped) ? this.data : this.escaped;
};
Text.prototype.appendTo = function(parent) {
  var node = document.createTextNode(this.data);
  parent.appendChild(node);
};
Text.prototype.attachTo = function(parent, node) {
  return attachText(parent, node, this.data, this);
};
Text.prototype.type = 'Text';
Text.prototype.serialize = function() {
  return serializeObject.instance(this, this.data);
};

function DynamicText(expression) {
  this.expression = expression;
}
DynamicText.prototype = new Template();
DynamicText.prototype.get = function(context, unescaped) {
  var value = this.expression.get(context);
  if (value instanceof Template) {
    do {
      value = value.get(context, unescaped);
    } while (value instanceof Template);
    return value;
  }
  var data = this.stringify(value);
  return (unescaped) ? data : escapeHtml(data);
};
DynamicText.prototype.appendTo = function(parent, context) {
  var value = this.expression.get(context);
  if (value instanceof Template) {
    value.appendTo(parent, context);
    return;
  }
  var data = this.stringify(value);
  var node = document.createTextNode(data);
  parent.appendChild(node);
  addNodeBinding(this, context, node);
};
DynamicText.prototype.attachTo = function(parent, node, context) {
  var value = this.expression.get(context);
  if (value instanceof Template) {
    return value.attachTo(parent, node, context);
  }
  var data = this.stringify(value);
  return attachText(parent, node, data, this, context);
};
DynamicText.prototype.update = function(context, binding) {
  binding.node.data = this.stringify(this.expression.get(context));
};
DynamicText.prototype.type = 'DynamicText';
DynamicText.prototype.serialize = function() {
  return serializeObject.instance(this, this.expression);
};

function attachText(parent, node, data, template, context) {
  if (!node) {
    var newNode = document.createTextNode(data);
    parent.appendChild(newNode);
    addNodeBinding(template, context, newNode);
    return;
  }
  if (node.nodeType === 3) {
    // Proceed if nodes already match
    if (node.data === data) {
      addNodeBinding(template, context, node);
      return node.nextSibling;
    }
    data = normalizeLineBreaks(data);
    // Split adjacent text nodes that would have been merged together in HTML
    var nextNode = splitData(node, data.length);
    if (node.data !== data) {
      throw attachError(parent, node);
    }
    addNodeBinding(template, context, node);
    return nextNode;
  }
  // An empty text node might not be created at the end of some text
  if (data === '') {
    var newNode = document.createTextNode('');
    parent.insertBefore(newNode, node || null);
    addNodeBinding(template, context, newNode);
    return node;
  }
  throw attachError(parent, node);
}

function Comment(data, hooks) {
  this.data = data;
  this.hooks = hooks;
}
Comment.prototype = new Template();
Comment.prototype.get = function() {
  return '<!--' + this.data + '-->';
};
Comment.prototype.appendTo = function(parent, context) {
  var node = document.createComment(this.data);
  parent.appendChild(node);
  emitHooks(this.hooks, context, node);
};
Comment.prototype.attachTo = function(parent, node, context) {
  return attachComment(parent, node, this.data, this, context);
};
Comment.prototype.type = 'Comment';
Comment.prototype.serialize = function() {
  return serializeObject.instance(this, this.data, this.hooks);
}

function DynamicComment(expression, hooks) {
  this.expression = expression;
  this.hooks = hooks;
}
DynamicComment.prototype = new Template();
DynamicComment.prototype.get = function(context) {
  var value = getUnescapedValue(this.expression, context);
  var data = this.stringify(value);
  return '<!--' + data + '-->';
};
DynamicComment.prototype.appendTo = function(parent, context) {
  var value = getUnescapedValue(this.expression, context);
  var data = this.stringify(value);
  var node = document.createComment(data);
  parent.appendChild(node);
  addNodeBinding(this, context, node);
};
DynamicComment.prototype.attachTo = function(parent, node, context) {
  var value = getUnescapedValue(this.expression, context);
  var data = this.stringify(value);
  return attachComment(parent, node, data, this, context);
};
DynamicComment.prototype.update = function(context, binding) {
  var value = getUnescapedValue(this.expression, context);
  binding.node.data = this.stringify(value);
};
DynamicComment.prototype.type = 'DynamicComment';
DynamicComment.prototype.serialize = function() {
  return serializeObject.instance(this, this.expression, this.hooks);
}

function attachComment(parent, node, data, template, context) {
  // Sometimes IE fails to create Comment nodes from HTML or innerHTML.
  // This is an issue inside of <select> elements, for example.
  if (!node || node.nodeType !== 8) {
    var newNode = document.createComment(data);
    parent.insertBefore(newNode, node || null);
    addNodeBinding(template, context, newNode);
    return node;
  }
  // Proceed if nodes already match
  if (node.data === data) {
    addNodeBinding(template, context, node);
    return node.nextSibling;
  }
  throw attachError(parent, node);
}

function addNodeBinding(template, context, node) {
  if (template.expression) {
    context.addBinding(new NodeBinding(template, context, node));
  }
  emitHooks(template.hooks, context, node);
}

function Html(data) {
  this.data = data;
}
Html.prototype = new Template();
Html.prototype.get = function() {
  return this.data;
};
Html.prototype.appendTo = function(parent) {
  var fragment = createHtmlFragment(parent, this.data);
  parent.appendChild(fragment);
};
Html.prototype.attachTo = function(parent, node) {
  return attachHtml(parent, node, this.data);
};
Html.prototype.type = "Html";
Html.prototype.serialize = function() {
  return serializeObject.instance(this, this.data);
};

function DynamicHtml(expression) {
  this.expression = expression;
  this.ending = '/' + expression;
}
DynamicHtml.prototype = new Template();
DynamicHtml.prototype.get = function(context) {
  var value = getUnescapedValue(this.expression, context);
  return this.stringify(value);
};
DynamicHtml.prototype.appendTo = function(parent, context, binding) {
  var start = document.createComment(this.expression);
  var end = document.createComment(this.ending);
  var value = getUnescapedValue(this.expression, context);
  var html = this.stringify(value);
  var fragment = createHtmlFragment(parent, html);
  parent.appendChild(start);
  parent.appendChild(fragment);
  parent.appendChild(end);
  updateRange(context, binding, this, start, end);
};
DynamicHtml.prototype.attachTo = function(parent, node, context) {
  var start = document.createComment(this.expression);
  var end = document.createComment(this.ending);
  var value = getUnescapedValue(this.expression, context);
  var html = this.stringify(value);
  parent.insertBefore(start, node || null);
  node = attachHtml(parent, node, html);
  parent.insertBefore(end, node || null);
  updateRange(context, null, this, start, end);
  return node;
};
DynamicHtml.prototype.update = function(context, binding) {
  var parent = binding.start.parentNode;
  if (!parent) return;
  // Get start and end in advance, since binding is mutated in getFragment
  var start = binding.start;
  var end = binding.end;
  var value = getUnescapedValue(this.expression, context);
  var html = this.stringify(value);
  var fragment = createHtmlFragment(parent, html);
  var innerOnly = true;
  replaceRange(context, start, end, fragment, binding, innerOnly);
};
DynamicHtml.prototype.type = 'DynamicHtml';
DynamicHtml.prototype.serialize = function() {
  return serializeObject.instance(this, this.expression);
};

function createHtmlFragment(parent, html) {
  if (parent && parent.nodeType === 1) {
    var range = document.createRange();
    range.selectNodeContents(parent);
    return range.createContextualFragment(html);
  }
  var div = document.createElement('div');
  var range = document.createRange();
  div.innerHTML = html;
  range.selectNodeContents(div);
  return range.extractContents();
}
function attachHtml(parent, node, html) {
  var fragment = createHtmlFragment(parent, html);
  for (var i = 0, len = fragment.childNodes.length; i < len; i++) {
    if (!node) throw attachError(parent, node);
    node = node.nextSibling;
  }
  return node;
}

function Attribute(data, ns) {
  this.data = data;
  this.ns = ns;
}
Attribute.prototype.get = Attribute.prototype.getBound = function(context) {
  return this.data;
};
Attribute.prototype.module = Template.prototype.module;
Attribute.prototype.type = 'Attribute';
Attribute.prototype.serialize = function() {
  return serializeObject.instance(this, this.data, this.ns);
};

function DynamicAttribute(expression, ns) {
  // In attributes, expression may be an instance of Template or Expression
  this.expression = expression;
  this.ns = ns;
  this.elementNs = null;
}
DynamicAttribute.prototype = new Attribute();
DynamicAttribute.prototype.get = function(context) {
  return getUnescapedValue(this.expression, context);
};
DynamicAttribute.prototype.getBound = function(context, element, name, elementNs) {
  this.elementNs = elementNs;
  context.addBinding(new AttributeBinding(this, context, element, name));
  return getUnescapedValue(this.expression, context);
};
DynamicAttribute.prototype.update = function(context, binding) {
  var value = getUnescapedValue(this.expression, context);
  var element = binding.element;
  var propertyName = !this.elementNs && UPDATE_PROPERTIES[binding.name];
  if (propertyName) {
    if (propertyName === 'value' && (element.value === value || element.valueAsNumber === value)) return;
    if (value === void 0) value = null;
    element[propertyName] = value;
    return;
  }
  if (value === false || value == null) {
    if (this.ns) {
      element.removeAttributeNS(this.ns, binding.name);
    } else {
      element.removeAttribute(binding.name);
    }
    return;
  }
  if (value === true) value = binding.name;
  if (this.ns) {
    element.setAttributeNS(this.ns, binding.name, value);
  } else {
    element.setAttribute(binding.name, value);
  }
};
DynamicAttribute.prototype.type = 'DynamicAttribute';
DynamicAttribute.prototype.serialize = function() {
  return serializeObject.instance(this, this.expression, this.ns);
};

function getUnescapedValue(expression, context) {
  var unescaped = true;
  var value = expression.get(context, unescaped);
  while (value instanceof Template) {
    value = value.get(context, unescaped);
  }
  return value;
}

function Element(tagName, attributes, content, hooks, selfClosing, notClosed, ns) {
  this.tagName = tagName;
  this.attributes = attributes;
  this.content = content;
  this.hooks = hooks;
  this.selfClosing = selfClosing;
  this.notClosed = notClosed;
  this.ns = ns;

  this.endTag = getEndTag(tagName, selfClosing, notClosed);
  this.startClose = getStartClose(selfClosing);
  var lowerTagName = tagName && tagName.toLowerCase();
  this.unescapedContent = (lowerTagName === 'script' || lowerTagName === 'style');
}
Element.prototype = new Template();
Element.prototype.getTagName = function() {
  return this.tagName;
};
Element.prototype.getEndTag = function() {
  return this.endTag;
};
Element.prototype.get = function(context) {
  var tagName = this.getTagName(context);
  var endTag = this.getEndTag(tagName);
  var tagItems = [tagName];
  for (var key in this.attributes) {
    var value = this.attributes[key].get(context);
    if (value === true) {
      tagItems.push(key);
    } else if (value !== false && value != null) {
      tagItems.push(key + '="' + escapeAttribute(value) + '"');
    }
  }
  var startTag = '<' + tagItems.join(' ') + this.startClose;
  if (this.content) {
    var inner = contentHtml(this.content, context, this.unescapedContent);
    return startTag + inner + endTag;
  }
  return startTag + endTag;
};
Element.prototype.appendTo = function(parent, context) {
  var tagName = this.getTagName(context);
  var element = (this.ns) ?
    document.createElementNS(this.ns, tagName) :
    document.createElement(tagName);
  for (var key in this.attributes) {
    var attribute = this.attributes[key];
    var value = attribute.getBound(context, element, key, this.ns);
    if (value === false || value == null) continue;
    var propertyName = !this.ns && CREATE_PROPERTIES[key];
    if (propertyName) {
      element[propertyName] = value;
      continue;
    }
    if (value === true) value = key;
    if (attribute.ns) {
      element.setAttributeNS(attribute.ns, key, value);
    } else {
      element.setAttribute(key, value);
    }
  }
  if (this.content) appendContent(element, this.content, context);
  parent.appendChild(element);
  emitHooks(this.hooks, context, element);
};
Element.prototype.attachTo = function(parent, node, context) {
  var tagName = this.getTagName(context);
  if (
    !node ||
    node.nodeType !== 1 ||
    node.tagName.toLowerCase() !== tagName.toLowerCase()
  ) {
    throw attachError(parent, node);
  }
  for (var key in this.attributes) {
    // Get each attribute to create bindings
    this.attributes[key].getBound(context, node, key, this.ns);
    // TODO: Ideally, this would also check that the node's current attributes
    // are equivalent, but there are some tricky edge cases
  }
  if (this.content) attachContent(node, node.firstChild, this.content, context);
  emitHooks(this.hooks, context, node);
  return node.nextSibling;
};
Element.prototype.type = 'Element';
Element.prototype.serialize = function() {
  return serializeObject.instance(
    this
  , this.tagName
  , this.attributes
  , this.content
  , this.hooks
  , this.selfClosing
  , this.notClosed
  , this.ns
  );
};

function DynamicElement(tagName, attributes, content, hooks, selfClosing, notClosed, ns) {
  this.tagName = tagName;
  this.attributes = attributes;
  this.content = content;
  this.hooks = hooks;
  this.selfClosing = selfClosing;
  this.notClosed = notClosed;
  this.ns = ns;

  this.startClose = getStartClose(selfClosing);
  this.unescapedContent = false;
}
DynamicElement.prototype = new Element();
DynamicElement.prototype.getTagName = function(context) {
  return getUnescapedValue(this.tagName, context);
};
DynamicElement.prototype.getEndTag = function(tagName) {
  return getEndTag(tagName, this.selfClosing, this.notClosed);
};
DynamicElement.prototype.type = 'DynamicElement';

function getStartClose(selfClosing) {
  return (selfClosing) ? ' />' : '>';
}

function getEndTag(tagName, selfClosing, notClosed) {
  var lowerTagName = tagName && tagName.toLowerCase();
  var isVoid = VOID_ELEMENTS[lowerTagName];
  return (isVoid || selfClosing || notClosed) ? '' : '</' + tagName + '>';
}

function getAttributeValue(element, name) {
  var propertyName = UPDATE_PROPERTIES[name];
  return (propertyName) ? element[propertyName] : element.getAttribute(name);
}

function emitHooks(hooks, context, value) {
  if (!hooks) return;
  context.queue(function queuedHooks() {
    for (var i = 0, len = hooks.length; i < len; i++) {
      hooks[i].emit(context, value);
    }
  });
}

function Block(expression, content) {
  this.expression = expression;
  this.ending = '/' + expression;
  this.content = content;
}
Block.prototype = new Template();
Block.prototype.get = function(context, unescaped) {
  var blockContext = context.child(this.expression);
  return contentHtml(this.content, blockContext, unescaped);
};
Block.prototype.appendTo = function(parent, context, binding) {
  var blockContext = context.child(this.expression);
  var start = document.createComment(this.expression);
  var end = document.createComment(this.ending);
  var condition = this.getCondition(context);
  parent.appendChild(start);
  appendContent(parent, this.content, blockContext);
  parent.appendChild(end);
  updateRange(context, binding, this, start, end, null, condition);
};
Block.prototype.attachTo = function(parent, node, context) {
  var blockContext = context.child(this.expression);
  var start = document.createComment(this.expression);
  var end = document.createComment(this.ending);
  var condition = this.getCondition(context);
  parent.insertBefore(start, node || null);
  node = attachContent(parent, node, this.content, blockContext);
  parent.insertBefore(end, node || null);
  updateRange(context, null, this, start, end, null, condition);
  return node;
};
Block.prototype.type = 'Block';
Block.prototype.serialize = function() {
  return serializeObject.instance(this, this.expression, this.content);
};
Block.prototype.update = function(context, binding) {
  if (!binding.start.parentNode) return;
  var condition = this.getCondition(context);
  if (condition === binding.condition) return;
  binding.condition = condition;
  // Get start and end in advance, since binding is mutated in getFragment
  var start = binding.start;
  var end = binding.end;
  var fragment = this.getFragment(context, binding);
  replaceRange(context, start, end, fragment, binding);
};
Block.prototype.getCondition = function(context) {
  // We do an identity check to see if the value has changed before updating.
  // With objects, the object would still be the same, so this identity check
  // would fail to update enough. Thus, return NaN, which never equals anything
  // including itself, so that we always update on objects.
  //
  // We could also JSON stringify or use some other hashing approach. However,
  // that could be really expensive on gets of things that never change, and
  // is probably not a good tradeoff. Perhaps there should be a separate block
  // type that is only used in the case of dynamic updates
  var value = this.expression.get(context);
  return (typeof value === 'object') ? NaN : value;
};

function ConditionalBlock(expressions, contents) {
  this.expressions = expressions;
  this.beginning = expressions.join('; ');
  this.ending = '/' + this.beginning;
  this.contents = contents;
}
ConditionalBlock.prototype = new Block();
ConditionalBlock.prototype.get = function(context, unescaped) {
  var condition = this.getCondition(context);
  if (condition == null) return '';
  var expression = this.expressions[condition];
  var blockContext = context.child(expression);
  return contentHtml(this.contents[condition], blockContext, unescaped);
};
ConditionalBlock.prototype.appendTo = function(parent, context, binding) {
  var start = document.createComment(this.beginning);
  var end = document.createComment(this.ending);
  parent.appendChild(start);
  var condition = this.getCondition(context);
  if (condition != null) {
    var expression = this.expressions[condition];
    var blockContext = context.child(expression);
    appendContent(parent, this.contents[condition], blockContext);
  }
  parent.appendChild(end);
  updateRange(context, binding, this, start, end, null, condition);
};
ConditionalBlock.prototype.attachTo = function(parent, node, context) {
  var start = document.createComment(this.beginning);
  var end = document.createComment(this.ending);
  parent.insertBefore(start, node || null);
  var condition = this.getCondition(context);
  if (condition != null) {
    var expression = this.expressions[condition];
    var blockContext = context.child(expression);
    node = attachContent(parent, node, this.contents[condition], blockContext);
  }
  parent.insertBefore(end, node || null);
  updateRange(context, null, this, start, end, null, condition);
  return node;
};
ConditionalBlock.prototype.type = 'ConditionalBlock';
ConditionalBlock.prototype.serialize = function() {
  return serializeObject.instance(this, this.expressions, this.contents);
};
ConditionalBlock.prototype.update = function(context, binding) {
  if (!binding.start.parentNode) return;
  var condition = this.getCondition(context);
  if (condition === binding.condition) return;
  binding.condition = condition;
  // Get start and end in advance, since binding is mutated in getFragment
  var start = binding.start;
  var end = binding.end;
  var fragment = this.getFragment(context, binding);
  replaceRange(context, start, end, fragment, binding);
};
ConditionalBlock.prototype.getCondition = function(context) {
  for (var i = 0, len = this.expressions.length; i < len; i++) {
    if (this.expressions[i].truthy(context)) {
      return i;
    }
  }
};

function EachBlock(expression, content, elseContent) {
  this.expression = expression;
  this.ending = '/' + expression;
  this.content = content;
  this.elseContent = elseContent;
}
EachBlock.prototype = new Block();
EachBlock.prototype.get = function(context, unescaped) {
  var items = this.expression.get(context);
  if (items && items.length) {
    var html = '';
    for (var i = 0, len = items.length; i < len; i++) {
      var itemContext = context.eachChild(this.expression, i);
      html += contentHtml(this.content, itemContext, unescaped);
    }
    return html;
  } else if (this.elseContent) {
    return contentHtml(this.elseContent, context, unescaped);
  }
  return '';
};
EachBlock.prototype.appendTo = function(parent, context, binding) {
  var items = this.expression.get(context);
  var start = document.createComment(this.expression);
  var end = document.createComment(this.ending);
  parent.appendChild(start);
  if (items && items.length) {
    for (var i = 0, len = items.length; i < len; i++) {
      var itemContext = context.eachChild(this.expression, i);
      this.appendItemTo(parent, itemContext, start);
    }
  } else if (this.elseContent) {
    appendContent(parent, this.elseContent, context);
  }
  parent.appendChild(end);
  updateRange(context, binding, this, start, end);
};
EachBlock.prototype.appendItemTo = function(parent, context, itemFor, binding) {
  var before = parent.lastChild;
  var start, end;
  appendContent(parent, this.content, context);
  if (before === parent.lastChild) {
    start = end = document.createComment('empty');
    parent.appendChild(start);
  } else {
    start = (before && before.nextSibling) || parent.firstChild;
    end = parent.lastChild;
  }
  updateRange(context, binding, this, start, end, itemFor);
};
EachBlock.prototype.attachTo = function(parent, node, context) {
  var items = this.expression.get(context);
  var start = document.createComment(this.expression);
  var end = document.createComment(this.ending);
  parent.insertBefore(start, node || null);
  if (items && items.length) {
    for (var i = 0, len = items.length; i < len; i++) {
      var itemContext = context.eachChild(this.expression, i);
      node = this.attachItemTo(parent, node, itemContext, start);
    }
  } else if (this.elseContent) {
    node = attachContent(parent, node, this.elseContent, context);
  }
  parent.insertBefore(end, node || null);
  updateRange(context, null, this, start, end);
  return node;
};
EachBlock.prototype.attachItemTo = function(parent, node, context, itemFor) {
  var start, end;
  var oldPrevious = node && node.previousSibling;
  var nextNode = attachContent(parent, node, this.content, context);
  if (nextNode === node) {
    start = end = document.createComment('empty');
    parent.insertBefore(start, node || null);
  } else {
    start = (oldPrevious && oldPrevious.nextSibling) || parent.firstChild;
    end = (nextNode && nextNode.previousSibling) || parent.lastChild;
  }
  updateRange(context, null, this, start, end, itemFor);
  return nextNode;
};
EachBlock.prototype.update = function(context, binding) {
  if (!binding.start.parentNode) return;
  var start = binding.start;
  var end = binding.end;
  if (binding.itemFor) {
    var fragment = document.createDocumentFragment();
    this.appendItemTo(fragment, context, binding.itemFor, binding);
  } else {
    var fragment = this.getFragment(context, binding);
  }
  replaceRange(context, start, end, fragment, binding);
};
EachBlock.prototype.insert = function(context, binding, index, howMany) {
  var parent = binding.start.parentNode;
  if (!parent) return;
  // In case we are inserting all of the items, update instead. This is needed
  // when we were previously rendering elseContent so that it is replaced
  if (index === 0 && this.expression.get(context).length === howMany) {
    return this.update(context, binding);
  }
  var node = indexStartNode(binding, index);
  var fragment = document.createDocumentFragment();
  for (var i = index, len = index + howMany; i < len; i++) {
    var itemContext = context.eachChild(this.expression, i);
    this.appendItemTo(fragment, itemContext, binding.start);
  }
  parent.insertBefore(fragment, node || null);
};
EachBlock.prototype.remove = function(context, binding, index, howMany) {
  var parent = binding.start.parentNode;
  if (!parent) return;
  // In case we are removing all of the items, update instead. This is needed
  // when elseContent should be rendered
  if (index === 0 && this.expression.get(context).length === 0) {
    return this.update(context, binding);
  }
  var node = indexStartNode(binding, index);
  var i = 0;
  while (node) {
    if (node === binding.end) return;
    if (node.$bindItemStart && node.$bindItemStart.itemFor === binding.start) {
      if (howMany === i++) return;
    }
    var nextNode = node.nextSibling;
    parent.removeChild(node);
    emitRemoved(context, node, binding);
    node = nextNode;
  }
};
EachBlock.prototype.move = function(context, binding, from, to, howMany) {
  var parent = binding.start.parentNode;
  if (!parent) return;
  var node = indexStartNode(binding, from);
  var fragment = document.createDocumentFragment();
  var i = 0;
  while (node) {
    if (node === binding.end) break;
    if (node.$bindItemStart && node.$bindItemStart.itemFor === binding.start) {
      if (howMany === i++) break;
    }
    var nextNode = node.nextSibling;
    fragment.appendChild(node);
    node = nextNode;
  }
  node = indexStartNode(binding, to);
  parent.insertBefore(fragment, node || null);
};
EachBlock.prototype.type = 'EachBlock';
EachBlock.prototype.serialize = function() {
  return serializeObject.instance(this, this.expression, this.content, this.elseContent);
};

function indexStartNode(binding, index) {
  var node = binding.start;
  var i = 0;
  while (node = node.nextSibling) {
    if (node === binding.end) return node;
    if (node.$bindItemStart && node.$bindItemStart.itemFor === binding.start) {
      if (index === i) return node;
      i++;
    }
  }
}

function updateRange(context, binding, template, start, end, itemFor, condition) {
  if (binding) {
    binding.start = start;
    binding.end = end;
    binding.condition = condition;
    setNodeBounds(binding, start, itemFor);
  } else {
    context.addBinding(new RangeBinding(template, context, start, end, itemFor, condition));
  }
}
function setNodeBounds(binding, start, itemFor) {
  if (itemFor) {
    setNodeProperty(start, '$bindItemStart', binding);
  } else {
    setNodeProperty(start, '$bindStart', binding);
  }
}

function appendContent(parent, content, context) {
  for (var i = 0, len = content.length; i < len; i++) {
    content[i].appendTo(parent, context);
  }
}
function attachContent(parent, node, content, context) {
  for (var i = 0, len = content.length; i < len; i++) {
    node = content[i].attachTo(parent, node, context);
  }
  return node;
}
function contentHtml(content, context, unescaped) {
  var html = '';
  for (var i = 0, len = content.length; i < len; i++) {
    html += content[i].get(context, unescaped);
  }
  return html;
}
function replaceRange(context, start, end, fragment, binding, innerOnly) {
  // Note: the calling function must make sure to check that there is a parent
  var parent = start.parentNode;
  // Copy item binding from old start to fragment being inserted
  if (start.$bindItemStart && fragment.firstChild) {
    setNodeProperty(fragment.firstChild, '$bindItemStart', start.$bindItemStart);
    start.$bindItemStart.start = fragment.firstChild;
  }
  // Fast path for single node replacements
  if (start === end) {
    parent.replaceChild(fragment, start);
    emitRemoved(context, start, binding);
    return;
  }
  // Remove all nodes from start to end
  var node = (innerOnly) ? start.nextSibling : start;
  var nextNode;
  while (node) {
    nextNode = node.nextSibling;
    emitRemoved(context, node, binding);
    if (innerOnly && node === end) {
      nextNode = end;
      break;
    }
    parent.removeChild(node);
    if (node === end) break;
    node = nextNode;
  }
  // This also works if nextNode is null, by doing an append
  parent.insertBefore(fragment, nextNode || null);
}
function emitRemoved(context, node, ignore) {
  context.removeNode(node);
  emitRemovedBinding(context, ignore, node.$bindNode);
  emitRemovedBinding(context, ignore, node.$bindStart);
  emitRemovedBinding(context, ignore, node.$bindItemStart);
  var attributes = node.$bindAttributes;
  if (attributes) {
    for (var key in attributes) {
      context.removeBinding(attributes[key]);
    }
  }
  for (node = node.firstChild; node; node = node.nextSibling) {
    emitRemoved(context, node, ignore);
  }
}
function emitRemovedBinding(context, ignore, binding) {
  if (binding && binding !== ignore) {
    context.removeBinding(binding);
  }
}

function attachError(parent, node) {
  if (typeof console !== 'undefined') {
    console.error('Attach failed for', node, 'within', parent);
  }
  return new Error('Attaching bindings failed, because HTML structure ' +
    'does not match client rendering.'
  );
}

function Binding() {
  this.meta = null;
}
Binding.prototype.type = 'Binding';
Binding.prototype.update = function() {
  this.context.pause();
  this.template.update(this.context, this);
  this.context.unpause();
};
Binding.prototype.insert = function() {
  this.update();
};
Binding.prototype.remove = function() {
  this.update();
};
Binding.prototype.move = function() {
  this.update();
};

function NodeBinding(template, context, node) {
  this.template = template;
  this.context = context;
  this.node = node;
  this.meta = null;
  setNodeProperty(node, '$bindNode', this);
}
NodeBinding.prototype = new Binding();
NodeBinding.prototype.type = 'NodeBinding';

function AttributeBindingsMap() {}
function AttributeBinding(template, context, element, name) {
  this.template = template;
  this.context = context;
  this.element = element;
  this.name = name;
  this.meta = null;
  var map = element.$bindAttributes ||
    (element.$bindAttributes = new AttributeBindingsMap());
  map[name] = this;
}
AttributeBinding.prototype = new Binding();
AttributeBinding.prototype.type = 'AttributeBinding';

function RangeBinding(template, context, start, end, itemFor, condition) {
  this.template = template;
  this.context = context;
  this.start = start;
  this.end = end;
  this.itemFor = itemFor;
  this.condition = condition;
  this.meta = null;
  setNodeBounds(this, start, itemFor);
}
RangeBinding.prototype = new Binding();
RangeBinding.prototype.type = 'RangeBinding';
RangeBinding.prototype.insert = function(index, howMany) {
  this.context.pause();
  if (this.template.insert) {
    this.template.insert(this.context, this, index, howMany);
  } else {
    this.template.update(this.context, this);
  }
  this.context.unpause();
};
RangeBinding.prototype.remove = function(index, howMany) {
  this.context.pause();
  if (this.template.remove) {
    this.template.remove(this.context, this, index, howMany);
  } else {
    this.template.update(this.context, this);
  }
  this.context.unpause();
};
RangeBinding.prototype.move = function(from, to, howMany) {
  this.context.pause();
  if (this.template.move) {
    this.template.move(this.context, this, from, to, howMany);
  } else {
    this.template.update(this.context, this);
  }
  this.context.unpause();
};


//// Utility functions ////

function noop() {}

function mergeInto(from, to) {
  for (var key in from) {
    to[key] = from[key];
  }
}

function escapeHtml(string) {
  string = string + '';
  return string.replace(/[&<]/g, function(match) {
    return (match === '&') ? '&amp;' : '&lt;';
  });
}

function escapeAttribute(string) {
  string = string + '';
  return string.replace(/[&"]/g, function(match) {
    return (match === '&') ? '&amp;' : '&quot;';
  });
}


//// Shims & workarounds ////

// General notes:
//
// In all cases, Node.insertBefore should have `|| null` after its second
// argument. IE works correctly when the argument is ommitted or equal
// to null, but it throws and error if it is equal to undefined.

if (!Array.isArray) {
  Array.isArray = function(value) {
    return Object.prototype.toString.call(value) === '[object Array]';
  };
}

// Equivalent to textNode.splitText, which is buggy in IE <=9
function splitData(node, index) {
  var newNode = node.cloneNode(false);
  newNode.deleteData(0, index);
  node.deleteData(index, node.length - index);
  node.parentNode.insertBefore(newNode, node.nextSibling || null);
  return newNode;
}

// Defined so that it can be overriden in IE <=8
function setNodeProperty(node, key, value) {
  return node[key] = value;
}

function normalizeLineBreaks(string) {
  return string;
}

(function() {
  // Don't try to shim in Node.js environment
  if (typeof document === 'undefined') return;

  var div = document.createElement('div');
  div.innerHTML = '\r\n<br>\n'
  var windowsLength = div.firstChild.data.length;
  var unixLength = div.lastChild.data.length;
  if (windowsLength === 1 && unixLength === 1) {
    normalizeLineBreaks = function(string) {
      return string.replace(/\r\n/g, '\n');
    };
  } else if (windowsLength === 2 && unixLength === 2) {
    normalizeLineBreaks = function(string) {
      return string.replace(/(^|[^\r])(\n+)/g, function(match, value, newLines) {
        for (var i = newLines.length; i--;) {
          value += '\r\n';
        }
        return value;
      });
    };
  }

  // TODO: Shim createHtmlFragment for old IE

  // TODO: Shim setAttribute('style'), which doesn't work in IE <=7
  // http://webbugtrack.blogspot.com/2007/10/bug-245-setattribute-style-does-not.html

  // TODO: Investigate whether input name attribute works in IE <=7. We could
  // override Element::appendTo to use IE's alternative createElement syntax:
  // document.createElement('<input name="xxx">')
  // http://webbugtrack.blogspot.com/2007/10/bug-235-createelement-is-broken-in-ie.html

  // In IE, input.defaultValue doesn't work correctly, so use input.value,
  // which mistakenly but conveniently sets both the value property and attribute.
  //
  // Surprisingly, in IE <=7, input.defaultChecked must be used instead of
  // input.checked before the input is in the document.
  // http://webbugtrack.blogspot.com/2007/11/bug-299-setattribute-checked-does-not.html
  var input = document.createElement('input');
  input.defaultValue = 'x';
  if (input.value !== 'x') {
    CREATE_PROPERTIES.value = 'value';
  }

  try {
    // TextNodes are not expando in IE <=8
    document.createTextNode('').$try = 0;
  } catch (err) {
    setNodeProperty = function(node, key, value) {
      // If trying to set a property on a TextNode, create a proxy CommentNode
      // and set the property on that node instead. Put the proxy after the
      // TextNode if marking the end of a range, and before otherwise.
      if (node.nodeType === 3) {
        var proxyNode = node.previousSibling;
        if (!proxyNode || proxyNode.$bindProxy !== node) {
          proxyNode = document.createComment('proxy');
          proxyNode.$bindProxy = node;
          node.parentNode.insertBefore(proxyNode, node || null);
        }
        return proxyNode[key] = value;
      }
      // Set the property directly on other node types
      return node[key] = value;
    };
  }
})();

},{"serialize-object":29}],29:[function(require,module,exports){
exports.instance = serializeInstance;
exports.args = serializeArgs;
exports.value = serializeValue;

function serializeInstance(instance) {
  var args = Array.prototype.slice.call(arguments, 1);
  return 'new ' + instance.module + '.' + instance.type +
    '(' + serializeArgs(args) + ')';
}

function serializeArgs(args) {
  // Map each argument into its string representation
  var items = [];
  for (var i = args.length; i--;) {
    var item = serializeValue(args[i]);
    items.unshift(item);
  }
  // Remove trailing null values, assuming they are optional
  for (var i = items.length; i--;) {
    var item = items[i];
    if (item !== 'void 0' && item !== 'null') break;
    items.pop();
  }
  return items.join(', ');
}

function serializeValue(input) {
  if (input && input.serialize) {
    return input.serialize();

  } else if (typeof input === 'undefined') {
    return 'void 0';

  } else if (input === null) {
    return 'null';

  } else if (typeof input === 'string') {
    return formatString(input);

  } else if (typeof input === 'number' || typeof input === 'boolean') {
    return input + '';

  } else if (Array.isArray(input)) {
    var items = [];
    for (var i = 0; i < input.length; i++) {
      var value = serializeValue(input[i]);
      items.push(value);
    }
    return '[' + items.join(', ') + ']';

  } else if (typeof input === 'object') {
    var items = [];
    for (var key in input) {
      var value = serializeValue(input[key]);
      items.push(formatString(key) + ': ' + value);
    }
    return '{' + items.join(', ') + '}';
  }
}
function formatString(value) {
  var escaped = value.replace(/['\r\n\\]/g, function(match) {
    return (match === '\'') ? '\\\'' :
      (match === '\r') ? '\\r' :
      (match === '\n') ? '\\n' :
      (match === '\\') ? '\\\\' :
      '';
  });
  return '\'' + escaped + '\'';
}

},{}],30:[function(require,module,exports){
var parse = require('./parse');

module.exports = {
  parse: parse
, unescapeEntities: unescapeEntities
, isConditionalComment: isConditionalComment
, trimLeading: trimLeading
, trimText: trimText
, trimTag: trimTag
, minify: minify
};

var replaceEntity;
if (typeof document !== 'undefined') {
  var entityContainer = document.createElement('div');
  replaceEntity = function(match) {
    // This use of innerHTML is only safe because the entity regular expression
    // is sufficiently restrictive. Doing this with un-validated HTML would
    // potentially introduce vulnerabilities
    entityContainer.innerHTML = match;
    return entityContainer.textContent || entityContainer.innerText;
  };
} else {
  // Named character references from:
  // http://www.whatwg.org/specs/web-apps/current-work/multipage/entities.json
  // 
  // Only include this reference on the server, since it is a pretty large file,
  // and we can use the browser's parser instead
  var _require = require;
  var entities = _require('./entities.json');
  replaceEntity = function(match) {
    var named = entities[match];
    if (named) return named.characters;
    if (match.charAt(1) !== '#') {
      throw new Error('Unrecognized character reference: ' + match);
    }
    var charCode = (match.charAt(2) === 'x' || match.charAt(2) === 'X') ?
      parseInt(match.slice(3, -1), 16) :
      parseInt(match.slice(2, -1), 10);
    return String.fromCharCode(charCode);
  };
}
// http://www.whatwg.org/specs/web-apps/current-work/multipage/syntax.html#character-references
function unescapeEntities(html) {
  return html.replace(/&#?[A-Za-z0-9]+;/g, replaceEntity);
}

// Assume any HTML comment that starts with `<!--[` or ends with `]-->`
// is a conditional comment. This can also be used to keep comments in
// minified HTML, such as `<!--[ Copyright John Doe, MIT Licensed ]-->`
function isConditionalComment(tag) {
  return /(?:^<!--\[)|(?:\]-->$)/.test(tag)
}

// Remove leading whitespace and newlines from a string. Whitespace at the end
// of a line will be maintained
function trimLeading(text) {
  return text ? text.replace(/\r?\n\s*/g, '') : ''
}

// Remove leading & trailing whitespace and newlines from a string
function trimText(text) {
  return text ? text.replace(/\s*\r?\n\s*/g, '') : ''
}

// Within a tag, remove leading & trailing whitespace. Keep a linebreak, since
// this could be the separator between attributes
function trimTag(tag) {
  return tag.replace(/(?:\s*\r?\n\s*)+/g, '\n')
}

// Remove linebreaks, leading & trailing space, and comments. Maintain a
// linebreak between HTML tag attributes and maintain conditional comments.
function minify(html) {
  var minified = ''
    , minifyContent = true

  parse(html, {
    start: function(tag, tagName, attrs) {
      minifyContent = !('x-no-minify' in attrs)
      minified += trimTag(tag)
    }
  , end: function(tag) {
      minified += trimTag(tag)
    }
  , text: function(text) {
      minified += minifyContent ? trimText(text) : text
    }
  , comment: function(tag) {
      if (isConditionalComment(tag)) minified += tag
    }
  , other: function(tag) {
      minified += tag
    }
  })
  return minified
}

},{"./parse":31}],31:[function(require,module,exports){
var startTag = /^<([^\s=\/!>]+)((?:\s+[^\s=\/>]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+)?)?)*)\s*(\/?)\s*>/
  , endTag = /^<\/([^\s=\/!>]+)[^>]*>/
  , comment = /^<!--([\s\S]*?)-->/
  , commentInside = /<!--[\s\S]*?-->/
  , other = /^<([\s\S]*?)>/
  , attr = /([^\s=]+)(?:\s*(=)\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+))?)?/g
  , rawTagsDefault = /^(style|script)$/i

function empty() {}

function matchEndDefault(tagName) {
  return new RegExp('</' + tagName, 'i')
}

function onStartTag(html, match, handler) {
  var attrs = {}
    , tag = match[0]
    , tagName = match[1]
    , remainder = match[2]
    , selfClosing = !!match[3]
  html = html.slice(tag.length)

  remainder.replace(attr, function(match, name, equals, attr0, attr1, attr2) {
    attrs[name] = attr0 || attr1 || attr2 || (equals ? '' : true)
  })
  handler(tag, tagName, attrs, selfClosing, html)

  return html
}

function onTag(html, match, handler) {
  var tag = match[0]
    , data = match[1]
  html = html.slice(tag.length)

  handler(tag, data, html)

  return html
}

function onText(html, index, isRawText, handler) {
  var text
  if (~index) {
    text = html.slice(0, index)
    html = html.slice(index)
  } else {
    text = html
    html = ''
  }

  if (text) handler(text, isRawText, html)

  return html
}

function rawEnd(html, ending, offset) {
  offset || (offset = 0)
  var index = html.search(ending)
    , commentMatch = html.match(commentInside)
    , commentEnd
  // Make sure that the ending condition isn't inside of an HTML comment
  if (commentMatch && commentMatch.index < index) {
    commentEnd = commentMatch.index + commentMatch[0].length
    offset += commentEnd
    html = html.slice(commentEnd)
    return rawEnd(html, ending, offset)
  }
  return index + offset
}

module.exports = function(html, options) {
  if (options == null) options = {}

  if (!html) return

  var startHandler = options.start || empty
    , endHandler = options.end || empty
    , textHandler = options.text || empty
    , commentHandler = options.comment || empty
    , otherHandler = options.other || empty
    , matchEnd = options.matchEnd || matchEndDefault
    , errorHandler = options.error
    , rawTags = options.rawTags || rawTagsDefault
    , index, last, match, tagName, err

  while (html) {
    if (html === last) {
      err = new Error('HTML parse error: ' + html)
      if (errorHandler) {
        errorHandler(err)
      } else {
        throw err
      }
    }
    last = html

    if (html[0] === '<') {
      if (match = html.match(startTag)) {
        html = onStartTag(html, match, startHandler)

        tagName = match[1]
        if (rawTags.test(tagName)) {
          index = rawEnd(html, matchEnd(tagName))
          html = onText(html, index, true, textHandler)
        }
        continue
      }

      if (match = html.match(endTag)) {
        match[1] = match[1]  // tagName
        html = onTag(html, match, endHandler)
        continue
      }

      if (match = html.match(comment)) {
        html = onTag(html, match, commentHandler)
        continue
      }

      if (match = html.match(other)) {
        html = onTag(html, match, otherHandler)
        continue
      }
    }

    index = html.indexOf('<')
    html = onText(html, index, false, textHandler)
  }
}

},{}],32:[function(require,module,exports){
module.exports = Doc;

function Doc(model, collectionName, id) {
  this.collectionName = collectionName;
  this.id = id;
  this.collectionData = model && model.data[collectionName];
}

Doc.prototype.path = function(segments) {
  var path = this.collectionName + '.' + this.id;
  if (segments && segments.lenth) path += '.' + segments.join('.');
  return path;
};

Doc.prototype._errorMessage = function(description, segments, value) {
  return description + ' at ' + this.path(segments) + ': ' +
    JSON.stringify(value, null, 2);
};

},{}],33:[function(require,module,exports){
var Doc = require('./Doc');
var util = require('../util');

module.exports = LocalDoc;

function LocalDoc(model, collectionName, id, snapshot) {
  Doc.call(this, model, collectionName, id);
  this.snapshot = snapshot;
  this._updateCollectionData();
}

LocalDoc.prototype = new Doc();

LocalDoc.prototype._updateCollectionData = function() {
  this.collectionData[this.id] = this.snapshot;
};

LocalDoc.prototype.create = function(value, cb) {
  if (this.snapshot !== undefined) {
    var message = this._errorMessage('create on local document with data', null, this.snapshot);
    var err = new Error(message);
    return cb(err);
  }
  this.snapshot = value;
  this._updateCollectionData();
  cb();
};

LocalDoc.prototype.set = function(segments, value, cb) {
  function set(node, key) {
    var previous = node[key];
    node[key] = value;
    return previous;
  }
  return this._apply(segments, set, cb);
};

LocalDoc.prototype.del = function(segments, cb) {
  // Don't do anything if the value is already undefined, since
  // apply creates objects as it traverses, and the del method
  // should not create anything
  var previous = this.get(segments);
  if (previous === void 0) {
    cb();
    return;
  }
  function del(node, key) {
    delete node[key];
    return previous;
  }
  return this._apply(segments, del, cb);
};

LocalDoc.prototype.increment = function(segments, byNumber, cb) {
  var self = this;
  function validate(value) {
    if (typeof value === 'number' || value == null) return;
    return new TypeError(self._errorMessage(
      'increment on non-number', segments, value
    ));
  }
  function increment(node, key) {
    var value = (node[key] || 0) + byNumber;
    node[key] = value;
    return value;
  }
  return this._validatedApply(segments, validate, increment, cb);
};

LocalDoc.prototype.push = function(segments, value, cb) {
  function push(arr) {
    return arr.push(value);
  }
  return this._arrayApply(segments, push, cb);
};

LocalDoc.prototype.unshift = function(segments, value, cb) {
  function unshift(arr) {
    return arr.unshift(value);
  }
  return this._arrayApply(segments, unshift, cb);
};

LocalDoc.prototype.insert = function(segments, index, values, cb) {
  function insert(arr) {
    arr.splice.apply(arr, [index, 0].concat(values));
    return arr.length;
  }
  return this._arrayApply(segments, insert, cb);
};

LocalDoc.prototype.pop = function(segments, cb) {
  function pop(arr) {
    return arr.pop();
  }
  return this._arrayApply(segments, pop, cb);
};

LocalDoc.prototype.shift = function(segments, cb) {
  function shift(arr) {
    return arr.shift();
  }
  return this._arrayApply(segments, shift, cb);
};

LocalDoc.prototype.remove = function(segments, index, howMany, cb) {
  function remove(arr) {
    return arr.splice(index, howMany);
  }
  return this._arrayApply(segments, remove, cb);
};

LocalDoc.prototype.move = function(segments, from, to, howMany, cb) {
  function move(arr) {
    // Remove from old location
    var values = arr.splice(from, howMany);
    // Insert in new location
    arr.splice.apply(arr, [to, 0].concat(values));
    return values;
  }
  return this._arrayApply(segments, move, cb);
};

LocalDoc.prototype.stringInsert = function(segments, index, value, cb) {
  var self = this;
  function validate(value) {
    if (typeof value === 'string' || value == null) return;
    return new TypeError(self._errorMessage(
      'stringInsert on non-string', segments, value
    ));
  }
  function stringInsert(node, key) {
    var previous = node[key];
    if (previous == null) {
      node[key] = value;
      return previous;
    }
    node[key] = previous.slice(0, index) + value + previous.slice(index);
    return previous;
  }
  return this._validatedApply(segments, validate, stringInsert, cb);
};

LocalDoc.prototype.stringRemove = function(segments, index, howMany, cb) {
  var self = this;
  function validate(value) {
    if (typeof value === 'string' || value == null) return;
    return new TypeError(self._errorMessage(
      'stringRemove on non-string', segments, value
    ));
  }
  function stringRemove(node, key) {
    var previous = node[key];
    if (previous == null) return previous;
    if (index < 0) index += previous.length;
    node[key] = previous.slice(0, index) + previous.slice(index + howMany);
    return previous;
  }
  return this._validatedApply(segments, validate, stringRemove, cb);
};

LocalDoc.prototype.get = function(segments) {
  return util.lookup(segments, this.snapshot);
};

/**
 * @param {Array} segments is the array representing a path
 * @param {Function} fn(node, key) applies a mutation on node[key]
 * @return {Object} returns the return value of fn(node, key)
 */
LocalDoc.prototype._createImplied = function(segments, fn) {
  var node = this;
  var key = 'snapshot';
  var i = 0;
  var nextKey = segments[i++];
  while (nextKey != null) {
    // Get or create implied object or array
    node = node[key] || (node[key] = /^\d+$/.test(nextKey) ? [] : {});
    key = nextKey;
    nextKey = segments[i++];
  }
  return fn(node, key);
};

LocalDoc.prototype._apply = function(segments, fn, cb) {
  var out = this._createImplied(segments, fn);
  this._updateCollectionData();
  cb();
  return out;
};

LocalDoc.prototype._validatedApply = function(segments, validate, fn, cb) {
  var out = this._createImplied(segments, function(node, key) {
    var err = validate(node[key]);
    if (err) return cb(err);
    return fn(node, key);
  });
  this._updateCollectionData();
  cb();
  return out;
};

LocalDoc.prototype._arrayApply = function(segments, fn, cb) {
  // Lookup a pointer to the property or nested property &
  // return the current value or create a new array
  var arr = this._createImplied(segments, nodeCreateArray);

  if (!Array.isArray(arr)) {
    var message = this._errorMessage(fn.name + ' on non-array', segments, arr);
    var err = new TypeError(message);
    return cb(err);
  }
  var out = fn(arr);
  this._updateCollectionData();
  cb();
  return out;
};

function nodeCreateArray(node, key) {
  return node[key] || (node[key] = []);
}

},{"../util":46,"./Doc":32}],34:[function(require,module,exports){
var uuid = require('uuid');

Model.INITS = [];

module.exports = Model;

function Model(options) {
  this.root = this;

  var inits = Model.INITS;
  options || (options = {});
  this.debug = options.debug || {};
  for (var i = 0; i < inits.length; i++) {
    inits[i](this, options);
  }
}

Model.prototype.id = function() {
  return uuid.v4();
};

Model.prototype._child = function() {
  return new ChildModel(this);
};

function ChildModel(model) {
  // Shared properties should be accessed via the root. This makes inheritance
  // cheap and easily extensible
  this.root = model.root;

  // EventEmitter methods access these properties directly, so they must be
  // inherited manually instead of via the root
  this._events = model._events;
  this._maxListeners = model._maxListeners;

  // Properties specific to a child instance
  this._context = model._context;
  this._at = model._at;
  this._pass = model._pass;
  this._silent = model._silent;
  this._eventContext = model._eventContext;
}
ChildModel.prototype = new Model();

},{"uuid":50}],35:[function(require,module,exports){
module.exports = require('./Model');

require('./events');
require('./paths');
require('./collections');
require('./mutators');
require('./setDiff');

require('./fn');
require('./filter');
require('./refList');
require('./ref');

},{"./Model":34,"./collections":36,"./events":38,"./filter":39,"./fn":40,"./mutators":41,"./paths":42,"./ref":43,"./refList":44,"./setDiff":45}],36:[function(require,module,exports){
var Model = require('./Model');
var LocalDoc = require('./LocalDoc');
var util = require('../util');

function CollectionMap() {}
function ModelData() {}
function DocMap() {}
function CollectionData() {}

Model.INITS.push(function(model) {
  model.root.collections = new CollectionMap();
  model.root.data = new ModelData();
});

Model.prototype.getCollection = function(collectionName) {
  return this.root.collections[collectionName];
};
Model.prototype.getDoc = function(collectionName, id) {
  var collection = this.root.collections[collectionName];
  return collection && collection.docs[id];
};
Model.prototype.get = function(subpath) {
  var segments = this._splitPath(subpath);
  return this._get(segments);
};
Model.prototype._get = function(segments) {
  return util.lookup(segments, this.root.data);
};
Model.prototype.getCopy = function(subpath) {
  var segments = this._splitPath(subpath);
  return this._getCopy(segments);
};
Model.prototype._getCopy = function(segments) {
  var value = this._get(segments);
  return util.copy(value);
};
Model.prototype.getDeepCopy = function(subpath) {
  var segments = this._splitPath(subpath);
  return this._getDeepCopy(segments);
};
Model.prototype._getDeepCopy = function(segments) {
  var value = this._get(segments);
  return util.deepCopy(value);
};
Model.prototype.getOrCreateCollection = function(name) {
  var collection = this.root.collections[name];
  if (collection) return collection;
  var Doc = this._getDocConstructor(name);
  collection = new Collection(this.root, name, Doc);
  this.root.collections[name] = collection;
  return collection;
};
Model.prototype._getDocConstructor = function() {
  // Only create local documents. This is overriden in ./connection.js, so that
  // the RemoteDoc behavior can be selectively included
  return LocalDoc;
};

/**
 * Returns an existing document with id in a collection. If the document does
 * not exist, then creates the document with id in a collection and returns the
 * new document.
 * @param {String} collectionName
 * @param {String} id
 * @param {Object} [data] data to create if doc with id does not exist in collection
 */
Model.prototype.getOrCreateDoc = function(collectionName, id, data) {
  var collection = this.getOrCreateCollection(collectionName);
  return collection.docs[id] || collection.add(id, data);
};

/**
 * @param {String} subpath
 */
Model.prototype.destroy = function(subpath) {
  var segments = this._splitPath(subpath);
  // Silently remove all types of listeners within subpath
  var silentModel = this.silent();
  silentModel.removeAllListeners(null, subpath);
  silentModel._removeAllRefs(segments);
  silentModel._stopAll(segments);
  silentModel._removeAllFilters(segments);
  // Silently remove all model data within subpath
  if (segments.length === 0) {
    this.root.collections = new CollectionMap();
    // Delete each property of data instead of creating a new object so that
    // it is possible to continue using a reference to the original data object
    var data = this.root.data;
    for (var key in data) {
      delete data[key];
    }
  } else if (segments.length === 1) {
    var collection = this.getCollection(segments[0]);
    collection && collection.destroy();
  } else {
    silentModel._del(segments);
  }
};

function Collection(model, name, Doc) {
  this.model = model;
  this.name = name;
  this.Doc = Doc;
  this.docs = new DocMap();
  this.data = model.data[name] = new CollectionData();
}

/**
 * Adds a document with `id` and `data` to `this` Collection.
 * @param {String} id
 * @param {Object} data
 * @return {LocalDoc|RemoteDoc} doc
 */
Collection.prototype.add = function(id, data) {
  var doc = new this.Doc(this.model, this.name, id, data, this);
  this.docs[id] = doc;
  return doc;
};
Collection.prototype.destroy = function() {
  delete this.model.collections[this.name];
  delete this.model.data[this.name];
};

/**
 * Removes the document with `id` from `this` Collection. If there are no more
 * documents in the Collection after the given document is removed, then this
 * also destroys the Collection.
 * @param {String} id
 */
Collection.prototype.remove = function(id) {
  delete this.docs[id];
  delete this.data[id];
  if (noKeys(this.docs)) this.destroy();
};

/**
 * Returns an object that maps doc ids to fully resolved documents.
 * @return {Object}
 */
Collection.prototype.get = function() {
  return this.data;
};

function noKeys(object) {
  for (var key in object) {
    return false;
  }
  return true;
}

},{"../util":46,"./LocalDoc":33,"./Model":34}],37:[function(require,module,exports){
var defaultFns = module.exports = new DefaultFns();

defaultFns.reverse = new FnPair(getReverse, setReverse);
defaultFns.asc = asc;
defaultFns.desc = desc;

function DefaultFns() {}
function FnPair(get, set) {
  this.get = get;
  this.set = set;
}

function getReverse(array) {
  return array && array.slice().reverse();
}
function setReverse(values) {
  return {0: getReverse(values)};
}

function asc(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
function desc(a, b) {
  if (a > b) return -1;
  if (a < b) return 1;
  return 0;
}

},{}],38:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter;
var util = require('../util');
var Model = require('./Model');

// These events are re-emitted as 'all' events, and they are queued up and
// emitted in sequence, so that events generated by other events are not
// seen in a different order by later listeners
Model.MUTATOR_EVENTS = {
  change: true
, insert: true
, remove: true
, move: true
, load: true
, unload: true
};

Model.INITS.push(function(model) {
  EventEmitter.call(this);

  // Set max listeners to unlimited
  model.setMaxListeners(0);

  // Used in async methods to emit an error event if a callback is not supplied.
  // This will throw if there is no handler for model.on('error')
  model.root._defaultCallback = defaultCallback;
  function defaultCallback(err) {
    if (typeof err === 'string') err = new Error(err);
    if (err) model.emit('error', err);
  }

  model.root._mutatorEventQueue = null;
  model.root._pass = new Passed({}, {});
  model.root._silent = null;
  model.root._eventContext = null;
});

util.mergeInto(Model.prototype, EventEmitter.prototype);

Model.prototype.wrapCallback = function(cb) {
  if (!cb) return this.root._defaultCallback;
  var model = this;
  return function wrappedCallback() {
    try {
      return cb.apply(this, arguments);
    } catch (err) {
      model.emit('error', err);
    }
  };
};

Model.prototype._emitError = function(err, additionalMessage) {
  if (typeof additionalMessage !== 'string') {
    try {
      additionalMessage = JSON.stringify(additionalMessage);
    } catch (stringifyErr) {}
  }
  if (typeof err === 'string') {
    err = new Error(err + ' ' + additionalMessage);
  } else if (err instanceof Error) {
    err.message = err.message + ' ' + additionalMessage;
  } else {
    try {
      err = new Error(JSON.stringify(err) + ' ' + additionalMessage);
    } catch (stringifyErr) {}
  }
  this.emit('error', err);
};

// EventEmitter.prototype.on, EventEmitter.prototype.addListener, and
// EventEmitter.prototype.once return `this`. The Model equivalents return
// the listener instead, since it is made internally for method subscriptions
// and may need to be passed to removeListener.

Model.prototype._emit = EventEmitter.prototype.emit;
Model.prototype.emit = function(type) {
  if (type === 'error') {
    return this._emit.apply(this, arguments);
  }
  if (Model.MUTATOR_EVENTS[type]) {
    if (this._silent) return this;
    var segments = arguments[1];
    var eventArgs = arguments[2];
    this._emit(type + 'Immediate', segments, eventArgs);
    if (this.root._mutatorEventQueue) {
      this.root._mutatorEventQueue.push([type, segments, eventArgs]);
      return this;
    }
    this.root._mutatorEventQueue = [];
    this._emit(type, segments, eventArgs);
    this._emit('all', segments, [type].concat(eventArgs));
    while (this.root._mutatorEventQueue.length) {
      var queued = this.root._mutatorEventQueue.shift();
      type = queued[0];
      segments = queued[1];
      eventArgs = queued[2];
      this._emit(type, segments, eventArgs);
      this._emit('all', segments, [type].concat(eventArgs));
    }
    this.root._mutatorEventQueue = null;
    return this;
  }
  return this._emit.apply(this, arguments);
};

Model.prototype._on = EventEmitter.prototype.on;
Model.prototype.addListener =
Model.prototype.on = function(type, pattern, cb) {
  var listener = eventListener(this, pattern, cb);
  this._on(type, listener);
  return listener;
};

Model.prototype.once = function(type, pattern, cb) {
  var listener = eventListener(this, pattern, cb);
  function g() {
    var matches = listener.apply(null, arguments);
    if (matches) this.removeListener(type, g);
  }
  this._on(type, g);
  return g;
};

Model.prototype._removeAllListeners = EventEmitter.prototype.removeAllListeners;
Model.prototype.removeAllListeners = function(type, subpattern) {
  // If a pattern is specified without an event type, remove all model event
  // listeners under that pattern for all events
  if (!type) {
    for (var key in this._events) {
      this.removeAllListeners(key, subpattern);
    }
    return this;
  }

  var pattern = this.path(subpattern);
  // If no pattern is specified, remove all listeners like normal
  if (!pattern) {
    if (arguments.length === 0) {
      return this._removeAllListeners();
    } else {
      return this._removeAllListeners(type);
    }
  }

  // Remove all listeners for an event under a pattern
  var listeners = this.listeners(type);
  var segments = pattern.split('.');
  // Make sure to iterate in reverse, since the array might be
  // mutated as listeners are removed
  for (var i = listeners.length; i--;) {
    var listener = listeners[i];
    if (patternContained(pattern, segments, listener)) {
      this.removeListener(type, listener);
    }
  }
  return this;
};

function patternContained(pattern, segments, listener) {
  var listenerSegments = listener.patternSegments;
  if (!listenerSegments) return false;
  if (pattern === listener.pattern || pattern === '**') return true;
  var len = segments.length;
  if (len > listenerSegments.length) return false;
  for (var i = 0; i < len; i++) {
    if (segments[i] !== listenerSegments[i]) return false;
  }
  return true;
}

Model.prototype.pass = function(object, invert) {
  var model = this._child();
  model._pass = (invert) ?
    new Passed(object, this._pass) :
    new Passed(this._pass, object);
  return model;
};

function Passed(previous, value) {
  for (var key in previous) {
    this[key] = previous[key];
  }
  for (var key in value) {
    this[key] = value[key];
  }
}

/**
 * The returned Model will or won't trigger event handlers when the model emits
 * events, depending on `value`
 * @param {Boolean|Null} value defaults to true
 * @return {Model}
 */
Model.prototype.silent = function(value) {
  var model = this._child();
  model._silent = (value == null) ? true : value;
  return model;
};

Model.prototype.eventContext = function(value) {
  var model = this._child();
  model._eventContext = value;
  return model;
};

Model.prototype.removeContextListeners = function(value) {
  if (arguments.length === 0) {
    value = this._eventContext;
  }
  // Remove all events created within a given context
  for (var type in this._events) {
    var listeners = this.listeners(type);
    // Make sure to iterate in reverse, since the array might be
    // mutated as listeners are removed
    for (var i = listeners.length; i--;) {
      var listener = listeners[i];
      if (listener.eventContext === value) {
        this.removeListener(type, listener);
      }
    }
  }
  return this;
};

function eventListener(model, subpattern, cb) {
  if (cb) {
    // For signatures:
    // model.on('change', 'example.subpath', callback)
    // model.at('example').on('change', 'subpath', callback)
    var pattern = model.path(subpattern);
    return modelEventListener(pattern, cb, model._eventContext);
  }
  var path = model.path();
  cb = arguments[1];
  // For signature:
  // model.at('example').on('change', callback)
  if (path) return modelEventListener(path, cb, model._eventContext);
  // For signature:
  // model.on('normalEvent', callback)
  return cb;
}

function modelEventListener(pattern, cb, eventContext) {
  var patternSegments = util.castSegments(pattern.split('.'));
  var testFn = testPatternFn(pattern, patternSegments);

  function modelListener(segments, eventArgs) {
    var captures = testFn(segments);
    if (!captures) return;

    var args = (captures.length) ? captures.concat(eventArgs) : eventArgs;
    cb.apply(null, args);
    return true;
  }

  // Used in Model#removeAllListeners
  modelListener.pattern = pattern;
  modelListener.patternSegments = patternSegments;
  modelListener.eventContext = eventContext;

  return modelListener;
}

function testPatternFn(pattern, patternSegments) {
  if (pattern === '**') {
    return function testPattern(segments) {
      return [segments.join('.')];
    };
  }

  var endingRest = stripRestWildcard(patternSegments);

  return function testPattern(segments) {
    // Any pattern with more segments does not match
    var patternLen = patternSegments.length;
    if (patternLen > segments.length) return;

    // A pattern with the same number of segments matches if each
    // of the segments are wildcards or equal. A shorter pattern matches
    // if it ends in a rest wildcard and each of the corresponding
    // segments are wildcards or equal.
    if (patternLen === segments.length || endingRest) {
      var captures = [];
      for (var i = 0; i < patternLen; i++) {
        var patternSegment = patternSegments[i];
        var segment = segments[i];
        if (patternSegment === '*' || patternSegment === '**') {
          captures.push(segment);
          continue;
        }
        if (patternSegment !== segment) return;
      }
      if (endingRest) {
        var remainder = segments.slice(i).join('.');
        captures.push(remainder);
      }
      return captures;
    }
  };
}

function stripRestWildcard(segments) {
  // ['example', '**'] -> ['example']; return true
  var lastIndex = segments.length - 1;
  if (segments[lastIndex] === '**') {
    segments.pop();
    return true;
  }
  // ['example', 'subpath**'] -> ['example', 'subpath']; return true
  var match = /^([^\*]+)\*\*$/.exec(segments[lastIndex]);
  if (!match) return false;
  segments[lastIndex] = match[1];
  return true;
}

},{"../util":46,"./Model":34,"events":1}],39:[function(require,module,exports){
var util = require('../util');
var Model = require('./Model');
var defaultFns = require('./defaultFns');

Model.INITS.push(function(model) {
  model.root._filters = new Filters(model);
  model.on('all', filterListener);
  function filterListener(segments, eventArgs) {
    var pass = eventArgs[eventArgs.length - 1];
    var map = model.root._filters.fromMap;
    for (var path in map) {
      var filter = map[path];
      if (pass.$filter === filter) continue;
      if (
        util.mayImpact(filter.segments, segments) ||
        (filter.inputsSegments && util.mayImpactAny(filter.inputsSegments, segments))
      ) {
        filter.update(pass);
      }
    }
  }
});

function parseFilterArguments(model, args) {
  var fn = args.pop();
  var options;
  if (!model.isPath(args[args.length - 1])) {
    options = args.pop();
  }
  var path = model.path(args.shift());
  var i = args.length;
  while (i--) {
    args[i] = model.path(args[i]);
  }
  return {
    path: path,
    inputPaths: (args.length) ? args : null,
    options: options,
    fn: fn
  };
}

Model.prototype.filter = function() {
  var args = Array.prototype.slice.call(arguments);
  var parsed = parseFilterArguments(this, args);
  return this.root._filters.add(
    parsed.path,
    parsed.fn,
    null,
    parsed.inputPaths,
    parsed.options
  );
};

Model.prototype.sort = function() {
  var args = Array.prototype.slice.call(arguments);
  var parsed = parseFilterArguments(this, args);
  return this.root._filters.add(
    parsed.path,
    null,
    parsed.fn || 'asc',
    parsed.inputPaths,
    parsed.options
  );
};

Model.prototype.removeAllFilters = function(subpath) {
  var segments = this._splitPath(subpath);
  this._removeAllFilters(segments);
};
Model.prototype._removeAllFilters = function(segments) {
  var filters = this.root._filters.fromMap;
  for (var from in filters) {
    if (util.contains(segments, filters[from].fromSegments)) {
      filters[from].destroy();
    }
  }
};

function FromMap() {}
function Filters(model) {
  this.model = model;
  this.fromMap = new FromMap();
}

Filters.prototype.add = function(path, filterFn, sortFn, inputPaths, options) {
  return new Filter(this, path, filterFn, sortFn, inputPaths, options);
};

Filters.prototype.toJSON = function() {
  var out = [];
  for (var from in this.fromMap) {
    var filter = this.fromMap[from];
    // Don't try to bundle if functions were passed directly instead of by name
    if (!filter.bundle) continue;
    var args = [from, filter.path, filter.filterName, filter.sortName, filter.inputPaths];
    if (filter.options) args.push(filter.options);
    out.push(args);
  }
  return out;
};

function Filter(filters, path, filterFn, sortFn, inputPaths, options) {
  this.filters = filters;
  this.model = filters.model.pass({$filter: this});
  this.path = path;
  this.segments = path.split('.');
  this.filterName = null;
  this.sortName = null;
  this.bundle = true;
  this.filterFn = null;
  this.sortFn = null;
  this.inputPaths = inputPaths;
  this.inputsSegments = null;
  if (inputPaths) {
    this.inputsSegments = [];
    for (var i = 0; i < this.inputPaths.length; i++) {
      var segments = this.inputPaths[i].split('.');
      this.inputsSegments.push(segments);
    }
  }
  this.options = options;
  this.skip = options && options.skip;
  this.limit = options && options.limit;
  if (filterFn) this.filter(filterFn);
  if (sortFn) this.sort(sortFn);
  this.idsSegments = null;
  this.from = null;
  this.fromSegments = null;
}

Filter.prototype.filter = function(fn) {
  if (typeof fn === 'function') {
    this.filterFn = fn;
    this.bundle = false;
    return this;
  } else if (typeof fn === 'string') {
    this.filterName = fn;
    this.filterFn = this.model.root._namedFns[fn] || defaultFns[fn];
    if (!this.filterFn) {
      throw new TypeError('Filter function not found: ' + fn);
    }
  }
  return this;
};

Filter.prototype.sort = function(fn) {
  if (!fn) fn = 'asc';
  if (typeof fn === 'function') {
    this.sortFn = fn;
    this.bundle = false;
    return this;
  } else if (typeof fn === 'string') {
    this.sortName = fn;
    this.sortFn = this.model.root._namedFns[fn] || defaultFns[fn];
    if (!this.sortFn) {
      throw new TypeError('Sort function not found: ' + fn);
    }
  }
  return this;
};

Filter.prototype._slice = function(results) {
  if (this.skip == null && this.limit == null) return results;
  var begin = this.skip || 0;
  // A limit of zero is equivalent to setting no limit
  var end;
  if (this.limit) end = begin + this.limit;
  return results.slice(begin, end);
};

Filter.prototype.getInputs = function() {
  if (!this.inputsSegments) return;
  var inputs = [];
  for (var i = 0, len = this.inputsSegments.length; i < len; i++) {
    var input = this.model._get(this.inputsSegments[i]);
    inputs.push(input);
  }
  return inputs;
};

Filter.prototype.callFilter = function(items, key, inputs) {
  var item = items[key];
  return (inputs) ?
    this.filterFn.apply(this.model, [item, key, items].concat(inputs)) :
    this.filterFn.call(this.model, item, key, items);
};

Filter.prototype.ids = function() {
  var items = this.model._get(this.segments);
  var ids = [];
  if (!items) return ids;
  if (Array.isArray(items)) {
    throw new Error('model.filter is not currently supported on arrays');
  }
  if (this.filterFn) {
    var inputs = this.getInputs();
    for (var key in items) {
      if (items.hasOwnProperty(key) && this.callFilter(items, key, inputs)) {
        ids.push(key);
      }
    }
  } else {
    ids = Object.keys(items);
  }
  var sortFn = this.sortFn;
  if (sortFn) {
    ids.sort(function(a, b) {
      return sortFn(items[a], items[b]);
    });
  }
  return this._slice(ids);
};

Filter.prototype.get = function() {
  var items = this.model._get(this.segments);
  var results = [];
  if (Array.isArray(items)) {
    throw new Error('model.filter is not currently supported on arrays');
  }
  if (this.filterFn) {
    var inputs = this.getInputs();
    for (var key in items) {
      if (items.hasOwnProperty(key) && this.callFilter(items, key, inputs)) {
        results.push(items[key]);
      }
    }
  } else {
    for (var key in items) {
      if (items.hasOwnProperty(key)) {
        results.push(items[key]);
      }
    }
  }
  if (this.sortFn) results.sort(this.sortFn);
  return this._slice(results);
};

Filter.prototype.update = function(pass) {
  var ids = this.ids();
  this.model.pass(pass, true)._setArrayDiff(this.idsSegments, ids);
};

Filter.prototype.ref = function(from) {
  from = this.model.path(from);
  this.from = from;
  this.fromSegments = from.split('.');
  this.filters.fromMap[from] = this;
  this.idsSegments = ['$filters', from.replace(/\./g, '|')];
  this.update();
  return this.model.refList(from, this.path, this.idsSegments.join('.'));
};

Filter.prototype.destroy = function() {
  delete this.filters.fromMap[this.from];
  this.model._removeRef(this.idsSegments);
  this.model._del(this.idsSegments);
};

},{"../util":46,"./Model":34,"./defaultFns":37}],40:[function(require,module,exports){
var util = require('../util');
var Model = require('./Model');
var defaultFns = require('./defaultFns');

function NamedFns() {}

Model.INITS.push(function(model) {
  model.root._namedFns = new NamedFns();
  model.root._fns = new Fns(model);
  model.on('all', fnListener);
  function fnListener(segments, eventArgs) {
    var pass = eventArgs[eventArgs.length - 1];
    var map = model.root._fns.fromMap;
    for (var path in map) {
      var fn = map[path];
      if (pass.$fn === fn) continue;
      if (util.mayImpactAny(fn.inputsSegments, segments)) {
        // Mutation affecting input path
        fn.onInput(pass);
      } else if (util.mayImpact(fn.fromSegments, segments)) {
        // Mutation affecting output path
        fn.onOutput(pass);
      }
    }
  }
});

Model.prototype.fn = function(name, fns) {
  this.root._namedFns[name] = fns;
};

function parseStartArguments(model, args, hasPath) {
  var last = args.pop();
  var fns, name;
  if (typeof last === 'string') {
    name = last;
  } else {
    fns = last;
  }
  var path;
  if (hasPath) {
    path = model.path(args.shift());
  }
  var options;
  if (!model.isPath(args[args.length - 1])) {
    options = args.pop();
  }
  var i = args.length;
  while (i--) {
    args[i] = model.path(args[i]);
  }
  return {
    name: name
  , path: path
  , inputPaths: args
  , fns: fns
  , options: options
  };
}

Model.prototype.evaluate = function() {
  var args = Array.prototype.slice.call(arguments);
  var parsed = parseStartArguments(this, args, false);
  return this.root._fns.get(parsed.name, parsed.inputPaths, parsed.fns, parsed.options);
};

Model.prototype.start = function() {
  var args = Array.prototype.slice.call(arguments);
  var parsed = parseStartArguments(this, args, true);
  return this.root._fns.start(parsed.name, parsed.path, parsed.inputPaths, parsed.fns, parsed.options);
};

Model.prototype.stop = function(subpath) {
  var path = this.path(subpath);
  this._stop(path);
};
Model.prototype._stop = function(fromPath) {
  this.root._fns.stop(fromPath);
};

Model.prototype.stopAll = function(subpath) {
  var segments = this._splitPath(subpath);
  this._stopAll(segments);
};
Model.prototype._stopAll = function(segments) {
  var fns = this.root._fns.fromMap;
  for (var from in fns) {
    var fromSegments = fns[from].fromSegments;
    if (util.contains(segments, fromSegments)) {
      this._stop(from);
    }
  }
};

function FromMap() {}
function Fns(model) {
  this.model = model;
  this.nameMap = model.root._namedFns;
  this.fromMap = new FromMap();
}

Fns.prototype.get = function(name, inputPaths, fns, options) {
  fns || (fns = this.nameMap[name] || defaultFns[name]);
  var fn = new Fn(this.model, name, null, inputPaths, fns, options);
  return fn.get();
};

Fns.prototype.start = function(name, path, inputPaths, fns, options) {
  fns || (fns = this.nameMap[name] || defaultFns[name]);
  var fn = new Fn(this.model, name, path, inputPaths, fns, options);
  this.fromMap[path] = fn;
  return fn.onInput();
};

Fns.prototype.stop = function(path) {
  var fn = this.fromMap[path];
  delete this.fromMap[path];
  return fn;
};

Fns.prototype.toJSON = function() {
  var out = [];
  for (var from in this.fromMap) {
    var fn = this.fromMap[from];
    // Don't try to bundle non-named functions that were started via
    // model.start directly instead of by name
    if (!fn.name) continue;
    var args = [fn.from].concat(fn.inputPaths);
    if (fn.options) args.push(fn.options);
    args.push(fn.name);
    out.push(args);
  }
  return out;
};

function Fn(model, name, from, inputPaths, fns, options) {
  this.model = model.pass({$fn: this});
  this.name = name;
  this.from = from;
  this.inputPaths = inputPaths;
  this.options = options;
  if (!fns) {
    throw new TypeError('Model function not found: ' + name);
  }
  this.getFn = fns.get || fns;
  this.setFn = fns.set;
  this.fromSegments = from && from.split('.');
  this.inputsSegments = [];
  for (var i = 0; i < this.inputPaths.length; i++) {
    var segments = this.inputPaths[i].split('.');
    this.inputsSegments.push(segments);
  }

  // Copy can be 'output', 'input', 'both', or 'none'
  var copy = (options && options.copy) || 'output';
  this.copyInput = (copy === 'input' || copy === 'both');
  this.copyOutput = (copy === 'output' || copy === 'both');

  // Mode can be 'diffDeep', 'diff', 'arrayDeep', or 'array'
  this.mode = (options && options.mode) || 'diffDeep';
}

Fn.prototype.apply = function(fn, inputs) {
  for (var i = 0, len = this.inputsSegments.length; i < len; i++) {
    var input = this.model._get(this.inputsSegments[i]);
    inputs.push(this.copyInput ? util.deepCopy(input) : input);
  }
  return fn.apply(this.model, inputs);
};

Fn.prototype.get = function() {
  return this.apply(this.getFn, []);
};

Fn.prototype.set = function(value, pass) {
  if (!this.setFn) return;
  var out = this.apply(this.setFn, [value]);
  if (!out) return;
  var inputsSegments = this.inputsSegments;
  var model = this.model.pass(pass, true);
  for (var key in out) {
    var value = (this.copyOutput) ? util.deepCopy(out[key]) : out[key];
    this._setValue(model, inputsSegments[key], value);
  }
};

Fn.prototype.onInput = function(pass) {
  var value = (this.copyOutput) ? util.deepCopy(this.get()) : this.get();
  this._setValue(this.model.pass(pass, true), this.fromSegments, value);
  return value;
};

Fn.prototype.onOutput = function(pass) {
  var value = this.model._get(this.fromSegments);
  return this.set(value, pass);
};

Fn.prototype._setValue = function(model, segments, value) {
  if (this.mode === 'diffDeep') {
    model._setDiffDeep(segments, value);
  } else if (this.mode === 'arrayDeep') {
    model._setArrayDiffDeep(segments, value);
  } else if (this.mode === 'array') {
    model._setArrayDiff(segments, value);
  } else {
    model._setDiff(segments, value);
  }
};

},{"../util":46,"./Model":34,"./defaultFns":37}],41:[function(require,module,exports){
var util = require('../util');
var Model = require('./Model');

Model.prototype._mutate = function(segments, fn, cb) {
  cb = this.wrapCallback(cb);
  var collectionName = segments[0];
  var id = segments[1];
  if (!collectionName || !id) {
    var message = fn.name + ' must be performed under a collection ' +
      'and document id. Invalid path: ' + segments.join('.');
    return cb(new Error(message));
  }
  var doc = this.getOrCreateDoc(collectionName, id);
  var docSegments = segments.slice(2);
  return fn(doc, docSegments, cb);
};

Model.prototype.set = function() {
  var subpath, value, cb;
  if (arguments.length === 1) {
    value = arguments[0];
  } else if (arguments.length === 2) {
    subpath = arguments[0];
    value = arguments[1];
  } else {
    subpath = arguments[0];
    value = arguments[1];
    cb = arguments[2];
  }
  var segments = this._splitPath(subpath);
  return this._set(segments, value, cb);
};
Model.prototype._set = function(segments, value, cb) {
  segments = this._dereference(segments);
  var model = this;
  function set(doc, docSegments, fnCb) {
    var previous = doc.set(docSegments, value, fnCb);
    // On setting the entire doc, remote docs sometimes do a copy to add the
    // id without it being stored in the database by ShareJS
    if (docSegments.length === 0) value = doc.get(docSegments);
    model.emit('change', segments, [value, previous, model._pass]);
    return previous;
  }
  return this._mutate(segments, set, cb);
};

Model.prototype.setEach = function() {
  var subpath, object, cb;
  if (arguments.length === 1) {
    object = arguments[0];
  } else if (arguments.length === 2) {
    subpath = arguments[0];
    object = arguments[1];
  } else {
    subpath = arguments[0];
    object = arguments[1];
    cb = arguments[2];
  }
  var segments = this._splitPath(subpath);
  return this._setEach(segments, object, cb);
};
Model.prototype._setEach = function(segments, object, cb) {
  segments = this._dereference(segments);
  var group = util.asyncGroup(this.wrapCallback(cb));
  for (var key in object) {
    var value = object[key];
    this._set(segments.concat(key), value, group());
  }
};

Model.prototype.add = function() {
  var subpath, value, cb;
  if (arguments.length === 1) {
    value = arguments[0];
  } else if (arguments.length === 2) {
    if (typeof arguments[1] === 'function') {
      value = arguments[0];
      cb = arguments[1];
    } else {
      subpath = arguments[0];
      value = arguments[1];
    }
  } else {
    subpath = arguments[0];
    value = arguments[1];
    cb = arguments[2];
  }
  var segments = this._splitPath(subpath);
  return this._add(segments, value, cb);
};
Model.prototype._add = function(segments, value, cb) {
  if (typeof value !== 'object') {
    var message = 'add requires an object value. Invalid value: ' + value;
    cb = this.wrapCallback(cb);
    return cb(new Error(message));
  }
  var id = value.id || this.id();
  value.id = id;
  segments = this._dereference(segments.concat(id));
  var model = this;
  function add(doc, docSegments, fnCb) {
    var previous;
    if (docSegments.length) {
      previous = doc.set(docSegments, value, fnCb);
    } else {
      doc.create(value, fnCb);
      // On creating the doc, remote docs do a copy to add the id without
      // it being stored in the database by ShareJS
      value = doc.get(docSegments);
    }
    model.emit('change', segments, [value, previous, model._pass]);
  }
  this._mutate(segments, add, cb);
  return id;
};

Model.prototype.setNull = function() {
  var subpath, value, cb;
  if (arguments.length === 1) {
    value = arguments[0];
  } else if (arguments.length === 2) {
    subpath = arguments[0];
    value = arguments[1];
  } else {
    subpath = arguments[0];
    value = arguments[1];
    cb = arguments[2];
  }
  var segments = this._splitPath(subpath);
  return this._setNull(segments, value, cb);
};
Model.prototype._setNull = function(segments, value, cb) {
  segments = this._dereference(segments);
  var model = this;
  function setNull(doc, docSegments, fnCb) {
    var previous = doc.get(docSegments);
    if (previous != null) {
      fnCb();
      return previous;
    }
    doc.set(docSegments, value, fnCb);
    model.emit('change', segments, [value, previous, model._pass]);
    return value;
  }
  return this._mutate(segments, setNull, cb);
};

Model.prototype.del = function() {
  var subpath, cb;
  if (arguments.length === 1) {
    if (typeof arguments[0] === 'function') {
      cb = arguments[0];
    } else {
      subpath = arguments[0];
    }
  } else {
    subpath = arguments[0];
    cb = arguments[1];
  }
  var segments = this._splitPath(subpath);
  return this._del(segments, cb);
};
Model.prototype._del = function(segments, cb) {
  segments = this._dereference(segments);
  var model = this;
  function del(doc, docSegments, fnCb) {
    var previous = doc.del(docSegments, fnCb);
    // When deleting an entire document, also remove the reference to the
    // document object from its collection
    if (segments.length === 2) {
      var collectionName = segments[0];
      var id = segments[1];
      model.root.collections[collectionName].remove(id);
    }
    model.emit('change', segments, [void 0, previous, model._pass]);
    return previous;
  }
  return this._mutate(segments, del, cb);
};

Model.prototype.increment = function() {
  var subpath, byNumber, cb;
  if (arguments.length === 1) {
    if (typeof arguments[0] === 'function') {
      cb = arguments[0];
    } else if (typeof arguments[0] === 'number') {
      byNumber = arguments[0];
    } else {
      subpath = arguments[0];
    }
  } else if (arguments.length === 2) {
    if (typeof arguments[1] === 'function') {
      cb = arguments[1];
      if (typeof arguments[0] === 'number') {
        byNumber = arguments[0];
      } else {
        subpath = arguments[0];
      }
    } else {
      subpath = arguments[0];
      byNumber = arguments[1];
    }
  } else {
    subpath = arguments[0];
    byNumber = arguments[1];
    cb = arguments[2];
  }
  var segments = this._splitPath(subpath);
  return this._increment(segments, byNumber, cb);
};
Model.prototype._increment = function(segments, byNumber, cb) {
  segments = this._dereference(segments);
  if (byNumber == null) byNumber = 1;
  var model = this;
  function increment(doc, docSegments, fnCb) {
    var value = doc.increment(docSegments, byNumber, fnCb);
    var previous = value - byNumber;
    model.emit('change', segments, [value, previous, model._pass]);
    return value;
  }
  return this._mutate(segments, increment, cb);
};

Model.prototype.push = function() {
  var subpath, value, cb;
  if (arguments.length === 1) {
    value = arguments[0];
  } else if (arguments.length === 2) {
    subpath = arguments[0];
    value = arguments[1];
  } else {
    subpath = arguments[0];
    value = arguments[1];
    cb = arguments[2];
  }
  var segments = this._splitPath(subpath);
  return this._push(segments, value, cb);
};
Model.prototype._push = function(segments, value, cb) {
  var forArrayMutator = true;
  segments = this._dereference(segments, forArrayMutator);
  var model = this;
  function push(doc, docSegments, fnCb) {
    var length = doc.push(docSegments, value, fnCb);
    model.emit('insert', segments, [length - 1, [value], model._pass]);
    return length;
  }
  return this._mutate(segments, push, cb);
};

Model.prototype.unshift = function() {
  var subpath, value, cb;
  if (arguments.length === 1) {
    value = arguments[0];
  } else if (arguments.length === 2) {
    subpath = arguments[0];
    value = arguments[1];
  } else {
    subpath = arguments[0];
    value = arguments[1];
    cb = arguments[2];
  }
  var segments = this._splitPath(subpath);
  return this._unshift(segments, value, cb);
};
Model.prototype._unshift = function(segments, value, cb) {
  var forArrayMutator = true;
  segments = this._dereference(segments, forArrayMutator);
  var model = this;
  function unshift(doc, docSegments, fnCb) {
    var length = doc.unshift(docSegments, value, fnCb);
    model.emit('insert', segments, [0, [value], model._pass]);
    return length;
  }
  return this._mutate(segments, unshift, cb);
};

Model.prototype.insert = function() {
  var subpath, index, values, cb;
  if (arguments.length === 1) {
    throw new Error('Not enough arguments for insert');
  } else if (arguments.length === 2) {
    index = arguments[0];
    values = arguments[1];
  } else if (arguments.length === 3) {
    subpath = arguments[0];
    index = arguments[1];
    values = arguments[2];
  } else {
    subpath = arguments[0];
    index = arguments[1];
    values = arguments[2];
    cb = arguments[3];
  }
  var segments = this._splitPath(subpath);
  return this._insert(segments, +index, values, cb);
};
Model.prototype._insert = function(segments, index, values, cb) {
  var forArrayMutator = true;
  segments = this._dereference(segments, forArrayMutator);
  var model = this;
  function insert(doc, docSegments, fnCb) {
    var inserted = (Array.isArray(values)) ? values : [values];
    var length = doc.insert(docSegments, index, inserted, fnCb);
    model.emit('insert', segments, [index, inserted, model._pass]);
    return length;
  }
  return this._mutate(segments, insert, cb);
};

Model.prototype.pop = function() {
  var subpath, cb;
  if (arguments.length === 1) {
    if (typeof arguments[0] === 'function') {
      cb = arguments[0];
    } else {
      subpath = arguments[0];
    }
  } else {
    subpath = arguments[0];
    cb = arguments[1];
  }
  var segments = this._splitPath(subpath);
  return this._pop(segments, cb);
};
Model.prototype._pop = function(segments, cb) {
  var forArrayMutator = true;
  segments = this._dereference(segments, forArrayMutator);
  var model = this;
  function pop(doc, docSegments, fnCb) {
    var arr = doc.get(docSegments);
    var length = arr && arr.length;
    if (!length) {
      fnCb();
      return;
    }
    var value = doc.pop(docSegments, fnCb);
    model.emit('remove', segments, [length - 1, [value], model._pass]);
    return value;
  }
  return this._mutate(segments, pop, cb);
};

Model.prototype.shift = function() {
  var subpath, cb;
  if (arguments.length === 1) {
    if (typeof arguments[0] === 'function') {
      cb = arguments[0];
    } else {
      subpath = arguments[0];
    }
  } else {
    subpath = arguments[0];
    cb = arguments[1];
  }
  var segments = this._splitPath(subpath);
  return this._shift(segments, cb);
};
Model.prototype._shift = function(segments, cb) {
  var forArrayMutator = true;
  segments = this._dereference(segments, forArrayMutator);
  var model = this;
  function shift(doc, docSegments, fnCb) {
    var arr = doc.get(docSegments);
    var length = arr && arr.length;
    if (!length) {
      fnCb();
      return;
    }
    var value = doc.shift(docSegments, fnCb);
    model.emit('remove', segments, [0, [value], model._pass]);
    return value;
  }
  return this._mutate(segments, shift, cb);
};

Model.prototype.remove = function() {
  var subpath, index, howMany, cb;
  if (arguments.length === 1) {
    index = arguments[0];
  } else if (arguments.length === 2) {
    if (typeof arguments[1] === 'function') {
      cb = arguments[1];
      if (typeof arguments[0] === 'number') {
        index = arguments[0];
      } else {
        subpath = arguments[0];
      }
    } else {
      if (typeof arguments[0] === 'number') {
        index = arguments[0];
        howMany = arguments[1];
      } else {
        subpath = arguments[0];
        index = arguments[1];
      }
    }
  } else if (arguments.length === 3) {
    if (typeof arguments[2] === 'function') {
      cb = arguments[2];
      if (typeof arguments[0] === 'number') {
        index = arguments[0];
        howMany = arguments[1];
      } else {
        subpath = arguments[0];
        index = arguments[1];
      }
    } else {
      subpath = arguments[0];
      index = arguments[1];
      howMany = arguments[2];
    }
  } else {
    subpath = arguments[0];
    index = arguments[1];
    howMany = arguments[2];
    cb = arguments[3];
  }
  var segments = this._splitPath(subpath);
  if (index == null) index = segments.pop();
  return this._remove(segments, +index, howMany, cb);
};
Model.prototype._remove = function(segments, index, howMany, cb) {
  var forArrayMutator = true;
  segments = this._dereference(segments, forArrayMutator);
  if (howMany == null) howMany = 1;
  var model = this;
  function remove(doc, docSegments, fnCb) {
    var removed = doc.remove(docSegments, index, howMany, fnCb);
    model.emit('remove', segments, [index, removed, model._pass]);
    return removed;
  }
  return this._mutate(segments, remove, cb);
};

Model.prototype.move = function() {
  var subpath, from, to, howMany, cb;
  if (arguments.length === 1) {
    throw new Error('Not enough arguments for move');
  } else if (arguments.length === 2) {
    from = arguments[0];
    to = arguments[1];
  } else if (arguments.length === 3) {
    if (typeof arguments[2] === 'function') {
      from = arguments[0];
      to = arguments[1];
      cb = arguments[2];
    } else if (typeof arguments[0] === 'number') {
      from = arguments[0];
      to = arguments[1];
      howMany = arguments[2];
    } else {
      subpath = arguments[0];
      from = arguments[1];
      to = arguments[2];
    }
  } else if (arguments.length === 4) {
    if (typeof arguments[3] === 'function') {
      cb = arguments[3];
      if (typeof arguments[0] === 'number') {
        from = arguments[0];
        to = arguments[1];
        howMany = arguments[2];
      } else {
        subpath = arguments[0];
        from = arguments[1];
        to = arguments[2];
      }
    } else {
      subpath = arguments[0];
      from = arguments[1];
      to = arguments[2];
      howMany = arguments[3];
    }
  } else {
    subpath = arguments[0];
    from = arguments[1];
    to = arguments[2];
    howMany = arguments[3];
    cb = arguments[4];
  }
  var segments = this._splitPath(subpath);
  return this._move(segments, from, to, howMany, cb);
};
Model.prototype._move = function(segments, from, to, howMany, cb) {
  var forArrayMutator = true;
  segments = this._dereference(segments, forArrayMutator);
  if (howMany == null) howMany = 1;
  var model = this;
  function move(doc, docSegments, fnCb) {
    // Cast to numbers
    from = +from;
    to = +to;
    // Convert negative indices into positive
    if (from < 0 || to < 0) {
      var len = doc.get(docSegments).length;
      if (from < 0) from += len;
      if (to < 0) to += len;
    }
    var moved = doc.move(docSegments, from, to, howMany, fnCb);
    model.emit('move', segments, [from, to, moved.length, model._pass]);
    return moved;
  }
  return this._mutate(segments, move, cb);
};

Model.prototype.stringInsert = function() {
  var subpath, index, text, cb;
  if (arguments.length === 1) {
    throw new Error('Not enough arguments for stringInsert');
  } else if (arguments.length === 2) {
    index = arguments[0];
    text = arguments[1];
  } else if (arguments.length === 3) {
    if (typeof arguments[2] === 'function') {
      index = arguments[0];
      text = arguments[1];
      cb = arguments[2];
    } else {
      subpath = arguments[0];
      index = arguments[1];
      text = arguments[2];
    }
  } else {
    subpath = arguments[0];
    index = arguments[1];
    text = arguments[2];
    cb = arguments[3];
  }
  var segments = this._splitPath(subpath);
  return this._stringInsert(segments, index, text, cb);
};
Model.prototype._stringInsert = function(segments, index, text, cb) {
  segments = this._dereference(segments);
  var model = this;
  function stringInsert(doc, docSegments, fnCb) {
    var previous = doc.stringInsert(docSegments, index, text, fnCb);
    var value = doc.get(docSegments);
    var pass = model.pass({$stringInsert: {index: index, text: text}})._pass;
    model.emit('change', segments, [value, previous, pass]);
    return;
  }
  return this._mutate(segments, stringInsert, cb);
};

Model.prototype.stringRemove = function() {
  var subpath, index, howMany, cb;
  if (arguments.length === 1) {
    throw new Error('Not enough arguments for stringRemove');
  } else if (arguments.length === 2) {
    index = arguments[0];
    howMany = arguments[1];
  } else if (arguments.length === 3) {
    if (typeof arguments[2] === 'function') {
      index = arguments[0];
      howMany = arguments[1];
      cb = arguments[2];
    } else {
      subpath = arguments[0];
      index = arguments[1];
      howMany = arguments[2];
    }
  } else {
    subpath = arguments[0];
    index = arguments[1];
    howMany = arguments[2];
    cb = arguments[3];
  }
  var segments = this._splitPath(subpath);
  return this._stringRemove(segments, index, howMany, cb);
};
Model.prototype._stringRemove = function(segments, index, howMany, cb) {
  segments = this._dereference(segments);
  var model = this;
  function stringRemove(doc, docSegments, fnCb) {
    var previous = doc.stringRemove(docSegments, index, howMany, fnCb);
    var value = doc.get(docSegments);
    var pass = model.pass({$stringRemove: {index: index, howMany: howMany}})._pass;
    model.emit('change', segments, [value, previous, pass]);
    return;
  }
  return this._mutate(segments, stringRemove, cb);
};

},{"../util":46,"./Model":34}],42:[function(require,module,exports){
var Model = require('./Model');

exports.mixin = {};

Model.prototype._splitPath = function(subpath) {
  var path = this.path(subpath);
  return (path && path.split('.')) || [];
};

/**
 * Returns the path equivalent to the path of the current scoped model plus
 * (optionally) a suffix subpath
 *
 * @optional @param {String} subpath
 * @return {String} absolute path
 * @api public
 */
Model.prototype.path = function(subpath) {
  if (subpath == null || subpath === '') return (this._at) ? this._at : '';
  if (typeof subpath === 'string' || typeof subpath === 'number') {
    return (this._at) ? this._at + '.' + subpath : '' + subpath;
  }
  if (typeof subpath.path === 'function') return subpath.path();
};

Model.prototype.isPath = function(subpath) {
  return this.path(subpath) != null;
};

Model.prototype.scope = function(path) {
  var model = this._child();
  model._at = path;
  return model;
};

/**
 * Create a model object scoped to a particular path.
 * Example:
 *     var user = model.at('users.1');
 *     user.set('username', 'brian');
 *     user.on('push', 'todos', function(todo) {
 *       // ...
 *     });
 *
 *  @param {String} segment
 *  @return {Model} a scoped model
 *  @api public
 */
Model.prototype.at = function(subpath) {
  var path = this.path(subpath);
  return this.scope(path);
};

/**
 * Returns a model scope that is a number of levels above the current scoped
 * path. Number of levels defaults to 1, so this method called without
 * arguments returns the model scope's parent model scope.
 *
 * @optional @param {Number} levels
 * @return {Model} a scoped model
 */
Model.prototype.parent = function(levels) {
  if (levels == null) levels = 1;
  var segments = this._splitPath();
  var len = Math.max(0, segments.length - levels);
  var path = segments.slice(0, len).join('.');
  return this.scope(path);
};

/**
 * Returns the last property segment of the current model scope path
 *
 * @optional @param {String} path
 * @return {String}
 */
Model.prototype.leaf = function(path) {
  if (!path) path = this.path();
  var i = path.lastIndexOf('.');
  return path.slice(i + 1);
};

},{"./Model":34}],43:[function(require,module,exports){
var util = require('../util');
var Model = require('./Model');

Model.INITS.push(function(model) {
  var root = model.root;
  root._refs = new Refs();
  addIndexListeners(root);
  addListener(root, 'change', refChange);
  addListener(root, 'load', refLoad);
  addListener(root, 'unload', refUnload);
  addListener(root, 'insert', refInsert);
  addListener(root, 'remove', refRemove);
  addListener(root, 'move', refMove);
});

function addIndexListeners(model) {
  model.on('insertImmediate', function refInsertIndex(segments, eventArgs) {
    var index = eventArgs[0];
    var howMany = eventArgs[1].length;
    function patchInsert(refIndex) {
      return (index <= refIndex) ? refIndex + howMany : refIndex;
    }
    onIndexChange(segments, patchInsert);
  });
  model.on('removeImmediate', function refRemoveIndex(segments, eventArgs) {
    var index = eventArgs[0];
    var howMany = eventArgs[1].length;
    function patchRemove(refIndex) {
      return (index <= refIndex) ? refIndex - howMany : refIndex;
    }
    onIndexChange(segments, patchRemove);
  });
  model.on('moveImmediate', function refMoveIndex(segments, eventArgs) {
    var from = eventArgs[0];
    var to = eventArgs[1];
    var howMany = eventArgs[2];
    function patchMove(refIndex) {
      // If the index was moved itself
      if (from <= refIndex && refIndex < from + howMany) {
        return refIndex + to - from;
      }
      // Remove part of a move
      if (from <= refIndex) refIndex -= howMany;
      // Insert part of a move
      if (to <= refIndex) refIndex += howMany;
      return refIndex;
    }
    onIndexChange(segments, patchMove);
  });
  function onIndexChange(segments, patch) {
    var fromMap = model._refs.fromMap;
    for (var from in fromMap) {
      var ref = fromMap[from];
      if (!(ref.updateIndices &&
        util.contains(segments, ref.toSegments) &&
        ref.toSegments.length > segments.length)) continue;
      var index = +ref.toSegments[segments.length];
      var patched = patch(index);
      if (index === patched) continue;
      model._refs.remove(from);
      ref.toSegments[segments.length] = '' + patched;
      ref.to = ref.toSegments.join('.');
      model._refs.add(ref);
    }
  }
}

function refChange(model, dereferenced, eventArgs, segments) {
  var value = eventArgs[0];
  var pass = eventArgs[2];
  // Detect if we are deleting vs. setting to undefined
  if (value === void 0) {
    var parentSegments = segments.slice();
    var last = parentSegments.pop();
    var parent = model._get(parentSegments);
    if (!parent || !(last in parent)) {
      model._del(dereferenced);
      return;
    }
  }
  model._set(dereferenced, value);
}
function refLoad(model, dereferenced, eventArgs) {
  var value = eventArgs[0];
  model._set(dereferenced, value);
}
function refUnload(model, dereferenced, eventArgs) {
  model._del(dereferenced);
}
function refInsert(model, dereferenced, eventArgs) {
  var index = eventArgs[0];
  var values = eventArgs[1];
  model._insert(dereferenced, index, values);
}
function refRemove(model, dereferenced, eventArgs) {
  var index = eventArgs[0];
  var howMany = eventArgs[1].length;
  model._remove(dereferenced, index, howMany);
}
function refMove(model, dereferenced, eventArgs) {
  var from = eventArgs[0];
  var to = eventArgs[1];
  var howMany = eventArgs[2];
  model._move(dereferenced, from, to, howMany);
}

function addListener(model, type, fn) {
  model.on(type + 'Immediate', refListener);
  function refListener(segments, eventArgs) {
    var pass = eventArgs[eventArgs.length - 1];
    // Find cases where an event is emitted on a path where a reference
    // is pointing. All original mutations happen on the fully dereferenced
    // location, so this detection only needs to happen in one direction
    var toMap = model._refs.toMap;
    var subpath;
    for (var i = 0, len = segments.length; i < len; i++) {
      subpath = (subpath) ? subpath + '.' + segments[i] : segments[i];
      // If a ref is found pointing to a matching subpath, re-emit on the
      // place where the reference is coming from as if the mutation also
      // occured at that path
      var refs = toMap[subpath];
      if (!refs) continue;
      var remaining = segments.slice(i + 1);
      for (var refIndex = 0, numRefs = refs.length; refIndex < numRefs; refIndex++) {
        var ref = refs[refIndex];
        var dereferenced = ref.fromSegments.concat(remaining);
        // The value may already be up to date via object reference. If so,
        // simply re-emit the event. Otherwise, perform the same mutation on
        // the ref's path
        if (model._get(dereferenced) === model._get(segments)) {
          model.emit(type, dereferenced, eventArgs);
        } else {
          var setterModel = ref.model.pass(pass, true);
          setterModel._dereference = noopDereference;
          fn(setterModel, dereferenced, eventArgs, segments);
        }
      }
    }
    // If a ref points to a child of a matching subpath, get the value in
    // case it has changed and set if different
    var parentToMap = model._refs.parentToMap;
    var refs = parentToMap[subpath];
    if (!refs) return;
    for (var refIndex = 0, numRefs = refs.length; refIndex < numRefs; refIndex++) {
      var ref = refs[refIndex];
      var value = model._get(ref.toSegments);
      var previous = model._get(ref.fromSegments);
      if (previous !== value) {
        var setterModel = ref.model.pass(pass, true);
        setterModel._dereference = noopDereference;
        setterModel._set(ref.fromSegments, value);
      }
    }
  }
}

Model.prototype._canRefTo = function(value) {
  return this.isPath(value) || (value && typeof value.ref === 'function');
};

Model.prototype.ref = function() {
  var from, to, options;
  if (arguments.length === 1) {
    to = arguments[0];
  } else if (arguments.length === 2) {
    if (this._canRefTo(arguments[1])) {
      from = arguments[0];
      to = arguments[1];
    } else {
      to = arguments[0];
      options = arguments[1];
    }
  } else {
    from = arguments[0];
    to = arguments[1];
    options = arguments[2];
  }
  var fromPath = this.path(from);
  var toPath = this.path(to);
  // Make ref to reffable object, such as query or filter
  if (!toPath) return to.ref(fromPath);
  var ref = new Ref(this.root, fromPath, toPath, options);
  if (ref.fromSegments.length < 2) {
    throw new Error('ref must be performed under a collection ' +
      'and document id. Invalid path: ' + fromPath);
  }
  this.root._refs.remove(fromPath);
  this.root._refLists.remove(fromPath);
  var value = this.get(to);
  ref.model._set(ref.fromSegments, value);
  this.root._refs.add(ref);
  return this.scope(fromPath);
};

Model.prototype.removeRef = function(subpath) {
  var segments = this._splitPath(subpath);
  var fromPath = segments.join('.');
  this._removeRef(segments, fromPath);
};
Model.prototype._removeRef = function(segments, fromPath) {
  this.root._refs.remove(fromPath);
  this.root._refLists.remove(fromPath);
  this._del(segments);
};

Model.prototype.removeAllRefs = function(subpath) {
  var segments = this._splitPath(subpath);
  this._removeAllRefs(segments);
};
Model.prototype._removeAllRefs = function(segments) {
  this._removeMapRefs(segments, this.root._refs.fromMap);
  this._removeMapRefs(segments, this.root._refLists.fromMap);
};
Model.prototype._removeMapRefs = function(segments, map) {
  for (var from in map) {
    var fromSegments = map[from].fromSegments;
    if (util.contains(segments, fromSegments)) {
      this._removeRef(fromSegments, from);
    }
  }
};

Model.prototype.dereference = function(subpath) {
  var segments = this._splitPath(subpath);
  return this._dereference(segments).join('.');
};

Model.prototype._dereference = function(segments, forArrayMutator, ignore) {
  if (segments.length === 0) return segments;
  var refs = this.root._refs.fromMap;
  var refLists = this.root._refLists.fromMap;
  var doAgain;
  do {
    var subpath = '';
    doAgain = false;
    for (var i = 0, len = segments.length; i < len; i++) {
      subpath = (subpath) ? subpath + '.' + segments[i] : segments[i];

      var ref = refs[subpath];
      if (ref) {
        var remaining = segments.slice(i + 1);
        segments = ref.toSegments.concat(remaining);
        doAgain = true;
        break;
      }

      var refList = refLists[subpath];
      if (refList && refList !== ignore) {
        var belowDescendant = i + 2 < len;
        var belowChild = i + 1 < len;
        if (!(belowDescendant || forArrayMutator && belowChild)) continue;
        segments = refList.dereference(segments, i);
        doAgain = true;
        break;
      }
    }
  } while (doAgain);
  // If a dereference fails, return a path that will result in a null value
  // instead of a path to everything in the model
  if (segments.length === 0) return ['$null'];
  return segments;
};

function noopDereference(segments) {
  return segments;
}

function Ref(model, from, to, options) {
  this.model = model && model.pass({$ref: this});
  this.from = from;
  this.to = to;
  this.fromSegments = from.split('.');
  this.toSegments = to.split('.');
  this.parentTos = [];
  for (var i = 1, len = this.toSegments.length; i < len; i++) {
    var parentTo = this.toSegments.slice(0, i).join('.');
    this.parentTos.push(parentTo);
  }
  this.updateIndices = options && options.updateIndices;
}
function FromMap() {}
function ToMap() {}

function Refs() {
  this.fromMap = new FromMap();
  this.toMap = new ToMap();
  this.parentToMap = new ToMap();
}

Refs.prototype.add = function(ref) {
  this.fromMap[ref.from] = ref;
  listMapAdd(this.toMap, ref.to, ref);
  for (var i = 0, len = ref.parentTos.length; i < len; i++) {
    listMapAdd(this.parentToMap, ref.parentTos[i], ref);
  }
};

Refs.prototype.remove = function(from) {
  var ref = this.fromMap[from];
  if (!ref) return;
  delete this.fromMap[from];
  listMapRemove(this.toMap, ref.to, ref);
  for (var i = 0, len = ref.parentTos.length; i < len; i++) {
    listMapRemove(this.parentToMap, ref.parentTos[i], ref);
  }
  return ref;
};

Refs.prototype.toJSON = function() {
  var out = [];
  for (var from in this.fromMap) {
    var ref = this.fromMap[from];
    out.push([ref.from, ref.to]);
  }
  return out;
};

function listMapAdd(map, name, item) {
  map[name] || (map[name] = []);
  map[name].push(item);
}

function listMapRemove(map, name, item) {
  var items = map[name];
  if (!items) return;
  var index = items.indexOf(item);
  if (index === -1) return;
  items.splice(index, 1);
  if (!items.length) delete map[name];
}

},{"../util":46,"./Model":34}],44:[function(require,module,exports){
var util = require('../util');
var Model = require('./Model');

Model.INITS.push(function(model) {
  var root = model.root;
  root._refLists = new RefLists();
  for (var type in Model.MUTATOR_EVENTS) {
    addListener(root, type);
  }
});

function addListener(model, type) {
  model.on(type + 'Immediate', refListListener);
  function refListListener(segments, eventArgs) {
    var pass = eventArgs[eventArgs.length - 1];
    // Check for updates on or underneath paths
    var fromMap = model._refLists.fromMap;
    for (var from in fromMap) {
      var refList = fromMap[from];
      if (pass.$refList === refList) continue;
      refList.onMutation(type, segments, eventArgs);
    }
  }
}

/**
 * @param {String} type
 * @param {Array} segments
 * @param {Array} eventArgs
 * @param {RefList} refList
 */
function patchFromEvent(type, segments, eventArgs, refList) {
  var fromLength = refList.fromSegments.length;
  var segmentsLength = segments.length;
  var pass = eventArgs[eventArgs.length - 1];
  var model = refList.model.pass(pass, true);

  // Mutation on the `from` output itself
  if (segmentsLength === fromLength) {
    if (type === 'insert') {
      var index = eventArgs[0];
      var values = eventArgs[1];
      var ids = setNewToValues(model, refList, values);
      model._insert(refList.idsSegments, index, ids);
      return;
    }

    if (type === 'remove') {
      var index = eventArgs[0];
      var howMany = eventArgs[1].length;
      var ids = model._remove(refList.idsSegments, index, howMany);
      // Delete the appropriate items underneath `to` if the `deleteRemoved`
      // option was set true
      if (refList.deleteRemoved) {
        for (var i = 0; i < ids.length; i++) {
          var item = refList.itemById(ids[i]);
          model._del(refList.toSegmentsByItem(item));
        }
      }
      return;
    }

    if (type === 'move') {
      var from = eventArgs[0];
      var to = eventArgs[1];
      var howMany = eventArgs[2];
      model._move(refList.idsSegments, from, to, howMany);
      return;
    }

    // Change of the entire output
    var values = (type === 'change') ?
      eventArgs[0] : model._get(refList.fromSegments);
    // Set ids to empty list if output is set to null
    if (!values) {
      model._set(refList.idsSegments, []);
      return;
    }
    // If the entire output is set, create a list of ids based on the output,
    // and update the corresponding items
    var ids = setNewToValues(model, refList, values);
    model._set(refList.idsSegments, ids);
    return;
  }

  // If mutation is on a parent of `from`, we might need to re-create the
  // entire refList output
  if (segmentsLength < fromLength) {
    model._setArrayDiff(refList.fromSegments, refList.get());
    return;
  }

  var index = segments[fromLength];
  var value = model._get(refList.fromSegments.concat(index));
  var toSegments = refList.toSegmentsByItem(value);

  // Mutation underneath a child of the `from` object.
  if (segmentsLength > fromLength + 1) {
    throw new Error('Mutation on descendant of refList `from`' +
      ' should have been dereferenced: ' + segments.join('.'));
  }

  // Otherwise, mutation of a child of the `from` object

  // If changing the item itself, it will also have to be re-set on the
  // original object
  if (type === 'change') {
    model._set(toSegments, value);
    updateIdForValue(model, refList, index, value);
    return;
  }
  if (type === 'insert' || type === 'remove' || type === 'move') {
    throw new Error('Array mutation on child of refList `from`' +
      'should have been dereferenced: ' + segments.join('.'));
  }
}

/**
 * @private
 * @param {Model} model
 * @param {RefList} refList
 * @param {Array} values
 */
function setNewToValues(model, refList, values, fn) {
  var ids = [];
  for (var i = 0; i < values.length; i++) {
    var value = values[i];
    var id = refList.idByItem(value);
    if (id === void 0 && typeof value === 'object') {
      id = value.id = model.id();
    }
    var toSegments = refList.toSegmentsByItem(value);
    if (id === void 0 || toSegments === void 0) {
      throw new Error('Unable to add item to refList: ' + value);
    }
    if (model._get(toSegments) !== value) {
      model._set(toSegments, value);
    }
    ids.push(id);
  }
  return ids;
}
function updateIdForValue(model, refList, index, value) {
  var id = refList.idByItem(value);
  var outSegments = refList.idsSegments.concat(index);
  model._set(outSegments, id);
}

function patchToEvent(type, segments, eventArgs, refList) {
  var toLength = refList.toSegments.length;
  var segmentsLength = segments.length;
  var pass = eventArgs[eventArgs.length - 1];
  var model = refList.model.pass(pass, true);

  // Mutation on the `to` object itself
  if (segmentsLength === toLength) {
    if (type === 'insert') {
      var insertIndex = eventArgs[0];
      var values = eventArgs[1];
      for (var i = 0; i < values.length; i++) {
        var value = values[i];
        var indices = refList.indicesByItem(value);
        if (!indices) continue;
        for (var j = 0; j < indices.length; j++) {
          var outSegments = refList.fromSegments.concat(indices[j]);
          model._set(outSegments, value);
        }
      }
      return;
    }

    if (type === 'remove') {
      var removeIndex = eventArgs[0];
      var values = eventArgs[1];
      var howMany = values.length;
      for (var i = removeIndex, len = removeIndex + howMany; i < len; i++) {
        var indices = refList.indicesByItem(values[i]);
        if (!indices) continue;
        for (var j = 0, indicesLen = indices.length; j < indicesLen; j++) {
          var outSegments = refList.fromSegments.concat(indices[j]);
          model._set(outSegments, void 0);
        }
      }
      return;
    }

    if (type === 'move') {
      // Moving items in the `to` object should have no effect on the output
      return;
    }
  }

  // Mutation on or above the `to` object
  if (segmentsLength <= toLength) {
    // If the entire `to` object is updated, we need to re-create the
    // entire refList output and apply what is different
    model._setArrayDiff(refList.fromSegments, refList.get());
    return;
  }

  // Mutation underneath a child of the `to` object. The item will already
  // be up to date, since it is under an object reference. Just re-emit
  if (segmentsLength > toLength + 1) {
    var value = model._get(segments.slice(0, toLength + 1));
    var indices = refList.indicesByItem(value);
    if (!indices) return;
    var remaining = segments.slice(toLength + 1);
    for (var i = 0; i < indices.length; i++) {
      var index = indices[i];
      var dereferenced = refList.fromSegments.concat(index, remaining);
      dereferenced = model._dereference(dereferenced, null, refList);
      eventArgs = eventArgs.slice();
      eventArgs[eventArgs.length - 1] = model._pass;
      model.emit(type, dereferenced, eventArgs);
    }
    return;
  }

  // Otherwise, mutation of a child of the `to` object

  // If changing the item itself, it will also have to be re-set on the
  // array created by the refList
  if (type === 'change' || type === 'load' || type === 'unload') {
    var value, previous;
    if (type === 'change') {
      value = eventArgs[0];
      previous = eventArgs[1];
    } else if (type === 'load') {
      value = eventArgs[0];
      previous = void 0;
    } else if (type === 'unload') {
      value = void 0;
      previous = eventArgs[0];
    }
    var newIndices = refList.indicesByItem(value);
    var oldIndices = refList.indicesByItem(previous);
    if (!newIndices && !oldIndices) return;
    if (oldIndices && !equivalentArrays(oldIndices, newIndices)) {
      // The changed item used to refer to some indices, but no longer does
      for (var i = 0; i < oldIndices.length; i++) {
        var outSegments = refList.fromSegments.concat(oldIndices[i]);
        model._set(outSegments, void 0);
      }
    }
    if (newIndices) {
      for (var i = 0; i < newIndices.length; i++) {
        var outSegments = refList.fromSegments.concat(newIndices[i]);
        model._set(outSegments, value);
      }
    }
    return;
  }

  var value = model._get(segments.slice(0, toLength + 1));
  var indices = refList.indicesByItem(value);
  if (!indices) return;

  if (type === 'insert' || type === 'remove' || type === 'move') {
    // Array mutations will have already been updated via an object
    // reference, so only re-emit
    for (var i = 0; i < indices.length; i++) {
      var dereferenced = refList.fromSegments.concat(indices[i]);
      dereferenced = model._dereference(dereferenced, null, refList);
      eventArgs = eventArgs.slice();
      eventArgs[eventArgs.length - 1] = model._pass;
      model.emit(type, dereferenced, eventArgs);
    }
  }
}
function equivalentArrays(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function patchIdsEvent(type, segments, eventArgs, refList) {
  var idsLength = refList.idsSegments.length;
  var segmentsLength = segments.length;
  var pass = eventArgs[eventArgs.length - 1];
  var model = refList.model.pass(pass, true);

  // An array mutation of the ids should be mirrored with a like change in
  // the output array
  if (segmentsLength === idsLength) {
    if (type === 'insert') {
      var index = eventArgs[0];
      var inserted = eventArgs[1];
      var values = [];
      for (var i = 0; i < inserted.length; i++) {
        var value = refList.itemById(inserted[i]);
        values.push(value);
      }
      model._insert(refList.fromSegments, index, values);
      return;
    }

    if (type === 'remove') {
      var index = eventArgs[0];
      var howMany = eventArgs[1].length;
      model._remove(refList.fromSegments, index, howMany);
      return;
    }

    if (type === 'move') {
      var from = eventArgs[0];
      var to = eventArgs[1];
      var howMany = eventArgs[2];
      model._move(refList.fromSegments, from, to, howMany);
      return;
    }
  }

  // Mutation on the `ids` list itself
  if (segmentsLength <= idsLength) {
    // If the entire `ids` array is updated, we need to re-create the
    // entire refList output and apply what is different
    model._setArrayDiff(refList.fromSegments, refList.get());
    return;
  }

  // Otherwise, direct mutation of a child in the `ids` object or mutation
  // underneath an item in the `ids` list. Update the item for the appropriate
  // id if it has changed
  var index = segments[idsLength];
  var id = refList.idByIndex(index);
  var item = refList.itemById(id);
  var itemSegments = refList.fromSegments.concat(index);
  if (model._get(itemSegments) !== item) {
    model._set(itemSegments, item);
  }
}

Model.prototype.refList = function() {
  var from, to, ids, options;
  if (arguments.length === 2) {
    to = arguments[0];
    ids = arguments[1];
  } else if (arguments.length === 3) {
    if (this.isPath(arguments[2])) {
      from = arguments[0];
      to = arguments[1];
      ids = arguments[2];
    } else {
      to = arguments[0];
      ids = arguments[1];
      options = arguments[2];
    }
  } else {
    from = arguments[0];
    to = arguments[1];
    ids = arguments[2];
    options = arguments[3];
  }
  var fromPath = this.path(from);
  var toPath;
  if (Array.isArray(to)) {
    toPath = [];
    for (var i = 0; i < to.length; i++) {
      toPath.push(this.path(to[i]));
    }
  } else {
    toPath = this.path(to);
  }
  var idsPath = this.path(ids);
  var refList = new RefList(this.root, fromPath, toPath, idsPath, options);
  this.root._refLists.remove(fromPath);
  refList.model._setArrayDiff(refList.fromSegments, refList.get());
  this.root._refLists.add(refList);
  return this.scope(fromPath);
};

function RefList(model, from, to, ids, options) {
  this.model = model && model.pass({$refList: this});
  this.from = from;
  this.to = to;
  this.ids = ids;
  this.fromSegments = from && from.split('.');
  this.toSegments = to && to.split('.');
  this.idsSegments = ids && ids.split('.');
  this.options = options;
  this.deleteRemoved = options && options.deleteRemoved;
}

// The default implementation assumes that the ids array is a flat list of
// keys on the to object. Ideally, this mapping could be customized via
// inheriting from RefList and overriding these methods without having to
// modify the above event handling code.
//
// In the default refList implementation, `key` and `id` are equal.
//
// Terms in the below methods:
//   `item`  - Object on the `to` path, which gets mirrored on the `from` path
//   `key`   - The property under `to` at which an item is located
//   `id`    - String or object in the array at the `ids` path
//   `index` - The index of an id, which corresponds to an index on `from`
RefList.prototype.get = function() {
  var ids = this.model._get(this.idsSegments);
  if (!ids) return [];
  var items = this.model._get(this.toSegments);
  var out = [];
  for (var i = 0; i < ids.length; i++) {
    var key = ids[i];
    out.push(items && items[key]);
  }
  return out;
};
RefList.prototype.dereference = function(segments, i) {
  var remaining = segments.slice(i + 1);
  var key = this.idByIndex(remaining[0]);
  if (key == null) return [];
  remaining[0] = key;
  return this.toSegments.concat(remaining);
};
RefList.prototype.toSegmentsByItem = function(item) {
  var key = this.idByItem(item);
  if (key === void 0) return;
  return this.toSegments.concat(key);
};
RefList.prototype.idByItem = function(item) {
  if (item && item.id) return item.id;
  var items = this.model._get(this.toSegments);
  for (var key in items) {
    if (item === items[key]) return key;
  }
};
RefList.prototype.indicesByItem = function(item) {
  var id = this.idByItem(item);
  var ids = this.model._get(this.idsSegments);
  if (!ids) return;
  var indices;
  var index = -1;
  while (true) {
    index = ids.indexOf(id, index + 1);
    if (index === -1) break;
    if (indices) {
      indices.push(index);
    } else {
      indices = [index];
    }
  }
  return indices;
};
RefList.prototype.itemById = function(id) {
  return this.model._get(this.toSegments.concat(id));
};
RefList.prototype.idByIndex = function(index) {
  return this.model._get(this.idsSegments.concat(index));
};
RefList.prototype.onMutation = function(type, segments, eventArgs) {
  if (util.mayImpact(this.toSegments, segments)) {
    patchToEvent(type, segments, eventArgs, this);
  } else if (util.mayImpact(this.idsSegments, segments)) {
    patchIdsEvent(type, segments, eventArgs, this);
  } else if (util.mayImpact(this.fromSegments, segments)) {
    patchFromEvent(type, segments, eventArgs, this);
  }
};

function FromMap() {}

function RefLists() {
  this.fromMap = new FromMap();
}

RefLists.prototype.add = function(refList) {
  this.fromMap[refList.from] = refList;
};

RefLists.prototype.remove = function(from) {
  var refList = this.fromMap[from];
  delete this.fromMap[from];
  return refList;
};

RefLists.prototype.toJSON = function() {
  var out = [];
  for (var from in this.fromMap) {
    var refList = this.fromMap[from];
    out.push([refList.from, refList.to, refList.ids, refList.options]);
  }
  return out;
};

},{"../util":46,"./Model":34}],45:[function(require,module,exports){
var util = require('../util');
var Model = require('./Model');
var arrayDiff = require('arraydiff');

Model.prototype.setDiff = function() {
  var subpath, value, cb;
  if (arguments.length === 1) {
    value = arguments[0];
  } else if (arguments.length === 2) {
    subpath = arguments[0];
    value = arguments[1];
  } else {
    subpath = arguments[0];
    value = arguments[1];
    cb = arguments[2];
  }
  var segments = this._splitPath(subpath);
  return this._setDiff(segments, value, cb);
};
Model.prototype._setDiff = function(segments, value, cb) {
  segments = this._dereference(segments);
  var model = this;
  function setDiff(doc, docSegments, fnCb) {
    var previous = doc.get(docSegments);
    if (util.equal(previous, value)) {
      fnCb();
      return previous;
    }
    doc.set(docSegments, value, fnCb);
    model.emit('change', segments, [value, previous, model._pass]);
    return previous;
  }
  return this._mutate(segments, setDiff, cb);
};

Model.prototype.setDiffDeep = function() {
  var subpath, value, cb;
  if (arguments.length === 1) {
    value = arguments[0];
  } else if (arguments.length === 2) {
    subpath = arguments[0];
    value = arguments[1];
  } else {
    subpath = arguments[0];
    value = arguments[1];
    cb = arguments[2];
  }
  var segments = this._splitPath(subpath);
  return this._setDiffDeep(segments, value, cb);
};
Model.prototype._setDiffDeep = function(segments, value, cb) {
  var before = this._get(segments);
  cb = this.wrapCallback(cb);
  var group = util.asyncGroup(cb);
  var finished = group();
  diffDeep(this, segments, before, value, group);
  finished();
};
function diffDeep(model, segments, before, after, group) {
  if (typeof before !== 'object' || !before ||
      typeof after !== 'object' || !after) {
    // Set the entire value if not diffable
    model._set(segments, after, group());
    return;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    var diff = arrayDiff(before, after, util.deepEqual);
    if (!diff.length) return;
    // If the only change is a single item replacement, diff the item instead
    if (
      diff.length === 2 &&
      diff[0].index === diff[1].index &&
      diff[0] instanceof arrayDiff.RemoveDiff &&
      diff[0].howMany === 1 &&
      diff[1] instanceof arrayDiff.InsertDiff &&
      diff[1].values.length === 1
    ) {
      var index = diff[0].index;
      var itemSegments = segments.concat(index);
      diffDeep(model, itemSegments, before[index], after[index], group);
      return;
    }
    model._applyArrayDiff(segments, diff, group());
    return;
  }

  // Delete keys that were in before but not after
  for (var key in before) {
    if (key in after) continue;
    var itemSegments = segments.concat(key);
    model._del(itemSegments, group());
  }

  // Diff each property in after
  for (var key in after) {
    if (util.deepEqual(before[key], after[key])) continue;
    var itemSegments = segments.concat(key);
    diffDeep(model, itemSegments, before[key], after[key], group);
  }
}

Model.prototype.setArrayDiff = function() {
  var subpath, value, cb;
  if (arguments.length === 1) {
    value = arguments[0];
  } else if (arguments.length === 2) {
    subpath = arguments[0];
    value = arguments[1];
  } else {
    subpath = arguments[0];
    value = arguments[1];
    cb = arguments[2];
  }
  var segments = this._splitPath(subpath);
  return this._setArrayDiff(segments, value, cb);
};
Model.prototype.setArrayDiffDeep = function() {
  var subpath, value, cb;
  if (arguments.length === 1) {
    value = arguments[0];
  } else if (arguments.length === 2) {
    subpath = arguments[0];
    value = arguments[1];
  } else {
    subpath = arguments[0];
    value = arguments[1];
    cb = arguments[2];
  }
  var segments = this._splitPath(subpath);
  return this._setArrayDiffDeep(segments, value, cb);
};
Model.prototype._setArrayDiffDeep = function(segments, value, cb) {
  return this._setArrayDiff(segments, value, cb, util.deepEqual);
};
Model.prototype._setArrayDiff = function(segments, value, cb, _equalFn) {
  var before = this._get(segments);
  if (before === value) return this.wrapCallback(cb)();
  if (!Array.isArray(before) || !Array.isArray(value)) {
    this._set(segments, value, cb);
    return;
  }
  var diff = arrayDiff(before, value, _equalFn);
  this._applyArrayDiff(segments, diff, cb);
};
Model.prototype._applyArrayDiff = function(segments, diff, cb) {
  if (!diff.length) return this.wrapCallback(cb)();
  segments = this._dereference(segments);
  var model = this;
  function applyArrayDiff(doc, docSegments, fnCb) {
    var group = util.asyncGroup(fnCb);
    for (var i = 0, len = diff.length; i < len; i++) {
      var item = diff[i];
      if (item instanceof arrayDiff.InsertDiff) {
        // Insert
        doc.insert(docSegments, item.index, item.values, group());
        model.emit('insert', segments, [item.index, item.values, model._pass]);
      } else if (item instanceof arrayDiff.RemoveDiff) {
        // Remove
        var removed = doc.remove(docSegments, item.index, item.howMany, group());
        model.emit('remove', segments, [item.index, removed, model._pass]);
      } else if (item instanceof arrayDiff.MoveDiff) {
        // Move
        var moved = doc.move(docSegments, item.from, item.to, item.howMany, group());
        model.emit('move', segments, [item.from, item.to, moved.length, model._pass]);
      }
    }
  }
  return this._mutate(segments, applyArrayDiff, cb);
};

},{"../util":46,"./Model":34,"arraydiff":47}],46:[function(require,module,exports){
(function (process){
var deepIs = require('deep-is');

var isServer = process.title !== 'browser';
exports.isServer = isServer;

exports.asyncGroup = asyncGroup;
exports.castSegments = castSegments;
exports.contains = contains;
exports.copy = copy;
exports.copyObject = copyObject;
exports.deepCopy = deepCopy;
exports.deepEqual = deepIs;
exports.equal = equal;
exports.equalsNaN = equalsNaN;
exports.isArrayIndex = isArrayIndex;
exports.lookup = lookup;
exports.mergeInto = mergeInto;
exports.mayImpact = mayImpact;
exports.mayImpactAny = mayImpactAny;
exports.serverRequire = serverRequire;
exports.serverUse = serverUse;
exports.use = use;

function asyncGroup(cb) {
  var group = new AsyncGroup(cb);
  return function asyncGroupAdd() {
    return group.add();
  };
}

/**
 * @constructor
 * @param {Function} cb(err)
 */
function AsyncGroup(cb) {
  this.cb = cb;
  this.isDone = false;
  this.count = 0;
}
AsyncGroup.prototype.add = function() {
  this.count++;
  var self = this;
  return function(err) {
    self.count--;
    if (self.isDone) return;
    if (err) {
      self.isDone = true;
      self.cb(err);
      return;
    }
    if (self.count > 0) return;
    self.isDone = true;
    self.cb();
  };
};

function castSegments(segments) {
  // Cast number path segments from strings to numbers
  for (var i = segments.length; i--;) {
    var segment = segments[i];
    if (typeof segment === 'string' && isArrayIndex(segment)) {
      segments[i] = +segment;
    }
  }
  return segments;
}

function contains(segments, testSegments) {
  for (var i = 0; i < segments.length; i++) {
    if (segments[i] !== testSegments[i]) return false;
  }
  return true;
}

function copy(value) {
  if (value instanceof Date) return new Date(value);
  if (typeof value === 'object') {
    if (value === null) return null;
    if (Array.isArray(value)) return value.slice();
    return copyObject(value);
  }
  return value;
}

function copyObject(object) {
  var out = new object.constructor();
  for (var key in object) {
    if (object.hasOwnProperty(key)) {
      out[key] = object[key];
    }
  }
  return out;
}

function deepCopy(value) {
  if (value instanceof Date) return new Date(value);
  if (typeof value === 'object') {
    if (value === null) return null;
    if (Array.isArray(value)) {
      var array = [];
      for (var i = value.length; i--;) {
        array[i] = deepCopy(value[i]);
      }
      return array;
    }
    var object = new value.constructor();
    for (var key in value) {
      if (value.hasOwnProperty(key)) {
        object[key] = deepCopy(value[key]);
      }
    }
    return object;
  }
  return value;
}

function equal(a, b) {
  return (a === b) || (equalsNaN(a) && equalsNaN(b));
}

function equalsNaN(x) {
  return x !== x;
}

function isArrayIndex(segment) {
  return (/^[0-9]+$/).test(segment);
}

function lookup(segments, value) {
  if (!segments) return value;

  for (var i = 0, len = segments.length; i < len; i++) {
    if (value == null) return value;
    value = value[segments[i]];
  }
  return value;
}

function mayImpactAny(segmentsList, testSegments) {
  for (var i = 0, len = segmentsList.length; i < len; i++) {
    if (mayImpact(segmentsList[i], testSegments)) return true;
  }
  return false;
}

function mayImpact(segments, testSegments) {
  var len = Math.min(segments.length, testSegments.length);
  for (var i = 0; i < len; i++) {
    if (segments[i] !== testSegments[i]) return false;
  }
  return true;
}

function mergeInto(to, from) {
  for (var key in from) {
    to[key] = from[key];
  }
  return to;
}

function serverRequire(module, id) {
  if (!isServer) return;
  return module.require(id);
}

function serverUse(module, id, options) {
  if (!isServer) return this;
  var plugin = module.require(id);
  return this.use(plugin, options);
}

function use(plugin, options) {
  // Don't include a plugin more than once
  var plugins = this._plugins || (this._plugins = []);
  if (plugins.indexOf(plugin) === -1) {
    plugins.push(plugin);
    plugin(this, options);
  }
  return this;
}

}).call(this,require('_process'))
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9kZXJieS9ub2RlX21vZHVsZXMvcmFjZXIvbGliL3V0aWwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyJ2YXIgZGVlcElzID0gcmVxdWlyZSgnZGVlcC1pcycpO1xuXG52YXIgaXNTZXJ2ZXIgPSBwcm9jZXNzLnRpdGxlICE9PSAnYnJvd3Nlcic7XG5leHBvcnRzLmlzU2VydmVyID0gaXNTZXJ2ZXI7XG5cbmV4cG9ydHMuYXN5bmNHcm91cCA9IGFzeW5jR3JvdXA7XG5leHBvcnRzLmNhc3RTZWdtZW50cyA9IGNhc3RTZWdtZW50cztcbmV4cG9ydHMuY29udGFpbnMgPSBjb250YWlucztcbmV4cG9ydHMuY29weSA9IGNvcHk7XG5leHBvcnRzLmNvcHlPYmplY3QgPSBjb3B5T2JqZWN0O1xuZXhwb3J0cy5kZWVwQ29weSA9IGRlZXBDb3B5O1xuZXhwb3J0cy5kZWVwRXF1YWwgPSBkZWVwSXM7XG5leHBvcnRzLmVxdWFsID0gZXF1YWw7XG5leHBvcnRzLmVxdWFsc05hTiA9IGVxdWFsc05hTjtcbmV4cG9ydHMuaXNBcnJheUluZGV4ID0gaXNBcnJheUluZGV4O1xuZXhwb3J0cy5sb29rdXAgPSBsb29rdXA7XG5leHBvcnRzLm1lcmdlSW50byA9IG1lcmdlSW50bztcbmV4cG9ydHMubWF5SW1wYWN0ID0gbWF5SW1wYWN0O1xuZXhwb3J0cy5tYXlJbXBhY3RBbnkgPSBtYXlJbXBhY3RBbnk7XG5leHBvcnRzLnNlcnZlclJlcXVpcmUgPSBzZXJ2ZXJSZXF1aXJlO1xuZXhwb3J0cy5zZXJ2ZXJVc2UgPSBzZXJ2ZXJVc2U7XG5leHBvcnRzLnVzZSA9IHVzZTtcblxuZnVuY3Rpb24gYXN5bmNHcm91cChjYikge1xuICB2YXIgZ3JvdXAgPSBuZXcgQXN5bmNHcm91cChjYik7XG4gIHJldHVybiBmdW5jdGlvbiBhc3luY0dyb3VwQWRkKCkge1xuICAgIHJldHVybiBncm91cC5hZGQoKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNiKGVycilcbiAqL1xuZnVuY3Rpb24gQXN5bmNHcm91cChjYikge1xuICB0aGlzLmNiID0gY2I7XG4gIHRoaXMuaXNEb25lID0gZmFsc2U7XG4gIHRoaXMuY291bnQgPSAwO1xufVxuQXN5bmNHcm91cC5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuY291bnQrKztcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICByZXR1cm4gZnVuY3Rpb24oZXJyKSB7XG4gICAgc2VsZi5jb3VudC0tO1xuICAgIGlmIChzZWxmLmlzRG9uZSkgcmV0dXJuO1xuICAgIGlmIChlcnIpIHtcbiAgICAgIHNlbGYuaXNEb25lID0gdHJ1ZTtcbiAgICAgIHNlbGYuY2IoZXJyKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHNlbGYuY291bnQgPiAwKSByZXR1cm47XG4gICAgc2VsZi5pc0RvbmUgPSB0cnVlO1xuICAgIHNlbGYuY2IoKTtcbiAgfTtcbn07XG5cbmZ1bmN0aW9uIGNhc3RTZWdtZW50cyhzZWdtZW50cykge1xuICAvLyBDYXN0IG51bWJlciBwYXRoIHNlZ21lbnRzIGZyb20gc3RyaW5ncyB0byBudW1iZXJzXG4gIGZvciAodmFyIGkgPSBzZWdtZW50cy5sZW5ndGg7IGktLTspIHtcbiAgICB2YXIgc2VnbWVudCA9IHNlZ21lbnRzW2ldO1xuICAgIGlmICh0eXBlb2Ygc2VnbWVudCA9PT0gJ3N0cmluZycgJiYgaXNBcnJheUluZGV4KHNlZ21lbnQpKSB7XG4gICAgICBzZWdtZW50c1tpXSA9ICtzZWdtZW50O1xuICAgIH1cbiAgfVxuICByZXR1cm4gc2VnbWVudHM7XG59XG5cbmZ1bmN0aW9uIGNvbnRhaW5zKHNlZ21lbnRzLCB0ZXN0U2VnbWVudHMpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWdtZW50cy5sZW5ndGg7IGkrKykge1xuICAgIGlmIChzZWdtZW50c1tpXSAhPT0gdGVzdFNlZ21lbnRzW2ldKSByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGNvcHkodmFsdWUpIHtcbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgRGF0ZSkgcmV0dXJuIG5ldyBEYXRlKHZhbHVlKTtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICBpZiAodmFsdWUgPT09IG51bGwpIHJldHVybiBudWxsO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkgcmV0dXJuIHZhbHVlLnNsaWNlKCk7XG4gICAgcmV0dXJuIGNvcHlPYmplY3QodmFsdWUpO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn1cblxuZnVuY3Rpb24gY29weU9iamVjdChvYmplY3QpIHtcbiAgdmFyIG91dCA9IG5ldyBvYmplY3QuY29uc3RydWN0b3IoKTtcbiAgZm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuICAgIGlmIChvYmplY3QuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgb3V0W2tleV0gPSBvYmplY3Rba2V5XTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG91dDtcbn1cblxuZnVuY3Rpb24gZGVlcENvcHkodmFsdWUpIHtcbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgRGF0ZSkgcmV0dXJuIG5ldyBEYXRlKHZhbHVlKTtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICBpZiAodmFsdWUgPT09IG51bGwpIHJldHVybiBudWxsO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgdmFyIGFycmF5ID0gW107XG4gICAgICBmb3IgKHZhciBpID0gdmFsdWUubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIGFycmF5W2ldID0gZGVlcENvcHkodmFsdWVbaV0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFycmF5O1xuICAgIH1cbiAgICB2YXIgb2JqZWN0ID0gbmV3IHZhbHVlLmNvbnN0cnVjdG9yKCk7XG4gICAgZm9yICh2YXIga2V5IGluIHZhbHVlKSB7XG4gICAgICBpZiAodmFsdWUuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICBvYmplY3Rba2V5XSA9IGRlZXBDb3B5KHZhbHVlW2tleV0pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb2JqZWN0O1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn1cblxuZnVuY3Rpb24gZXF1YWwoYSwgYikge1xuICByZXR1cm4gKGEgPT09IGIpIHx8IChlcXVhbHNOYU4oYSkgJiYgZXF1YWxzTmFOKGIpKTtcbn1cblxuZnVuY3Rpb24gZXF1YWxzTmFOKHgpIHtcbiAgcmV0dXJuIHggIT09IHg7XG59XG5cbmZ1bmN0aW9uIGlzQXJyYXlJbmRleChzZWdtZW50KSB7XG4gIHJldHVybiAoL15bMC05XSskLykudGVzdChzZWdtZW50KTtcbn1cblxuZnVuY3Rpb24gbG9va3VwKHNlZ21lbnRzLCB2YWx1ZSkge1xuICBpZiAoIXNlZ21lbnRzKSByZXR1cm4gdmFsdWU7XG5cbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHNlZ21lbnRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKHZhbHVlID09IG51bGwpIHJldHVybiB2YWx1ZTtcbiAgICB2YWx1ZSA9IHZhbHVlW3NlZ21lbnRzW2ldXTtcbiAgfVxuICByZXR1cm4gdmFsdWU7XG59XG5cbmZ1bmN0aW9uIG1heUltcGFjdEFueShzZWdtZW50c0xpc3QsIHRlc3RTZWdtZW50cykge1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gc2VnbWVudHNMaXN0Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKG1heUltcGFjdChzZWdtZW50c0xpc3RbaV0sIHRlc3RTZWdtZW50cykpIHJldHVybiB0cnVlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gbWF5SW1wYWN0KHNlZ21lbnRzLCB0ZXN0U2VnbWVudHMpIHtcbiAgdmFyIGxlbiA9IE1hdGgubWluKHNlZ21lbnRzLmxlbmd0aCwgdGVzdFNlZ21lbnRzLmxlbmd0aCk7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoc2VnbWVudHNbaV0gIT09IHRlc3RTZWdtZW50c1tpXSkgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBtZXJnZUludG8odG8sIGZyb20pIHtcbiAgZm9yICh2YXIga2V5IGluIGZyb20pIHtcbiAgICB0b1trZXldID0gZnJvbVtrZXldO1xuICB9XG4gIHJldHVybiB0bztcbn1cblxuZnVuY3Rpb24gc2VydmVyUmVxdWlyZShtb2R1bGUsIGlkKSB7XG4gIGlmICghaXNTZXJ2ZXIpIHJldHVybjtcbiAgcmV0dXJuIG1vZHVsZS5yZXF1aXJlKGlkKTtcbn1cblxuZnVuY3Rpb24gc2VydmVyVXNlKG1vZHVsZSwgaWQsIG9wdGlvbnMpIHtcbiAgaWYgKCFpc1NlcnZlcikgcmV0dXJuIHRoaXM7XG4gIHZhciBwbHVnaW4gPSBtb2R1bGUucmVxdWlyZShpZCk7XG4gIHJldHVybiB0aGlzLnVzZShwbHVnaW4sIG9wdGlvbnMpO1xufVxuXG5mdW5jdGlvbiB1c2UocGx1Z2luLCBvcHRpb25zKSB7XG4gIC8vIERvbid0IGluY2x1ZGUgYSBwbHVnaW4gbW9yZSB0aGFuIG9uY2VcbiAgdmFyIHBsdWdpbnMgPSB0aGlzLl9wbHVnaW5zIHx8ICh0aGlzLl9wbHVnaW5zID0gW10pO1xuICBpZiAocGx1Z2lucy5pbmRleE9mKHBsdWdpbikgPT09IC0xKSB7XG4gICAgcGx1Z2lucy5wdXNoKHBsdWdpbik7XG4gICAgcGx1Z2luKHRoaXMsIG9wdGlvbnMpO1xuICB9XG4gIHJldHVybiB0aGlzO1xufVxuIl19
},{"_process":3,"deep-is":48}],47:[function(require,module,exports){
module.exports = arrayDiff;

// Based on some rough benchmarking, this algorithm is about O(2n) worst case,
// and it can compute diffs on random arrays of length 1024 in about 34ms,
// though just a few changes on an array of length 1024 takes about 0.5ms

arrayDiff.InsertDiff = InsertDiff;
arrayDiff.RemoveDiff = RemoveDiff;
arrayDiff.MoveDiff = MoveDiff;

function InsertDiff(index, values) {
  this.index = index;
  this.values = values;
}
InsertDiff.prototype.type = 'insert';
InsertDiff.prototype.toJSON = function() {
  return {
    type: this.type
  , index: this.index
  , values: this.values
  };
};

function RemoveDiff(index, howMany) {
  this.index = index;
  this.howMany = howMany;
}
RemoveDiff.prototype.type = 'remove';
RemoveDiff.prototype.toJSON = function() {
  return {
    type: this.type
  , index: this.index
  , howMany: this.howMany
  };
};

function MoveDiff(from, to, howMany) {
  this.from = from;
  this.to = to;
  this.howMany = howMany;
}
MoveDiff.prototype.type = 'move';
MoveDiff.prototype.toJSON = function() {
  return {
    type: this.type
  , from: this.from
  , to: this.to
  , howMany: this.howMany
  };
};

function strictEqual(a, b) {
  return a === b;
}

function arrayDiff(before, after, equalFn) {
  if (!equalFn) equalFn = strictEqual;

  // Find all items in both the before and after array, and represent them
  // as moves. Many of these "moves" may end up being discarded in the last
  // pass if they are from an index to the same index, but we don't know this
  // up front, since we haven't yet offset the indices.
  // 
  // Also keep a map of all the indicies accounted for in the before and after
  // arrays. These maps are used next to create insert and remove diffs.
  var beforeLength = before.length;
  var afterLength = after.length;
  var moves = [];
  var beforeMarked = {};
  var afterMarked = {};
  for (var beforeIndex = 0; beforeIndex < beforeLength; beforeIndex++) {
    var beforeItem = before[beforeIndex];
    for (var afterIndex = 0; afterIndex < afterLength; afterIndex++) {
      if (afterMarked[afterIndex]) continue;
      if (!equalFn(beforeItem, after[afterIndex])) continue;
      var from = beforeIndex;
      var to = afterIndex;
      var howMany = 0;
      do {
        beforeMarked[beforeIndex++] = afterMarked[afterIndex++] = true;
        howMany++;
      } while (
        beforeIndex < beforeLength &&
        afterIndex < afterLength &&
        equalFn(before[beforeIndex], after[afterIndex]) &&
        !afterMarked[afterIndex]
      );
      moves.push(new MoveDiff(from, to, howMany));
      beforeIndex--;
      break;
    }
  }

  // Create a remove for all of the items in the before array that were
  // not marked as being matched in the after array as well
  var removes = [];
  for (beforeIndex = 0; beforeIndex < beforeLength;) {
    if (beforeMarked[beforeIndex]) {
      beforeIndex++;
      continue;
    }
    var index = beforeIndex;
    var howMany = 0;
    while (beforeIndex < beforeLength && !beforeMarked[beforeIndex++]) {
      howMany++;
    }
    removes.push(new RemoveDiff(index, howMany));
  }

  // Create an insert for all of the items in the after array that were
  // not marked as being matched in the before array as well
  var inserts = [];
  for (afterIndex = 0; afterIndex < afterLength;) {
    if (afterMarked[afterIndex]) {
      afterIndex++;
      continue;
    }
    var index = afterIndex;
    var howMany = 0;
    while (afterIndex < afterLength && !afterMarked[afterIndex++]) {
      howMany++;
    }
    var values = after.slice(index, index + howMany);
    inserts.push(new InsertDiff(index, values));
  }

  var insertsLength = inserts.length;
  var removesLength = removes.length;
  var movesLength = moves.length;
  var i, j;

  // Offset subsequent removes and moves by removes
  var count = 0;
  for (i = 0; i < removesLength; i++) {
    var remove = removes[i];
    remove.index -= count;
    count += remove.howMany;
    for (j = 0; j < movesLength; j++) {
      var move = moves[j];
      if (move.from >= remove.index) move.from -= remove.howMany;
    }
  }

  // Offset moves by inserts
  for (i = insertsLength; i--;) {
    var insert = inserts[i];
    var howMany = insert.values.length;
    for (j = movesLength; j--;) {
      var move = moves[j];
      if (move.to >= insert.index) move.to -= howMany;
    }
  }

  // Offset the to of moves by later moves
  for (i = movesLength; i-- > 1;) {
    var move = moves[i];
    if (move.to === move.from) continue;
    for (j = i; j--;) {
      var earlier = moves[j];
      if (earlier.to >= move.to) earlier.to -= move.howMany;
      if (earlier.to >= move.from) earlier.to += move.howMany;
    }
  }

  // Only output moves that end up having an effect after offsetting
  var outputMoves = [];

  // Offset the from of moves by earlier moves
  for (i = 0; i < movesLength; i++) {
    var move = moves[i];
    if (move.to === move.from) continue;
    outputMoves.push(move);
    for (j = i + 1; j < movesLength; j++) {
      var later = moves[j];
      if (later.from >= move.from) later.from -= move.howMany;
      if (later.from >= move.to) later.from += move.howMany;
    }
  }

  return removes.concat(outputMoves, inserts);
}

},{}],48:[function(require,module,exports){
var pSlice = Array.prototype.slice;
var Object_keys = typeof Object.keys === 'function'
    ? Object.keys
    : function (obj) {
        var keys = [];
        for (var key in obj) keys.push(key);
        return keys;
    }
;

var deepEqual = module.exports = function (actual, expected) {
  // enforce Object.is +0 !== -0
  if (actual === 0 && expected === 0) {
    return areZerosEqual(actual, expected);

  // 7.1. All identical values are equivalent, as determined by ===.
  } else if (actual === expected) {
    return true;

  } else if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();

  } else if (isNumberNaN(actual)) {
    return isNumberNaN(expected);

  // 7.3. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (typeof actual != 'object' && typeof expected != 'object') {
    return actual == expected;

  // 7.4. For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected);
  }
};

function isUndefinedOrNull(value) {
  return value === null || value === undefined;
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function isNumberNaN(value) {
  // NaN === NaN -> false
  return typeof value == 'number' && value !== value;
}

function areZerosEqual(zeroA, zeroB) {
  // (1 / +0|0) -> Infinity, but (1 / -0) -> -Infinity and (Infinity !== -Infinity)
  return (1 / zeroA) === (1 / zeroB);
}

function objEquiv(a, b) {
  if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
    return false;

  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return deepEqual(a, b);
  }
  try {
    var ka = Object_keys(a),
        kb = Object_keys(b),
        key, i;
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

},{}],49:[function(require,module,exports){
(function (global){

var rng;

if (global.crypto && crypto.getRandomValues) {
  // WHATWG crypto-based RNG - http://wiki.whatwg.org/wiki/Crypto
  // Moderately fast, high quality
  var _rnds8 = new Uint8Array(16);
  rng = function whatwgRNG() {
    crypto.getRandomValues(_rnds8);
    return _rnds8;
  };
}

if (!rng) {
  // Math.random()-based (RNG)
  //
  // If all else fails, use Math.random().  It's fast, but is of unspecified
  // quality.
  var  _rnds = new Array(16);
  rng = function() {
    for (var i = 0, r; i < 16; i++) {
      if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
      _rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return _rnds;
  };
}

module.exports = rng;


}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9kZXJieS9ub2RlX21vZHVsZXMvcmFjZXIvbm9kZV9tb2R1bGVzL3V1aWQvcm5nLWJyb3dzZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIlxudmFyIHJuZztcblxuaWYgKGdsb2JhbC5jcnlwdG8gJiYgY3J5cHRvLmdldFJhbmRvbVZhbHVlcykge1xuICAvLyBXSEFUV0cgY3J5cHRvLWJhc2VkIFJORyAtIGh0dHA6Ly93aWtpLndoYXR3Zy5vcmcvd2lraS9DcnlwdG9cbiAgLy8gTW9kZXJhdGVseSBmYXN0LCBoaWdoIHF1YWxpdHlcbiAgdmFyIF9ybmRzOCA9IG5ldyBVaW50OEFycmF5KDE2KTtcbiAgcm5nID0gZnVuY3Rpb24gd2hhdHdnUk5HKCkge1xuICAgIGNyeXB0by5nZXRSYW5kb21WYWx1ZXMoX3JuZHM4KTtcbiAgICByZXR1cm4gX3JuZHM4O1xuICB9O1xufVxuXG5pZiAoIXJuZykge1xuICAvLyBNYXRoLnJhbmRvbSgpLWJhc2VkIChSTkcpXG4gIC8vXG4gIC8vIElmIGFsbCBlbHNlIGZhaWxzLCB1c2UgTWF0aC5yYW5kb20oKS4gIEl0J3MgZmFzdCwgYnV0IGlzIG9mIHVuc3BlY2lmaWVkXG4gIC8vIHF1YWxpdHkuXG4gIHZhciAgX3JuZHMgPSBuZXcgQXJyYXkoMTYpO1xuICBybmcgPSBmdW5jdGlvbigpIHtcbiAgICBmb3IgKHZhciBpID0gMCwgcjsgaSA8IDE2OyBpKyspIHtcbiAgICAgIGlmICgoaSAmIDB4MDMpID09PSAwKSByID0gTWF0aC5yYW5kb20oKSAqIDB4MTAwMDAwMDAwO1xuICAgICAgX3JuZHNbaV0gPSByID4+PiAoKGkgJiAweDAzKSA8PCAzKSAmIDB4ZmY7XG4gICAgfVxuXG4gICAgcmV0dXJuIF9ybmRzO1xuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHJuZztcblxuIl19
},{}],50:[function(require,module,exports){
//     uuid.js
//
//     Copyright (c) 2010-2012 Robert Kieffer
//     MIT License - http://opensource.org/licenses/mit-license.php

// Unique ID creation requires a high quality random # generator.  We feature
// detect to determine the best RNG source, normalizing to a function that
// returns 128-bits of randomness, since that's what's usually required
var _rng = require('./rng');

// Maps for number <-> hex string conversion
var _byteToHex = [];
var _hexToByte = {};
for (var i = 0; i < 256; i++) {
  _byteToHex[i] = (i + 0x100).toString(16).substr(1);
  _hexToByte[_byteToHex[i]] = i;
}

// **`parse()` - Parse a UUID into it's component bytes**
function parse(s, buf, offset) {
  var i = (buf && offset) || 0, ii = 0;

  buf = buf || [];
  s.toLowerCase().replace(/[0-9a-f]{2}/g, function(oct) {
    if (ii < 16) { // Don't overflow!
      buf[i + ii++] = _hexToByte[oct];
    }
  });

  // Zero out remaining bytes if string was short
  while (ii < 16) {
    buf[i + ii++] = 0;
  }

  return buf;
}

// **`unparse()` - Convert UUID byte array (ala parse()) into a string**
function unparse(buf, offset) {
  var i = offset || 0, bth = _byteToHex;
  return  bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]];
}

// **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html

// random #'s we need to init node and clockseq
var _seedBytes = _rng();

// Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
var _nodeId = [
  _seedBytes[0] | 0x01,
  _seedBytes[1], _seedBytes[2], _seedBytes[3], _seedBytes[4], _seedBytes[5]
];

// Per 4.2.2, randomize (14 bit) clockseq
var _clockseq = (_seedBytes[6] << 8 | _seedBytes[7]) & 0x3fff;

// Previous uuid creation time
var _lastMSecs = 0, _lastNSecs = 0;

// See https://github.com/broofa/node-uuid for API details
function v1(options, buf, offset) {
  var i = buf && offset || 0;
  var b = buf || [];

  options = options || {};

  var clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq;

  // UUID timestamps are 100 nano-second units since the Gregorian epoch,
  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
  var msecs = options.msecs !== undefined ? options.msecs : new Date().getTime();

  // Per 4.2.1.2, use count of uuid's generated during the current clock
  // cycle to simulate higher resolution clock
  var nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1;

  // Time since last uuid creation (in msecs)
  var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

  // Per 4.2.1.2, Bump clockseq on clock regression
  if (dt < 0 && options.clockseq === undefined) {
    clockseq = clockseq + 1 & 0x3fff;
  }

  // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
  // time interval
  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  }

  // Per 4.2.1.2 Throw error if too many uuids are requested
  if (nsecs >= 10000) {
    throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
  }

  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq;

  // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
  msecs += 12219292800000;

  // `time_low`
  var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
  b[i++] = tl >>> 24 & 0xff;
  b[i++] = tl >>> 16 & 0xff;
  b[i++] = tl >>> 8 & 0xff;
  b[i++] = tl & 0xff;

  // `time_mid`
  var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
  b[i++] = tmh >>> 8 & 0xff;
  b[i++] = tmh & 0xff;

  // `time_high_and_version`
  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
  b[i++] = tmh >>> 16 & 0xff;

  // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
  b[i++] = clockseq >>> 8 | 0x80;

  // `clock_seq_low`
  b[i++] = clockseq & 0xff;

  // `node`
  var node = options.node || _nodeId;
  for (var n = 0; n < 6; n++) {
    b[i + n] = node[n];
  }

  return buf ? buf : unparse(b);
}

// **`v4()` - Generate random UUID**

// See https://github.com/broofa/node-uuid for API details
function v4(options, buf, offset) {
  // Deprecated - 'format' argument, as supported in v1.2
  var i = buf && offset || 0;

  if (typeof(options) == 'string') {
    buf = options == 'binary' ? new Array(16) : null;
    options = null;
  }
  options = options || {};

  var rnds = options.random || (options.rng || _rng)();

  // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;

  // Copy bytes to buffer, if provided
  if (buf) {
    for (var ii = 0; ii < 16; ii++) {
      buf[i + ii] = rnds[ii];
    }
  }

  return buf || unparse(rnds);
}

// Export public API
var uuid = v4;
uuid.v1 = v1;
uuid.v4 = v4;
uuid.parse = parse;
uuid.unparse = unparse;

module.exports = uuid;

},{"./rng":49}],51:[function(require,module,exports){
var qs = require('qs')
var parseUrl = require('url').parse
var resolveUrl = require('url').resolve
var router = require('./router')
var currentPath = window.location.pathname + window.location.search

// Replace the initial state with the current URL immediately,
// so that it will be rendered if the state is later popped
if (window.history.replaceState) {
  window.history.replaceState({
    $render: true,
    $method: 'get'
  }, null, window.location.href)
}

module.exports = History

function History(app, routes) {
  this.app = app
  this.routes = routes

  if (window.history.pushState) {
    addListeners(this)
    return
  }
  this.push = function(url) {
    window.location.assign(url)
  }
  this.replace = function(url) {
    window.location.replace(url)
  }
}

History.prototype.push = function(url, render, state, e) {
  this._update('pushState', url, render, state, e)
}

History.prototype.replace = function(url, render, state, e) {
  this._update('replaceState', url, render, state, e)
}

// Rerender the current url locally
History.prototype.refresh = function() {
  var path = routePath(window.location.href)
  // Note that we don't pass previous to avoid triggering transitions
  router.render(this, {url: path, method: 'get'})
}

History.prototype.back = function() {
  window.history.back()
}

History.prototype.forward = function() {
  window.history.forward()
}

History.prototype.go = function(i) {
  window.history.go(i)
}

History.prototype._update = function(historyMethod, relativeUrl, render, state, e) {
  var url = resolveUrl(window.location.href, relativeUrl)
  var path = routePath(url)

  // TODO: history.push should set the window.location with external urls
  if (!path) return
  if (render == null) render = true
  if (state == null) state = {}

  // Update the URL
  var options = renderOptions(e, path)
  state.$render = true
  state.$method = options.method
  window.history[historyMethod](state, null, options.url)
  currentPath = window.location.pathname + window.location.search
  if (render) router.render(this, options, e)
}

History.prototype.page = function() {
  var page = this.app.createPage()
  var history = this

  function redirect(url) {
    if (url === 'back') return history.back()
    // TODO: Add support for `basepath` option like Express
    if (url === 'home') url = '\\'
    history.replace(url, true)
  }

  page.redirect = redirect
  return page
}

// Get the pathname if it is on the same protocol and domain
function routePath(url) {
  var match = parseUrl(url)
  return match &&
    match.protocol === window.location.protocol &&
    match.host === window.location.host &&
    match.pathname + (match.search || '')
}

function renderOptions(e, path) {
  // If this is a form submission, extract the form data and
  // append it to the url for a get or params.body for a post
  if (e && e.type === 'submit') {
    var form = e.target
    var elements = form.elements
    var query = []
    for (var i = 0, len = elements.length, el; i < len; i++) {
      el = elements[i]
      var name = el.name
      if (!name) continue
      var value = el.value
      query.push(encodeURIComponent(name) + '=' + encodeURIComponent(value))
      if (name === '_method') {
        var override = value.toLowerCase()
        if (override === 'delete') override = 'del'
      }
    }
    query = query.join('&')
    if (form.method.toLowerCase() === 'post') {
      var method = override || 'post'
      var body = qs.parse(query)
    } else {
      method = 'get'
      path += '?' + query
    }
  } else {
    method = 'get'
  }
  return {
    method: method
  , url: path
  , previous: window.location.pathname + window.location.search
  , body: body
  , form: form
  , link: e && e._tracksLink
  }
}

function addListeners(history) {

  // Detect clicks on links
  function onClick(e) {
    var el = e.target

    // Ignore command click, control click, and non-left click
    if (e.metaKey || e.which !== 1) return

    // Ignore if already prevented
    if (e.defaultPrevented) return

    // Also look up for parent links (<a><img></a>)
    while (el) {
      var url = el.href
      if (url) {

        // Ignore if created by Tracks
        if (el.hasAttribute && el.hasAttribute('data-router-ignore')) return

        // Ignore links meant to open in a different window or frame
        if (el.target && el.target !== '_self') return

        // Ignore hash links to the same page
        var hashIndex = url.indexOf('#')
        if (~hashIndex && url.slice(0, hashIndex) === window.location.href.replace(/#.*/, '')) {
          return
        }

        e._tracksLink = el
        history.push(url, true, null, e)
        return
      }

      el = el.parentNode
    }
  }

  function onSubmit(e) {
    var target = e.target

    // Ignore if already prevented
    if (e.defaultPrevented) return

    // Only handle if emitted on a form element that isn't multipart
    if (target.tagName.toLowerCase() !== 'form') return
    if (target.enctype === 'multipart/form-data') return

    // Ignore if created by Tracks
    if (target.hasAttribute && target.hasAttribute('data-router-ignore')) return

    // Use the url from the form action, defaulting to the current url
    var url = target.action || window.location.href
    history.push(url, true, null, e)
  }

  function onPopState(e) {
    // HACK: Chrome sometimes does a pop state before the app is set up properly
    if (!history.app.page) return

    var previous = currentPath
    var state = e.state
    currentPath = window.location.pathname + window.location.search

    var options = {
      previous: previous
    , url: currentPath
    }

    if (state) {
      if (!state.$render) return
      options.method = state.$method
      // Note that the post body is only sent on the initial reqest
      // and it is empty if the state is later popped
      return router.render(history, options)
    }

    // The state object will be null for states created by jump links.
    // window.location.hash cannot be used, because it returns nothing
    // if the url ends in just a hash character
    var url = window.location.href
      , hashIndex = url.indexOf('#')
      , el, id
    if (~hashIndex && currentPath !== previous) {
      options.method = 'get'
      router.render(history, options)
      id = url.slice(hashIndex + 1)
      if (el = document.getElementById(id) || document.getElementsByName(id)[0]) {
        el.scrollIntoView()
      }
    }
  }

  document.addEventListener('click', onClick, true)
  document.addEventListener('submit', onSubmit, false)
  window.addEventListener('popstate', onPopState, true)
}

},{"./router":53,"qs":54,"url":8}],52:[function(require,module,exports){
var Route = require('../vendor/express/router/route')
var History = require('./History')
var router = module.exports = require('./router')

router.setup = setup

function setup(app) {
  var routes = {
    queue: {}
  , transitional: {}
  , app: app
  }
  app.history = new History(app, routes)

  ;['get', 'post', 'put', 'del', 'enter', 'exit'].forEach(function(method) {
    var queue = routes.queue[method] = []
    var transitional = routes.transitional[method] = []

    app[method] = function(pattern, callback) {
      if (Array.isArray(pattern)) {
        pattern.forEach(function(item) {
          app[method](item, callback)
        })
        return app
      }

      if (router.isTransitional(pattern)) {
        var from = pattern.from
        var to = pattern.to
        var forward = pattern.forward || (callback && callback.forward) || callback
        var back = pattern.back || (callback && callback.back)

        var fromRoute = new Route(method, from, back)
        var toRoute = new Route(method, to, forward)
        fromRoute.isTransitional = true
        toRoute.isTransitional = true
        transitional.push({
          from: fromRoute
        , to: toRoute
        })
        if (back) transitional.push({
          from: toRoute
        , to: fromRoute
        })

        return app
      }

      queue.push(new Route(method, pattern, callback))
      return app
    }
  })
}

},{"../vendor/express/router/route":55,"./History":51,"./router":53}],53:[function(require,module,exports){
var qs = require('qs')
var nodeUrl = require('url');

module.exports = {
  render: render
, isTransitional: isTransitional
, mapRoute: mapRoute
}

function isTransitional(pattern) {
  return pattern.hasOwnProperty('from') && pattern.hasOwnProperty('to')
}

function mapRoute(from, params) {
  var i = params.url.indexOf('?')
  var queryString = (~i) ? params.url.slice(i) : ''
  // If the route looks like /:a/:b?/:c/:d?
  // and :b and :d are missing, return /a/c
  // Thus, skip the / if the value is missing
  var i = 0
  var path = from.replace(/\/(?:(?:\:([^?\/:*(]+)(?:\([^)]+\))?)|\*)(\?)?/g, onMatch)
  function onMatch(match, key, optional) {
    var value = key ? params[key] : params[i++]
    return (optional && value == null) ? '' : '/' + encodeURIComponent(value)
  }
  return path + queryString
}

function render(history, options, e) {
  var req = new RenderReq(history.app.page, history.routes, options, e)
  req.routeTransitional(0, function() {
    req.page = history.page()
    req.routeQueue(0, function() {
      // Cancel rendering by this app if no routes match
      req.cancel()
    })
  })
}

function RenderReq(page, routes, options, e) {
  this.page = page
  this.options = options
  this.e = e
  this.setUrl(options.url.replace(/#.*/, ''))
  var queryString = nodeUrl.parse(this.url).query;
  this.query = queryString ? qs.parse(queryString) : {}
  this.method = options.method
  this.body = options.body || {}
  this.setPrevious(options.previous)
  this.transitional = routes.transitional[this.method]
  this.queue = routes.queue[this.method]
  this.app = routes.app
}

RenderReq.prototype.cancel = function() {
  var options = this.options
  // Don't do anything if this is the result of an event, since the
  // appropriate action will happen by default
  if (this.e || options.noNavigate) return
  // Otherwise, manually perform appropriate action
  if (options.form) {
    options.form.setAttribute('data-router-ignore', '')
    options.form.submit()
  } else {
    window.location.assign(options.url)
  }
}

RenderReq.prototype.setUrl = function(url) {
  this.url = url
  this.path = url.replace(/\?.*/, '')
}
RenderReq.prototype.setPrevious = function(previous) {
  this.previous = previous
  this.previousPath = previous && previous.replace(/\?.*/, '')
}

RenderReq.prototype.routeTransitional = function(i, next) {
  i || (i = 0)
  var item
  while (item = this.transitional[i++]) {
    if (!item.to.match(this.path) || !item.from.match(this.previousPath)) continue
    var req = this
    var params = this.routeParams(item.to)
    // Even though we don't need to do anything after a done, pass a
    // no op function, so that routes can expect it to be defined
    function done() {}
    this.onMatch(item.to, params, function(err) {
      if (err) return req.cancel()
      req.routeTransitional(i, next)
    }, done)
    return
  }
  next()
}

RenderReq.prototype.routeQueue = function(i, next) {
  i || (i = 0)
  var route
  while (route = this.queue[i++]) {
    if (!route.match(this.path)) continue
    var req = this
    var params = this.routeParams(route)
    this.onMatch(route, params, function(err) {
      if (err) return req.cancel()
      req.routeQueue(i, next)
    })
    return
  }
  next()
}

RenderReq.prototype.onMatch = function(route, params, next, done) {
  if (!this.page) return next()
  // Stop the default browser action, such as clicking a link or submitting a form
  if (this.e) {
    this.e.preventDefault()
    this.e = null
  }
  this.page.params = params
  if (route.isTransitional) {
    this.app.onRoute(route.callbacks, this.page, next, done)
  } else {
    this.app.onRoute(route.callbacks, this.page, next)
  }
}

RenderReq.prototype.routeParams = function(route) {
  var routeParams = route.params
  var params = routeParams.slice()

  for (var key in routeParams) {
    params[key] = routeParams[key]
  }
  params.previous = this.previous
  params.url = this.url
  params.body = this.body
  params.query = this.query
  params.method = this.method
  return params
}

},{"qs":54,"url":8}],54:[function(require,module,exports){
/**
 * Object#toString() ref for stringify().
 */

var toString = Object.prototype.toString;

/**
 * Object#hasOwnProperty ref
 */

var hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Array#indexOf shim.
 */

var indexOf = typeof Array.prototype.indexOf === 'function'
  ? function(arr, el) { return arr.indexOf(el); }
  : function(arr, el) {
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] === el) return i;
      }
      return -1;
    };

/**
 * Array.isArray shim.
 */

var isArray = Array.isArray || function(arr) {
  return toString.call(arr) == '[object Array]';
};

/**
 * Object.keys shim.
 */

var objectKeys = Object.keys || function(obj) {
  var ret = [];
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      ret.push(key);
    }
  }
  return ret;
};

/**
 * Array#forEach shim.
 */

var forEach = typeof Array.prototype.forEach === 'function'
  ? function(arr, fn) { return arr.forEach(fn); }
  : function(arr, fn) {
      for (var i = 0; i < arr.length; i++) fn(arr[i]);
    };

/**
 * Array#reduce shim.
 */

var reduce = function(arr, fn, initial) {
  if (typeof arr.reduce === 'function') return arr.reduce(fn, initial);
  var res = initial;
  for (var i = 0; i < arr.length; i++) res = fn(res, arr[i]);
  return res;
};

/**
 * Cache non-integer test regexp.
 */

var isint = /^[0-9]+$/;

function promote(parent, key) {
  if (parent[key].length == 0) return parent[key] = {}
  var t = {};
  for (var i in parent[key]) {
    if (hasOwnProperty.call(parent[key], i)) {
      t[i] = parent[key][i];
    }
  }
  parent[key] = t;
  return t;
}

function parse(parts, parent, key, val) {
  var part = parts.shift();
  
  // illegal
  if (Object.getOwnPropertyDescriptor(Object.prototype, key)) return;
  
  // end
  if (!part) {
    if (isArray(parent[key])) {
      parent[key].push(val);
    } else if ('object' == typeof parent[key]) {
      parent[key] = val;
    } else if ('undefined' == typeof parent[key]) {
      parent[key] = val;
    } else {
      parent[key] = [parent[key], val];
    }
    // array
  } else {
    var obj = parent[key] = parent[key] || [];
    if (']' == part) {
      if (isArray(obj)) {
        if ('' != val) obj.push(val);
      } else if ('object' == typeof obj) {
        obj[objectKeys(obj).length] = val;
      } else {
        obj = parent[key] = [parent[key], val];
      }
      // prop
    } else if (~indexOf(part, ']')) {
      part = part.substr(0, part.length - 1);
      if (!isint.test(part) && isArray(obj)) obj = promote(parent, key);
      parse(parts, obj, part, val);
      // key
    } else {
      if (!isint.test(part) && isArray(obj)) obj = promote(parent, key);
      parse(parts, obj, part, val);
    }
  }
}

/**
 * Merge parent key/val pair.
 */

function merge(parent, key, val){
  if (~indexOf(key, ']')) {
    var parts = key.split('[')
      , len = parts.length
      , last = len - 1;
    parse(parts, parent, 'base', val);
    // optimize
  } else {
    if (!isint.test(key) && isArray(parent.base)) {
      var t = {};
      for (var k in parent.base) t[k] = parent.base[k];
      parent.base = t;
    }
    set(parent.base, key, val);
  }

  return parent;
}

/**
 * Compact sparse arrays.
 */

function compact(obj) {
  if ('object' != typeof obj) return obj;

  if (isArray(obj)) {
    var ret = [];

    for (var i in obj) {
      if (hasOwnProperty.call(obj, i)) {
        ret.push(obj[i]);
      }
    }

    return ret;
  }

  for (var key in obj) {
    obj[key] = compact(obj[key]);
  }

  return obj;
}

/**
 * Parse the given obj.
 */

function parseObject(obj){
  var ret = { base: {} };

  forEach(objectKeys(obj), function(name){
    merge(ret, name, obj[name]);
  });

  return compact(ret.base);
}

/**
 * Parse the given str.
 */

function parseString(str){
  var ret = reduce(String(str).split('&'), function(ret, pair){
    var eql = indexOf(pair, '=')
      , brace = lastBraceInKey(pair)
      , key = pair.substr(0, brace || eql)
      , val = pair.substr(brace || eql, pair.length)
      , val = val.substr(indexOf(val, '=') + 1, val.length);

    // ?foo
    if ('' == key) key = pair, val = '';
    if ('' == key) return ret;

    return merge(ret, decode(key), decode(val));
  }, { base: {} }).base;

  return compact(ret);
}

/**
 * Parse the given query `str` or `obj`, returning an object.
 *
 * @param {String} str | {Object} obj
 * @return {Object}
 * @api public
 */

exports.parse = function(str){
  if (null == str || '' == str) return {};
  return 'object' == typeof str
    ? parseObject(str)
    : parseString(str);
};

/**
 * Turn the given `obj` into a query string
 *
 * @param {Object} obj
 * @return {String}
 * @api public
 */

var stringify = exports.stringify = function(obj, prefix) {
  if (isArray(obj)) {
    return stringifyArray(obj, prefix);
  } else if ('[object Object]' == toString.call(obj)) {
    return stringifyObject(obj, prefix);
  } else if ('string' == typeof obj) {
    return stringifyString(obj, prefix);
  } else {
    return prefix + '=' + encodeURIComponent(String(obj));
  }
};

/**
 * Stringify the given `str`.
 *
 * @param {String} str
 * @param {String} prefix
 * @return {String}
 * @api private
 */

function stringifyString(str, prefix) {
  if (!prefix) throw new TypeError('stringify expects an object');
  return prefix + '=' + encodeURIComponent(str);
}

/**
 * Stringify the given `arr`.
 *
 * @param {Array} arr
 * @param {String} prefix
 * @return {String}
 * @api private
 */

function stringifyArray(arr, prefix) {
  var ret = [];
  if (!prefix) throw new TypeError('stringify expects an object');
  for (var i = 0; i < arr.length; i++) {
    ret.push(stringify(arr[i], prefix + '[' + i + ']'));
  }
  return ret.join('&');
}

/**
 * Stringify the given `obj`.
 *
 * @param {Object} obj
 * @param {String} prefix
 * @return {String}
 * @api private
 */

function stringifyObject(obj, prefix) {
  var ret = []
    , keys = objectKeys(obj)
    , key;

  for (var i = 0, len = keys.length; i < len; ++i) {
    key = keys[i];
    if ('' == key) continue;
    if (null == obj[key]) {
      ret.push(encodeURIComponent(key) + '=');
    } else {
      ret.push(stringify(obj[key], prefix
        ? prefix + '[' + encodeURIComponent(key) + ']'
        : encodeURIComponent(key)));
    }
  }

  return ret.join('&');
}

/**
 * Set `obj`'s `key` to `val` respecting
 * the weird and wonderful syntax of a qs,
 * where "foo=bar&foo=baz" becomes an array.
 *
 * @param {Object} obj
 * @param {String} key
 * @param {String} val
 * @api private
 */

function set(obj, key, val) {
  var v = obj[key];
  if (Object.getOwnPropertyDescriptor(Object.prototype, key)) return;
  if (undefined === v) {
    obj[key] = val;
  } else if (isArray(v)) {
    v.push(val);
  } else {
    obj[key] = [v, val];
  }
}

/**
 * Locate last brace in `str` within the key.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function lastBraceInKey(str) {
  var len = str.length
    , brace
    , c;
  for (var i = 0; i < len; ++i) {
    c = str[i];
    if (']' == c) brace = false;
    if ('[' == c) brace = true;
    if ('=' == c && !brace) return i;
  }
}

/**
 * Decode `str`.
 *
 * @param {String} str
 * @return {String}
 * @api private
 */

function decode(str) {
  try {
    return decodeURIComponent(str.replace(/\+/g, ' '));
  } catch (err) {
    return str;
  }
}

},{}],55:[function(require,module,exports){

/**
 * Module dependencies.
 */

var utils = require('../utils');

/**
 * Expose `Route`.
 */

module.exports = Route;

/**
 * Initialize `Route` with the given HTTP `method`, `path`,
 * and an array of `callbacks` and `options`.
 *
 * Options:
 *
 *   - `sensitive`    enable case-sensitive routes
 *   - `strict`       enable strict matching for trailing slashes
 *
 * @param {String} method
 * @param {String} path
 * @param {Array} callbacks
 * @param {Object} options.
 * @api private
 */

function Route(method, path, callbacks, options) {
  options = options || {};
  this.path = path;
  this.method = method;
  this.callbacks = callbacks;
  this.regexp = utils.pathRegexp(path
    , this.keys = []
    , options.sensitive
    , options.strict);
}

/**
 * Check if this route matches `path`, if so
 * populate `.params`.
 *
 * @param {String} path
 * @return {Boolean}
 * @api private
 */

Route.prototype.match = function(path){
  var keys = this.keys
    , params = this.params = []
    , m = this.regexp.exec(path);

  if (!m) return false;

  for (var i = 1, len = m.length; i < len; ++i) {
    var key = keys[i - 1];

    var val = 'string' == typeof m[i]
      ? decodeURIComponent(m[i])
      : m[i];

    if (key) {
      params[key.name] = val;
    } else {
      params.push(val);
    }
  }

  return true;
};

},{"../utils":56}],56:[function(require,module,exports){

/**
 * Module dependencies.
 */

/**
 * toString ref.
 */

var toString = {}.toString;

/**
 * Return ETag for `body`.
 *
 * @param {String|Buffer} body
 * @return {String}
 * @api private
 */

exports.etag = function(body){
  return '"' + crc32.signed(body) + '"';
};

/**
 * Make `locals()` bound to the given `obj`.
 *
 * This is used for `app.locals` and `res.locals`.
 *
 * @param {Object} obj
 * @return {Function}
 * @api private
 */

exports.locals = function(obj){
  function locals(obj){
    for (var key in obj) locals[key] = obj[key];
    return obj;
  };

  return locals;
};

/**
 * Check if `path` looks absolute.
 *
 * @param {String} path
 * @return {Boolean}
 * @api private
 */

exports.isAbsolute = function(path){
  if ('/' == path[0]) return true;
  if (':' == path[1] && '\\' == path[2]) return true;
};

/**
 * Flatten the given `arr`.
 *
 * @param {Array} arr
 * @return {Array}
 * @api private
 */

exports.flatten = function(arr, ret){
  var ret = ret || []
    , len = arr.length;
  for (var i = 0; i < len; ++i) {
    if (Array.isArray(arr[i])) {
      exports.flatten(arr[i], ret);
    } else {
      ret.push(arr[i]);
    }
  }
  return ret;
};

/**
 * Normalize the given `type`, for example "html" becomes "text/html".
 *
 * @param {String} type
 * @return {Object}
 * @api private
 */

exports.normalizeType = function(type){
  return ~type.indexOf('/')
    ? acceptParams(type)
    : { value: mime.lookup(type), params: {} };
};

/**
 * Normalize `types`, for example "html" becomes "text/html".
 *
 * @param {Array} types
 * @return {Array}
 * @api private
 */

exports.normalizeTypes = function(types){
  var ret = [];

  for (var i = 0; i < types.length; ++i) {
    ret.push(exports.normalizeType(types[i]));
  }

  return ret;
};

/**
 * Return the acceptable type in `types`, if any.
 *
 * @param {Array} types
 * @param {String} str
 * @return {String}
 * @api private
 */

exports.acceptsArray = function(types, str){
  // accept anything when Accept is not present
  if (!str) return types[0];

  // parse
  var accepted = exports.parseAccept(str)
    , normalized = exports.normalizeTypes(types)
    , len = accepted.length;

  for (var i = 0; i < len; ++i) {
    for (var j = 0, jlen = types.length; j < jlen; ++j) {
      if (exports.accept(normalized[j], accepted[i])) {
        return types[j];
      }
    }
  }
};

/**
 * Check if `type(s)` are acceptable based on
 * the given `str`.
 *
 * @param {String|Array} type(s)
 * @param {String} str
 * @return {Boolean|String}
 * @api private
 */

exports.accepts = function(type, str){
  if ('string' == typeof type) type = type.split(/ *, */);
  return exports.acceptsArray(type, str);
};

/**
 * Check if `type` array is acceptable for `other`.
 *
 * @param {Object} type
 * @param {Object} other
 * @return {Boolean}
 * @api private
 */

exports.accept = function(type, other){
  var t = type.value.split('/');
  return (t[0] == other.type || '*' == other.type)
    && (t[1] == other.subtype || '*' == other.subtype)
    && paramsEqual(type.params, other.params);
};

/**
 * Check if accept params are equal.
 *
 * @param {Object} a
 * @param {Object} b
 * @return {Boolean}
 * @api private
 */

function paramsEqual(a, b){
  return !Object.keys(a).some(function(k) {
    return a[k] != b[k];
  });
}

/**
 * Parse accept `str`, returning
 * an array objects containing
 * `.type` and `.subtype` along
 * with the values provided by
 * `parseQuality()`.
 *
 * @param {Type} name
 * @return {Type}
 * @api private
 */

exports.parseAccept = function(str){
  return exports
    .parseParams(str)
    .map(function(obj){
      var parts = obj.value.split('/');
      obj.type = parts[0];
      obj.subtype = parts[1];
      return obj;
    });
};

/**
 * Parse quality `str`, returning an
 * array of objects with `.value`,
 * `.quality` and optional `.params`
 *
 * @param {String} str
 * @return {Array}
 * @api private
 */

exports.parseParams = function(str){
  return str
    .split(/ *, */)
    .map(acceptParams)
    .filter(function(obj){
      return obj.quality;
    })
    .sort(function(a, b){
      if (a.quality === b.quality) {
        return a.originalIndex - b.originalIndex;
      } else {
        return b.quality - a.quality;
      }
    });
};

/**
 * Parse accept params `str` returning an
 * object with `.value`, `.quality` and `.params`.
 * also includes `.originalIndex` for stable sorting
 *
 * @param {String} str
 * @return {Object}
 * @api private
 */

function acceptParams(str, index) {
  var parts = str.split(/ *; */);
  var ret = { value: parts[0], quality: 1, params: {}, originalIndex: index };

  for (var i = 1; i < parts.length; ++i) {
    var pms = parts[i].split(/ *= */);
    if ('q' == pms[0]) {
      ret.quality = parseFloat(pms[1]);
    } else {
      ret.params[pms[0]] = pms[1];
    }
  }

  return ret;
}

/**
 * Escape special characters in the given string of html.
 *
 * @param  {String} html
 * @return {String}
 * @api private
 */

exports.escape = function(html) {
  return String(html)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

/**
 * Normalize the given path string,
 * returning a regular expression.
 *
 * An empty array should be passed,
 * which will contain the placeholder
 * key names. For example "/user/:id" will
 * then contain ["id"].
 *
 * @param  {String|RegExp|Array} path
 * @param  {Array} keys
 * @param  {Boolean} sensitive
 * @param  {Boolean} strict
 * @return {RegExp}
 * @api private
 */

exports.pathRegexp = function(path, keys, sensitive, strict) {
  if (toString.call(path) == '[object RegExp]') return path;
  if (Array.isArray(path)) path = '(' + path.join('|') + ')';
  path = path
    .concat(strict ? '' : '/?')
    .replace(/\/\(/g, '(?:/')
    .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?(\*)?/g, function(_, slash, format, key, capture, optional, star){
      keys.push({ name: key, optional: !! optional });
      slash = slash || '';
      return ''
        + (optional ? '' : slash)
        + '(?:'
        + (optional ? slash : '')
        + (format || '') + (capture || (format && '([^/.]+?)' || '([^/]+?)')) + ')'
        + (optional || '')
        + (star ? '(/*)?' : '');
    })
    .replace(/([\/.])/g, '\\$1')
    .replace(/\*/g, '(.*)');
  return new RegExp('^' + path + '$', sensitive ? '' : 'i');
}

},{}],57:[function(require,module,exports){
(function (global){
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

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImluZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbInZhciBEZXJieVN0YW5kYWxvbmUgPSByZXF1aXJlKCdkZXJieS9saWIvRGVyYnlTdGFuZGFsb25lJyk7XG5nbG9iYWwuZGVyYnkgPSBtb2R1bGUuZXhwb3J0cyA9IG5ldyBEZXJieVN0YW5kYWxvbmUoKTtcblxubW9kdWxlLmV4cG9ydHMuQXBwLnByb3RvdHlwZS5yZWdpc3RlclZpZXdzID0gZnVuY3Rpb24oc2VsZWN0b3IpIHtcbiAgc2VsZWN0b3IgfHwgKHNlbGVjdG9yID0gJ3NjcmlwdFt0eXBlPVwidGV4dC90ZW1wbGF0ZVwiXScpO1xuICB2YXIgdGVtcGxhdGVzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChzZWxlY3Rvcik7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdGVtcGxhdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHRlbXBsYXRlID0gdGVtcGxhdGVzW2ldO1xuICAgIHRoaXMudmlld3MucmVnaXN0ZXIodGVtcGxhdGUuaWQsIHRlbXBsYXRlLmlubmVySFRNTCwgdGVtcGxhdGUuZGF0YXNldCk7XG4gIH1cbn07XG5cbi8vIEluY2x1ZGUgdGVtcGxhdGUgYW5kIGV4cHJlc3Npb24gcGFyc2luZ1xucmVxdWlyZSgnZGVyYnkvbm9kZV9tb2R1bGVzL2RlcmJ5LXBhcnNpbmcnKTtcbiJdfQ==
},{"derby/lib/DerbyStandalone":11,"derby/node_modules/derby-parsing":20}]},{},[57])


//# sourceMappingURL=derby-standalone.map.json