'use strict';

require('mocha');
var assert = require('assert');
var utils = require('snapdragon-util');
var Parser = require('snapdragon/lib/parser');
var captureSet = require('..');
var parser;

describe('parser', function() {
  beforeEach(function() {
    parser = new Parser();
    parser.use(captureSet());
  });

  describe('.next', function() {
    it('should get the next node in an array of nodes', function() {
      parser.captureSet('brace', /^\{/, /^\}/);

      parser.set('text', function() {
        var pos = this.position();
        var m = this.match(/^[^{}]/);
        if (!m) return;
        return pos({
          type: 'text',
          val: m[0]
        });
      });

      var ast = parser.parse('a{b,{c,d},e}f');
      assert(utils.hasType(ast, 'brace'));
      assert(utils.hasType(ast.nodes[2], 'brace.open'));
      assert(utils.hasType(ast.nodes[2], 'brace.close'));
    });
  });
});
