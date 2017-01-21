'use strict';

var Node = require('snapdragon-node');
var extend = require('extend-shallow');

/**
 * Register the plugin with `snapdragon.use()` or `snapdragon.parser.use()`.
 *
 * ```js
 * var Snapdragon = require('snapdragon');
 * var captureSet = require('snapdragon-capture-set');
 *
 * // snapdragon
 * var snapdragon = new Snapdragon();
 * snapdragon.use(captureSet());
 *
 * // parser
 * snapdragon.parser.use(captureSet());
 * ```
 * @api public
 */

module.exports = function(options) {
  return function(snapdragon) {
    if (snapdragon.isSnapdragon) {
      snapdragon.parser.use(captureSet(options));
      snapdragon.define('captureSet', function() {
        return this.parser.captureSet.apply(this.parser, arguments);
      });

    } else if (snapdragon.isParser) {
      snapdragon.use(captureSet(options));

    } else {
      throw new Error('expected an instance of snapdragon or snapdragon.parser');
    }
  };
};

/**
 * Create a node of the given `type` using the specified regex or function.
 *
 * ```js
 * parser.captureSet('brace', /^\{/, /^\}/);
 * ```
 * @param {String} `type`
 * @param {RegExp|Function} `regex` Pass the regex to use for capturing the `open` and `close` nodes.
 * @return {Object} Returns the parser instance for chaining
 * @api public
 */

function captureSet(options) {
  return function(parser) {
    parser.define('captureOpen', function(type, regex, fn) {
      this.sets[type] = this.sets[type] || [];

      // noop, we really only need the `.open` and `.close` visitors
      this.set(type, function() {});

      // create the `open` visitor for "type"
      this.set(type + '.open', function() {
        var pos = this.position();
        var match = this.match(regex);
        if (!match || !match[0]) return;

        this.setCount++;

        // get the last node, either from `this.stack` or `this.ast.nodes`,
        // so we can push our "parent" node onto the `nodes` array of
        // that node. We don't want to just push it onto the ast, because
        // we need to easily be able to pop it off of a stack when we
        // get the "close" node
        var prev = this.prev();

        // create the "parent" node (ex: "brace")
        var parent = pos(new Node({
          type: type,
          nodes: []
        }));

        // create the "open" node (ex: "brace.open")
        var open = pos(new Node({
          type: type + '.open',
          val: match[0]
        }));

        // push "open" node onto `parent.nodes`, and create
        // a reference to parent on `open.parent`
        parent.pushNode(open);

        // add a non-enumerable reference to the "match" arguments
        open.define('match', match);
        parent.define('match', match);

        if (typeof fn === 'function') {
          fn.call(this, open, parent);
        }

        this.push(type, parent);
        prev.pushNode(parent);
      });

      return this;
    });

    parser.define('captureClose', function(type, regex, fn) {
      if (typeof this.sets[type] === 'undefined') {
        throw new Error('an `.open` type is not registered for ' + type);
      }

      var opts = extend({}, this.options, options);

      // create the `close` visitor for "type"
      this.set(type + '.close', function() {
        var pos = this.position();
        var match = this.match(regex);
        if (!match || !match[0]) return;

        var parent = this.pop(type);
        var close = pos(new Node({
          type: type + '.close',
          val: match[0]
        }));

        if (!this.isType(parent, type)) {
          if (opts.strict) {
            throw new Error('missing opening "' + type + '"');
          }

          this.setCount--;
          close.define('escaped', true);
          return close;
        }

        if (close.suffix === '\\') {
          parent.define('escaped', true);
          close.define('escaped', true);
        }

        parent.pushNode(close);
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
