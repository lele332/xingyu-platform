(() => {
  "use strict";

  const $ = (s, root = document) => (root || document).querySelector(s);
  const $$ = (s, root = document) => Array.from((root || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const storage = {
    get(key, fallback = 0) {
      try { const v = Number(localStorage.getItem(key)); return Number.isFinite(v) ? v : fallback; }
      catch (_) { return fallback; }
    },
    set(key, value) { try { localStorage.setItem(key, String(value)); } catch (_) {} }
  };

  function roundedRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function createSfx() {
    let ac = null;
    function tone({ freq = 440, end = freq, dur = .1, type = "sine", vol = .04 }) {
      try {
        ac = ac || new (window.AudioContext || window.webkitAudioContext)();
        if (ac.state === "suspended") ac.resume();
        const t = ac.currentTime;
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (end !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(.0001, t + dur);
        o.connect(g).connect(ac.destination);
        o.start(t);
        o.stop(t + dur + .02);
      } catch (_) {}
    }
    return {
      move: () => tone({ freq: 540, end: 640, dur: .05, type: "triangle", vol: .03 }),
      rotate: () => tone({ freq: 680, end: 820, dur: .06, type: "triangle", vol: .03 }),
      lock: () => tone({ freq: 280, end: 190, dur: .11, type: "sine", vol: .04 }),
      clear: () => tone({ freq: 720, end: 1020, dur: .18, type: "sine", vol: .05 }),
      jump: () => tone({ freq: 520, end: 720, dur: .09, type: "sine", vol: .04 }),
      coin: () => tone({ freq: 900, end: 1260, dur: .08, type: "sine", vol: .04 }),
      stomp: () => tone({ freq: 340, end: 190, dur: .12, type: "square", vol: .03 }),
      hurt: () => tone({ freq: 220, end: 110, dur: .22, type: "sawtooth", vol: .04 }),
      win: () => tone({ freq: 660, end: 990, dur: .28, type: "sine", vol: .05 })
    };
  }

  function createParticles() {
    const list = [];
    function emit(x, y, color, { count = 10, spread = 3, life = 520, size = 3, gravity = .05 } = {}) {
      for (let i = 0; i < count; i++) {
        list.push({
          x, y,
          vx: rand(-spread, spread),
          vy: rand(-spread, .5),
          life: life * rand(.65, 1),
          maxLife: life,
          color,
          size: rand(size * .6, size * 1.2),
          gravity
        });
      }
    }
    function update(dt) {
      const scale = dt / 16.7;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.x += p.vx * scale;
        p.y += p.vy * scale;
        p.vy += p.gravity * scale;
        p.life -= dt;
        if (p.life <= 0) list.splice(i, 1);
      }
    }
    function draw(ctx) {
      for (const p of list) {
        const alpha = clamp(p.life / p.maxLife, 0, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    function clear() { list.length = 0; }
    return { emit, update, draw, clear };
  }

  function isActive(name) {
    const view = $("#view-relax");
    const panel = $(`[data-relax-panel="${name}"]`);
    return !!view && view.classList.contains("active") && !!panel && panel.classList.contains("is-active");
  }

  function overlayText(ctx, w, h, title, sub) {
    ctx.fillStyle = "rgba(4,7,14,.74)";
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "700 34px system-ui, -apple-system, 'Microsoft YaHei'";
    ctx.fillText(title, w / 2, h / 2 - 8);
    ctx.font = "500 15px system-ui, -apple-system, 'Microsoft YaHei'";
    ctx.fillStyle = "rgba(255,255,255,.72)";
    ctx.fillText(sub, w / 2, h / 2 + 28);
    ctx.textAlign = "left";
  }
  function initBlocks() {
    const canvas = $("#blockCanvas");
    const nextCanvas = $("#blockNext");
    const holdCanvas = $("#blockHold");
    if (!canvas || !nextCanvas || !holdCanvas) return;

    const ctx = canvas.getContext("2d");
    const nctx = nextCanvas.getContext("2d");
    const hctx = holdCanvas.getContext("2d");
    const scoreEl = $("#blockScore");
    const linesEl = $("#blockLines");
    const levelEl = $("#blockLevel");
    const comboEl = $("#blockCombo");
    const bestEl = $("#blockBest");
    const statusEl = $("#blockStatus");
    const startBtn = $("#btnBlockStart");
    const pauseBtn = $("#btnBlockPause");
    const resetBtn = $("#btnBlockReset");

    const COLS = 10, ROWS = 20, CELL = 36;
    const W = COLS * CELL, H = ROWS * CELL;
    const BEST_KEY = "xingyu_arcade_block_best";
    const SHAPES = [
      { cells: [[1,1,1,1]], color: "#4cc9ff" },
      { cells: [[1,0,0],[1,1,1]], color: "#9b6bff" },
      { cells: [[0,0,1],[1,1,1]], color: "#ff8f6b" },
      { cells: [[1,1],[1,1]], color: "#ffd166" },
      { cells: [[0,1,1],[1,1,0]], color: "#6ee7b7" },
      { cells: [[0,1,0],[1,1,1]], color: "#f472b6" },
      { cells: [[1,1,0],[0,1,1]], color: "#60a5fa" }
    ];
    const fx = createParticles();
    const sound = createSfx();
    let grid, piece, hold, canHold, nextQueue, bag;
    let score, lines, level, combo, best;
    let started, paused, over, lastTime, dropTimer, lockTimer, raf;
    let clearRows, clearTimer;

    best = storage.get(BEST_KEY);

    function reset() {
      grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      piece = null; hold = null; canHold = true; nextQueue = []; bag = [];
      score = 0; lines = 0; level = 1; combo = 0;
      started = false; paused = false; over = false;
      lastTime = 0; dropTimer = 0; lockTimer = 0; clearRows = []; clearTimer = 0;
      fx.clear(); refillNext(); spawnPiece(); hud(); drawPreviews();
      statusEl && (statusEl.textContent = "准备开始");
    }

    function refillBag() {
      bag = SHAPES.map((_, i) => i);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }

    function newPiece() {
      if (!bag.length) refillBag();
      const shape = SHAPES[bag.pop()];
      return { cells: shape.cells.map(r => [...r]), color: shape.color, x: 3, y: 0 };
    }

    function refillNext() {
      while (nextQueue.length < 3) nextQueue.push(newPiece());
    }

    function collides(p, x = p.x, y = p.y, cells = p.cells) {
      for (let r = 0; r < cells.length; r++) {
        for (let c = 0; c < cells[r].length; c++) {
          if (!cells[r][c]) continue;
          const nx = x + c, ny = y + r;
          if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
          if (ny >= 0 && grid[ny][nx]) return true;
        }
      }
      return false;
    }

    function spawnPiece() {
      piece = nextQueue.shift() || newPiece();
      refillNext();
      piece.x = 3; piece.y = 0;
      canHold = true; lockTimer = 0;
      if (collides(piece)) {
        over = true; started = false;
        best = Math.max(best, score);
        storage.set(BEST_KEY, best);
        statusEl && (statusEl.textContent = "游戏结束");
      }
      drawPreviews();
    }

    function hud() {
      scoreEl && (scoreEl.textContent = score);
      linesEl && (linesEl.textContent = lines);
      levelEl && (levelEl.textContent = level);
      comboEl && (comboEl.textContent = combo);
      bestEl && (bestEl.textContent = best);
    }

    function canAct() {
      return started && !paused && !over && clearTimer <= 0 && !!piece;
    }

    function move(dir) {
      if (!canAct()) return;
      if (!collides(piece, piece.x + dir, piece.y)) { piece.x += dir; sound.move(); }
    }

    function rotateCW(m) {
      const rows = m.length, cols = m[0].length;
      return Array.from({ length: cols }, (_, y) => Array.from({ length: rows }, (_, x) => m[rows - 1 - x][y]));
    }

    function rotateCCW(m) {
      const rows = m.length, cols = m[0].length;
      return Array.from({ length: cols }, (_, y) => Array.from({ length: rows }, (_, x) => m[x][cols - 1 - y]));
    }

    function rotate(dir) {
      if (!canAct()) return;
      const rotated = dir > 0 ? rotateCW(piece.cells) : rotateCCW(piece.cells);
      for (const off of [0, -1, 1, -2, 2]) {
        const test = { ...piece, cells: rotated, x: piece.x + off };
        if (!collides(test)) {
          piece.cells = rotated;
          piece.x += off;
          sound.rotate();
          return;
        }
      }
    }

    function softDrop() {
      if (!canAct()) return;
      if (!collides(piece, piece.x, piece.y + 1)) {
        piece.y++;
        score += 1;
        hud();
      } else {
        lockPiece();
      }
    }

    function hardDrop() {
      if (!canAct()) return;
      let n = 0;
      while (!collides(piece, piece.x, piece.y + 1)) { piece.y++; n++; }
      score += n * 2;
      fx.emit(piece.x * CELL + CELL, piece.y * CELL, piece.color, { count: 14, spread: 4 });
      lockPiece();
    }
    function holdPiece() {
      if (!canAct() || !canHold) return;
      const current = piece;
      if (hold) {
        piece = hold;
        hold = current;
      } else {
        hold = current;
        piece = nextQueue.shift() || newPiece();
        refillNext();
      }
      piece.x = 3; piece.y = 0;
      canHold = false;
      if (collides(piece)) {
        over = true; started = false;
        best = Math.max(best, score);
        storage.set(BEST_KEY, best);
      }
      drawPreviews(); hud();
    }

    function ghostY() {
      if (!piece) return 0;
      let y = piece.y;
      while (!collides(piece, piece.x, y + 1)) y++;
      return y;
    }

    function lockPiece() {
      if (!piece) return;
      piece.cells.forEach((row, r) => row.forEach((v, c) => {
        if (v && piece.y + r >= 0) grid[piece.y + r][piece.x + c] = piece.color;
      }));
      fx.emit((piece.x + 1) * CELL, (piece.y + 1) * CELL, piece.color, { count: 10, spread: 3 });
      piece = null;
      sound.lock();
      clearRows = [];
      for (let y = 0; y < ROWS; y++) if (grid[y].every(Boolean)) clearRows.push(y);
      if (clearRows.length) {
        clearTimer = 220;
        combo++;
        clearRows.forEach(y => fx.emit(W / 2, y * CELL + CELL / 2, "#ffffff", { count: 16, spread: 7, life: 640 }));
        sound.clear();
        statusEl && (statusEl.textContent = "消行成功");
      } else {
        combo = 0;
        statusEl && (statusEl.textContent = "进行中");
        spawnPiece();
      }
      hud();
    }

    function finishClear() {
      const count = clearRows.length;
      const kept = grid.filter((_, y) => !clearRows.includes(y));
      while (kept.length < ROWS) kept.unshift(Array(COLS).fill(null));
      grid = kept;
      lines += count;
      level = Math.floor(lines / 10) + 1;
      score += [0, 100, 300, 500, 800][count] * (1 + (combo - 1) * .25) * (1 + (level - 1) * .1);
      score = Math.round(score);
      best = Math.max(best, score);
      storage.set(BEST_KEY, best);
      clearRows = []; clearTimer = 0;
      spawnPiece(); hud();
    }

    function update(dt) {
      if (clearTimer > 0) {
        clearTimer -= dt;
        if (clearTimer <= 0) finishClear();
        return;
      }
      if (!started || paused || over || !piece) return;
      const interval = Math.max(90, 1000 - (level - 1) * 72);
      if (!collides(piece, piece.x, piece.y + 1)) {
        dropTimer += dt;
        if (dropTimer >= interval) { piece.y++; dropTimer = 0; lockTimer = 0; }
      } else {
        lockTimer += dt;
        if (lockTimer >= 430) lockPiece();
      }
    }

    function drawCell(c, x, y, color, alpha = 1, size = CELL) {
      c.globalAlpha = alpha;
      c.fillStyle = color;
      roundedRect(c, x + 2, y + 2, size - 4, size - 4, 8);
      c.fill();
      c.globalAlpha = alpha * .28;
      c.fillStyle = "#fff";
      roundedRect(c, x + 7, y + 7, size - 14, 7, 5);
      c.fill();
      c.globalAlpha = 1;
    }

    function draw() {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#080c16");
      g.addColorStop(1, "#0e1324");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(255,255,255,.05)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= COLS; x++) {
        ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, H); ctx.stroke();
      }
      for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(W, y * CELL); ctx.stroke();
      }

      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const color = grid[y][x];
          if (color) drawCell(ctx, x * CELL, y * CELL, color, clearRows.includes(y) ? .28 : .94);
        }
      }

      if (piece) {
        const gy = ghostY();
        piece.cells.forEach((row, r) => row.forEach((v, c) => {
          if (v && gy + r >= 0) drawCell(ctx, (piece.x + c) * CELL, (gy + r) * CELL, piece.color, .16);
        }));
        piece.cells.forEach((row, r) => row.forEach((v, c) => {
          if (v && piece.y + r >= 0) drawCell(ctx, (piece.x + c) * CELL, (piece.y + r) * CELL, piece.color, 1);
        }));
      }

      fx.draw(ctx);

      if (combo > 1) {
        ctx.font = "800 22px system-ui, -apple-system, 'Microsoft YaHei'";
        ctx.fillStyle = "rgba(255,255,255,.9)";
        ctx.fillText(`COMBO ×${combo}`, 16, 38);
      }

      if (over) overlayText(ctx, W, H, "游戏结束", "点重开再挑战");
      else if (paused) overlayText(ctx, W, H, "已暂停", "点继续");
      else if (!started) overlayText(ctx, W, H, "方块拼图", "点击开始");
    }

    function drawMiniPiece(c, piece, x, y, cell, alpha = 1) {
      if (!piece) return;
      const w = piece.cells[0].length * cell;
      const h = piece.cells.length * cell;
      const ox = x + (140 - w) / 2;
      const oy = y + (90 - h) / 2;
      piece.cells.forEach((row, r) => row.forEach((v, cc) => {
        if (v) drawCell(c, ox + cc * cell, oy + r * cell, piece.color, alpha, cell);
      }));
    }

    function drawPreviews() {
      nctx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
      hctx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
      nctx.fillStyle = "rgba(4,8,16,.45)";
      roundedRect(nctx, 0, 0, nextCanvas.width, nextCanvas.height, 14); nctx.fill();
      hctx.fillStyle = "rgba(4,8,16,.45)";
      roundedRect(hctx, 0, 0, holdCanvas.width, holdCanvas.height, 14); hctx.fill();
      nextQueue.forEach((p, i) => drawMiniPiece(nctx, p, 0, i * 90, i === 0 ? 28 : 22, i === 0 ? 1 : .65));
      drawMiniPiece(hctx, hold, 0, 0, 28, .9);
    }

    function startGame() {
      if (over) reset();
      started = true; paused = false;
      pauseBtn && (pauseBtn.textContent = "暂停");
      statusEl && (statusEl.textContent = "进行中");
    }

    function togglePause() {
      if (!started || over) return;
      paused = !paused;
      pauseBtn && (pauseBtn.textContent = paused ? "继续" : "暂停");
      statusEl && (statusEl.textContent = paused ? "已暂停" : "进行中");
    }

    startBtn && startBtn.addEventListener("click", startGame);
    pauseBtn && pauseBtn.addEventListener("click", togglePause);
    resetBtn && resetBtn.addEventListener("click", () => { reset(); startGame(); });

    document.addEventListener("keydown", e => {
      if (!isActive("blocks") || e.target.closest("input,textarea")) return;
      const key = e.key.toLowerCase();
      const handled = ["arrowleft","arrowright","arrowdown","arrowup"," ","z","x","c","p","r"];
      if (!handled.includes(key)) return;
      e.preventDefault();
      if (key === "p") return togglePause();
      if (key === "r") { reset(); return startGame(); }
      if (key === "arrowleft") return move(-1);
      if (key === "arrowright") return move(1);
      if (key === "arrowdown") return softDrop();
      if (key === "arrowup") return rotate(1);
      if (key === "z") return rotate(-1);
      if (key === "x") return rotate(1);
      if (key === "c") return holdPiece();
      if (key === " ") return hardDrop();
    });

    $$("#view-relax [data-block-act]").forEach(btn => {
      btn.addEventListener("click", () => {
        const act = btn.dataset.blockAct;
        if (act === "left") move(-1);
        else if (act === "right") move(1);
        else if (act === "down") softDrop();
        else if (act === "rotate") rotate(1);
        else if (act === "drop") hardDrop();
        else if (act === "hold") holdPiece();
      });
    });

    if (!raf) {
      const loop = now => {
        raf = requestAnimationFrame(loop);
        const dt = Math.min(60, now - (lastTime || now));
        lastTime = now;
        if (!isActive("blocks")) return;
        update(dt); fx.update(dt); draw();
      };
      raf = requestAnimationFrame(loop);
    }
    reset();
  }
  function initJump() {
    const canvas = $("#jumpCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const scoreEl = $("#jumpScore");
    const livesEl = $("#jumpLives");
    const levelEl = $("#jumpLevel");
    const bestEl = $("#jumpBest");
    const statusEl = $("#jumpStatus");
    const startBtn = $("#btnJumpStart");
    const pauseBtn = $("#btnJumpPause");
    const resetBtn = $("#btnJumpReset");

    const W = canvas.width, H = canvas.height;
    const BEST_KEY = "xingyu_arcade_jump_best";
    const fx = createParticles();
    const sound = createSfx();
    let best = storage.get(BEST_KEY);

    const LEVELS = [
      {
        width: 2200,
        platforms: [
          { x: 0, y: 430, w: 760, h: 80, ground: true },
          { x: 900, y: 430, w: 520, h: 80, ground: true },
          { x: 1560, y: 430, w: 640, h: 80, ground: true },
          { x: 220, y: 330, w: 130, h: 20 },
          { x: 520, y: 260, w: 120, h: 20 },
          { x: 820, y: 320, w: 150, h: 20 },
          { x: 1120, y: 270, w: 130, h: 20 },
          { x: 1420, y: 330, w: 140, h: 20 }
        ],
        coins: [[260,290],[310,290],[560,220],[610,220],[870,280],[920,280],[1170,230],[1220,230],[1470,290],[1520,290],[1800,350],[1850,350]],
        enemies: [
          { x: 420, y: 402, w: 32, h: 28, min: 380, max: 700, speed: 1.3, dir: 1 },
          { x: 1020, y: 402, w: 32, h: 28, min: 960, max: 1360, speed: 1.5, dir: -1 }
        ],
        spikes: [{ x: 780, y: 416, w: 44, h: 14 }],
        goal: { x: 2080, y: 334, w: 46, h: 96 }
      },
      {
        width: 2600,
        platforms: [
          { x: 0, y: 430, w: 620, h: 80, ground: true },
          { x: 760, y: 430, w: 460, h: 80, ground: true },
          { x: 1340, y: 430, w: 560, h: 80, ground: true },
          { x: 2080, y: 430, w: 520, h: 80, ground: true },
          { x: 180, y: 330, w: 130, h: 20 },
          { x: 420, y: 260, w: 120, h: 20 },
          { x: 700, y: 320, w: 140, h: 20 },
          { x: 1000, y: 260, w: 130, h: 20 },
          { x: 1300, y: 330, w: 140, h: 20 },
          { x: 1600, y: 260, w: 150, h: 20 },
          { x: 1900, y: 320, w: 130, h: 20 }
        ],
        coins: [[220,290],[270,290],[460,220],[510,220],[760,280],[810,280],[1060,220],[1110,220],[1360,290],[1410,290],[1660,220],[1710,220],[1960,280],[2010,280],[2350,350],[2400,350]],
        enemies: [
          { x: 360, y: 402, w: 32, h: 28, min: 320, max: 560, speed: 1.4, dir: 1 },
          { x: 900, y: 402, w: 32, h: 28, min: 860, max: 1160, speed: 1.6, dir: -1 },
          { x: 1520, y: 402, w: 32, h: 28, min: 1440, max: 1840, speed: 1.8, dir: 1 }
        ],
        spikes: [{ x: 700, y: 416, w: 44, h: 14 }, { x: 1260, y: 416, w: 44, h: 14 }],
        goal: { x: 2480, y: 334, w: 46, h: 96 }
      },
      {
        width: 3000,
        platforms: [
          { x: 0, y: 430, w: 520, h: 80, ground: true },
          { x: 640, y: 430, w: 380, h: 80, ground: true },
          { x: 1140, y: 430, w: 520, h: 80, ground: true },
          { x: 1800, y: 430, w: 440, h: 80, ground: true },
          { x: 2380, y: 430, w: 620, h: 80, ground: true },
          { x: 160, y: 330, w: 130, h: 20 },
          { x: 380, y: 260, w: 120, h: 20 },
          { x: 680, y: 320, w: 140, h: 20 },
          { x: 960, y: 260, w: 130, h: 20 },
          { x: 1240, y: 330, w: 140, h: 20 },
          { x: 1560, y: 260, w: 150, h: 20 },
          { x: 1900, y: 320, w: 130, h: 20 },
          { x: 2180, y: 260, w: 140, h: 20 },
          { x: 2520, y: 320, w: 150, h: 20 }
        ],
        coins: [[200,290],[250,290],[420,220],[470,220],[730,280],[780,280],[1010,220],[1060,220],[1300,290],[1350,290],[1620,220],[1670,220],[1960,280],[2010,280],[2240,220],[2290,220],[2620,280],[2670,280]],
        enemies: [
          { x: 300, y: 402, w: 32, h: 28, min: 260, max: 480, speed: 1.5, dir: 1 },
          { x: 780, y: 402, w: 32, h: 28, min: 720, max: 980, speed: 1.7, dir: -1 },
          { x: 1300, y: 402, w: 32, h: 28, min: 1240, max: 1580, speed: 1.9, dir: 1 },
          { x: 2100, y: 402, w: 32, h: 28, min: 2020, max: 2320, speed: 2.1, dir: -1 }
        ],
        spikes: [{ x: 580, y: 416, w: 44, h: 14 }, { x: 1080, y: 416, w: 44, h: 14 }, { x: 2280, y: 416, w: 44, h: 14 }],
        goal: { x: 2860, y: 334, w: 46, h: 96 }
      }
    ];

    let platforms, coins, enemies, spikes, goal, levelData;
    let player, keys, camX;
    let score, lives, levelIndex, running, paused, won, over, respawnTimer, transitionTimer, jumpHeld, raf, lastTime;

    function resetPlayer() {
      player = { x: 60, y: 380, w: 28, h: 36, vx: 0, vy: 0, onGround: false, face: 1 };
      camX = 0;
      jumpHeld = false;
    }

    function loadLevel(index) {
      levelIndex = clamp(index, 0, LEVELS.length - 1);
      levelData = LEVELS[levelIndex];
      platforms = levelData.platforms.map(p => ({ ...p }));
      coins = levelData.coins.map(([x, y]) => ({ x, y, r: 9, taken: false }));
      enemies = levelData.enemies.map(e => ({ ...e, dead: false }));
      spikes = levelData.spikes.map(s => ({ ...s }));
      goal = { ...levelData.goal };
      resetPlayer();
      respawnTimer = 0;
      transitionTimer = 0;
      won = false;
      statusEl && (statusEl.textContent = `第 ${levelIndex + 1} 关`);
      hud();
    }

    function fullReset() {
      score = 0; lives = 3; over = false; paused = false; running = false;
      loadLevel(0);
    }

    function hud() {
      scoreEl && (scoreEl.textContent = score);
      livesEl && (livesEl.textContent = lives);
      levelEl && (levelEl.textContent = levelIndex + 1);
      bestEl && (bestEl.textContent = best);
    }

    function aabb(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function hurt() {
      if (respawnTimer > 0) return;
      lives--;
      fx.emit(player.x + player.w / 2, player.y + player.h / 2, "#ff7b8a", { count: 18, spread: 5, life: 650 });
      sound.hurt();
      if (lives <= 0) {
        lives = 0;
        running = false;
        over = true;
        best = Math.max(best, score);
        storage.set(BEST_KEY, best);
        statusEl && (statusEl.textContent = "游戏结束");
      } else {
        respawnTimer = 55;
        resetPlayer();
      }
      hud();
    }
    function update(dt) {
      if (!running || paused || won || over) return;
      if (respawnTimer > 0) {
        respawnTimer -= dt / 16.7;
        return;
      }
      const scale = dt / 16.7;
      const left = keys.ArrowLeft || keys.a || keys.A;
      const right = keys.ArrowRight || keys.d || keys.D;
      const jumpKey = keys[" "] || keys.ArrowUp || keys.w || keys.W;

      if (left) player.vx = Math.max(-5.0, player.vx - .8 * scale);
      else if (right) player.vx = Math.min(5.0, player.vx + .8 * scale);
      else player.vx *= Math.pow(.82, scale);

      if (jumpKey && !jumpHeld && player.onGround) {
        player.vy = -15.2;
        player.onGround = false;
        sound.jump();
        fx.emit(player.x + player.w / 2, player.y + player.h, "#ffffff", { count: 8, spread: 2, life: 320, size: 2.5 });
      }
      jumpHeld = !!jumpKey;
      if (!jumpKey && player.vy < -6) player.vy = -6;

      player.vy = Math.min(16, player.vy + .86 * scale);
      player.x += player.vx * scale;
      player.x = clamp(player.x, 0, levelData.width - player.w);
      player.y += player.vy * scale;

      player.onGround = false;
      for (const p of platforms) {
        if (!aabb(player, p)) continue;
        const overlapLeft = player.x + player.w - p.x;
        const overlapRight = p.x + p.w - player.x;
        const overlapTop = player.y + player.h - p.y;
        const overlapBottom = p.y + p.h - player.y;
        const min = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
        if (min === overlapTop && player.vy >= 0) {
          player.y = p.y - player.h;
          player.vy = 0;
          player.onGround = true;
        } else if (min === overlapBottom && player.vy < 0) {
          player.y = p.y + p.h;
          player.vy = 1;
        } else if (min === overlapLeft) {
          player.x = p.x - player.w;
          player.vx = 0;
        } else if (min === overlapRight) {
          player.x = p.x + p.w;
          player.vx = 0;
        }
      }

      if (player.y > H + 120) hurt();

      for (const c of coins) {
        if (c.taken) continue;
        if (Math.hypot(player.x + player.w / 2 - c.x, player.y + player.h / 2 - c.y) < 27) {
          c.taken = true;
          score += 100;
          fx.emit(c.x, c.y, "#ffd166", { count: 10, spread: 3, life: 420, size: 2.5 });
          sound.coin();
          hud();
        }
      }

      for (const e of enemies) {
        if (e.dead) continue;
        e.x += e.speed * e.dir * scale;
        if (e.x < e.min) { e.x = e.min; e.dir = 1; }
        if (e.x + e.w > e.max) { e.x = e.max - e.w; e.dir = -1; }
        if (!aabb(player, e)) continue;
        if (player.vy > 0 && player.y + player.h - e.y < 20) {
          e.dead = true;
          player.vy = -9;
          score += 150;
          fx.emit(e.x + e.w / 2, e.y + e.h / 2, "#ff7b8a", { count: 14, spread: 4, life: 500 });
          sound.stomp();
          hud();
        } else {
          hurt();
        }
      }

      for (const s of spikes) if (aabb(player, s)) hurt();

      if (aabb(player, goal)) {
        won = true;
        running = false;
        score += 1000;
        best = Math.max(best, score);
        storage.set(BEST_KEY, best);
        transitionTimer = 1200;
        sound.win();
        statusEl && (statusEl.textContent = "关卡完成");
        hud();
      }

      camX = lerp(camX, clamp(player.x + player.w / 2 - W / 2, 0, levelData.width - W), .08);
    }

    function drawBackground() {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#101a34");
      g.addColorStop(1, "#0a1020");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < 90; i++) {
        const x = ((i * 137.5 - camX * .12) % (W + 240) + W + 240) % (W + 240) - 120;
        const y = (i * 83) % 300 + 10;
        ctx.globalAlpha = .18 + (i % 5) * .08;
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(x, y, i % 3 ? 1 : 1.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (let i = 0; i < 8; i++) {
        const x = ((i * 420 - camX * .25) % (W + 500) + W + 500) % (W + 500) - 250;
        ctx.fillStyle = "rgba(255,255,255,.04)";
        ctx.beginPath();
        ctx.moveTo(x, H);
        ctx.lineTo(x + 220, 180);
        ctx.lineTo(x + 440, H);
        ctx.closePath();
        ctx.fill();
      }

      for (let i = 0; i < 6; i++) {
        const x = ((i * 560 - camX * .35) % (W + 800) + W + 800) % (W + 800) - 400;
        const y = 90 + (i % 3) * 38;
        ctx.fillStyle = "rgba(255,255,255,.05)";
        roundedRect(ctx, x, y, 150, 32, 16); ctx.fill();
        roundedRect(ctx, x + 40, y - 16, 76, 32, 16); ctx.fill();
      }
    }

    function draw() {
      drawBackground();
      ctx.save();
      ctx.translate(-camX, 0);

      for (const p of platforms) {
        const pg = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
        pg.addColorStop(0, p.ground ? "#25355a" : "#304070");
        pg.addColorStop(1, "#141d31");
        ctx.fillStyle = pg;
        roundedRect(ctx, p.x, p.y, p.w, p.h, p.ground ? 0 : 10);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.08)";
        roundedRect(ctx, p.x, p.y, p.w, 8, 4);
        ctx.fill();
      }

      for (const s of spikes) {
        ctx.fillStyle = "#ff5f78";
        for (let x = s.x; x < s.x + s.w; x += 12) {
          ctx.beginPath();
          ctx.moveTo(x, s.y + s.h);
          ctx.lineTo(x + 6, s.y);
          ctx.lineTo(x + 12, s.y + s.h);
          ctx.closePath();
          ctx.fill();
        }
      }

      for (const c of coins) {
        if (c.taken) continue;
        const pulse = 1 + Math.sin(Date.now() * .006 + c.x) * .08;
        const cg = ctx.createRadialGradient(c.x, c.y, 1, c.x, c.y, c.r * pulse * 2.4);
        cg.addColorStop(0, "#fff3b0");
        cg.addColorStop(1, "rgba(255,209,102,0)");
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r * pulse * 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ffd166";
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r * pulse, 0, Math.PI * 2); ctx.fill();
      }

      for (const e of enemies) {
        if (e.dead) continue;
        ctx.fillStyle = "#ff7b8a";
        roundedRect(ctx, e.x, e.y, e.w, e.h, 9); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(e.x + (e.dir > 0 ? e.w * .68 : e.w * .32), e.y + e.h * .36, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#111";
        ctx.beginPath(); ctx.arc(e.x + (e.dir > 0 ? e.w * .68 : e.w * .32), e.y + e.h * .36, 1.8, 0, Math.PI * 2); ctx.fill();
      }

      ctx.fillStyle = "#6ee7b7";
      roundedRect(ctx, goal.x, goal.y, goal.w, goal.h, 12); ctx.fill();
      ctx.fillStyle = "#04120c";
      ctx.font = "800 16px system-ui";
      ctx.fillText("GOAL", goal.x + 4, goal.y + 55);

      ctx.fillStyle = "#e8f2ff";
      roundedRect(ctx, player.x, player.y, player.w, player.h, 9); ctx.fill();
      ctx.fillStyle = "#08101f";
      ctx.beginPath();
      ctx.arc(player.x + (player.face > 0 ? 19 : 9), player.y + 12, 3.2, 0, Math.PI * 2);
      ctx.fill();

      fx.draw(ctx);
      ctx.restore();

      if (over) overlayText(ctx, W, H, "游戏结束", `得分 ${score} · 点重开`);
      else if (won) overlayText(ctx, W, H, "关卡完成", levelIndex === LEVELS.length - 1 ? `最终得分 ${score}` : "正在进入下一关…");
      else if (paused) overlayText(ctx, W, H, "已暂停", "点继续");
      else if (!running) overlayText(ctx, W, H, `第 ${levelIndex + 1} 关`, "点击开始");
    }
    function startGame() {
      if (over) fullReset();
      if (won) {
        if (levelIndex === LEVELS.length - 1) fullReset();
        else loadLevel(levelIndex + 1);
      }
      running = true;
      paused = false;
      pauseBtn && (pauseBtn.textContent = "暂停");
    }

    startBtn && startBtn.addEventListener("click", startGame);
    pauseBtn && pauseBtn.addEventListener("click", () => {
      if (!running) return;
      paused = !paused;
      pauseBtn && (pauseBtn.textContent = paused ? "继续" : "暂停");
    });
    resetBtn && resetBtn.addEventListener("click", () => { fullReset(); startGame(); });

    document.addEventListener("keydown", e => {
      if (!isActive("jump") || e.target.closest("input,textarea")) return;
      const key = e.key.toLowerCase();
      const handled = ["arrowleft","arrowright","arrowup"," ","a","d","w","p","r"];
      if (!handled.includes(key)) return;
      e.preventDefault();
      if (key === "p") { if (running) pauseBtn && pauseBtn.click(); return; }
      if (key === "r") { fullReset(); startGame(); return; }
      keys[e.key] = true;
    });

    document.addEventListener("keyup", e => { keys[e.key] = false; });

    $$("#view-relax [data-jump-act]").forEach(btn => {
      const act = btn.dataset.jumpAct;
      const press = e => {
        e.preventDefault();
        if (act === "left") keys.ArrowLeft = true;
        else if (act === "right") keys.ArrowRight = true;
        else keys[" "] = true;
      };
      const release = () => {
        if (act === "left") keys.ArrowLeft = false;
        else if (act === "right") keys.ArrowRight = false;
        else keys[" "] = false;
      };
      btn.addEventListener("pointerdown", press);
      btn.addEventListener("pointerup", release);
      btn.addEventListener("pointerleave", release);
    });

    if (!raf) {
      const loop = now => {
        raf = requestAnimationFrame(loop);
        const dt = Math.min(60, now - (lastTime || now));
        lastTime = now;
        if (!isActive("jump")) return;
        if (won && transitionTimer > 0) {
          transitionTimer -= dt;
          if (transitionTimer <= 0) {
            if (levelIndex === LEVELS.length - 1) fullReset();
            else { loadLevel(levelIndex + 1); running = true; }
          }
        }
        update(dt);
        fx.update(dt);
        draw();
      };
      raf = requestAnimationFrame(loop);
    }

    keys = {};
    fullReset();
  }

  function init() {
    initBlocks();
    initJump();
  }

  window.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();
})();
