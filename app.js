/* Dancing Chess — app / UI. */
"use strict";

(() => {
  const { W, B, other, NAMES, COLOR_NAMES } = Rules;
  const $ = (id) => document.getElementById(id);
  const SAVE_KEY = "embrace.save.v1";
  const PREFS_KEY = "embrace.prefs.v1";
  const AI_STEP_MS = 420;

  const HEART =
    '<svg class="heart" viewBox="0 0 24 24" aria-hidden="true"><path fill="#ff5e8a" stroke="#fff" stroke-width="2" ' +
    'd="M12 21 C5 16 2 12.5 2 8.6 C2 5.5 4.4 3.3 7.2 3.3 C9.2 3.3 10.9 4.4 12 6 C13.1 4.4 14.8 3.3 16.8 3.3 ' +
    'C19.6 3.3 22 5.5 22 8.6 C22 12.5 19 16 12 21 Z"/></svg>';

  // ---------- state ----------
  let game = null; // { mode: "ai"|"local", level, human, state, history: [states at turn starts], reps: {} }
  let selected = null;
  let busy = false;
  let manualFlip = false;
  let landed = -1;
  let prefs = { level: "normal", color: "w" };

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } },
  };

  // ---------- board DOM ----------
  const boardEl = $("board");
  const cells = [];
  for (let k = 0; k < 64; k++) {
    const el = document.createElement("div");
    el.setAttribute("role", "gridcell");
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      onTap(squareAt(k));
    });
    boardEl.appendChild(el);
    cells.push(el);
  }

  const isFlipped = () => {
    const base = game && game.mode === "ai" && game.human === B;
    return manualFlip ? !base : base;
  };
  const squareAt = (k) => (isFlipped() ? 63 - k : k);

  // ---------- rendering ----------
  function render() {
    if (!game) return;
    const st = game.state;
    const steps = isHumanTurn() ? Rules.legalSteps(st) : [];
    const selSteps = st.chain ? steps : selected !== null ? steps.filter((s) => s.from === selected) : [];
    const markBy = new Map(selSteps.map((s) => [s.to, s]));
    const movable = new Set(steps.map((s) => s.from));
    const trail = new Set(st.trail);
    const flipped = isFlipped();

    for (let k = 0; k < 64; k++) {
      const i = squareAt(k);
      const r = i >> 3;
      const f = i & 7;
      const el = cells[k];
      const cls = ["cell", (r + f) % 2 ? "dark" : "light"];
      if (trail.has(i)) cls.push("trail");
      if (i === selected && !st.chain) cls.push("selected");
      if (movable.has(i)) cls.push("can-move");
      if (i === landed) cls.push("landed");
      el.className = cls.join(" ");

      let html = "";
      const sq = st.board[i];
      if (sq) {
        if (sq.w && sq.b) {
          html += `<div class="piece-holder"><div class="pair">${Pieces.svg(sq.w, "left")}${Pieces.svg(sq.b, "right")}${HEART}</div></div>`;
        } else {
          html += `<div class="piece-holder">${Pieces.svg(sq.w || sq.b)}</div>`;
        }
      }
      if (st.chain && st.chain.from === i) html += `<div class="floating">${Pieces.svg(st.chain.piece)}</div>`;

      const m = markBy.get(i);
      if (m) {
        const enemy = sq && sq[other(st.turn)];
        const win = m.kind === "join" && enemy && enemy.t === "k";
        html += `<div class="mark ${m.kind}${win ? " win" : ""}"></div>`;
      }

      const bottomRow = flipped ? r === 0 : r === 7;
      const leftCol = flipped ? f === 7 : f === 0;
      if (bottomRow) html += `<span class="coord file">${"abcdefgh"[f]}</span>`;
      if (leftCol) html += `<span class="coord rank">${8 - r}</span>`;
      el.innerHTML = html;
    }

    renderPlayers();
    renderStatus();
    $("btn-undo").disabled = busy || !canUndo();
    landed = -1;
  }

  function freeCount(color) {
    let n = 0;
    for (const s of game.state.board) if (s && s[color] && !s[other(color)]) n++;
    return n;
  }

  function playerName(color) {
    if (game.mode === "ai") return color === game.human ? "You" : "Computer";
    return COLOR_NAMES[color];
  }

  function renderPlayers() {
    const bottomColor = isFlipped() ? B : W;
    const st = game.state;
    for (const [el, color] of [[$("player-bottom"), bottomColor], [$("player-top"), other(bottomColor)]]) {
      el.className = "player" + (st.turn === color && !st.winner && !st.draw ? " active" : "") + (el.id === "player-top" ? " top" : " bottom");
      el.innerHTML =
        `<span class="chip ${color}"></span><span class="name">${playerName(color)}</span>` +
        `<span class="free">${freeCount(color)} free</span>`;
    }
  }

  function renderStatus() {
    const st = game.state;
    const el = $("status");
    el.classList.toggle("chain", !!st.chain);
    if (st.winner) {
      el.textContent = `${playerName(st.winner)} ${game.mode === "ai" && st.winner === game.human ? "win" : "wins"}!`;
    } else if (st.draw) {
      el.textContent = "Draw.";
    } else if (st.chain) {
      const who = isHumanTurn() ? "Your" : `${playerName(st.turn)}'s`;
      el.textContent = isHumanTurn()
        ? `Chain reaction! Move your bumped ${NAMES[st.chain.piece.t]}.`
        : `Chain reaction… ${who} ${NAMES[st.chain.piece.t]} is moving.`;
    } else if (!isHumanTurn()) {
      el.textContent = "Computer is thinking…";
    } else if (AI.canWin({ ...st, turn: other(st.turn) })) {
      el.textContent = game.mode === "ai" ? "Careful — your king is in danger!" : `${COLOR_NAMES[st.turn]}: your king is in danger!`;
    } else {
      el.textContent = game.mode === "ai" ? "Your move" : `${COLOR_NAMES[st.turn]} to move`;
    }
  }

  // ---------- game flow ----------
  function isHumanTurn() {
    const st = game.state;
    if (st.winner || st.draw) return false;
    return game.mode === "local" || st.turn === game.human;
  }

  function onTap(i) {
    if (!game || busy || !isHumanTurn()) return;
    const st = game.state;
    const steps = Rules.legalSteps(st);
    if (st.chain) {
      const s = steps.find((x) => x.to === i);
      if (s) doStep(s);
      return;
    }
    if (selected !== null) {
      const s = steps.find((x) => x.from === selected && x.to === i);
      if (s) {
        doStep(s);
        return;
      }
    }
    selected = steps.some((x) => x.from === i) && selected !== i ? i : null;
    render();
  }

  function doStep(step) {
    const st = game.state;
    if (!st.chain) game.history.push(st);
    game.state = Rules.applyStep(st, step);
    selected = null;
    landed = step.to;
    buzz(step.kind === "bump" ? [12, 40, 12] : 10);
    afterStep();
  }

  function afterStep() {
    const st = game.state;
    if (!st.chain && !st.winner && !st.draw) {
      const key = Rules.positionKey(st);
      game.reps[key] = (game.reps[key] || 0) + 1;
      if (game.reps[key] >= 3) st.draw = "repetition";
    }
    save();
    render();
    if (st.winner || st.draw) {
      setTimeout(showResult, 650);
      return;
    }
    maybeAI();
  }

  function maybeAI() {
    if (game.mode !== "ai" || game.state.turn === game.human || game.state.winner || game.state.draw) return;
    busy = true;
    render();
    const token = game;
    setTimeout(() => {
      if (game !== token) return;
      const turn = AI.choose(game.state, game.level);
      if (!turn) {
        busy = false;
        return;
      }
      game.history.push(game.state);
      let n = 0;
      const playNext = () => {
        if (game !== token) return;
        const step = turn.steps[n++];
        game.state = Rules.applyStep(game.state, step);
        landed = step.to;
        if (n < turn.steps.length) {
          render();
          setTimeout(playNext, AI_STEP_MS);
        } else {
          busy = false;
          buzz(8);
          afterStep();
        }
      };
      playNext();
    }, 380);
  }

  function canUndo() {
    if (!game || !game.history.length) return false;
    if (game.mode === "ai") return game.history.some((s) => s.turn === game.human);
    return true;
  }

  function undo() {
    if (busy || !canUndo()) return;
    const unrecord = (st) => {
      if (st.chain || st.winner) return;
      const key = Rules.positionKey(st);
      if (game.reps[key]) game.reps[key]--;
    };
    let st = game.state;
    if (game.mode === "ai") {
      if (!st.chain) unrecord(st);
      let prev = game.history.pop();
      while (prev.turn !== game.human && game.history.length) {
        unrecord(prev);
        prev = game.history.pop();
      }
      game.state = prev;
    } else {
      if (!st.chain) unrecord(st);
      game.state = game.history.pop();
    }
    game.state.draw = false;
    selected = null;
    $("result").hidden = true;
    save();
    render();
  }

  function newGame(mode, level, colorPref) {
    let human = W;
    if (mode === "ai") human = colorPref === "random" ? (Math.random() < 0.5 ? W : B) : colorPref;
    const state = Rules.newGame();
    game = { mode, level, human, colorPref, state, history: [], reps: { [Rules.positionKey(state)]: 1 } };
    selected = null;
    busy = false;
    manualFlip = false;
    $("mode-label").textContent = mode === "ai" ? `vs Computer · ${level === "easy" ? "Relaxed" : "Tricky"}` : "Two players";
    $("btn-flip").hidden = false;
    show("game");
    save();
    render();
    maybeAI();
  }

  function showResult() {
    const st = game.state;
    if (!st.winner && !st.draw) return;
    let title;
    let text;
    if (st.draw) {
      title = "It's a draw";
      text = st.draw === "repetition" ? "The same position came up three times." : "No moves left to make.";
    } else if (game.mode === "ai") {
      title = st.winner === game.human ? "You win!" : "The computer wins";
      text = st.winner === game.human ? "You danced with the enemy king." : "Its pieces got to your king first.";
    } else {
      title = `${COLOR_NAMES[st.winner]} wins!`;
      text = `${COLOR_NAMES[st.winner]} danced with the ${COLOR_NAMES[other(st.winner)].toLowerCase()} king.`;
    }
    $("result-title").textContent = title;
    $("result-text").textContent = text;
    const winner = st.winner || W;
    $("result-icon").innerHTML = st.draw
      ? `<div class="pair">${Pieces.svg({ t: "k", c: W }, "left")}${Pieces.svg({ t: "k", c: B }, "right")}</div>`
      : `<div class="pair">${Pieces.svg({ t: "q", c: winner }, "left")}${Pieces.svg({ t: "k", c: other(winner) }, "right")}${HEART}</div>`;
    $("result").hidden = false;
  }

  // ---------- persistence ----------
  function save() {
    if (!game) return;
    const { mode, level, human, colorPref, state, history, reps } = game;
    if (state.winner || state.draw) {
      store.del(SAVE_KEY);
      return;
    }
    store.set(SAVE_KEY, { mode, level, human, colorPref, state, history: history.slice(-60), reps });
  }

  function loadSaved() {
    const s = store.get(SAVE_KEY);
    if (!s || !s.state || !Array.isArray(s.state.board) || s.state.board.length !== 64) return null;
    return s;
  }

  // ---------- screens ----------
  function show(name) {
    $("menu").hidden = name !== "menu";
    $("game").hidden = name !== "game";
    if (name === "menu") $("btn-continue").hidden = !loadSaved();
  }

  function buzz(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* not supported */ }
  }

  // ---------- menu wiring ----------
  function setupSeg(name) {
    const seg = document.querySelector(`.seg[data-name="${name}"]`);
    const update = () => seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.value === prefs[name])));
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      prefs[name] = b.dataset.value;
      store.set(PREFS_KEY, prefs);
      update();
    });
    update();
  }

  prefs = { ...prefs, ...(store.get(PREFS_KEY) || {}) };
  setupSeg("level");
  setupSeg("color");

  $("btn-ai").addEventListener("click", () => newGame("ai", prefs.level, prefs.color));
  $("btn-local").addEventListener("click", () => newGame("local", null, null));
  $("btn-continue").addEventListener("click", () => {
    const s = loadSaved();
    if (!s) return;
    game = { ...s, reps: s.reps || {} };
    selected = null;
    busy = false;
    manualFlip = false;
    $("mode-label").textContent = game.mode === "ai" ? `vs Computer · ${game.level === "easy" ? "Relaxed" : "Tricky"}` : "Two players";
    show("game");
    render();
    maybeAI();
  });
  $("btn-back").addEventListener("click", () => {
    busy = false;
    save();
    game = null; // also cancels any pending computer move
    show("menu");
  });
  $("btn-undo").addEventListener("click", undo);
  $("btn-flip").addEventListener("click", () => {
    manualFlip = !manualFlip;
    render();
  });
  $("btn-restart").addEventListener("click", () => {
    if (!game) return;
    const started = game.history.length > 0 && !game.state.winner && !game.state.draw;
    if (started && !confirm("Start a new game?")) return;
    newGame(game.mode, game.level, game.colorPref);
  });

  const openRules = () => ($("rules").hidden = false);
  const closeRules = () => ($("rules").hidden = true);
  $("btn-rules").addEventListener("click", openRules);
  $("btn-help").addEventListener("click", openRules);
  $("btn-rules-close").addEventListener("click", closeRules);
  $("rules").addEventListener("click", (e) => { if (e.target.id === "rules") closeRules(); });

  $("btn-again").addEventListener("click", () => {
    $("result").hidden = true;
    newGame(game.mode, game.level, game.colorPref);
  });
  $("btn-result-menu").addEventListener("click", () => {
    $("result").hidden = true;
    game = null;
    show("menu");
  });
  $("btn-result-view").addEventListener("click", () => ($("result").hidden = true));

  // ---------- install (PWA) ----------
  let deferredPrompt = null;
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!standalone && isIOS) $("ios-hint").hidden = false;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!standalone) $("btn-install").hidden = false;
  });
  $("btn-install").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch { /* dismissed */ }
    deferredPrompt = null;
    $("btn-install").hidden = true;
  });
  window.addEventListener("appinstalled", () => ($("btn-install").hidden = true));

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  show("menu");
})();
