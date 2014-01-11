var compile = (function(){
  "use strict";

  /*
    TODO
      deprecate fest:attributes?
      shortcuts for fest:attribute
      less strict sax parser
   */

  var fs = null, dirname, isAbsolutePath;
  var __log_error = (typeof __fest_error !== 'undefined' ? __fest_error : console.error);

  if (typeof require === 'function'){
    fs = require('fs');
  }

  var readFileSync = function(file, encoding){
    var result = '',
      read_file = (typeof __read_file === 'function' ? __read_file : fs.readFileSync);
    try {
      result = read_file(file, encoding);
    }catch (e){
      __log_error('error open file "' + file + '", ' + e.message);
      return '';
    }
    if (typeof result === 'undefined'){
      __log_error('error check file "' + file + '"');
      return '';
    }
    return result;
  };

  dirname = function(path){
    var idx = path.lastIndexOf('/'),
      root = (idx === 0) ? 1 : 0;
    if (idx === -1) {
      // Primitive support for Windows platform
      idx = path.lastIndexOf('\\');
      root = (idx > 1 && (path[idx - 1] === ':')) ? 1 : 0;
    }
    return idx != -1 ? path.substring(0, idx + root) : '.';
  };

  isAbsolutePath = function(path){
    if (path.length) {
      if (path[0] === '/') {
        return true;
      } else if (path.length > 3) {
        return (path[1] === ':' && path[2] === '\\');
      }
    }
    return false;
  };

  var sax = (new Function(readFileSync(__dirname + '/sax.js').toString() + ' return sax;'))();
  var js_beautify = (new Function(readFileSync(__dirname + '/beautify.js').toString() + ' return js_beautify;'))();
  var translate = (new Function('return ' + readFileSync(__dirname + '/translate.js').toString()))();

  var fest_ns = 'http://fest.mail.ru';

  var short_tags = {area: true, base: true, br: true, col: true, command: true,
            embed: true, hr: true, img: true, input: true, keygen: true,
            link: true, meta: true, param: true, source: true, wbr: true };

  var jschars=/[\\'"\/\n\r\t\b\f<>]/g;
  var htmlchars=/[&<>"]/g;

  var jshash = {
    "\"":"\\\"",
    "\\":"\\\\",
    "/" :"\\/",
    "\n":"\\n",
    "\r":"\\r",
    "\t":"\\t",
    "\b":"\\b",
    "\f":"\\f",
    "'" :"\\'",
    "<" :"\\u003C",
    ">" :"\\u003E"
  };

  var htmlhash = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  };

  var reName = /^(?!(?:do|if|in|for|let|new|try|var|case|else|enum|eval|false|null|this|true|void|with|break|catch|class|const|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|default|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$)[$A-Z\_a-z][$A-Z\_a-z0-9]*$/;
  var nsTags = 'doctype,comment,cdata,n,space,if,else,elseif,switch,case,default,value,insert,for,set,get,include'.split(',');
  function escapeJS(s){
    return s;
    /*return s.replace(jschars, function (chr){
      return jshash[chr];
    });*/
  }

  function escapeHTML(s){
    return s.replace(htmlchars,function(chr){
      return htmlhash[chr];
    });
  }

  function getName(name){
    if (/^[a-zA-Z_]+$/.test(name)){
      return '.' + name;
    } else {
      return '["' + escapeJS(name) + '"]';
    }
  }

  function compileAttributes(attrs, section) {
    var i, result = { 'text': '', 'expr': [], 'name': [] }, n = 0, attrValue = '';
    for (i in attrs){
      attrValue = attrs[i].value.replace(/{{/g, "__DOUBLE_LEFT_CURLY_BRACES__").replace(/}}/g, "__DOUBLE_RIGHT_CURLY_BRACES__");

      section.source += '\ntable.insert(html,[=[ ' + i + '="]=])\n';

      //result.text += ' ' + i + '=\\"'
      attrValue.match(/{[^}]*}|[^{}]*/g).forEach(function (str) {
        if (str !== '') {
          if (str[0] === '{') {
            result.name[n] = i;
            result.expr[n] = str.slice(1, -1).replace(/__DOUBLE_LEFT_CURLY_BRACES__/g, "{").replace(/__DOUBLE_RIGHT_CURLY_BRACES__/g, "}");
            //result.text += '" .. fest_attrs[' + n++ + '] .. "';

            section.source += '\ntable.insert(html, ' + getLuaExpr(result.expr[n]) + ')';
          
          } else {
            section.source += '\ntable.insert(html,[=[' + str.replace(/__DOUBLE_LEFT_CURLY_BRACES__/g, "{").replace(/__DOUBLE_RIGHT_CURLY_BRACES__/g, "}") + ']=])';
          }
        }
      });
      section.source += '\ntable.insert(html,[=["]=])';
    }
    return result;
  }

  function errorMessage(msg, badLine, file) {
    function zeroPadding(s, len) {
      if (s.toString().length >= len){
        return s + "";
      }
      return String(new Array(len + 1).join('0') + s).slice(-len);
    }

    function numSort(a, b) {
      return a - b;
    }

    function leftWhitespace(s) {
      return s.length - s.trimLeft().length;
    }

    var before = 1, after = 1,
      lines = file.split('\n'),
      badPlace = [],
      num = [];

    for (var i = badLine - before; i <= badLine + after; i++) {
      if (lines[i] !== undefined){
        num.push(i);
      }
    }

    var longest = num.sort(numSort)[num.length - 1].toString().length,
      minWhitespace = num.slice(0)
        .map(function(n) { return leftWhitespace(lines[n]); })
        .sort(numSort)[0];

    num.forEach(function(n) {
      badPlace.push(
        ('%n%: ' + lines[n].slice(minWhitespace)).replace('%n%', zeroPadding(n + 1, longest))
      );
    });

    return [badPlace.join('\n'), 'At line ' + zeroPadding(badLine + 1, longest) + ': ' + msg].join('\n');
  }

  function getExpr(compile_file, parser) {
    return function(value, where) {
      try {
        value = value.replace(/;+\s*$/,'');

        (new Function('(' + value + ')'));
      } catch (e) {
        throw new Error(errorMessage((where || 'node') + ' has ' + e, parser.line, compile_file));
      }
      return getLuaExpr(value);
    };
  }

  function getLuaExpr(val) {
    val = val
      .replace(/\&\&/g, ' and ')
      .replace(/\|\|/g, ' or ')
      .replace(/\!/g, ' not ');
    if (val.indexOf('?') === -1)
      val = val.replace(/\:/g, '=');// object notation
    else
      val = val.replace(/\:/g, ' or ');// ternar operator
    
    val = val
      .replace(/\?/g, ' and ')
    
    return val;
  }

  function getEval(compile_file, parser) {
    return function(value) {
      try {
        (new Function(value));
      } catch (e) {
        throw new Error(errorMessage('node has ' + e, parser.line, compile_file));
      }
      return value;
    };
  }

  function getAttr(compile_file, parser) {
    return function(node, attr, type) {
      var value;
      try {
        value = node.attributes[attr].value;
      } catch (e) {
        throw new Error(errorMessage('attribute "' + attr + '" is missing', parser.line, compile_file));
      }
      if (type === 'expr') {
        try {
          (new Function('(' + value + ')'));
        } catch (e) {
          throw new Error(errorMessage('attribute "' + attr + '" has ' + e, parser.line, compile_file));
        }
      } else if (type === 'var') {
        if (!reName.test(value)) {
          throw new Error(errorMessage('attribute "' + attr + '" has an invalid identifier', parser.line, compile_file));
        }
      }
      return getLuaExpr(value);
    };
  }

  function push_debug_info(section, parser, compile_file, block, debug){
    if (!debug){
      return;
    }
    section.source += '__fest_debug_file="' + escapeJS(compile_file) + '";';
    section.source += '__fest_debug_line="' + parser.line + '";';
    section.source += '__fest_debug_block="' + block + '";';
  }

  function _compile (data){
    var file = data.file,
      context_name = data.context_name,
      options = data.options,
      output = data.output,
      inline_get_blocks = data.inline_get_blocks;

    output = output || {sections: [], uses: {}};

    function resolveFilename(filename) {
      if (isAbsolutePath(filename)) {
        return filename;
      } else {
        return dirname(file) + '/' + filename;
      }
    }

    var counters = {counter: 0, promises: 1},
      choose = [],
      stack = [],
      fstack = [],
      section = flush(),
      opentag = false,
      templateClosed = false,
      parser = sax.parser(options.sax.strict, options.sax),
      // compile_file = readFileSync(file, 'utf-8'),
      compile_file = translate({
        file: file,
        template: readFileSync(file, 'utf-8'),
        sax: sax,
        fest_ns: fest_ns,
        errorMessage: errorMessage,
        escapeHTML: escapeHTML,
        options: options
      }),
      _getAttr = getAttr(compile_file, parser),
      _getExpr = getExpr(compile_file, parser),
      _getEval = getEval(compile_file, parser),
      attrs;

    function should_inline_get_blocks() {
      return inline_get_blocks || stack.indexOf('set') !== -1 || stack.indexOf('param') !== -1;
    }

    function closetag(name, opentag){
      if (!opentag){
        return false;
      }
      if (stack.indexOf('attributes') >= 0 || name === 'attributes'){
        return opentag;
      }
      if (stack[stack.length - 1] === 'shorttag'){
        section.source += '\ntable.insert(html, [=[/>]=])\n';
      } else if (stack[stack.length - 1] === 'element') {
        section.source += '\nfest_element = fest_element_stack[#fest_element_stack-1]\n';
        section.source += '\ntable.insert(html, fest_short_tags[fest_element] and "/>" or ">")\n';
      } else {
        section.source += '\ntable.insert(html, [=[>]=])\n';
      }
      return false;
    }

    function flush(name) {
      var section = {
        source: '',
        name: name
      };
      output.sections.push(section);
      return section;
    }

    parser.onopentag = function (node) {
      push_debug_info(section, parser, file, node.name, options.debug);

      opentag = closetag(node.local, opentag);

      if (node.local == 'set' && should_inline_get_blocks()) {
        throw new Error(file + "\n" + errorMessage('fest:set cannot be defined in another fest:set or fest:param', parser.line, compile_file));
      }
      if (['include', 'set', 'get'].indexOf(node.local) !== -1 && stack.indexOf('var') !== -1) {
        throw new Error(file + "\n" + errorMessage('fest:' + node.local +' is not allowed inside fest:var', parser.line, compile_file));
      }

      if (nsTags.indexOf(node.local) === -1) {
        section.source += '\ntable.insert(html,[=[<' + node.name + ']=])\n';
        attrs = compileAttributes(node.attributes, section);
        stack.push('html:' + node.name);
        stack.push(node.name in short_tags ? 'shorttag' : 'tag');
        opentag = true;
        return;
      } else {
        fstack.push(node);
      }
      stack.push(node.local);

      switch (node.local){
        case 'doctype':
          section.source += '\ntable.insert(html,[=[<!DOCTYPE ]=])\n';
          return;
        case 'comment':
          section.source += '\ntable.insert(html,[=[<!--]=])\n';
          return;
        case 'cdata':
          section.source += '\ntable.insert(html,"<![CDATA[")\n';
          return;
        case 'text':
          section.source += node.attributes.value ? '\ntable.insert(html,[=[' + escapeJS(_getAttr(node, 'value')) + ']=])\n' : '';
          return;

        case 'n':
          section.source += '\ntable.insert(html,[=["\\n"]=])\n';
          break;
        case 'space':
          section.source += '\ntable.insert(html,[=[" "]=])\n';
          return;

        case 'switch':
          section.source += '\n\n';
          return;

        case 'if':
          section.source += '\nif ' + _getAttr(node, 'test', 'expr') + ' then\n';
          return;
        case 'elseif':
          section.source += '\nelseif ' + _getAttr(node, 'test', 'expr') + ' then\n';
          return;
        case 'else':
          section.source += '\nelse\n';
          return;

        case 'value':
          section.source += '\ntable.insert(html,';
          return;

        case 'insert':
          section.source += '\ntable.insert(html,[=[' + escapeJS(readFileSync(resolveFilename(_getAttr(node, 'src')), 'utf-8')) + ']=])\n';
          return;

        case 'for':
          section.source += [
            '',
            'for {index}, {value} in ipairs({iterator} or {}) do'
              .replace('{index}', _getAttr(node, 'index', 'var'))
              .replace('{value}', _getAttr(node, 'value', 'var'))
              .replace('{iterator}', _getAttr(node, 'iterate', 'expr')),
          ].join('\n');
          counters.counter++;
          return;
        case 'set':
          section.source += [
            '',
            'fest_blocks{name} = function(params)'
              .replace('{name}', getName(_getAttr(node, 'name'))),
            '  local html = {}',
            '  params = params or {}',
          ].join('\n');
          section = flush(_getAttr(node, 'name'));
          return;

        case 'get':
          
          return;
        case 'include':
          _compile({
            file: resolveFilename(_getAttr(node, 'src')),
            context_name: context_name,
            options: options,
            output: output,
            inline_get_blocks: should_inline_get_blocks()
          });
          section = flush();
          return;
      }
    };

    parser.onclosetag = function () {
      var node = this.tag;

      opentag = closetag(node.local, opentag);
      stack.pop();

      if (nsTags.indexOf(node.local) === -1) {
        stack.pop();
        if (!(node.name in short_tags)){
          section.source += '\ntable.insert(html,[=[</' + node.name + '>]=])\n';
        }
        return;
      } else {
        fstack.pop();
      }
      switch (node.local){
        case 'doctype':
          section.source += '\ntable.insert(html,[=[>]=])\n';
          return;
        case 'comment':
          section.source += '\ntable.insert(html,[=[-->]=])\n';
          return;
        case 'attribute':
          section.source += '\ntable.insert(html,[=["]=])\n';
          return;
        case 'cdata':
          section.source += '\ntable.insert(html,"]=]>")\n';
          return;
        case 'if':
          section.source += '\nend\n';
          return;
        case 'for':
          section.source += '\nend\n';
          return;

        case 'value':
          section.source += ');';
          return;
        case 'set':
          section.source += [
            '',
            '  return table.concat(html)',
            'end',
          ].join('\n');
          section = flush();
          return;
        case 'get':
          section.source += '\ntable.insert(html,fest_blocks[{block}](fest_params))\n'
            .replace('{block}', node.attributes.select ?
                _getAttr(node, 'select', 'expr')
              : ('"' + _getAttr(node, 'name')) + '"');
          return;

      }
    };

    parser.ontext = parser.oncdata = function (text) {
      opentag = closetag('text', opentag);
      if (stack[stack.length - 1] === 'script') {
        section.source += _getEval(text);
      } else if (stack[stack.length - 1] === 'get') {
        section.source += '\nfest_params=' + _getExpr(text) + '\n';
      } else if (stack[stack.length - 1] === 'value') {
        section.source += _getExpr(text);
      } else {
        section.source += '\ntable.insert(html,[=[' + escapeJS(text) + ']=])\n';
      }
    };
    

    if (compile_file){
      parser.write(compile_file);
    }
    parser.close();

    return output;
  }

  function finish_compile(file, options, name){
    var template;
    name = name || '';

    options = options || {beautify: true, nothrow: false};
    options.sax = options.sax || {trim:true, xmlns:true};
    options.sax.strict = options.sax.strict || true;
    options.mode = options.mode || 'string'; // `function` for __fest_pushstr with +=, `array` for push() and join(), `string` for +=
    options.events = options.events || {};
    // options.messages // messages dictionary
    // options.plural   // plural function

    function build_template(output) {

      var source = '';
      output.sections.forEach(function (section) {
        if (output.disable_sgo || section.name === undefined || output.uses[section.name]) {
          source += section.source;
        }
      });

      template = [
        'local function render ( context )',
        '  local fest_blocks = {}',
        '  local fest_attrs = {}',
        '  local html = {}',
        '  local fest_short_tags = {area = 1, base= 1, br= 1, col= 1, command= 1, embed= 1, hr= 1, img= 1, input= 1, keygen= 1, link= 1, meta= 1, param= 1, source= 1, wbr= 1 }',
        source,
        ' return table.concat(html)',
        'end',
        'return render'
      ].join('\n');

    }

    try {
      build_template(_compile({file:file, context_name:'context', options:options}));
    } catch (e) {
      if (options && !options.nothrow) {
        throw e;
      }
      __log_error(e.message);
      template = 'function() { return "' + escapeJS(e.message) + '"; }';
    }

    return template;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = finish_compile;
  } else {
    return finish_compile;
  }
})();
