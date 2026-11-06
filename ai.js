/* Embrace — computer opponent. */
"use strict";

const AI = (() => {
  const { other, legalSteps, applyStep, targets, rowOf, fileOf } = Rules;
  const VALUE = { p: 1, n: 3, b: 3.2, r: 5, q: 9, k: 0 };
  const MAX_CHAIN = 5;

  /** Every complete turn (a step plus any chain reaction it sets off). */
  function turns(state, maxChain = MAX_CHAIN) {
    const out = [];
    (function dfs(s, path, depth) {
      for (const st of legalSteps(s)) {
        const ns = applyStep(s, st, true);
        const p = path.concat([st]);
        if (!ns.chain) out.push({ steps: p, state: ns });
        else if (depth < maxChain) dfs(ns, p, depth + 1);
      }
    })(state, [], 0);
    return out;
  }

  /** Can the side to move pair up with the enemy king this turn (directly or through a chain)? */
  function canWin(state, depth = 0) {
    const c = state.turn;
    const o = other(c);
    for (const st of legalSteps(state)) {
      const sq = state.board[st.to];
      if (st.kind === "join" && sq[o].t === "k") return true;
      if (st.kind === "bump" && depth < MAX_CHAIN) {
        if (canWin(applyStep(state, st, true), depth + 1)) return true;
      }
    }
    return false;
  }

  const centre = (i) => {
    const r = rowOf(i);
    const f = fileOf(i);
    return 3.5 - Math.max(Math.abs(r - 3.5), Math.abs(f - 3.5));
  };

  function kingSquare(board, c) {
    for (let i = 0; i < 64; i++) {
      const s = board[i];
      if (s && s[c] && s[c].t === "k") return i;
    }
    return -1;
  }

  // How many of `c`'s lone pieces bear on squares around the enemy king.
  function pressure(board, c) {
    const o = other(c);
    const k = kingSquare(board, o);
    if (k < 0) return 0;
    const kr = rowOf(k);
    const kf = fileOf(k);
    let n = 0;
    for (let i = 0; i < 64; i++) {
      const s = board[i];
      if (!s || !s[c] || s[o] || s[c].t === "k") continue;
      for (const t of targets(board, i, s[c], "lone")) {
        if (Math.abs(rowOf(t.to) - kr) <= 1 && Math.abs(fileOf(t.to) - kf) <= 1) n++;
      }
    }
    return n;
  }

  /** Static score from `me`'s point of view. Free pieces are what count: paired pieces can't attack. */
  function evaluate(state, me) {
    if (state.winner) return state.winner === me ? 1e6 : -1e6;
    const o = other(me);
    const b = state.board;
    let score = 0;
    for (let i = 0; i < 64; i++) {
      const s = b[i];
      if (!s) continue;
      if (s[me] && !s[o]) score += VALUE[s[me].t] + (s[me].t !== "k" ? centre(i) * 0.06 : 0);
      else if (s[o] && !s[me]) score -= VALUE[s[o].t] + (s[o].t !== "k" ? centre(i) * 0.06 : 0);
      else score += (VALUE[s[o].t] - VALUE[s[me].t]) * 0.15;
    }
    score += pressure(b, me) * 0.12 - pressure(b, o) * 0.16;
    return score;
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Pick a full turn for the side to move. level: "easy" | "normal". */
  function choose(state, level) {
    const me = state.turn;
    const all = shuffle(turns(state));
    if (!all.length) return null;

    const win = all.find((t) => t.state.winner === me);
    if (win) return win;

    const safe = all.filter((t) => !canWin(t.state));
    const pool = safe.length ? safe : all;

    if (level === "easy") {
      if (Math.random() < 0.55) return pool[0];
      return pool.reduce((best, t) => (evaluate(t.state, me) > evaluate(best.state, me) ? t : best));
    }

    // Normal: score every safe turn, then look one reply ahead for the most promising few.
    const scored = pool
      .map((t) => {
        let sc = evaluate(t.state, me) + Math.random() * 0.05;
        // Threatening to win next turn is valuable.
        if (canWin({ ...t.state, turn: me })) sc += 1.2;
        return { t, sc };
      })
      .sort((a, b) => b.sc - a.sc);

    const top = scored.slice(0, 10);
    let best = top[0];
    let bestVal = -Infinity;
    for (const cand of top) {
      const replies = turns(cand.t.state, 3);
      let worst = Infinity;
      for (const r of replies) {
        let v = evaluate(r.state, me);
        if (canWin(r.state)) v += 50; // that reply would hand me the win
        else if (canWin({ ...r.state, turn: other(me) })) v -= 3; // it threatens my king
        if (v < worst) worst = v;
        if (worst < bestVal) break; // can't beat what we have
      }
      if (!replies.length) worst = evaluate(cand.t.state, me);
      const val = worst * 0.7 + cand.sc * 0.3;
      if (val > bestVal) {
        bestVal = val;
        best = cand;
      }
    }
    return best.t;
  }

  return { choose, turns, canWin, evaluate };
})();
