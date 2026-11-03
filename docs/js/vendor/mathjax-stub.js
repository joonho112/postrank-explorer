// Stand-in for MathJax. Quarto's mathjax html-math-method points at this file so that pages keep their TeX; the
// post-render step converts every formula to MathML with Temml and removes this script tag. If the file is ever
// loaded (a page that skipped the post-render, or reveal.js's math plugin), it does nothing: the MathJax 3 calls
// Quarto makes (typeset, typesetPromise) and the MathJax 2 calls reveal.js makes (Hub.Config, Hub.Queue) are no-ops,
// except that Hub.Queue runs function jobs so that reveal.js finishes its layout.
(function () {
  var mj = window.MathJax = window.MathJax || {};
  mj.typeset = function () {};
  mj.typesetPromise = function () { return Promise.resolve(); };
  mj.typesetClear = function () {};
  mj.startup = mj.startup || { promise: Promise.resolve() };
  mj.Hub = {
    Config: function () {},
    Queue: function () {
      for (var i = 0; i < arguments.length; i++) {
        if (typeof arguments[i] === "function") { try { arguments[i](); } catch (e) { /* layout job failed */ } }
      }
    }
  };
})();
