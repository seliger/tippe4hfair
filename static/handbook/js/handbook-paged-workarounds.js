/**
 * Fixes two separate, unrelated bugs in the Paged.js-rendered PDF:
 *
 * BUG 1: Broken internal links (this file's main addition)
 * Paged.js names its own generated page-wrapper elements "page-<N>",
 * where N is the physical page number (this is baked into the
 * polyfill itself, not something CSS or config can change). BookStack
 * independently names its own content entities "page-<N>" too, using
 * its own internal, unrelated numbering. When a BookStack content ID
 * number happens to be smaller than that content's own eventual
 * printed page number, the two collide: an anchor link's
 * "#page-267", say, can resolve to Paged.js's own 267th page wrapper
 * instead of the real heading, which might not print until page 289.
 * The browser has no way to know these are different things; they're
 * just two elements with the same id, and it takes the first one it
 * finds. That's the "click 289, land on 267" symptom.
 *
 * The fix: rename every BookStack "page-N" / "chapter-N" id (and the
 * hrefs that point at them) to "page-N-bk" / "chapter-N-bk" BEFORE
 * Paged.js starts rendering, so there's no longer a name collision
 * once Paged.js starts creating its own "page-N" elements. The suffix
 * (not a prefix) is deliberate: print.css's selectors like
 * h1[id^="page-"] and a[href^="#chapter-"] still match unchanged,
 * since the ids still start the same way, they just end differently.
 *
 * BUG 2: Stale target-counter() page numbers (carried over from the
 * earlier fix-toc-page-numbers.js)
 * Paged.js resolves target-counter() incrementally and freezes each
 * TOC entry's displayed page number the moment its target is first
 * rendered, without revisiting it if later content shifts pagination
 * earlier in the document. This corrects the DISPLAYED number by
 * reading the true final page directly from the completed render.
 * It's a separate bug from BUG 1: fixing the ids doesn't fix the
 * displayed numbers, and fixing the displayed numbers doesn't fix the
 * links, hence both fixes living together in this one file.
 *
 * HOW THIS RUNS
 * Both hooks are official Paged.js extension points: window.PagedConfig
 * .before runs immediately before Paged.js starts rendering (needed for
 * the rename, which must happen first), and .after runs once rendering
 * is completely finished (needed for reading true final page numbers).
 *
 * HOW TO WIRE IT UP
 * Same as before: load this BEFORE paged.polyfill.js, since the
 * polyfill reads window.PagedConfig at the moment it executes.
 *
 *   <script src="fix-toc-and-links.js"></script>
 *   <script src="paged.polyfill.js"></script>
 *
 * This replaces fix-toc-page-numbers.js; don't load both.
 */
window.PagedConfig = {
  before: function () {
    var elements = document.querySelectorAll(
      '[id^="page-"], [id^="chapter-"]'
    );
    var idMap = {};
    elements.forEach(function (el) {
      var oldId = el.id;
      var newId = oldId + "-bk";
      idMap[oldId] = newId;
      el.id = newId;
    });

    var links = document.querySelectorAll(
      'a[href^="#page-"], a[href^="#chapter-"]'
    );
    links.forEach(function (a) {
      var oldHref = a.getAttribute("href").slice(1);
      if (idMap[oldHref]) {
        a.setAttribute("href", "#" + idMap[oldHref]);
      }
    });
  },

  after: function (flow) {
    var pageEls = Array.prototype.slice.call(
      document.querySelectorAll(".pagedjs_page")
    );
    var links = document.querySelectorAll('.contents li > a[href^="#"]');

    links.forEach(function (a) {
      var id = a.getAttribute("href").slice(1);
      for (var i = 0; i < pageEls.length; i++) {
        var pg = pageEls[i];
        var el = pg.querySelector("#" + CSS.escape(id));
        if (el) {
          var realPage = pg.getAttribute("data-page-number");
          if (realPage) {
            a.setAttribute("data-real-page", realPage);
          }
          break;
        }
      }
    });

    var style = document.createElement("style");
    style.textContent =
      ".contents li > a::after { content: attr(data-real-page) !important; }";
    document.head.appendChild(style);
  },
};