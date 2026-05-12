// ============================================================
// PELLE BATTLE — Excavator Fighting Game
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
  const W = window.innerWidth, H = window.innerHeight;
  const aspect = 16 / 9;
  let w, h;
  if (W / H > aspect) { h = H; w = h * aspect; }
  else { w = W; h = w / aspect; }
  canvas.width = Math.round(w);
  canvas.height = Math.round(h);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  if (game) game.onResize();
}
window.addEventListener('resize', resize);

// ── Audio ──
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;
function getAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
}
function playHit(type = 'normal') {
  try {
    const ac = getAudio();
    const g = ac.createGain(); g.connect(ac.destination);
    const o = ac.createOscillator(); o.connect(g);
    if (type === 'normal') {
      o.type = 'square'; o.frequency.setValueAtTime(180, ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(60, ac.currentTime + 0.15);
      g.gain.setValueAtTime(0.3, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
      o.start(); o.stop(ac.currentTime + 0.15);
    } else if (type === 'heavy') {
      o.type = 'sawtooth'; o.frequency.setValueAtTime(100, ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(30, ac.currentTime + 0.3);
      g.gain.setValueAtTime(0.5, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3);
      o.start(); o.stop(ac.currentTime + 0.3);
    } else if (type === 'special') {
      o.type = 'sawtooth'; o.frequency.setValueAtTime(400, ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(50, ac.currentTime + 0.5);
      g.gain.setValueAtTime(0.6, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5);
      o.start(); o.stop(ac.currentTime + 0.5);
    } else if (type === 'ultra') {
      for (let i = 0; i < 3; i++) {
        const oo = ac.createOscillator(), gg = ac.createGain();
        oo.connect(gg); gg.connect(ac.destination);
        oo.type = 'sawtooth';
        oo.frequency.setValueAtTime(300 + i * 150, ac.currentTime + i * 0.12);
        oo.frequency.exponentialRampToValueAtTime(40, ac.currentTime + i * 0.12 + 0.4);
        gg.gain.setValueAtTime(0.5, ac.currentTime + i * 0.12);
        gg.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.12 + 0.4);
        oo.start(ac.currentTime + i * 0.12); oo.stop(ac.currentTime + i * 0.12 + 0.4);
      }
    } else if (type === 'block') {
      o.type = 'triangle'; o.frequency.setValueAtTime(500, ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(400, ac.currentTime + 0.1);
      g.gain.setValueAtTime(0.2, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.1);
      o.start(); o.stop(ac.currentTime + 0.1);
    }
  } catch(e) {}
}

// ── Fighter image sprites ──
// Each image: portrait, arm on the RIGHT side, body/cab on the LEFT
// In-game: Fred faces RIGHT (no flip), Pascal faces LEFT (flip)
const FIGHTER_CFG = {
  fred: {
    src: 'fred.png',
    bodyColor: '#e87000',
    accentColor: '#b85000',
    // Clip polygon in normalized image coords [0-1] — shows body+tracks, hides arm
    // Fred: wheeled excavator, arm occupies upper-right ~45% of image
    bodyClip: [
      [0, 0], [0.52, 0], [0.52, 0.21],
      [0.57, 0.29], [0.57, 0.68],
      [1.0, 0.68], [1.0, 1.0], [0, 1.0]
    ],
    // Where the arm boom attaches to body, normalized in image coords
    armPivotNorm: [0.54, 0.25],
    // Image layout: body center is roughly at this fraction from left
    bodyCenterNorm: 0.30,
    // Arm lengths as fraction of rendered image height
    boomLenF: 0.33,
    stickLenF: 0.23,
    bucketLenF: 0.13,
  },
  pascal: {
    src: 'pascal.png',
    bodyColor: '#c8a800',
    accentColor: '#8a7200',
    // Pascal: tracked mini-excavator
    bodyClip: [
      [0, 0], [0.55, 0], [0.55, 0.22],
      [0.61, 0.30], [0.61, 0.65],
      [1.0, 0.65], [1.0, 1.0], [0, 1.0]
    ],
    armPivotNorm: [0.58, 0.26],
    bodyCenterNorm: 0.32,
    boomLenF: 0.30,
    stickLenF: 0.22,
    bucketLenF: 0.12,
  }
};

// Remove white background from image (one-time processing)
function removeWhiteBg(img) {
  const oc = document.createElement('canvas');
  oc.width = img.naturalWidth;
  oc.height = img.naturalHeight;
  const octx = oc.getContext('2d');
  octx.drawImage(img, 0, 0);
  const id = octx.getImageData(0, 0, oc.width, oc.height);
  const d = id.data;
  const lo = 200, hi = 255;
  for (let i = 0; i < d.length; i += 4) {
    const minC = Math.min(d[i], d[i+1], d[i+2]);
    if (minC >= lo) {
      // Fade out near-white: fully transparent at 255, opaque at lo
      d[i+3] = Math.max(0, Math.round(255 * (lo - minC) / (lo - hi)));
    }
  }
  octx.putImageData(id, 0, 0);
  return oc;
}

// ── Constants ──
const GRAVITY = 0.6;
const FLOOR_RATIO = 0.78;
const MAX_HP = 100;
const MAX_SP = 100;
const ROUND_TIME = 99;

const STATE = {
  IDLE: 'idle', WALK: 'walk', JUMP: 'jump',
  PUNCH: 'punch', KICK: 'kick', SPECIAL: 'special', ULTRA: 'ultra',
  BLOCK: 'block', HIT: 'hit', KO: 'ko', WIN: 'win',
};

// ── Particle ──
class Particle {
  constructor(x, y, vx, vy, color, life, size) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.color = color; this.life = this.maxLife = life; this.size = size;
  }
  update() { this.x += this.vx; this.y += this.vy; this.vy += 0.3; this.life--; }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.life / this.maxLife;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * (this.life / this.maxLife), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Projectile ──
class Projectile {
  constructor(x, y, dir, color, owner) {
    this.x = x; this.y = y; this.vx = dir * 9;
    this.color = color; this.owner = owner; this.alive = true; this.r = 18; this.angle = 0;
  }
  update(W) { this.x += this.vx; this.angle += 0.2; if (this.x < -50 || this.x > W + 50) this.alive = false; }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y); ctx.rotate(this.angle);
    ctx.shadowColor = this.color; ctx.shadowBlur = 15;
    ctx.strokeStyle = this.color; ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, r = i % 2 === 0 ? this.r : this.r * 0.5;
      i === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
    }
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle = this.color; ctx.globalAlpha = 0.4; ctx.fill();
    ctx.restore();
  }
}

// ── Fighter ──
class Fighter {
  constructor(cfg) {
    this.id = cfg.id;
    this.name = cfg.name;
    this.icfg = FIGHTER_CFG[cfg.id];
    this.color = this.icfg.bodyColor;
    this.accentColor = this.icfg.accentColor;
    this.facing = cfg.facing;
    this.x = cfg.x; this.y = 0; this.vy = 0;
    this.onGround = true;
    this.hp = MAX_HP; this.sp = 0;
    this.state = STATE.IDLE; this.stateTimer = 0; this.idleTimer = 0;
    this.hitFlash = 0;
    this.boom = -0.55; this.arm = 0.35; this.bucket = 0.25;
    this.targetBoom = -0.55; this.targetArm = 0.35; this.targetBucket = 0.25;
    this.winBoom = 0; this.winDir = 1;
    this.projectiles = []; this.particles = [];
    this.keys = {};
    this.isAI = cfg.isAI || false;
    this.aiTimer = 0;
    this.trackOffset = 0;

    // Load and process sprite
    this.sprite = null; // processed (white-removed) image canvas
    this.imgNaturalW = 1; this.imgNaturalH = 1;
    const img = new Image();
    img.onload = () => {
      this.imgNaturalW = img.naturalWidth;
      this.imgNaturalH = img.naturalHeight;
      this.sprite = removeWhiteBg(img);
    };
    img.src = this.icfg.src;
  }

  get W() { return canvas.width; }
  get H() { return canvas.height; }
  get floorY() { return Math.floor(this.H * FLOOR_RATIO); }
  // Approximate body width for hit detection (based on rendered size)
  get bodyW() { return this.H * 0.20; }
  get bodyH() { return this.H * 0.18; }

  resetPosition(x) {
    this.x = x; this.y = this.floorY; this.vy = 0; this.onGround = true;
    this.state = STATE.IDLE; this.stateTimer = 0;
    this.boom = -0.55; this.arm = 0.35; this.bucket = 0.25;
    this.targetBoom = -0.55; this.targetArm = 0.35; this.targetBucket = 0.25;
    this.projectiles = []; this.hitFlash = 0;
  }

  setState(s, d) { this.state = s; this.stateTimer = d; }

  canAct() {
    return this.state === STATE.IDLE || this.state === STATE.WALK || this.state === STATE.JUMP;
  }

  punch(target) {
    if (!this.canAct()) return;
    this.setState(STATE.PUNCH, 28);
    this.targetBoom = 0.2; this.targetArm = -0.6; this.targetBucket = -0.4;
    playHit('normal');
    this.sp = Math.min(MAX_SP, this.sp + 8);
    game.tryHit(this, target, 8, 'normal', 0.28);
  }

  kick(target) {
    if (!this.canAct()) return;
    this.setState(STATE.KICK, 35);
    this.targetBoom = 0.4; this.targetArm = -0.9; this.targetBucket = -0.7;
    playHit('heavy');
    this.sp = Math.min(MAX_SP, this.sp + 12);
    game.tryHit(this, target, 14, 'heavy', 0.32);
  }

  special(target) {
    if (!this.canAct() || this.sp < 30) return;
    this.sp -= 30;
    this.setState(STATE.SPECIAL, 50);
    this.targetBoom = -1.0; this.targetArm = 0.8; this.targetBucket = 0.6;
    playHit('special');
    const dir = this.facing;
    const px = this.x + dir * this.bodyW * 0.7;
    const py = this.y - this.bodyH * 0.6;
    this.projectiles.push(new Projectile(px, py, dir, this.color, this));
    game.announce('ATTAQUE SPÉCIALE !', '#0ff', 900);
  }

  ultra(target) {
    if (!this.canAct() || this.sp < 100) return;
    this.sp = 0;
    this.setState(STATE.ULTRA, 90);
    this.targetBoom = -1.3; this.targetArm = 1.0; this.targetBucket = 0.9;
    playHit('ultra');
    const dir = this.facing;
    for (let i = 0; i < 3; i++) {
      const px = this.x + dir * this.bodyW * 0.7;
      const py = this.y - this.bodyH * (0.3 + i * 0.25);
      setTimeout(() => {
        const p = new Projectile(px, py, dir, '#ff0', this);
        p.r = 24; this.projectiles.push(p);
      }, i * 120);
    }
    game.flashScreen('#ff0', 0.5);
    game.announce('⚡ ULTRA !! ⚡', '#ff0', 1200);
  }

  block() {
    if (this.state === STATE.KO || this.state === STATE.WIN) return;
    this.setState(STATE.BLOCK, 1);
    this.targetBoom = -0.2; this.targetArm = -0.1; this.targetBucket = 0.1;
  }

  takeDamage(dmg, type) {
    if (this.state === STATE.KO) return false;
    if (this.state === STATE.BLOCK) { dmg = Math.floor(dmg * 0.2); playHit('block'); }
    this.hp = Math.max(0, this.hp - dmg);
    this.sp = Math.min(MAX_SP, this.sp + dmg * 0.5);
    this.hitFlash = 8;
    this.setState(STATE.HIT, 18);
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, spd = 2 + Math.random() * 4;
      this.particles.push(new Particle(
        this.x, this.y - this.bodyH * 0.5,
        Math.cos(a) * spd, Math.sin(a) * spd - 2,
        type === 'ultra' ? '#ff0' : type === 'special' ? '#0ff' : '#f44',
        20 + Math.random() * 10, 3 + Math.random() * 4
      ));
    }
    return true;
  }

  jump() {
    if (!this.onGround) return;
    this.vy = -this.H * 0.022; this.onGround = false;
    this.setState(STATE.JUMP, 999);
  }

  update(dt, opponent) {
    if (this.isAI) this.updateAI(opponent);
    const W = this.W, floor = this.floorY, bw = this.bodyW;

    if (this.state !== STATE.KO && this.state !== STATE.WIN) {
      const spd = W * 0.004;
      if (this.keys.left && this.state !== STATE.HIT) {
        this.x -= spd; if (this.canAct()) this.setState(STATE.WALK, 999); this.trackOffset -= 2;
      } else if (this.keys.right && this.state !== STATE.HIT) {
        this.x += spd; if (this.canAct()) this.setState(STATE.WALK, 999); this.trackOffset += 2;
      } else if (this.state === STATE.WALK) { this.setState(STATE.IDLE, 0); }
      if (this.keys.up) { this.jump(); this.keys.up = false; }
      if (this.keys.punch) { this.punch(opponent); this.keys.punch = false; }
      if (this.keys.kick) { this.kick(opponent); this.keys.kick = false; }
      if (this.keys.special) { this.special(opponent); this.keys.special = false; }
      if (this.keys.ultra) { this.ultra(opponent); this.keys.ultra = false; }
      if (this.keys.block) this.block();
      else if (this.state === STATE.BLOCK) this.setState(STATE.IDLE, 0);
    }

    if (!this.onGround) {
      this.vy += GRAVITY; this.y += this.vy;
      if (this.y >= floor) {
        this.y = floor; this.vy = 0; this.onGround = true;
        if (this.state === STATE.JUMP) this.setState(STATE.IDLE, 0);
      }
    }
    this.x = Math.max(bw * 0.5, Math.min(W - bw * 0.5, this.x));
    if (this.state !== STATE.KO && this.state !== STATE.WIN)
      this.facing = opponent.x > this.x ? 1 : -1;

    if (this.stateTimer > 0) {
      this.stateTimer--;
      if (this.stateTimer === 0 && this.state !== STATE.KO && this.state !== STATE.WIN && this.state !== STATE.BLOCK) {
        this.setState(STATE.IDLE, 0);
        this.targetBoom = -0.55; this.targetArm = 0.35; this.targetBucket = 0.25;
      }
    }

    const sp = 0.18;
    this.boom += (this.targetBoom - this.boom) * sp;
    this.arm += (this.targetArm - this.arm) * sp;
    this.bucket += (this.targetBucket - this.bucket) * sp;

    this.idleTimer += 0.05;
    if (this.state === STATE.IDLE) this.boom = -0.55 + Math.sin(this.idleTimer) * 0.04;
    if (this.state === STATE.WIN) {
      this.winBoom += 0.06 * this.winDir;
      if (this.winBoom > 0.5 || this.winBoom < -0.5) this.winDir *= -1;
      this.boom = -0.55 + this.winBoom; this.targetBoom = this.boom;
    }

    if (this.hitFlash > 0) this.hitFlash--;
    this.particles.forEach(p => p.update()); this.particles = this.particles.filter(p => p.life > 0);
    this.projectiles.forEach(p => p.update(W)); this.projectiles = this.projectiles.filter(p => p.alive);

    this.projectiles.forEach(p => {
      const dx = Math.abs(p.x - opponent.x), dy = Math.abs(p.y - (opponent.y - opponent.bodyH * 0.5));
      if (dx < opponent.bodyW * 0.7 && dy < opponent.bodyH * 0.8) {
        opponent.takeDamage(12, 'special'); playHit('special'); p.alive = false;
        game.flashScreen('#0ff', 0.3);
      }
    });
  }

  updateAI(opponent) {
    this.aiTimer--;
    if (this.aiTimer > 0) return;
    this.aiTimer = 18 + Math.floor(Math.random() * 28);
    const dx = opponent.x - this.x, dist = Math.abs(dx);
    const atkRange = this.bodyW * 1.8, closeRange = this.bodyW * 1.2;
    this.keys.left = this.keys.right = this.keys.punch = this.keys.kick = false;
    this.keys.special = this.keys.ultra = this.keys.block = false;
    const r = Math.random();
    if (dist > atkRange) {
      dx > 0 ? this.keys.right = true : this.keys.left = true;
    } else if (dist < closeRange) {
      if (r < 0.3) dx > 0 ? this.keys.left = true : this.keys.right = true;
      else if (r < 0.6) this.keys.punch = true;
      else this.keys.kick = true;
    } else {
      if (r < 0.06 && this.sp >= 100) this.keys.ultra = true;
      else if (r < 0.18 && this.sp >= 30) this.keys.special = true;
      else if (r < 0.38) this.keys.kick = true;
      else if (r < 0.56) this.keys.punch = true;
      else if (r < 0.66) this.keys.up = true;
      else if (r < 0.74) this.keys.block = true;
      else dx > 0 ? this.keys.right = true : this.keys.left = true;
    }
  }

  // ── Drawing ──
  draw(ctx) {
    if (this.hitFlash % 2 === 1) {
      ctx.save(); ctx.globalAlpha = 0.4;
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.sprite) {
      this.drawWithSprite(ctx);
    } else {
      ctx.scale(this.facing, 1);
      this.drawFallback(ctx);
    }

    ctx.restore();
    if (this.hitFlash % 2 === 1) ctx.restore();

    this.particles.forEach(p => p.draw(ctx));
    this.projectiles.forEach(p => p.draw(ctx));
  }

  drawWithSprite(ctx) {
    const H = this.H;
    const cfg = this.icfg;
    const aspect = this.imgNaturalW / this.imgNaturalH;

    // Scale image: full height = 72% of canvas height
    const targetH = H * 0.72;
    const targetW = targetH * aspect;

    // Shift so the excavator body center is at fighter.x (not image center)
    const imgX = -targetW * cfg.bodyCenterNorm;
    const imgY = -targetH; // bottom of image at floor

    ctx.save();
    ctx.scale(this.facing, 1);

    // ── Draw body (clipped to exclude arm area) ──
    ctx.save();
    ctx.beginPath();
    const poly = cfg.bodyClip;
    ctx.moveTo(imgX + poly[0][0] * targetW, imgY + poly[0][1] * targetH);
    for (let i = 1; i < poly.length; i++)
      ctx.lineTo(imgX + poly[i][0] * targetW, imgY + poly[i][1] * targetH);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(this.sprite, imgX, imgY, targetW, targetH);
    ctx.restore();

    // Hit flash overlay on body
    if (this.hitFlash > 0 && this.hitFlash % 2 === 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      const p = cfg.bodyClip;
      ctx.moveTo(imgX + p[0][0] * targetW, imgY + p[0][1] * targetH);
      for (let i = 1; i < p.length; i++)
        ctx.lineTo(imgX + p[i][0] * targetW, imgY + p[i][1] * targetH);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // ── Draw articulated arm ──
    const pivX = imgX + cfg.armPivotNorm[0] * targetW;
    const pivY = imgY + cfg.armPivotNorm[1] * targetH;
    const boomLen = targetH * cfg.boomLenF;
    const stickLen = targetH * cfg.stickLenF;
    const bucketLen = targetH * cfg.bucketLenF;

    this.drawArm(ctx, pivX, pivY, boomLen, stickLen, bucketLen);

    ctx.restore();
  }

  drawArm(ctx, pivX, pivY, boomLen, stickLen, bucketLen) {
    const color = this.color;
    const accent = this.accentColor;
    const s = this.H * 0.001; // scale unit

    // Boom angle: starts pointing up-right (forward direction)
    const boomAngle = this.boom + Math.PI * 0.08; // slight forward tilt
    const boomEndX = pivX + Math.cos(boomAngle) * boomLen;
    const boomEndY = pivY + Math.sin(boomAngle) * boomLen;

    // Stick
    const stickAngle = boomAngle + this.arm;
    const stickEndX = boomEndX + Math.cos(stickAngle) * stickLen;
    const stickEndY = boomEndY + Math.sin(stickAngle) * stickLen;

    // Hydraulic cylinder lines (decorative)
    ctx.strokeStyle = 'rgba(160,160,160,0.7)';
    ctx.lineWidth = s * 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pivX + s * 6, pivY + s * 4);
    ctx.lineTo((pivX + boomEndX) * 0.55, (pivY + boomEndY) * 0.55 + pivY * 0.45);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(boomEndX - s * 4, boomEndY);
    ctx.lineTo((boomEndX + stickEndX) * 0.5, (boomEndY + stickEndY) * 0.5);
    ctx.stroke();

    // ── BOOM ──
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 13;
    ctx.beginPath();
    ctx.moveTo(pivX, pivY);
    ctx.lineTo(boomEndX, boomEndY);
    ctx.stroke();
    // Highlight stripe
    ctx.strokeStyle = accent;
    ctx.lineWidth = s * 5;
    ctx.beginPath();
    ctx.moveTo(pivX + s * 2, pivY + s * 2);
    ctx.lineTo(boomEndX + s * 2, boomEndY + s * 2);
    ctx.stroke();

    // Pivot joint
    ctx.fillStyle = '#777';
    ctx.beginPath(); ctx.arc(pivX, pivY, s * 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#999';
    ctx.beginPath(); ctx.arc(pivX, pivY, s * 4, 0, Math.PI * 2); ctx.fill();

    // ── STICK ──
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 10;
    ctx.beginPath();
    ctx.moveTo(boomEndX, boomEndY);
    ctx.lineTo(stickEndX, stickEndY);
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.lineWidth = s * 4;
    ctx.beginPath();
    ctx.moveTo(boomEndX + s * 1.5, boomEndY + s * 1.5);
    ctx.lineTo(stickEndX + s * 1.5, stickEndY + s * 1.5);
    ctx.stroke();

    // Elbow joint
    ctx.fillStyle = '#666';
    ctx.beginPath(); ctx.arc(boomEndX, boomEndY, s * 6, 0, Math.PI * 2); ctx.fill();

    // ── BUCKET ──
    const bucketAngle = stickAngle + this.bucket;
    ctx.save();
    ctx.translate(stickEndX, stickEndY);
    ctx.rotate(bucketAngle);

    const bkW = bucketLen * 0.9;
    const bkH = bucketLen * 0.75;

    ctx.fillStyle = '#8a8a8a';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(bucketLen, -bkW * 0.25);
    ctx.lineTo(bucketLen + bkW * 0.28, bkH * 0.45);
    ctx.lineTo(bucketLen, bkH * 0.85);
    ctx.lineTo(0, bkH * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = s * 2;
    ctx.stroke();

    // Teeth
    ctx.fillStyle = '#bbb';
    for (let t = 0; t < 4; t++) {
      ctx.beginPath();
      ctx.moveTo(bucketLen + bkW * 0.05 + t * bkW * 0.10, bkH * 0.85);
      ctx.lineTo(bucketLen + bkW * 0.01 + t * bkW * 0.10, bkH * 0.85 + s * 6);
      ctx.lineTo(bucketLen + bkW * 0.14 + t * bkW * 0.10, bkH * 0.85);
      ctx.fill();
    }
    ctx.restore();

    // Wrist joint
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.arc(stickEndX, stickEndY, s * 5, 0, Math.PI * 2); ctx.fill();
  }

  // Fallback: fully programmatic drawing (used while image loads)
  drawFallback(ctx) {
    const H = this.H;
    const s = H * 0.001;
    const bw = 105 * s, bh = 80 * s, trackH = 28 * s, trackW = 115 * s, wheelR = 16 * s;

    // Tracks
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.roundRect(-trackW*0.5, -trackH, trackW, trackH, wheelR*0.4);
    ctx.fill();
    // Body
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.roundRect(-bw*0.45, -trackH-bh, bw, bh, 8*s);
    ctx.fill();
    // Name
    ctx.font = `bold ${Math.floor(11*s)}px Arial Black, sans-serif`;
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(this.name, 0, -trackH - bh * 0.22);

    // Fallback arm
    const pivX = bw * 0.40, pivY = -trackH - bh * 0.85;
    this.drawArm(ctx, pivX, pivY, 90*s, 65*s, 28*s);
  }
}

// ── Game ──
class Game {
  constructor() {
    this.mode = null; this.round = 1; this.maxRounds = 3;
    this.p1Wins = 0; this.p2Wins = 0;
    this.timer = ROUND_TIME; this.timerClock = 0;
    this.state = 'menu';
    this.announceTimeout = null;

    this.fred = new Fighter({ id: 'fred', name: 'Fred', facing: 1, x: 0 });
    this.pascal = new Fighter({ id: 'pascal', name: 'Pascal', facing: -1, x: 0 });

    this.setupControls();
    this.setupOverlay();
    this.loop();
  }

  onResize() {
    const W = canvas.width;
    this.fred.resetPosition(W * 0.25);
    this.pascal.resetPosition(W * 0.75);
  }

  setupOverlay() {
    document.getElementById('btn-1p').addEventListener('click', () => this.startGame('1p'));
    document.getElementById('btn-2p').addEventListener('click', () => this.startGame('2p'));
  }

  startGame(mode) {
    this.mode = mode;
    this.round = 1; this.p1Wins = 0; this.p2Wins = 0;
    this.pascal.isAI = mode === '1p';
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('p2-controls').style.display = mode === '1p' ? 'none' : '';
    document.getElementById('p2-actions').style.display = mode === '1p' ? 'none' : '';
    this.startRound();
  }

  startRound() {
    const W = canvas.width;
    this.fred.resetPosition(W * 0.25);
    this.pascal.resetPosition(W * 0.75);
    this.fred.hp = MAX_HP; this.fred.sp = 0;
    this.pascal.hp = MAX_HP; this.pascal.sp = 0;
    this.timer = ROUND_TIME; this.timerClock = 0;
    this.state = 'countdown';
    document.getElementById('round-display').textContent = `ROUND ${this.round}`;

    let count = 3;
    const tick = () => {
      if (count > 0) {
        this.announce(count === 3 ? 'PRÊTS ?' : String(count), '#fff', 700);
        count--; setTimeout(tick, 750);
      } else {
        this.announce('BATTEZ !!!', '#f80', 900);
        this.state = 'fight';
      }
    };
    setTimeout(tick, 300);
  }

  tryHit(attacker, defender, baseDmg, type, reachRatio) {
    const dx = Math.abs(attacker.x - defender.x);
    const reach = attacker.bodyW * (reachRatio + 2.2);
    if (dx < reach) { defender.takeDamage(baseDmg, type); if (type === 'heavy') game.flashScreen('#f00', 0.2); }
  }

  announce(text, color, duration) {
    const el = document.getElementById('announce');
    el.textContent = text; el.style.color = color; el.style.opacity = '1';
    if (this.announceTimeout) clearTimeout(this.announceTimeout);
    this.announceTimeout = setTimeout(() => { el.style.opacity = '0'; }, duration);
  }

  flashScreen(color, intensity) {
    const el = document.getElementById('flash-overlay');
    el.style.background = color; el.style.opacity = String(intensity);
    clearTimeout(this._flashTO);
    this._flashTO = setTimeout(() => { el.style.opacity = '0'; }, 120);
  }

  setupControls() {
    const bind = (id, key, fighter) => {
      const el = document.getElementById(id);
      if (!el) return;
      const press = () => { fighter.keys[key] = true; };
      const release = () => { fighter.keys[key] = false; };
      el.addEventListener('touchstart', e => { e.preventDefault(); press(); }, { passive: false });
      el.addEventListener('touchend', e => { e.preventDefault(); release(); }, { passive: false });
      el.addEventListener('mousedown', e => { e.preventDefault(); press(); });
      el.addEventListener('mouseup', e => { e.preventDefault(); release(); });
    };

    const p1 = this.fred, p2 = this.pascal;
    bind('p1-left','left',p1); bind('p1-right','right',p1); bind('p1-up','up',p1);
    bind('p1-punch','punch',p1); bind('p1-kick','kick',p1);
    bind('p1-special','special',p1); bind('p1-super','ultra',p1); bind('p1-block','block',p1);
    bind('p2-left','left',p2); bind('p2-right','right',p2); bind('p2-up','up',p2);
    bind('p2-punch','punch',p2); bind('p2-kick','kick',p2);
    bind('p2-special','special',p2); bind('p2-super','ultra',p2); bind('p2-block','block',p2);

    const kbDown = {
      'ArrowLeft': () => p1.keys.left = true,
      'ArrowRight': () => p1.keys.right = true,
      'ArrowUp': () => { p1.keys.up = true; },
      'z': () => p1.keys.punch = true,
      'x': () => p1.keys.kick = true,
      'c': () => p1.keys.special = true,
      'v': () => p1.keys.ultra = true,
      's': () => p1.keys.block = true,
    };
    const kbUp = {
      'ArrowLeft': () => p1.keys.left = false,
      'ArrowRight': () => p1.keys.right = false,
      's': () => p1.keys.block = false,
    };
    window.addEventListener('keydown', e => { if (kbDown[e.key]) { kbDown[e.key](); e.preventDefault(); } });
    window.addEventListener('keyup', e => { if (kbUp[e.key]) kbUp[e.key](); });
  }

  checkRoundEnd() {
    const fredDead = this.fred.hp <= 0, pascalDead = this.pascal.hp <= 0, timeUp = this.timer <= 0;
    if (!fredDead && !pascalDead && !timeUp) return;
    this.state = 'roundover';
    let winner = null;
    if (fredDead && !pascalDead) { winner = this.pascal; this.p2Wins++; }
    else if (pascalDead && !fredDead) { winner = this.fred; this.p1Wins++; }
    else if (timeUp) {
      if (this.fred.hp > this.pascal.hp) { winner = this.fred; this.p1Wins++; }
      else if (this.pascal.hp > this.fred.hp) { winner = this.pascal; this.p2Wins++; }
    }
    if (winner) {
      winner.setState(STATE.WIN, 9999);
      const loser = winner === this.fred ? this.pascal : this.fred;
      loser.setState(STATE.KO, 9999);
      this.announce(`K.O. !! ${winner.name} GAGNE !`, '#ff0', 9999);
      playHit('ultra'); this.flashScreen('#fff', 0.8);
    } else { this.announce('ÉGALITÉ !', '#0ff', 9999); }

    setTimeout(() => {
      const need = Math.ceil(this.maxRounds / 2);
      if (this.p1Wins >= need || this.p2Wins >= need || this.round >= this.maxRounds) this.showGameOver();
      else { this.round++; this.startRound(); }
    }, 3000);
  }

  showGameOver() {
    this.state = 'gameover';
    const ov = document.getElementById('overlay');
    ov.style.display = 'flex';
    const winner = this.p1Wins > this.p2Wins ? this.fred : this.p2Wins > this.p1Wins ? this.pascal : null;
    ov.innerHTML = `
      <h1>${winner ? winner.name + ' GAGNE !' : 'MATCH NUL !'}</h1>
      <div class="subtitle">${this.fred.name} ${this.p1Wins} — ${this.p2Wins} ${this.pascal.name}</div>
      <button class="start-btn" id="btn-rematch">REVANCHE !</button>
      <button class="start-btn" id="btn-menu">MENU</button>`;
    document.getElementById('btn-rematch').addEventListener('click', () => this.startGame(this.mode));
    document.getElementById('btn-menu').addEventListener('click', () => {
      ov.innerHTML = `
        <h1>⚙ PELLE BATTLE ⚙</h1>
        <div class="subtitle">Fred vs Pascal — Combat de Pelleteuses</div>
        <button class="start-btn" id="btn-1p">1 JOUEUR (vs IA)</button>
        <button class="start-btn" id="btn-2p">2 JOUEURS</button>`;
      document.getElementById('btn-1p').addEventListener('click', () => this.startGame('1p'));
      document.getElementById('btn-2p').addEventListener('click', () => this.startGame('2p'));
    });
  }

  updateHUD() {
    document.getElementById('hp1').style.width = (this.fred.hp / MAX_HP * 100) + '%';
    document.getElementById('hp2').style.width = (this.pascal.hp / MAX_HP * 100) + '%';
    document.getElementById('sp1').style.width = (this.fred.sp / MAX_SP * 100) + '%';
    document.getElementById('sp2').style.width = (this.pascal.sp / MAX_SP * 100) + '%';
    document.getElementById('timer').textContent = Math.ceil(this.timer);
  }

  drawBackground(ctx) {
    const W = canvas.width, H = canvas.height;
    const floor = Math.floor(H * FLOOR_RATIO);

    const sky = ctx.createLinearGradient(0, 0, 0, floor);
    sky.addColorStop(0, '#1a1a2e');
    sky.addColorStop(0.5, '#16213e');
    sky.addColorStop(1, '#0f3460');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, floor);

    // Glow
    ctx.save();
    const glow = ctx.createRadialGradient(W*.5, H*.12, 0, W*.5, H*.12, H*.12);
    glow.addColorStop(0, 'rgba(255,200,50,0.9)');
    glow.addColorStop(0.4, 'rgba(255,150,0,0.4)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(W*.5, H*.12, H*.12, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // Silhouettes
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(W*0.08, H*0.15, 6, floor - H*0.15);
    ctx.fillRect(W*0.08, H*0.15, W*0.12, 5);
    ctx.fillRect(W*0.78, H*0.3, W*0.08, floor - H*0.3);
    ctx.fillRect(W*0.86, H*0.38, W*0.06, floor - H*0.38);

    // Crowd
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    for (let i = 0; i < 30; i++) {
      ctx.beginPath();
      ctx.ellipse((i/30)*W, floor, 8, H*(0.06+Math.sin(i*1.7)*0.02), 0, 0, Math.PI*2);
      ctx.fill();
    }

    // Floor
    const floorGrad = ctx.createLinearGradient(0, floor, 0, H);
    floorGrad.addColorStop(0, '#5c3a1e');
    floorGrad.addColorStop(0.3, '#3d2610');
    floorGrad.addColorStop(1, '#1a0f05');
    ctx.fillStyle = floorGrad; ctx.fillRect(0, floor, W, H - floor);

    ctx.strokeStyle = 'rgba(255,255,100,0.15)'; ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);
    ctx.beginPath(); ctx.moveTo(W/2, floor); ctx.lineTo(W/2, H); ctx.stroke();
    ctx.setLineDash([]);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const spot1 = ctx.createRadialGradient(W*.25, 0, 0, W*.25, 0, H*.9);
    spot1.addColorStop(0, 'rgba(255,180,0,0.06)'); spot1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spot1; ctx.fillRect(0, 0, W, H);
    const spot2 = ctx.createRadialGradient(W*.75, 0, 0, W*.75, 0, H*.9);
    spot2.addColorStop(0, 'rgba(100,150,255,0.06)'); spot2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spot2; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  loop() {
    const tick = () => { requestAnimationFrame(tick); this.update(); this.render(); };
    requestAnimationFrame(tick);
  }

  update() {
    if (this.state !== 'fight') return;
    this.timerClock++;
    if (this.timerClock >= 60) { this.timerClock = 0; this.timer--; }
    this.fred.update(1, this.pascal);
    this.pascal.update(1, this.fred);
    this.updateHUD();
    this.checkRoundEnd();
  }

  render() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    this.drawBackground(ctx);
    [this.fred, this.pascal].forEach(f => {
      ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(f.x, f.floorY + 5, f.bodyW * 0.65, 9, 0, 0, Math.PI*2);
      ctx.fill(); ctx.restore();
    });
    this.fred.draw(ctx);
    this.pascal.draw(ctx);
  }
}

// ── Boot ──
let game;
resize();
window.addEventListener('load', () => { resize(); game = new Game(); game.onResize(); });
