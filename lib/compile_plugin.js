var compile = (function () {
  "use strict";

  var fs = null,
    dirname, isAbsolutePath;
  var __log_error = (typeof __fest_error !== 'undefined' ? __fest_error : console.error);

  if (typeof require === 'function') {
    fs = require('fs');
  }

  var readFileSync = function (file, encoding) {
    var result = '',
      read_file = (typeof __read_file === 'function' ? __read_file : fs.readFileSync);
    try {
      result = read_file(file, encoding);
    }
    catch (e) {
      __log_error('error open file "' + file + '", ' + e.message);
      return '';
    }
    if (typeof result === 'undefined') {
      __log_error('error check file "' + file + '"');
      return '';
    }
    return result;
  };

  dirname = function (path) {
    var idx = path.lastIndexOf('/'),
      root = (idx === 0) ? 1 : 0;
    if (idx === -1) {
      // Primitive support for Windows platform
      idx = path.lastIndexOf('\\');
      root = (idx > 1 && (path[idx - 1] === ':')) ? 1 : 0;
    }
    return idx != -1 ? path.substring(0, idx + root) : '.';
  };

  isAbsolutePath = function (path) {
    if (path.length) {
      if (path[0] === '/') {
        return true;
      }
      else if (path.length > 3) {
        return (path[1] === ':' && path[2] === '\\');
      }
    }
    return false;
  };

  var sax = (new Function(readFileSync(__dirname + '/sax.js').toString() + ' return sax;'))();
  var js_beautify = (new Function(readFileSync(__dirname + '/beautify.js').toString() + ' return js_beautify;'))();
  var translate = (new Function('return ' + readFileSync(__dirname + '/translate.js').toString()))();

  var fest_ns = 'http://fest.mail.ru';

  var short_tags = {
    area: true,
    base: true,
    br: true,
    col: true,
    command: true,
    embed: true,
    hr: true,
    img: true,
    input: true,
    keygen: true,
    link: true,
    meta: true,
    param: true,
    source: true,
    wbr: true
  };

  var jschars = /[\\'"\/\n\r\t\b\f<>]/g;
  var htmlchars = /[&<>"]/g;

  var jshash = {
    "\"": "\\\"",
    "\\": "\\\\",
    "/": "\\/",
    "\n": "\\n",
    "\r": "\\r",
    "\t": "\\t",
    "\b": "\\b",
    "\f": "\\f",
    "'": "\\'",
    "<": "\\u003C",
    ">": "\\u003E"
  };

  var htmlhash = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  };

  var reName = /^(?!(?:do|if|in|for|let|new|try|var|case|else|enum|eval|false|null|this|true|void|with|break|catch|class|const|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|default|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$)[$A-Z\_a-z][$A-Z\_a-z0-9]*$/;
  var nsTags = 'doctype,comment,cdata,n,space,if,else,elseif,switch,case,default,value,insert,for,set,get,include,param,params,var'.split(',');

  function escapeJS(s) {
    return s.replace(jschars, function (chr) {
      return jshash[chr];
    });
  }

  function escapeHTML(s) {
    return s.replace(htmlchars, function (chr) {
      return htmlhash[chr];
    });
  }

  function getName(name) {
    if (/^[a-zA-Z_]+$/.test(name)) {
      return '.' + name;
    }
    else {
      return '["' + escapeJS(name) + '"]';
    }
  }

  function compileAttributes(attrs) {
    var i, result = {
        'text': '',
        'expr': [],
        'name': []
      }, n = 0,
      attrValue = '';
    for (i in attrs) {
      attrValue = attrs[i].value.replace(/{{/g, "__DOUBLE_LEFT_CURLY_BRACES__").replace(/}}/g, "__DOUBLE_RIGHT_CURLY_BRACES__");

      result.text += ' ' + i + '=\\"'
      attrValue.match(/{[^}]*}|[^{}]*/g).forEach(function (str) {
        if (str !== '') {
          if (str[0] === '{') {
            result.name[n] = i;
            result.expr[n] = str.slice(1, -1).replace(/__DOUBLE_LEFT_CURLY_BRACES__/g, "{").replace(/__DOUBLE_RIGHT_CURLY_BRACES__/g, "}");
            result.text += '"+$.escapeHTML(' + result.expr[n] + ')+"';
          }
          else {
            result.text += escapeJS(escapeHTML(str)).replace(/__DOUBLE_LEFT_CURLY_BRACES__/g, "{").replace(/__DOUBLE_RIGHT_CURLY_BRACES__/g, "}");
          }
        }
      });
      result.text += '\\"';
    }
    return result;
  }

  function compileExpr(attr, _getExpr) {
    var i = 0,
      attrValue = '',
      result = {
        containsExpr: false,
        text: []
      };
    attrValue = attr.value.replace(/{{/g, "__DOUBLE_LEFT_CURLY_BRACES__").replace(/}}/g, "__DOUBLE_RIGHT_CURLY_BRACES__");
    attrValue.match(/{[^}]*}|[^{}]*/g).forEach(function (str) {
      if (str !== '') {
        if (str[0] === '{') {
          i++;
          result.text.push('(' + str.slice(1, -1).replace(/__DOUBLE_LEFT_CURLY_BRACES__/g, "{").replace(/__DOUBLE_RIGHT_CURLY_BRACES__/g, "}") + ')');
          _getExpr(result.text[result.text.length - 1], 'expression #' + (i) + ' in attribute "' + attr.name + '"');
          result.containsExpr = true;
        }
        else {
          result.text.push('"' + escapeJS(escapeHTML(str)).replace(/__DOUBLE_LEFT_CURLY_BRACES__/g, "{").replace(/__DOUBLE_RIGHT_CURLY_BRACES__/g, "}") + '"');
        }
      }
    });
    result.text = result.text.join('+');
    return result;
  }

  function errorMessage(msg, badLine, file) {
    function zeroPadding(s, len) {
      if (s.toString().length >= len) {
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

    var before = 1,
      after = 1,
      lines = file.split('\n'),
      badPlace = [],
      num = [];

    for (var i = badLine - before; i <= badLine + after; i++) {
      if (lines[i] !== undefined) {
        num.push(i);
      }
    }

    var longest = num.sort(numSort)[num.length - 1].toString().length,
      minWhitespace = num.slice(0)
        .map(function (n) {
          return leftWhitespace(lines[n]);
        })
        .sort(numSort)[0];

    num.forEach(function (n) {
      badPlace.push(
        ('%n%: ' + lines[n].slice(minWhitespace)).replace('%n%', zeroPadding(n + 1, longest))
      );
    });

    return [badPlace.join('\n'), 'At line ' + zeroPadding(badLine + 1, longest) + ': ' + msg].join('\n');
  }

  function getExpr(compile_file, parser) {
    return function (value, where) {
      try {
        value = value.replace(/;+\s*$/, '');
        (new Function('(' + value + ')'));
      }
      catch (e) {
        throw new Error(errorMessage((where || 'node') + ' has ' + e, parser.line, compile_file));
      }
      return value;
    };
  }

  function getEval(compile_file, parser) {
    return function (value) {
      try {
        (new Function(value));
      }
      catch (e) {
        throw new Error(errorMessage('node has ' + e, parser.line, compile_file));
      }
      return value;
    };
  }

  function getAttr(compile_file, parser) {
    return function (node, attr, type) {
      var value;
      try {
        value = node.attributes[attr].value;
      }
      catch (e) {
        throw new Error(errorMessage('attribute "' + attr + '" is missing', parser.line, compile_file));
      }
      if (type === 'expr') {
        try {
          (new Function('(' + value + ')'));
        }
        catch (e) {
          throw new Error(errorMessage('attribute "' + attr + '" has ' + e, parser.line, compile_file));
        }
      }
      else if (type === 'var') {
        if (!reName.test(value)) {
          throw new Error(errorMessage('attribute "' + attr + '" has an invalid identifier', parser.line, compile_file));
        }
      }
      return value;
    };
  }

  function push_debug_info(section, parser, compile_file, block, debug) {
    if (!debug) {
      return;
    }
    section.source.push('__fest_debug_file="{file}";'.replace('{file}', escapeJS(compile_file)));
    section.source.push('__fest_debug_line="{line}";'.replace('{line}', parser.line));
    section.source.push('__fest_debug_block="{block}";'.replace('{block}', block));
  }

  function _compile(data) {
    var file = data.file,
      context_name = data.context_name,
      options = data.options,
      output = data.output,
      inline_get_blocks = data.inline_get_blocks;

    output = output || {
      sections: [],
      uses: {}
    };

    function resolveFilename(filename) {
      if (isAbsolutePath(filename)) {
        return filename;
      }
      else {
        return dirname(file) + '/' + filename;
      }
    }

    var counters = {
      counter: 0,
      promises: 1
    },
      choose = [],
      stack = [],
      fstack = [],
      section = flush(),
      opentag = false,
      templateClosed = false,
      parser = sax.parser(options.sax.strict, options.sax),
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

    function closetag(name, opentag) {
      if (!opentag) {
        return false;
      }
      if (stack.indexOf('attributes') >= 0 || name === 'attributes') {
        return opentag;
      }
      if (stack[stack.length - 1] === 'shorttag') {
        section.source.push('"/>"');
      }
      else {
        section.source.push('">"');
      }
      return false;
    }

    function flush(name) {
      var section = {
        source: [],
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
      if (['include', 'set'].indexOf(node.local) !== -1 && stack.indexOf('var') !== -1) {
        throw new Error(file + "\n" + errorMessage('fest:' + node.local + ' is not allowed inside fest:var', parser.line, compile_file));
      }

      if (nsTags.indexOf(node.local) === -1) {
        attrs = compileAttributes(node.attributes);
        stack.push('html:' + node.name);
        stack.push(node.name in short_tags ? 'shorttag' : 'tag');
        opentag = true;
        section.source.push('"<{name}{attrs}"'
          .replace('{name}', node.name)
          .replace('{attrs}', attrs.text)
        );
        return;
      }
      else {
        fstack.push(node);
      }
      stack.push(node.local);

      switch (node.local) {
      case 'doctype':
        section.source.push('"<!DOCTYPE "');
        return;
      case 'comment':
        section.source.push('"<!--"');
        return;
      case 'cdata':
        section.source.push('"<![CDATA["');
        return;
      case 'n':
        section.source.push('"\n"');
        return;
      case 'space':
        section.source.push('" "');
        return;
      case 'switch':
        section.source.push([
          '(function(){',
            'switch ({val}) {'
            .replace('{val}', _getAttr(node, 'test', 'expr'))
        ].join(''));
        break;
      case 'case':
        section.source.push(section.source.pop() + 'case {val}:'
          .replace('{val}', _getAttr(node, 'is', 'expr'))
        );
        return;
      case 'default':
        section.source.push(section.source.pop() + 'default:');
        return;
      case 'if':
        section.source.push([
          '(function(){',
            'if ({val}) {',
            'return ""'
        ].join('').replace('{val}', _getAttr(node, 'test', 'expr')));
        return;
      case 'elseif':
        section.source.push(section.source.pop() + [
          '} else if ({val}) {',
            'return ""'
        ].join('').replace('{val}', _getAttr(node, 'test', 'expr')));
        return;
      case 'else':
        section.source.push(section.source.pop() + '} else { return ""');
        return;
      case 'value':
        if (node.attributes.escape)
          switch (node.attributes.escape.value) {
          case 'html':
            section.source.push('$.escapeHTML(');
            break;
          case 'js':
            section.source.push('$.escapeJS(');
            break;
          case 'json':
            section.source.push('$.escapeJSON(');
            break;
          }
        return;
      case 'insert':
        section.source.push('"' + escapeJS(readFileSync(resolveFilename(_getAttr(node, 'src')), 'utf-8')) + '"');
        return;
      case 'for':
        section.source.push([
            '(function(){',
              'var buf = "";',
              'for(var {i} = 0, {i}l = {list}.length; {i} < {i}l ; {i}++) {',
                'var {value} = {list}[{i}];',
                'buf += ""'
          ].join('')
          .replace(/\{i\}/g, _getAttr(node, 'index', 'var'))
          .replace(/\{list\}/g, _getAttr(node, 'iterate', 'expr'))
          .replace(/\{value\}/g, _getAttr(node, 'value'))
        );
        return;
      case 'set':
        section.source.push([
            'BLOCKS{name} = function(params) {',
              'return '
          ].join('')
          .replace('{name}', getName(_getAttr(node, 'name')))
        );
        section = flush(_getAttr(node, 'name'));
        return;
      case 'get':
        var tmpName = node.attributes.select ?
          _getAttr(node, 'select', 'expr') : _getAttr(node, 'name')
        var caseGetName = ['<<', 'get', tmpName, '>>'].join('-');
        section.source.push(caseGetName);
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
      case 'var':
        section.source.push(
          '(var {name} = {value}'
          .replace('{name}', _getAttr(node, 'name'))
          .replace('{value}', node.attributes.value ? _getAttr(node, 'value')
            : (node.attributes.select ? '(' + _getAttr(node, 'select', 'expr') + ')'
              : '""')
          )
        );
        return;
      case 'param':
        section.source.push(section.source.pop() +
          ',getParams.{name} = {value}'
          .replace('{name}', node.attributes.name.value)
          .replace('{value}', node.attributes.value ? _getAttr(node, 'value', 'var')
            : (node.attributes.select ? '(' + _getAttr(node, 'select', 'expr') + ')'
              : '""')
          )
        );
        return;
      case 'params':
        section.source.push(',extend(getParams, ');
        return;
      }
    };

    parser.onclosetag = function () {
      var node = this.tag;

      opentag = closetag(node.local, opentag);

      stack.pop();
      if (nsTags.indexOf(node.local) === -1) {
        stack.pop();
        if (!(node.name in short_tags)) {
          section.source.push('"</{name}>"'.replace('{name}', node.name));
        }
        return;
      }
      else {
        fstack.pop();
      }
      switch (node.local) {
      case 'doctype':
        section.source.push('">"');
        return;
      case 'comment':
        section.source.push('"-->"');
        return;
      case 'cdata':
        section.source.push('"]]>"');
        return;
      case 'for':
        section.source.push(section.source.pop() + [
            '}',
            'return buf',
          '}())'
        ].join(''));
        return;
      case 'switch':
      case 'if':
        section.source.push(section.source.pop() + '}}()||"")');
        return;
      case 'case':
      case 'default':
        section.source.push(section.source.pop() + 'return ""');
        return;
      case 'value':
        if (node.attributes.escape)
          switch (node.attributes.escape.value) {
          case 'html':
          case 'js':
          case 'json':
            section.source.push(')');
            break;
          }
        return;
      case 'set':
        section.source.push('}');
        section = flush();
        return;
      case 'get':
        var caseGetName = ['<<', 'get', (
          node.attributes.select ?
          _getAttr(node, 'select', 'expr') :
          _getAttr(node, 'name')
        ), '>>'].join('-');

        var getSource = [];
        getSource.unshift(section.source.pop());
        while (getSource[0] !== caseGetName) {
          getSource.unshift(section.source.pop());
        }
        getSource.shift();// выкидываем caseGetName
        var onTextParamed = getSource.length < 2;// был ли только текст и никаких params\param
        section.source.push(
          '{return} require({name})({getParams={},}{params}{,getParams})'
          .replace('{return}', node.attributes.return ? 'return' : '')
          .replace('{name}', node.attributes.select ? _getAttr(node, 'select', 'expr')
            : ('"' + _getAttr(node, 'name') + '-template"')
          )
          .replace('{getParams={},}', onTextParamed ? '' : 'getParams={}')
          .replace('{params}', getSource.join('+'))
          .replace('{,getParams}', onTextParamed ? '' : ',getParams')
        );

        return;
      case 'params':
        var paramsSource = [];
        paramsSource.unshift(section.source.pop());
        while (paramsSource[0] !== ',extend(getParams, ') {
          paramsSource.unshift(section.source.pop());
        }
        paramsSource.push(')');
        section.source.push(paramsSource.join(''));
        return;
      case 'param':
        return;
      case 'var':
        section.source.push(section.source.pop() + ';"")');
        return;
      }
    };

    parser.oncdata = function (text) {
      opentag = closetag('text', opentag);
      section.source.push('"' + escapeJS(text) + '"');
    }

    parser.ontext = function (text) {
      opentag = closetag('text', opentag);
      switch (stack[stack.length - 1]) {
      case 'script':
        section.source.push(_getEval(text));
        break;
      case 'get':
      case 'var':
      case 'value':
      case 'param':
      case 'params':
        var tmpExpr = _getExpr(text);
        if (/^[a-z_\.\[\]\"\'$]+$/i.test(tmpExpr))
          section.source.push(_getExpr(text));
        else
          section.source.push('(' + _getExpr(text) + ')');
        break;
      default:
        section.source.push('"' + escapeJS(text) + '"');
        break;
      }
    };

    if (compile_file) {
      parser.write(compile_file);
    }
    parser.close();

    return output;
  }

  function finish_compile(file, options, name) {
    var template;
    name = name || '';

    options = options || {
      beautify: true,
      nothrow: false
    };
    options.sax = options.sax || {
      trim: true,
      xmlns: true
    };
    options.sax.strict = options.sax.strict || true;
    options.mode = options.mode || 'string'; // `function` for __fest_pushstr with +=, `array` for push() and join(), `string` for +=
    options.events = options.events || {};
    // options.messages // messages dictionary
    // options.plural   // plural function

    function build_template(output) {

      var source = '';
      output.sections.forEach(function (section) {
        if (output.disable_sgo || section.name === undefined || output.uses[section.name]) {
          source += section.source.join('+');
        }
      });

      template = readFileSync(__dirname + '/tmpl-plugin.js').toString()
        .replace(/__SOURCE__/g, source || '""');
    }

    try {
      build_template(_compile({
        file: file,
        context_name: '__fest_context',
        options: options
      }));
      template = template.replace(/"\+"/g, ''); // string concats
      if (options.beautify) template = js_beautify(template);
    }
    catch (e) {
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
  }
  else {
    return finish_compile;
  }
})();
