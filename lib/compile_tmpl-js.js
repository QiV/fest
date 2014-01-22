function __NAME__(params) {
  "use strict";
  var BLOCKS = {},
    getParams = {},
    debug_file = "",
    debug_line = "",
    debug_block = "",
    htmlchars = /__HTMLCHARS__/g,
    htmlchars_test = /__HTMLCHARS__/,
    short_tags = __SHORT_TAGS__,
    element_stack = [],
    htmlhash = __HTMLHASH__,
    jschars = /__JSCHARS__/g,
    jschars_test = /__JSCHARS__/,
    jshash = __JSHASH__;

  function replaceHTML(chr) {
    return htmlhash[chr]
  }

  function replaceJS(chr) {
    return jshash[chr]
  }

  function escapeJS(s) {
    if (typeof s === "string") {
      if (jschars_test.test(s))
        return s.replace(jschars, replaceJS);
    }
    else if (typeof s === "undefined")
      return "";
    return s;
  }

  function escapeHTML(s) {
    if (typeof s === "string") {
      if (htmlchars_test.test(s))
        return s.replace(htmlchars, replaceHTML);
    }
    else if (typeof s === "undefined")
      return "";
    return s;
  }
  function extend(dest, src) {
    for (var i in src)
      dest[i] = src[i];
  }
  __SOURCE__
};
