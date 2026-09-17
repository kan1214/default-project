"use strict";

(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const elScore = document.getElementById("score");
  const elLevel = document.getElementById("level");
  const elEaten = document.getElementById("eaten");
  const overlay = document.getElementById("overlay");
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const muteBtn = document.getElementById("muteBtn");
  const levelToast = document.getElementById("levelToast");
  const dpad = document.getElementById("dpad");

  let W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
  }
  resize();
  window.addEventListener("resize", resize);

  // ---------- Utility ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function hashRand(cx, cy, k) {
    const n = Math.sin(cx * 127.1 + cy * 311.7 + k * 74.7) * 43758.5453;
    return n - Math.floor(n);
  }

  // ---------- Audio (WebAudio, no files) ----------
  let audioCtx = null;
  let muted = false;
  try {
    muted = localStorage.getItem("bh_muted") === "1";
  } catch (_) {}

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }

  function tone(freq, dur, vol, type, delay) {
    if (muted || !audioCtx) return;
    const t = audioCtx.currentTime + (delay || 0);
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  const sfxEat = (lvl) => {
    const base = 220 + lvl * 18;
    tone(base, 0.1, 0.1, "sine");
    tone(base * 1.35, 0.16, 0.07, "triangle", 0.04);
  };
  const sfxLevel = () => {
    tone(330, 0.2, 0.14, "triangle");
    tone(440, 0.2, 0.14, "triangle", 0.1);
    tone(660, 0.4, 0.13, "triangle", 0.2);
  };
  const sfxStart = () => {
    tone(220, 0.4, 0.12, "sine");
    tone(440, 0.5, 0.09, "sine", 0.25);
  };

  // ---------- Game state ----------
  const game = {
    running: false,
    paused: false,
    time: 0,
    score: 0,
    eaten: 0,
    level: 1,
    particles: [],
    texts: [],
    shocks: [],
    keys: {},
    touch: { x: 0, y: 0 },
    shake: 0,
  };

  const player = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    r: 18,
    mass: 1,
    gravityR: 181,
    MAX_SPEED: 320,
    ACCEL: 1500,
    DRAG: 5,
  };

  // ---------- Object types ----------
  const TYPES = [
    { name: "rock",   r: 6,  mass: 1,  color: "#9aa7b5", glow: "#5f6b78", count: 50, maxV: 38, tail: false },
    { name: "star",   r: 9,  mass: 3,  color: "#ffd166", glow: "#ff9f1c", count: 28, maxV: 26, tail: false },
    { name: "comet",  r: 6,  mass: 2,  color: "#7bf1a8", glow: "#34d399", count: 20, maxV: 78, tail: true },
    { name: "planet", r: 15, mass: 10, color: "#4cc9f0", glow: "#3a86ff", count: 14, maxV: 16, tail: false },
    { name: "giant",  r: 30, mass: 40, color: "#ff6b6b", glow: "#e63946", count: 4,  maxV: 8,  tail: false },
  ];

  let objects = [];

  function spawnObject(type, far) {
    const safeMin = type.r + player.r + 90;
    const minD = far ? Math.max(620, player.gravityR * 1.7, safeMin)
                     : Math.max(380, player.gravityR * 1.35, safeMin);
    const maxD = Math.max(1350, player.gravityR * 2.6);
    const a = Math.random() * TAU;
    const d = minD + Math.random() * (maxD - minD);
    const vA = Math.random() * TAU;
    const v = rand(0, type.maxV);
    objects.push({
      type,
      x: player.x + Math.cos(a) * d,
      y: player.y + Math.sin(a) * d,
      vx: Math.cos(vA) * v,
      vy: Math.sin(vA) * v,
      trail: [],
      sucked: false,
      phase: Math.random() * TAU,
    });
  }

  function buildWorld() {
    objects = [];
    for (const t of TYPES) {
      for (let i = 0; i < t.count; i++) spawnObject(t, true);
    }
  }

  // ---------- Levels ----------
  const LEVELS = [10];
  (function () {
    while (LEVELS.length < 60) {
      LEVELS.push(Math.round(LEVELS[LEVELS.length - 1] * 1.45 + 4));
    }
  })();

  function levelFor(eaten) {
    let l = 1;
    for (const t of LEVELS) {
      if (eaten >= t) l++;
      else break;
    }
    return l;
  }

  // ---------- Input ----------
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    game.keys[k] = true;
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) {
      e.preventDefault();
    }
    if (e.key === "p" || e.key === "P" || e.key === "Escape") togglePause();
  });

  window.addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    game.keys[k] = false;
  });

  function inputDir() {
    let x = 0, y = 0;
    if (game.keys["arrowleft"] || game.keys["a"]) x -= 1;
    if (game.keys["arrowright"] || game.keys["d"]) x += 1;
    if (game.keys["arrowup"] || game.keys["w"]) y -= 1;
    if (game.keys["arrowdown"] || game.keys["s"]) y += 1;
    x += game.touch.x;
    y += game.touch.y;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  // D-Pad
  const padState = { up: false, down: false, left: false, right: false };
  function refreshTouch() {
    game.touch.x = (padState.right ? 1 : 0) - (padState.left ? 1 : 0);
    game.touch.y = (padState.down ? 1 : 0) - (padState.up ? 1 : 0);
  }
  function bindPad(el, key) {
    if (!key) return;
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      padState[key] = true;
      el.classList.add("pressed");
      refreshTouch();
    });
    const release = () => {
      padState[key] = false;
      el.classList.remove("pressed");
      refreshTouch();
    };
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    el.addEventListener("pointerleave", release);
  }

  document.querySelectorAll("#dpad [data-dir]").forEach((el) => {
    bindPad(el, el.getAttribute("data-dir"));
  });

  if (window.matchMedia("(pointer: coarse)").matches) dpad.classList.add("show");
  else if ("ontouchstart" in window) dpad.classList.add("show");

  // ---------- Controls ----------
  function togglePause() {
    if (!game.running) return;
    game.paused = !game.paused;
    pauseBtn.textContent = game.paused ? "▶" : "⏸";
  }

  function refreshMute() {
    muteBtn.textContent = muted ? "🔇" : "🔊";
    try { localStorage.setItem("bh_muted", muted ? "1" : "0"); } catch (_) {}
  }
  refreshMute();
  muteBtn.addEventListener("click", () => { muted = !muted; ensureAudio(); refreshMute(); });

  pauseBtn.addEventListener("click", togglePause);

  startBtn.addEventListener("click", () => {
    ensureAudio();
    game.running = true;
    game.paused = false;
    player.x = 0;
    player.y = 0;
    player.vx = 0;
    player.vy = 0;
    game.score = 0;
    game.eaten = 0;
    game.level = 1;
    game.particles = [];
    game.texts = [];
    game.shocks = [];
    sfxStart();
    overlay.classList.add("hidden");
    levelToast.classList.add("hidden");
  });

  // ---------- FX helpers ----------
  function emitBurst(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const s = rand(speed * 0.3, speed);
      game.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.4, 0.9),
        maxLife: 0.9,
        size: rand(2, 5),
        color,
      });
    }
  }

  function addText(str, x, y) {
    game.texts.push({ str, x, y, life: 1 });
  }

  function showLevelToast(lvl) {
    levelToast.textContent = `黑洞擴張！ LV ${lvl}`;
    levelToast.classList.remove("show");
    void levelToast.offsetWidth;
    levelToast.classList.add("show");
    setTimeout(() => levelToast.classList.remove("show"), 1500);
  }

  // ---------- Update ----------
  function updatePlayer(dt) {
    const dir = inputDir();
    player.vx += dir.x * player.ACCEL * dt;
    player.vy += dir.y * player.ACCEL * dt;
    player.vx -= player.vx * player.DRAG * dt;
    player.vy -= player.vy * player.DRAG * dt;
    const sp = Math.hypot(player.vx, player.vy);
    if (sp > player.MAX_SPEED) {
      player.vx *= player.MAX_SPEED / sp;
      player.vy *= player.MAX_SPEED / sp;
    }
    player.x += player.vx * dt;
    player.y += player.vy * dt;
  }

  function update(dt) {
    game.time += dt;
    updatePlayer(dt);

    // Objects
    const despawnD = Math.max(1600, player.gravityR * 3 + 1300);
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      const dx = player.x - o.x;
      const dy = player.y - o.y;
      const dist = Math.hypot(dx, dy);
      const pullOn = dist < player.gravityR;
      o.sucked = pullOn;

      if (pullOn) {
        const u = 1 - dist / player.gravityR;
        const pull = 3000 * (player.gravityR / 181) * u;
        o.vx += (dx / dist) * pull * dt;
        o.vy += (dy / dist) * pull * dt;
        const s = Math.hypot(o.vx, o.vy);
        if (s > 560) { o.vx *= 560 / s; o.vy *= 560 / s; }
      }

      o.x += o.vx * dt;
      o.y += o.vy * dt;

      // trail
      game.frameCount = game.frameCount || 0;
      if (pullOn && game.frameCount % 2 === 0) {
        o.trail.push({ x: o.x, y: o.y });
        if (o.trail.length > 10) o.trail.shift();
      } else if (!pullOn) {
        o.trail.length = 0;
      }

      // eat
      const eatR = player.r * 0.95 + 2;
      if (dist < eatR) {
        game.score += o.type.mass;
        game.eaten += 1;
        player.mass += o.type.mass;
        player.r = 12 + 5.5 * Math.pow(player.mass, 0.34);
        player.gravityR = 55 + player.r * 7;
        emitBurst(o.x, o.y, o.type.color, 16, 220);
        addText("+" + o.type.mass, o.x, o.y - 12);
        sfxEat(levelFor(game.eaten));
        const nl = levelFor(game.eaten);
        if (nl > game.level) {
          game.level = nl;
          game.shake = 12;
          game.shocks.push({ x: player.x, y: player.y, r: player.r, maxR: player.r * 4, life: 1 });
          showLevelToast(nl);
          if (!muted) sfxLevel();
        }
        objects.splice(i, 1);
        spawnObject(o.type, true);
        continue;
      }

      // cull & respawn if too far
      if (dist > despawnD && !pullOn) {
        o.x = player.x + Math.cos(Math.random() * TAU) * rand(700, 1100);
        o.y = player.y + Math.sin(Math.random() * TAU) * rand(700, 1100);
      }
    }

    // Particles
    for (let i = game.particles.length - 1; i >= 0; i--) {
      const p = game.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= (1 - 2.5 * dt);
      p.vy *= (1 - 2.5 * dt);
      p.life -= dt;
      if (p.life <= 0) game.particles.splice(i, 1);
    }

    // Texts
    for (let i = game.texts.length - 1; i >= 0; i--) {
      const t = game.texts[i];
      t.y -= 45 * dt;
      t.life -= dt * 0.9;
      if (t.life <= 0) game.texts.splice(i, 1);
    }

    // Shocks
    for (let i = game.shocks.length - 1; i >= 0; i--) {
      const s = game.shocks[i];
      s.r += (s.maxR - s.r) * 3.5 * dt;
      s.life -= dt * 1.6;
      if (s.life <= 0) game.shocks.splice(i, 1);
    }

    if (game.shake > 0) game.shake = Math.max(0, game.shake - 40 * dt);

    // HUD
    elScore.textContent = Math.round(player.mass * 10) / 10;
    elLevel.textContent = game.level;
    elEaten.textContent = game.eaten;
  }

  // ---------- Render helpers ----------
  function project(x, y) {
    const scale = zoomScale();
    return { x: (x - player.x) * scale + W / 2, y: (y - player.y) * scale + H / 2 };
  }

  function zoomScale() {
    return clamp(44 / player.r, 0.55, 1);
  }

  function drawBackground() {
    const scale = zoomScale();
    const viewL = player.x - (W / 2) / scale;
    const viewR = player.x + (W / 2) / scale;
    const viewT = player.y - (H / 2) / scale;
    const viewB = player.y + (H / 2) / scale;
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-player.x + W / 2 / scale, -player.y + H / 2 / scale);
    ctx.lineWidth = 1 / scale;

    // grid
    const cell = 110;
    ctx.strokeStyle = "rgba(120, 160, 255, 0.045)";
    ctx.beginPath();
    for (let x = Math.floor(viewL / cell) * cell; x <= viewR; x += cell) {
      ctx.moveTo(x, viewT); ctx.lineTo(x, viewB);
    }
    for (let y = Math.floor(viewT / cell) * cell; y <= viewB; y += cell) {
      ctx.moveTo(viewL, y); ctx.lineTo(viewR, y);
    }
    ctx.stroke();

    // nebulae
    const nStartX = Math.floor(viewL / cell);
    const nStartY = Math.floor(viewT / cell);
    for (let cx = nStartX; cx <= Math.floor(viewR / cell); cx++) {
      for (let cy = nStartY; cy <= Math.floor(viewB / cell); cy++) {
        if (hashRand(cx, cy, 5) < 0.05) {
          const hue = hashRand(cx, cy, 6) * 60 - 10;
          const nx = (cx + hashRand(cx, cy, 7)) * cell;
          const ny = (cy + hashRand(cx, cy, 8)) * cell;
          const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, cell * 1.1);
          grad.addColorStop(0, `hsla(${hue}, 90%, 55%, 0.06)`);
          grad.addColorStop(1, "hsla(260, 90%, 55%, 0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(nx, ny, cell * 1.1, 0, TAU);
          ctx.fill();
        }
      }
    }

    // star dots
    const sCell = 70;
    ctx.fillStyle = "#c9c3ff";
    for (let cx = Math.floor(viewL / sCell); cx <= Math.floor(viewR / sCell); cx++) {
      for (let cy = Math.floor(viewT / sCell); cy <= Math.floor(viewB / sCell); cy++) {
        if (hashRand(cx, cy, 1) < 0.4) {
          const sx = (cx + hashRand(cx, cy, 2)) * sCell;
          const sy = (cy + hashRand(cx, cy, 3)) * sCell;
          const sz = hashRand(cx, cy, 4);
          const tw = 0.6 + 0.4 * Math.sin(game.time * (1 + sz * 2) + cy);
          ctx.globalAlpha = 0.25 + 0.55 * sz * tw;
          ctx.beginPath();
          ctx.arc(sx, sy, (0.6 + sz * 1.4) / scale, 0, TAU);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawObject(o) {
    const { x, y } = o;
    const r = o.type.r;
    ctx.save();

    // trail (infall)
    if (o.sucked && o.trail.length > 2) {
      ctx.strokeStyle = o.type.glow;
      ctx.lineCap = "round";
      for (let i = 1; i < o.trail.length; i++) {
        const a = i / o.trail.length;
        ctx.strokeStyle = o.type.glow;
        ctx.globalAlpha = a * 0.5;
        ctx.lineWidth = (1 + a * 2.4) / zoomScale();
        ctx.beginPath();
        ctx.moveTo(o.trail[i - 1].x, o.trail[i - 1].y);
        ctx.lineTo(o.trail[i].x, o.trail[i].y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // comet tail
    if (o.type.tail) {
      const sp = Math.hypot(o.vx, o.vy) || 1;
      const tx = -o.vx / sp * r * 4;
      const ty = -o.vy / sp * r * 4;
      const g = ctx.createLinearGradient(x, y, x + tx, y + ty);
      g.addColorStop(0, o.type.color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = r * 0.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x + tx, y + ty);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    // glow
    const pulse = 1 + 0.08 * Math.sin(game.time * 2.5 + o.phase);
    const glowR = r * 2.2 * pulse;
    const glow = ctx.createRadialGradient(x, y, r * 0.2, x, y, glowR);
    glow.addColorStop(0, o.type.glow + "55");
    glow.addColorStop(0.3, o.type.glow + "22");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, glowR, 0, TAU);
    ctx.fill();

    // body
    ctx.fillStyle = o.type.color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    const hi = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    hi.addColorStop(0, "rgba(255,255,255,0.55)");
    hi.addColorStop(0.4, "rgba(255,255,255,0.05)");
    hi.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = hi;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  function drawBlackHole() {
    const { x, y } = player;
    const r = player.r;
    const gR = player.gravityR;

    // outer gravitational darkness
    const dark = ctx.createRadialGradient(x, y, r * 0.4, x, y, gR);
    dark.addColorStop(0, "rgba(0,0,0,0)");
    dark.addColorStop(0.4, "rgba(6,0,18,0.32)");
    dark.addColorStop(0.8, "rgba(6,0,18,0.08)");
    dark.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(x, y, gR, 0, TAU);
    ctx.fill();

    // ambient purple glow
    const glow = ctx.createRadialGradient(x, y, r * 0.7, x, y, r * 2.4);
    glow.addColorStop(0, "rgba(124,58,237,0.35)");
    glow.addColorStop(0.4, "rgba(88,28,135,0.12)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.4, 0, TAU);
    ctx.fill();
  }

  function drawAccretion() {
    const { x, y } = player;
    const outer = player.r * 1.75;
    const inner = player.r * 1.05;
    const segments = 3;
    ctx.save();
    ctx.translate(x, y);
    for (let i = 0; i < segments; i++) {
      const rot = game.time * 0.8 + (i * TAU) / segments;
      const startA = rot;
      const arc = TAU / segments * 1.6;
      const grad = ctx.createLinearGradient(
        Math.cos(startA) * inner, Math.sin(startA) * inner,
        Math.cos(startA + arc) * outer, Math.sin(startA + arc) * outer
      );
      grad.addColorStop(0, "rgba(255,179,71,0.7)");
      grad.addColorStop(0.5, "rgba(56,189,248,0.45)");
      grad.addColorStop(1, "rgba(124,58,237,0.05)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = player.r * 0.55;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, 0, (inner + outer) / 2, startA, startA + arc);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCore() {
    const { x, y } = player;
    const r = player.r;
    const core = ctx.createRadialGradient(x, y, 0, x, y, r);
    core.addColorStop(0, "#000000");
    core.addColorStop(0.5, "#05010f");
    core.addColorStop(0.78, "#160732");
    core.addColorStop(0.9, "#2e1065");
    core.addColorStop(1, "#4c1d95");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();

    // hot rim
    ctx.strokeStyle = "rgba(167,139,250,0.75)";
    ctx.lineWidth = r * 0.09;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.98, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,209,102,0.35)";
    ctx.lineWidth = r * 0.035;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.86, game.time * 0.9, game.time * 0.9 + TAU * 0.6);
    ctx.stroke();
  }

  function drawParticles() {
    for (const p of game.particles) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawShocks() {
    for (const s of game.shocks) {
      ctx.strokeStyle = `rgba(255, 209, 102, ${clamp(s.life, 0, 1) * 0.7})`;
      ctx.lineWidth = 3 / zoomScale();
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.stroke();
    }
  }

  function drawTexts() {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "700 18px system-ui, sans-serif";
    for (const t of game.texts) {
      const spt = project(t.x, t.y);
      ctx.globalAlpha = clamp(t.life, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillText(t.str, spt.x + 1.5, spt.y + 1.5);
      ctx.fillStyle = "#ffe9a8";
      ctx.fillText(t.str, spt.x, spt.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawVignette() {
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(2,0,10,0.55)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  // ---------- Render ----------
  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#05010f";
    ctx.fillRect(0, 0, W, H);

    const scale = zoomScale();
    const shakeX = game.shake ? (Math.random() - 0.5) * game.shake : 0;
    const shakeY = game.shake ? (Math.random() - 0.5) * game.shake : 0;

    drawBackground();

    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-player.x + W / 2 / scale + shakeX / scale, -player.y + H / 2 / scale + shakeY / scale);

    drawBlackHole();
    for (const o of objects) drawObject(o);
    drawParticles();
    drawShocks();
    drawAccretion();
    drawCore();
    ctx.restore();

    drawTexts();
    drawVignette();
  }

  // ---------- Loop ----------
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;

    if (game.running && !game.paused) {
      update(dt);
    } else {
      game.time += dt;
    }
    render();
  }

  buildWorld();
  requestAnimationFrame(loop);
})();