/* Dancing Chess — rules engine.
 *
 * Board: 64 squares, index = row * 8 + file, row 0 is Black's back rank (top).
 * A square is null (empty) or { w: piece|null, b: piece|null }.
 * When both w and b are set, the square holds a pair (two pieces dancing together).
 * Piece: { t: "p"|"n"|"b"|"r"|"q"|"k", c: "w"|"b", m: hasMoved }
 */
"use strict";

const Rules = (() => {
  const W = "w";
  const B = "b";
  const other = (c) => (c === W ? B : W);
  const NAMES = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
  const COLOR_NAMES = { w: "Light", b: "Dark" };

  const rowOf = (i) => i >> 3;
  const fileOf = (i) => i & 7;
  const at = (r, f) => (r >= 0 && r < 8 && f >= 0 && f < 8 ? r * 8 + f : -1);

  const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  const lone = (c, p) => (c === W ? { w: p, b: null } : { w: null, b: p });

  function newGame() {
    const board = new Array(64).fill(null);
    const back = "rnbqkbnr";
    for (let f = 0; f < 8; f++) {
      board[at(0, f)] = lone(B, { t: back[f], c: B, m: false });
      board[at(1, f)] = lone(B, { t: "p", c: B, m: false });
      board[at(6, f)] = lone(W, { t: "p", c: W, m: false });
      board[at(7, f)] = lone(W, { t: back[f], c: W, m: false });
    }
    return { board, turn: W, chain: null, winner: null, draw: false, trail: [], ply: 0 };
  }

  function cloneSquare(s) {
    return s ? { w: s.w && { ...s.w }, b: s.b && { ...s.b } } : null;
  }

  function clone(state) {
    return {
      board: state.board.map(cloneSquare),
      turn: state.turn,
      chain: state.chain ? { from: state.chain.from, piece: { ...state.chain.piece } } : null,
      winner: state.winner,
      draw: state.draw,
      trail: state.trail.slice(),
      ply: state.ply,
    };
  }

  /**
   * Squares a piece can reach.
   * mode: "lone"  — a single piece moving on its own
   *       "pair"  — the player's piece inside a pair, carrying its partner along
   *       "chain" — a piece that was just bumped out of a pair
   */
  function targets(board, from, piece, mode) {
    const out = [];
    const c = piece.c;
    const o = other(c);
    const r = rowOf(from);
    const f = fileOf(from);
    const canJoin = mode !== "pair" && piece.t !== "k";

    // Returns true when the square is empty, so sliders keep going.
    const consider = (to, pawnKind) => {
      const s = board[to];
      if (!s) {
        if (pawnKind !== "diag") out.push({ to, kind: "move" });
        return true;
      }
      if (pawnKind === "fwd") return false;
      if (s[c] && !s[o]) return false; // own lone piece blocks
      if (!canJoin) return false;
      out.push({ to, kind: s[c] ? "bump" : "join" });
      return false;
    };

    switch (piece.t) {
      case "p": {
        const d = c === W ? -1 : 1;
        const start = c === W ? 6 : 1;
        const one = at(r + d, f);
        if (one >= 0 && consider(one, "fwd") && r === start) {
          const two = at(r + 2 * d, f);
          if (two >= 0) consider(two, "fwd");
        }
        for (const df of [-1, 1]) {
          const t = at(r + d, f + df);
          if (t >= 0) consider(t, "diag");
        }
        break;
      }
      case "n":
        for (const [dr, df] of KNIGHT) {
          const t = at(r + dr, f + df);
          if (t >= 0) consider(t);
        }
        break;
      case "k":
        for (const [dr, df] of KING) {
          const t = at(r + dr, f + df);
          if (t >= 0) consider(t);
        }
        if (mode === "lone" && !piece.m) addCastles(board, from, piece, out);
        break;
      default: {
        const dirs =
          piece.t === "r" ? ROOK_DIRS : piece.t === "b" ? BISHOP_DIRS : ROOK_DIRS.concat(BISHOP_DIRS);
        for (const [dr, df] of dirs) {
          let rr = r + dr;
          let ff = f + df;
          while (true) {
            const t = at(rr, ff);
            if (t < 0 || !consider(t)) break;
            rr += dr;
            ff += df;
          }
        }
      }
    }
    return out;
  }

  function addCastles(board, from, king, out) {
    const home = king.c === W ? 7 : 0;
    if (from !== at(home, 4)) return;
    for (const [rookFile, kingFile, rookTo] of [[0, 2, 3], [7, 6, 5]]) {
      const rs = board[at(home, rookFile)];
      const rook = rs && rs[king.c];
      if (!rook || rook.t !== "r" || rook.m || rs[other(king.c)]) continue;
      const lo = Math.min(rookFile, 4) + 1;
      const hi = Math.max(rookFile, 4);
      let clear = true;
      for (let ff = lo; ff < hi; ff++) if (board[at(home, ff)]) clear = false;
      if (clear) {
        out.push({ to: at(home, kingFile), kind: "castle", rookFrom: at(home, rookFile), rookTo: at(home, rookTo) });
      }
    }
  }

  // A bump is only allowed if the piece that gets bumped has somewhere to go.
  function bumpIsPlayable(board, from, piece, step, inChain) {
    if (step.kind !== "bump") return true;
    const bumped = board[step.to][piece.c];
    const nb = board.slice();
    if (!inChain) nb[from] = null;
    nb[step.to] = { ...board[step.to], [piece.c]: piece };
    return targets(nb, step.to, bumped, "chain").length > 0;
  }

  function legalSteps(state) {
    if (state.winner || state.draw) return [];
    const { board, turn: c } = state;
    const res = [];
    if (state.chain) {
      const { from, piece } = state.chain;
      for (const t of targets(board, from, piece, "chain")) {
        if (bumpIsPlayable(board, from, piece, t, true)) res.push({ from, ...t });
      }
      return res;
    }
    for (let i = 0; i < 64; i++) {
      const s = board[i];
      if (!s || !s[c]) continue;
      const mode = s[other(c)] ? "pair" : "lone";
      for (const t of targets(board, i, s[c], mode)) {
        if (bumpIsPlayable(board, i, s[c], t, false)) res.push({ from: i, ...t });
      }
    }
    return res;
  }

  /** Apply one step. Returns a new state. Pass fast=true to skip the stalemate check (used by the AI). */
  function applyStep(state, step, fast) {
    const s = clone(state);
    const b = s.board;
    const c = s.turn;
    const o = other(c);
    const continuing = !!s.chain;
    let mover;
    let partner = null;

    if (continuing) {
      mover = s.chain.piece;
      s.chain = null;
    } else {
      const src = b[step.from];
      mover = src[c];
      partner = src[o];
      b[step.from] = null;
    }
    mover.m = true;
    if (partner) partner.m = true;

    const to = step.to;
    let bumped = null;
    if (step.kind === "move" || step.kind === "castle") {
      b[to] = c === W ? { w: mover, b: partner } : { w: partner, b: mover };
    } else if (step.kind === "join") {
      b[to] = { ...b[to], [c]: mover };
    } else {
      bumped = b[to][c];
      b[to] = { ...b[to], [c]: mover };
    }

    if (step.kind === "castle") {
      const rook = b[step.rookFrom][c];
      rook.m = true;
      b[step.rookFrom] = null;
      b[step.rookTo] = lone(c, rook);
    }

    // Pawns that reach the far side become queens (even when carried there in a pair).
    const dst = b[to];
    const row = rowOf(to);
    for (const p of [dst.w, dst.b]) {
      if (p && p.t === "p" && ((p.c === W && row === 0) || (p.c === B && row === 7))) p.t = "q";
    }

    s.trail = continuing ? s.trail.concat([to]) : [step.from, to];

    if (dst.w && dst.b && (dst.w.t === "k" || dst.b.t === "k")) s.winner = c;

    if (bumped && !s.winner) {
      s.chain = { from: to, piece: bumped };
    } else {
      s.turn = o;
      s.ply++;
      if (!fast && !s.winner && legalSteps(s).length === 0) s.draw = true;
    }
    return s;
  }

  function positionKey(state) {
    let k = state.turn;
    for (const s of state.board) {
      if (!s) k += ".";
      else k += (s.w ? s.w.t.toUpperCase() : "-") + (s.b ? s.b.t : "-");
    }
    return k;
  }

  return {
    W, B, other, NAMES, COLOR_NAMES, rowOf, fileOf, at,
    newGame, clone, targets, legalSteps, applyStep, positionKey,
  };
})();
