'use strict';

var define = require('define-property');
var extend = require('extend-shallow');

/**
 * Adds a `.capture` method to a [snapdragon][] `Parser` instance.
 * Wraps the `.set` method to simplify the interface for creating
 * parsers.
 *
 * ```js
 * var Snapdragon = require('snapdragon');
 * var capture = require('snapdragon-capture');
 * var parser = new Snapdragon.Parser();
 * parser.use(capture());
 * ```
 * @param {String} `type`
 * @param {RegExp|Function} `regex` Pass the regex to use for capturing. Pass a function if you need access to the parser instance.
 * @return {Object} Returns the parser instance for chaining
 * @api public
 */

module.exports = function(options) {
  return function(snapdragon) {
    if (snapdragon.isSnapdragon) {
      snapdragon.parser.use(capture(options));
      snapdragon.define('captureSet', function() {
        return this.parser.captureSet.apply(this.parser, arguments);
      });

    } else if (snapdragon.isParser) {
      snapdragon.use(capture(options));

    } else {
      throw new Error('expected an instance of snapdragon or snapdragon.parser');
    }
  };
};

function capture(options) {
  return function(parser) {
    parser.define('captureOpen', function(type, regex, fn) {
      this.sets[type] = this.sets[type] || [];
      this.set(type + '.open', function() {
        var parsed = this.parsed;
        var pos = this.position();
        var m = this.match(regex);
        if (!m || !m[0]) return;

        this.setCount++;

        var val = m[0];
        var open = pos({
          type: type + '.open',
          val: val
        });

        var prev = this.prev();
        var node = pos({
          type: type,
          nodes: [open]
        });

        // decorate "open"
        define(open, 'match', m);
        define(open, 'parent', node);
        define(open, 'parsed', parsed);
        define(open, 'rest', this.input);

        // decorate "node"
        define(node, 'match', m);
        define(node, 'parent', prev);
        define(node, 'parsed', parsed);
        define(node, 'rest', this.input);

        if (typeof fn === 'function') {
          fn.call(this, open, node);
        }

        this.push(type, node);
        prev.nodes.push(node);
      });

      return this;
    });

    parser.define('captureClose', function(type, regex, fn) {
      if (typeof this.sets[type] === 'undefined') {
        throw new Error('an `.open` type is not registered for ' + type);
      }

      var opts = extend({}, this.options, options);

      this.set(type + '.close', function() {
        var parsed = this.parsed;
        var pos = this.position();
        var m = this.match(regex);
        if (!m || !m[0]) return;

        var parent = this.pop(type);
        var node = pos({
          type: type + '.close',
          suffix: m[1],
          val: m[0]
        });

        if (!this.isType(parent, type)) {
          if (opts.strict) {
            throw new Error('missing opening "' + type + '"');
          }

          this.setCount--;
          node.escaped = true;
          return node;
        }

        if (node.suffix === '\\') {
          parent.escaped = true;
          node.escaped = true;
        }

        parent.nodes.push(node);
        define(node, 'parsed', parsed);
        define(node, 'parent', parent);
        define(node, 'rest', this.input);
      });

      return this;
    });

    /**
     * Create a parser with open and close for parens,
     * brackets or braces
     */

    parser.define('captureSet', function(type, openRegex, closeRegex, fn) {
      this.captureOpen(type, openRegex, fn);
      this.captureClose(type, closeRegex, fn);
      return this;
    });
  };
}
