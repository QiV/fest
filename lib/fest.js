var fs = require('fs'),
  compile = require('./compile'),
  compile_lua = require('./compile_lua'),
  compile_require = require('./compile_require'),
  compile_tmpl = require('./compile_tmpl');

var Fest = function () {};

Fest.prototype = {
  compile: compile,
  compile_lua: compile_lua,
  compile_require: compile_require,

  render: function (file, json, options) {
    var compiled = this.compile(file, options),
      template = (new Function('return ' + compiled))();
    return template(json);
  },

  compile_tmpl: compile_tmpl
  /*
  compileTpl: function(file, source, wrapper) {
    var wrapperFile = __dirname + '/wrappers/' + wrapper;

    try {
      var wrapperTemplate = fs.readFileSync(wrapperFile, 'utf-8');

      file = file.replace(/\'/g, "\\'").replace(/\"/g, '\\"').replace(/\\/g, '\\');

      return wrapperTemplate.replace(/##file##/g, file).replace(/##source##/g, source);

    } catch(e) {
      console.error('Postcompile wrapper template file '+wrapperFile+' dosn\'t exists')
      process.exit();
    }
  }
*/
};

module.exports = new Fest();
