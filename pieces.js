/* Dancing Chess — piece artwork (original, drawn in a 45×45 box). */
"use strict";

const Pieces = (() => {
  const BASE = '<rect x="10" y="35" width="25" height="5.5" rx="2.2"/>';
  const SHAPES = {
    p:
      '<circle cx="22.5" cy="13.5" r="6"/>' +
      '<path d="M15.5 35 C16 28 18.5 23.5 22.5 21.5 C26.5 23.5 29 28 29.5 35 Z"/>' +
      BASE,
    r:
      '<path d="M12 8.5 H17 V12.5 H20 V8.5 H25 V12.5 H28 V8.5 H33 V18 L30 21 V31 L33 34 V35 H12 V34 L15 31 V21 L12 18 Z"/>' +
      BASE,
    n:
      '<path d="M14.5 35 C14 28 17 24.5 20.5 21.5 C17 21.8 13.2 22 11.3 19.8 C10.2 17.6 12 14.8 15.8 12.8 C17.2 9.6 20 7.8 23 7.6 L24.2 4.5 L26.4 7.9 C31.5 9.2 34.4 15.2 34.2 22 C34 28 32.4 31.8 31.5 35 Z"/>' +
      '<circle class="d" cx="20.6" cy="13.2" r="1.4"/>' +
      BASE,
    b:
      '<circle cx="22.5" cy="6.4" r="2.6"/>' +
      '<path d="M22.5 8.8 C28 13 30.8 18.5 30 23 C29.2 27 26.2 29.2 22.5 29.2 C18.8 29.2 15.8 27 15 23 C14.2 18.5 17 13 22.5 8.8 Z"/>' +
      '<path class="d" fill="none" d="M25.6 15 L20.4 21"/>' +
      '<path d="M15 35 C16 31.5 18.5 29.6 22.5 29.6 C26.5 29.6 29 31.5 30 35 Z"/>' +
      BASE,
    q:
      '<circle cx="9.5" cy="12.5" r="2.6"/><circle cx="17" cy="9.5" r="2.4"/><circle cx="22.5" cy="7" r="2.6"/>' +
      '<circle cx="28" cy="9.5" r="2.4"/><circle cx="35.5" cy="12.5" r="2.6"/>' +
      '<path d="M10 14.5 L17 22 L17.6 11.5 L22.5 20 L27.4 11.5 L28 22 L35 14.5 L31.5 30 H13.5 Z"/>' +
      '<path d="M13 30.5 H32 L31 35 H14 Z"/>' +
      BASE,
    k:
      '<path d="M21 3 H24 V7 H28 V10 H24 V14 H21 V10 H17 V7 H21 Z"/>' +
      '<path d="M11.5 20 C11.5 15 17 13.5 22.5 18.5 C28 13.5 33.5 15 33.5 20 C33.5 24.5 30.5 27.5 30.5 30.5 H14.5 C14.5 27.5 11.5 24.5 11.5 20 Z"/>' +
      '<path d="M14 30.8 H31 L30.5 35 H14.5 Z"/>' +
      BASE,
  };

  const PALETTE = {
    w: { fill: "#fffaf0", line: "#3a2e5c" },
    b: { fill: "#3a2e5c", line: "#fffaf0" },
  };

  function svg(piece, cls = "") {
    const p = PALETTE[piece.c];
    return (
      `<svg class="pc ${cls}" viewBox="0 0 45 45" aria-hidden="true">` +
      `<g fill="${p.fill}" stroke="${p.line}" stroke-width="1.6" stroke-linejoin="round" ` +
      `style="--line:${p.line}">${SHAPES[piece.t]}</g></svg>`
    );
  }

  return { svg };
})();
