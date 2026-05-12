// ============================================================
// PELLE BATTLE — Excavator Fighting Game
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ── Resize canvas to fill screen in landscape ──
function resize() {
  const W = window.innerWidth;
  const H = window.innerHeight;
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
    const g = ac.createGain();
    g.connect(ac.destination);
    const o = ac.createOscillator();
    o.connect(g);
    if (type === 'normal') {
      o.type = 'square'; o.frequency.setValueAtTime(180, ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(60, ac.currentTime + 0.15);
      g.gain.setValueAtTime(0.3, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
      o.start(); o.stop(ac.currentTime + 0.15);
    } else if (type === 'heavy') {
      o.type = 'sawtooth'; o.frequency.setValueAtTime(100, ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(30, ac.currentTime + 0.3);
      g.gain.setValueAtTime(0.5, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3);
      o.start(); o.stop(ac.currentTime + 0.3);
    } else if (type === 'special') {
      o.type = 'sawtooth'; o.frequency.setValueAtTime(400, ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(50, ac.currentTime + 0.5);
      g.gain.setValueAtTime(0.6, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5);
      o.start(); o.stop(ac.currentTime + 0.5);
    } else if (type === 'ultra') {
      for (let i = 0; i < 3; i++) {
        const oo = ac.createOscillator();
        const gg = ac.createGain();
        oo.connect(gg); gg.connect(ac.destination);
        oo.type = 'sawtooth';
        oo.frequency.setValueAtTime(300 + i * 150, ac.currentTime + i * 0.12);
        oo.frequency.exponentialRampToValueAtTime(40, ac.currentTime + i * 0.12 + 0.4);
        gg.gain.setValueAtTime(0.5, ac.currentTime + i * 0.12);
        gg.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.12 + 0.4);
        oo.start(ac.currentTime + i * 0.12);
        oo.stop(ac.currentTime + i * 0.12 + 0.4);
      }
    } else if (type === 'block') {
      o.type = 'triangle'; o.frequency.setValueAtTime(500, ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(400, ac.currentTime + 0.1);
      g.gain.setValueAtTime(0.2, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.1);
      o.start(); o.stop(ac.currentTime + 0.1);
    }
  } catch(e) {}
}

// ── Photo images ──
const fredImg = new Image();
const pascalImg = new Image();
fredImg.src = 'fred.png';
pascalImg.src = 'pascal.png';

// ── Constants ──
const GRAVITY = 0.6;
const FLOOR_RATIO = 0.78;
const MAX_HP = 100;
const MAX_SP = 100;
const ROUND_TIME = 99;

// ── Fighter states ──
const STATE = {
  IDLE: 'idle',
  WALK: 'walk',
  JUMP: 'jump',
  PUNCH: 'punch',
  KICK: 'kick',
  SPECIAL: 'special',
  ULTRA: 'ultra',
  BLOCK: 'block',
  HIT: 'hit',
  KO: 'ko',
  WIN: 'win',
};

// ── Particle ──
class Particle {
  constructor(x, y, vx, vy, color, life, size) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.color = color;
    this.life = this.maxLife = life;
    this.size = size;
  }
  update() {
    this.x += this.vx; this.y += this.vy;
    this.vy += 0.3;
    this.life--;
  }
  draw(ctx) {
    const alpha = this.life / this.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Projectile (special attack) ──
class Projectile {
  constructor(x, y, dir, color, owner) {
    this.x = x; this.y = y;
    this.vx = dir * 9;
    this.color = color;
    this.owner = owner;
    this.alive = true;
    this.r = 18;
    this.angle = 0;
  }
  update(W) {
    this.x += this.vx;
    this.angle += 0.2;
    if (this.x < -50 || this.x > W + 50) this.alive = false;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 15;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? this.r : this.r * 0.5;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.4;
    ctx.fill();
    ctx.restore();
  }
}

// ── Excavator Fighter ──
class Fighter {
  constructor(cfg) {
    this.id = cfg.id;
    this.name = cfg.name;
    this.color = cfg.color;       // main body color
    this.accentColor = cfg.accentColor;
    this.photo = cfg.photo;
    this.facing = cfg.facing;     // 1 = right, -1 = left
    this.x = cfg.x;
    this.y = 0; // set by onResize
    this.vy = 0;
    this.onGround = true;
    this.hp = MAX_HP;
    this.sp = 0;
    this.state = STATE.IDLE;
    this.stateTimer = 0;
    this.idleTimer = 0;
    this.scale = cfg.scale || 1;
    this.hitFlash = 0;

    // Arm angles (for articulation)
    this.boom = -0.6;      // main boom angle
    this.arm = 0.4;        // forearm angle
    this.bucket = 0.3;     // bucket angle
    this.targetBoom = -0.6;
    this.targetArm = 0.4;
    this.targetBucket = 0.3;

    // Win animation
    this.winBoom = 0;
    this.winDir = 1;

    // Projectiles
    this.projectiles = [];
    this.ultraProjectiles = [];

    // Input
    this.keys = {};

    // AI
    this.isAI = cfg.isAI || false;
    this.aiTimer = 0;
    this.aiAction = null;

    // Walk track offset
    this.trackOffset = 0;

    // Particles
    this.particles = [];
  }

  get W() { return canvas.width; }
  get H() { return canvas.height; }
  get floorY() { return Math.floor(this.H * FLOOR_RATIO); }
  get bodyW() { return Math.floor(this.H * 0.22 * this.scale); }
  get bodyH() { return Math.floor(this.H * 0.16 * this.scale); }

  resetPosition(x) {
    this.x = x;
    this.y = this.floorY;
    this.vy = 0;
    this.onGround = true;
    this.state = STATE.IDLE;
    this.stateTimer = 0;
    this.boom = -0.6; this.arm = 0.4; this.bucket = 0.3;
    this.targetBoom = -0.6; this.targetArm = 0.4; this.targetBucket = 0.3;
    this.projectiles = [];
    this.hitFlash = 0;
  }

  setState(s, duration) {
    this.state = s;
    this.stateTimer = duration;
  }

  canAct() {
    return this.state === STATE.IDLE || this.state === STATE.WALK || this.state === STATE.JUMP;
  }

  punch(target) {
    if (!this.canAct()) return;
    this.setState(STATE.PUNCH, 28);
    this.targetBoom = 0.3;
    this.targetArm = -0.5;
    this.targetBucket = -0.3;
    playHit('normal');
    this.sp = Math.min(MAX_SP, this.sp + 8);
    game.tryHit(this, target, 8, 'normal', 0.28);
  }

  kick(target) {
    if (!this.canAct()) return;
    this.setState(STATE.KICK, 35);
    this.targetBoom = 0.5;
    this.targetArm = -0.8;
    this.targetBucket = -0.6;
    playHit('heavy');
    this.sp = Math.min(MAX_SP, this.sp + 12);
    game.tryHit(this, target, 14, 'heavy', 0.32);
  }

  special(target) {
    if (!this.canAct() || this.sp < 30) return;
    this.sp -= 30;
    this.setState(STATE.SPECIAL, 50);
    this.targetBoom = -1.0;
    this.targetArm = 0.8;
    this.targetBucket = 0.6;
    playHit('special');
    // Launch a projectile
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
    this.targetBoom = -1.3;
    this.targetArm = 1.0;
    this.targetBucket = 0.9;
    playHit('ultra');
    // Three projectiles
    const dir = this.facing;
    for (let i = 0; i < 3; i++) {
      const px = this.x + dir * this.bodyW * 0.7;
      const py = this.y - this.bodyH * (0.3 + i * 0.25);
      setTimeout(() => {
        const p = new Projectile(px, py, dir, '#ff0', this);
        p.r = 24;
        this.projectiles.push(p);
      }, i * 120);
    }
    game.flashScreen('#ff0', 0.5);
    game.announce('⚡ ULTRA !! ⚡', '#ff0', 1200);
  }

  block() {
    if (this.state === STATE.KO || this.state === STATE.WIN) return;
    this.setState(STATE.BLOCK, 1);
    this.targetBoom = -0.2;
    this.targetArm = -0.1;
    this.targetBucket = 0.1;
  }

  takeDamage(dmg, type) {
    if (this.state === STATE.KO) return false;
    if (this.state === STATE.BLOCK) {
      dmg = Math.floor(dmg * 0.2);
      playHit('block');
    }
    this.hp = Math.max(0, this.hp - dmg);
    this.sp = Math.min(MAX_SP, this.sp + dmg * 0.5);
    this.hitFlash = 8;
    this.setState(STATE.HIT, 18);
    // Spawn particles
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      this.particles.push(new Particle(
        this.x, this.y - this.bodyH * 0.5,
        Math.cos(angle) * speed, Math.sin(angle) * speed - 2,
        type === 'ultra' ? '#ff0' : (type === 'special' ? '#0ff' : '#f44'),
        20 + Math.random() * 10, 3 + Math.random() * 4
      ));
    }
    return true;
  }

  jump() {
    if (!this.onGround) return;
    this.vy = -this.H * 0.022;
    this.onGround = false;
    this.setState(STATE.JUMP, 999);
  }

  update(dt, opponent, isP1) {
    const W = this.W, H = this.H;
    const floor = this.floorY;
    const bw = this.bodyW;

    // ── Input / AI ──
    if (this.isAI) {
      this.updateAI(opponent);
    }

    if (this.state !== STATE.KO && this.state !== STATE.WIN) {
      // Movement
      const moveSpeed = W * 0.004;
      if (this.keys.left && this.state !== STATE.HIT) {
        this.x -= moveSpeed;
        if (this.state === STATE.IDLE || this.state === STATE.WALK) this.setState(STATE.WALK, 999);
        this.trackOffset -= 2;
      } else if (this.keys.right && this.state !== STATE.HIT) {
        this.x += moveSpeed;
        if (this.state === STATE.IDLE || this.state === STATE.WALK) this.setState(STATE.WALK, 999);
        this.trackOffset += 2;
      } else if (this.state === STATE.WALK) {
        this.setState(STATE.IDLE, 0);
      }

      if (this.keys.up) { this.jump(); this.keys.up = false; }
      if (this.keys.punch) { this.punch(opponent); this.keys.punch = false; }
      if (this.keys.kick) { this.kick(opponent); this.keys.kick = false; }
      if (this.keys.special) { this.special(opponent); this.keys.special = false; }
      if (this.keys.ultra) { this.ultra(opponent); this.keys.ultra = false; }
      if (this.keys.block) { this.block(); }
      else if (this.state === STATE.BLOCK) { this.setState(STATE.IDLE, 0); }
    }

    // ── Physics ──
    if (!this.onGround) {
      this.vy += GRAVITY;
      this.y += this.vy;
      if (this.y >= floor) {
        this.y = floor;
        this.vy = 0;
        this.onGround = true;
        if (this.state === STATE.JUMP) this.setState(STATE.IDLE, 0);
      }
    }

    // Boundaries
    const margin = bw * 0.5;
    this.x = Math.max(margin, Math.min(W - margin, this.x));

    // Facing toward opponent
    if (this.state !== STATE.KO && this.state !== STATE.WIN) {
      this.facing = opponent.x > this.x ? 1 : -1;
    }

    // ── State timer ──
    if (this.stateTimer > 0) {
      this.stateTimer--;
      if (this.stateTimer === 0 && this.state !== STATE.KO && this.state !== STATE.WIN && this.state !== STATE.BLOCK) {
        this.setState(STATE.IDLE, 0);
        this.targetBoom = -0.6;
        this.targetArm = 0.4;
        this.targetBucket = 0.3;
      }
    }

    // ── Arm interpolation ──
    const armSpeed = 0.18;
    this.boom += (this.targetBoom - this.boom) * armSpeed;
    this.arm += (this.targetArm - this.arm) * armSpeed;
    this.bucket += (this.targetBucket - this.bucket) * armSpeed;

    // Idle breathing / bobbing
    this.idleTimer += 0.05;
    if (this.state === STATE.IDLE) {
      this.boom = -0.6 + Math.sin(this.idleTimer) * 0.04;
    }

    // Win animation
    if (this.state === STATE.WIN) {
      this.winBoom += 0.06 * this.winDir;
      if (this.winBoom > 0.4 || this.winBoom < -0.4) this.winDir *= -1;
      this.boom = -0.6 + this.winBoom;
      this.targetBoom = this.boom;
    }

    // Hit flash
    if (this.hitFlash > 0) this.hitFlash--;

    // Particles
    this.particles.forEach(p => p.update());
    this.particles = this.particles.filter(p => p.life > 0);

    // Projectiles
    this.projectiles.forEach(p => p.update(W));
    this.projectiles = this.projectiles.filter(p => p.alive);

    // Check projectile vs opponent
    this.projectiles.forEach(p => {
      const dx = Math.abs(p.x - opponent.x);
      const dy = Math.abs(p.y - (opponent.y - opponent.bodyH * 0.5));
      if (dx < opponent.bodyW * 0.7 && dy < opponent.bodyH * 0.8) {
        opponent.takeDamage(12, 'special');
        playHit('special');
        p.alive = false;
        game.flashScreen('#0ff', 0.3);
      }
    });
  }

  updateAI(opponent) {
    this.aiTimer--;
    if (this.aiTimer > 0) return;
    this.aiTimer = 20 + Math.floor(Math.random() * 30);

    const dx = opponent.x - this.x;
    const dist = Math.abs(dx);
    const bw = this.bodyW;
    const atkRange = bw * 1.8;
    const closeRange = bw * 1.2;

    // Clear movement
    this.keys.left = false;
    this.keys.right = false;
    this.keys.punch = false;
    this.keys.kick = false;
    this.keys.special = false;
    this.keys.ultra = false;
    this.keys.block = false;

    const r = Math.random();

    if (dist > atkRange) {
      // Move toward opponent
      if (dx > 0) this.keys.right = true;
      else this.keys.left = true;
    } else if (dist < closeRange) {
      // Too close, back off or attack
      if (r < 0.3) {
        if (dx > 0) this.keys.left = true;
        else this.keys.right = true;
      } else if (r < 0.6) {
        this.keys.punch = true;
      } else {
        this.keys.kick = true;
      }
    } else {
      // In range
      if (r < 0.05 && this.sp >= 100) { this.keys.ultra = true; }
      else if (r < 0.15 && this.sp >= 30) { this.keys.special = true; }
      else if (r < 0.35) { this.keys.kick = true; }
      else if (r < 0.55) { this.keys.punch = true; }
      else if (r < 0.65) { this.keys.up = true; }
      else if (r < 0.75) { this.keys.block = true; }
      else {
        if (dx > 0) this.keys.right = true;
        else this.keys.left = true;
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    const scale = this.H * 0.001 * this.scale;
    const dir = this.facing;

    // Hit flash
    if (this.hitFlash % 2 === 1) {
      ctx.globalAlpha = 0.4;
    }

    ctx.scale(dir, 1);

    this.drawExcavator(ctx, scale);

    // Particles don't need scale/dir flip
    ctx.restore();

    // Draw particles in world coords
    this.particles.forEach(p => p.draw(ctx));

    // Draw projectiles
    this.projectiles.forEach(p => p.draw(ctx));
  }

  drawExcavator(ctx, s) {
    // s = base scale unit
    const bw = 105 * s;   // body width
    const bh = 80 * s;    // body height
    const trackH = 28 * s;
    const trackW = 115 * s;
    const wheelR = 16 * s;

    // ── TRACKS (undercarriage) ──
    const trackY = 0;
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.roundRect(-trackW * 0.5, trackY - trackH, trackW, trackH, wheelR * 0.4);
    ctx.fill();

    // Track tread marks
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2 * s;
    const offset = this.trackOffset % 14;
    for (let i = -1; i < 10; i++) {
      const tx = -trackW * 0.5 + (i * 14 + offset) * s;
      if (tx > -trackW * 0.5 && tx < trackW * 0.5) {
        ctx.beginPath();
        ctx.moveTo(tx, trackY - trackH + 2 * s);
        ctx.lineTo(tx, trackY - 2 * s);
        ctx.stroke();
      }
    }

    // Wheels
    ctx.fillStyle = '#555';
    for (const wx of [-trackW * 0.38, 0, trackW * 0.38]) {
      ctx.beginPath();
      ctx.arc(wx, trackY - trackH * 0.5, wheelR * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(wx, trackY - trackH * 0.5, wheelR * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#555';
    }

    // ── BODY (cab) ──
    const bodyX = -bw * 0.45;
    const bodyTop = trackY - trackH - bh;
    ctx.fillStyle = this.hitFlash % 2 === 1 ? '#fff' : this.color;
    ctx.beginPath();
    ctx.roundRect(bodyX, bodyTop, bw, bh, 8 * s);
    ctx.fill();

    // Body accent / shadow
    ctx.fillStyle = this.accentColor;
    ctx.fillRect(bodyX, bodyTop + bh * 0.6, bw, bh * 0.4);
    ctx.beginPath();
    ctx.roundRect(bodyX, bodyTop, bw, bh, 8 * s);
    ctx.clip();
    ctx.fillStyle = this.accentColor;
    ctx.fillRect(bodyX, bodyTop + bh * 0.6, bw, bh * 0.4);

    ctx.restore();
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.facing, 1);

    // Name on body
    ctx.font = `bold ${Math.floor(11 * s)}px Arial Black, sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
    ctx.fillText(this.name.toUpperCase(), bodyX + bw * 0.5, bodyTop + bh * 0.78);
    ctx.shadowBlur = 0;

    // Cabin window
    const winX = bodyX + bw * 0.05;
    const winY = bodyTop + bh * 0.08;
    const winW = bw * 0.9;
    const winH = bh * 0.48;
    ctx.fillStyle = 'rgba(120,200,255,0.25)';
    ctx.beginPath();
    ctx.roundRect(winX, winY, winW, winH, 5 * s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,240,255,0.5)';
    ctx.lineWidth = 2 * s;
    ctx.stroke();

    // Driver photo inside cabin
    const photo = this.photo;
    if (photo && photo.complete && photo.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(winX + 2 * s, winY + 2 * s, winW - 4 * s, winH - 4 * s, 4 * s);
      ctx.clip();
      // mix-blend-mode to remove white background from photo
      ctx.globalCompositeOperation = 'multiply';
      // Draw photo — scale to fit
      const ph = photo;
      const ratio = ph.naturalWidth / ph.naturalHeight;
      const drawH = winH - 4 * s;
      const drawW = drawH * ratio;
      const drawX = winX + (winW - drawW) / 2;
      ctx.drawImage(ph, drawX, winY + 2 * s, drawW, drawH);
      ctx.restore();
    }

    // ── ARM SYSTEM ──
    // Pivot at top-right of body
    const pivotX = bodyX + bw * 0.85;
    const pivotY = bodyTop + bh * 0.15;
    const boomLen = 90 * s;
    const armLen = 65 * s;
    const bucketLen = 30 * s;

    ctx.lineWidth = 10 * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Hydraulic lines (decorative)
    ctx.strokeStyle = 'rgba(100,100,100,0.6)';
    ctx.lineWidth = 3 * s;

    // Boom
    const boomAngle = this.boom - Math.PI / 2;
    const boomEndX = pivotX + Math.cos(boomAngle) * boomLen;
    const boomEndY = pivotY + Math.sin(boomAngle) * boomLen;

    ctx.strokeStyle = this.color;
    ctx.lineWidth = 11 * s;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(boomEndX, boomEndY);
    ctx.stroke();

    // Boom highlight
    ctx.strokeStyle = this.accentColor;
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.moveTo(pivotX + 2 * s, pivotY + 2 * s);
    ctx.lineTo(boomEndX + 2 * s, boomEndY + 2 * s);
    ctx.stroke();

    // Boom joint
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 7 * s, 0, Math.PI * 2);
    ctx.fill();

    // Arm
    const armAngle = boomAngle + this.arm;
    const armEndX = boomEndX + Math.cos(armAngle) * armLen;
    const armEndY = boomEndY + Math.sin(armAngle) * armLen;

    ctx.strokeStyle = this.color;
    ctx.lineWidth = 9 * s;
    ctx.beginPath();
    ctx.moveTo(boomEndX, boomEndY);
    ctx.lineTo(armEndX, armEndY);
    ctx.stroke();

    // Arm joint
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(boomEndX, boomEndY, 6 * s, 0, Math.PI * 2);
    ctx.fill();

    // Hydraulic cylinder (boom)
    ctx.strokeStyle = 'rgba(180,180,180,0.8)';
    ctx.lineWidth = 3 * s;
    const hydMid = { x: (pivotX + boomEndX) * 0.5, y: (pivotY + boomEndY) * 0.5 };
    ctx.beginPath();
    ctx.moveTo(pivotX + 8 * s, pivotY);
    ctx.lineTo(hydMid.x, hydMid.y);
    ctx.stroke();

    // Bucket
    const bucketAngle = armAngle + this.bucket;
    const bucketEndX = armEndX + Math.cos(bucketAngle) * bucketLen;
    const bucketEndY = armEndY + Math.sin(bucketAngle) * bucketLen;

    // Bucket shape (shovel)
    ctx.save();
    ctx.translate(armEndX, armEndY);
    ctx.rotate(bucketAngle);
    const bkW = 26 * s;
    const bkH = 20 * s;
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(bucketLen, -bkW * 0.3);
    ctx.lineTo(bucketLen + bkW * 0.3, bkH * 0.5);
    ctx.lineTo(bucketLen - bkW * 0.1, bkH);
    ctx.lineTo(0, bkH * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2 * s;
    ctx.stroke();

    // Bucket teeth
    ctx.fillStyle = '#aaa';
    for (let t = 0; t < 3; t++) {
      ctx.beginPath();
      ctx.moveTo(bucketLen + bkW * 0.1 + t * bkW * 0.12, bkH);
      ctx.lineTo(bucketLen + bkW * 0.06 + t * bkW * 0.12, bkH + 6 * s);
      ctx.lineTo(bucketLen + bkW * 0.2 + t * bkW * 0.12, bkH);
      ctx.fill();
    }
    ctx.restore();

    // Arm joint at bucket
    ctx.fillStyle = '#666';
    ctx.beginPath();
    ctx.arc(armEndX, armEndY, 5 * s, 0, Math.PI * 2);
    ctx.fill();

    // ── EXHAUST / DETAILS ──
    // Exhaust pipe
    ctx.fillStyle = '#555';
    ctx.fillRect(bodyX + bw * 0.1, bodyTop - 10 * s, 5 * s, 10 * s);
    // Smoke puff when walking
    if (this.state === STATE.WALK || this.state === STATE.ULTRA) {
      ctx.fillStyle = `rgba(200,200,200,${0.3 + Math.random() * 0.2})`;
      const puffX = bodyX + bw * 0.1 + 2 * s;
      const puffY = bodyTop - 12 * s;
      ctx.beginPath();
      ctx.arc(puffX, puffY - Math.random() * 5 * s, 4 * s + Math.random() * 3 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    // Headlight
    ctx.fillStyle = this.state === STATE.ULTRA ? '#ff0' : '#ffd';
    ctx.beginPath();
    ctx.arc(bodyX + bw * 0.85, bodyTop + bh * 0.55, 5 * s, 0, Math.PI * 2);
    ctx.fill();
    if (this.state === STATE.ULTRA) {
      ctx.shadowColor = '#ff0'; ctx.shadowBlur = 20;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}

// ── Hit detection ──
// ── Main Game ──
class Game {
  constructor() {
    this.mode = null; // '1p' or '2p'
    this.round = 1;
    this.maxRounds = 3;
    this.p1Wins = 0;
    this.p2Wins = 0;
    this.timer = ROUND_TIME;
    this.timerClock = 0;
    this.state = 'menu'; // menu, fight, roundover, gameover
    this.particles = [];
    this.announceTimeout = null;

    this.fred = new Fighter({
      id: 'fred', name: 'Fred',
      color: '#e87000', accentColor: '#c45000',
      photo: fredImg,
      facing: 1, x: 0, scale: 1.0,
    });
    this.pascal = new Fighter({
      id: 'pascal', name: 'Pascal',
      color: '#d4b800', accentColor: '#a89000',
      photo: pascalImg,
      facing: -1, x: 0, scale: 1.0,
    });

    this.setupControls();
    this.setupOverlay();
    this.loop();
  }

  onResize() {
    const W = canvas.width, H = canvas.height;
    this.fred.resetPosition(W * 0.25);
    this.pascal.resetPosition(W * 0.75);
  }

  setupOverlay() {
    document.getElementById('btn-1p').addEventListener('click', () => this.startGame('1p'));
    document.getElementById('btn-2p').addEventListener('click', () => this.startGame('2p'));
  }

  startGame(mode) {
    this.mode = mode;
    this.round = 1;
    this.p1Wins = 0;
    this.p2Wins = 0;
    this.fred.hp = MAX_HP; this.fred.sp = 0;
    this.pascal.hp = MAX_HP; this.pascal.sp = 0;
    this.pascal.isAI = mode === '1p';
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('p2-controls').style.display = mode === '1p' ? 'none' : '';
    document.getElementById('p2-actions').style.display = mode === '1p' ? 'none' : '';
    this.startRound();
  }

  startRound() {
    const W = canvas.width, H = canvas.height;
    this.fred.resetPosition(W * 0.25);
    this.pascal.resetPosition(W * 0.75);
    this.fred.hp = MAX_HP; this.fred.sp = 0;
    this.pascal.hp = MAX_HP; this.pascal.sp = 0;
    this.timer = ROUND_TIME;
    this.timerClock = 0;
    this.state = 'countdown';
    this.particles = [];
    document.getElementById('round-display').textContent = `ROUND ${this.round}`;

    // Countdown
    let count = 3;
    const tick = () => {
      if (count > 0) {
        this.announce(count === 3 ? 'PRÊTS ?' : String(count), '#fff', 700);
        count--;
        setTimeout(tick, 750);
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
    if (dx < reach) {
      defender.takeDamage(baseDmg, type);
      if (type === 'heavy') game.flashScreen('#f00', 0.2);
    }
  }

  announce(text, color, duration) {
    const el = document.getElementById('announce');
    el.textContent = text;
    el.style.color = color;
    el.style.opacity = '1';
    if (this.announceTimeout) clearTimeout(this.announceTimeout);
    this.announceTimeout = setTimeout(() => { el.style.opacity = '0'; }, duration);
  }

  flashScreen(color, intensity) {
    const el = document.getElementById('flash-overlay');
    el.style.background = color;
    el.style.opacity = String(intensity);
    clearTimeout(this._flashTO);
    this._flashTO = setTimeout(() => { el.style.opacity = '0'; }, 120);
  }

  setupControls() {
    const map = {
      'p1-left':    () => this.fred.keys.left = true,
      'p1-right':   () => this.fred.keys.right = true,
      'p1-up':      () => this.fred.keys.up = true,
      'p1-down':    () => this.fred.keys.down = true,
      'p1-punch':   () => this.fred.keys.punch = true,
      'p1-kick':    () => this.fred.keys.kick = true,
      'p1-special': () => this.fred.keys.special = true,
      'p1-super':   () => this.fred.keys.ultra = true,
      'p1-block':   () => this.fred.keys.block = true,
      'p2-left':    () => this.pascal.keys.left = true,
      'p2-right':   () => this.pascal.keys.right = true,
      'p2-up':      () => this.pascal.keys.up = true,
      'p2-down':    () => this.pascal.keys.down = true,
      'p2-punch':   () => this.pascal.keys.punch = true,
      'p2-kick':    () => this.pascal.keys.kick = true,
      'p2-special': () => this.pascal.keys.special = true,
      'p2-super':   () => this.pascal.keys.ultra = true,
      'p2-block':   () => this.pascal.keys.block = true,
    };
    const releaseMap = {
      'p1-left':  () => this.fred.keys.left = false,
      'p1-right': () => this.fred.keys.right = false,
      'p1-block': () => this.fred.keys.block = false,
      'p2-left':  () => this.pascal.keys.left = false,
      'p2-right': () => this.pascal.keys.right = false,
      'p2-block': () => this.pascal.keys.block = false,
    };

    for (const [id, fn] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener('touchstart', e => { e.preventDefault(); fn(); }, { passive: false });
      el.addEventListener('mousedown', e => { e.preventDefault(); fn(); });
    }
    for (const [id, fn] of Object.entries(releaseMap)) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener('touchend', e => { e.preventDefault(); fn(); }, { passive: false });
      el.addEventListener('mouseup', e => { e.preventDefault(); fn(); });
    }

    // Keyboard
    const kbMap = {
      'ArrowLeft': () => { this.fred.keys.left = true; },
      'ArrowRight': () => { this.fred.keys.right = true; },
      'ArrowUp': () => { this.fred.keys.up = true; },
      'z': () => { this.fred.keys.punch = true; },
      'x': () => { this.fred.keys.kick = true; },
      'c': () => { this.fred.keys.special = true; },
      'v': () => { this.fred.keys.ultra = true; },
      's': () => { this.fred.keys.block = true; },
    };
    const kbRelease = {
      'ArrowLeft': () => { this.fred.keys.left = false; },
      'ArrowRight': () => { this.fred.keys.right = false; },
      's': () => { this.fred.keys.block = false; },
    };
    window.addEventListener('keydown', e => { if (kbMap[e.key]) kbMap[e.key](); });
    window.addEventListener('keyup', e => { if (kbRelease[e.key]) kbRelease[e.key](); });
  }

  checkRoundEnd() {
    const fredDead = this.fred.hp <= 0;
    const pascalDead = this.pascal.hp <= 0;
    const timeUp = this.timer <= 0;

    if (!fredDead && !pascalDead && !timeUp) return;

    this.state = 'roundover';

    let winner = null;
    if (fredDead && !pascalDead) { winner = this.pascal; this.p2Wins++; }
    else if (pascalDead && !fredDead) { winner = this.fred; this.p1Wins++; }
    else if (fredDead && pascalDead) { /* draw */ }
    else if (timeUp) {
      if (this.fred.hp > this.pascal.hp) { winner = this.fred; this.p1Wins++; }
      else if (this.pascal.hp > this.fred.hp) { winner = this.pascal; this.p2Wins++; }
    }

    if (winner) {
      winner.setState(STATE.WIN, 9999);
      const loser = winner === this.fred ? this.pascal : this.fred;
      loser.setState(STATE.KO, 9999);
      this.announce(`K.O. !! ${winner.name} GAGNE !`, '#ff0', 9999);
      playHit('ultra');
      this.flashScreen('#fff', 0.8);
    } else {
      this.announce('ÉGALITÉ !', '#0ff', 9999);
    }

    setTimeout(() => {
      const neededWins = Math.ceil(this.maxRounds / 2);
      if (this.p1Wins >= neededWins || this.p2Wins >= neededWins || this.round >= this.maxRounds) {
        this.showGameOver();
      } else {
        this.round++;
        this.startRound();
      }
    }, 3000);
  }

  showGameOver() {
    this.state = 'gameover';
    const ov = document.getElementById('overlay');
    ov.style.display = 'flex';
    const winner = this.p1Wins > this.p2Wins ? this.fred : (this.p2Wins > this.p1Wins ? this.pascal : null);
    ov.innerHTML = `
      <h1>${winner ? winner.name + ' GAGNE !' : 'MATCH NUL !'}</h1>
      <div class="subtitle">${this.fred.name} ${this.p1Wins} — ${this.p2Wins} ${this.pascal.name}</div>
      <button class="start-btn" id="btn-rematch">REVANCHE !</button>
      <button class="start-btn" id="btn-menu">MENU</button>
    `;
    document.getElementById('btn-rematch').addEventListener('click', () => this.startGame(this.mode));
    document.getElementById('btn-menu').addEventListener('click', () => {
      ov.innerHTML = `
        <h1>⚙ PELLE BATTLE ⚙</h1>
        <div class="subtitle">Fred vs Pascal — Combat de Pelleteuses</div>
        <button class="start-btn" id="btn-1p">1 JOUEUR (vs IA)</button>
        <button class="start-btn" id="btn-2p">2 JOUEURS</button>
      `;
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

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, floor);
    sky.addColorStop(0, '#1a1a2e');
    sky.addColorStop(0.5, '#16213e');
    sky.addColorStop(1, '#0f3460');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, floor);

    // Sun / moon glow
    ctx.save();
    ctx.beginPath();
    ctx.arc(W * 0.5, H * 0.12, H * 0.06, 0, Math.PI * 2);
    const glow = ctx.createRadialGradient(W * 0.5, H * 0.12, 0, W * 0.5, H * 0.12, H * 0.12);
    glow.addColorStop(0, 'rgba(255,200,50,0.9)');
    glow.addColorStop(0.4, 'rgba(255,150,0,0.4)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.arc(W * 0.5, H * 0.12, H * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Construction site silhouette
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    // Crane silhouette left
    ctx.fillRect(W * 0.08, H * 0.15, 6, floor - H * 0.15);
    ctx.fillRect(W * 0.08, H * 0.15, W * 0.12, 5);
    ctx.fillRect(W * 0.2, H * 0.15, 4, H * 0.08);
    // Building right
    ctx.fillRect(W * 0.78, H * 0.3, W * 0.08, floor - H * 0.3);
    ctx.fillRect(W * 0.86, H * 0.38, W * 0.06, floor - H * 0.38);

    // Crowd silhouette
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    for (let i = 0; i < 30; i++) {
      const cx = (i / 30) * W;
      const ch = H * (0.06 + Math.sin(i * 1.7) * 0.02);
      ctx.beginPath();
      ctx.ellipse(cx, floor, 8, ch, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Arena floor
    const floorGrad = ctx.createLinearGradient(0, floor, 0, H);
    floorGrad.addColorStop(0, '#5c3a1e');
    floorGrad.addColorStop(0.3, '#3d2610');
    floorGrad.addColorStop(1, '#1a0f05');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, floor, W, H - floor);

    // Floor lines (dirt arena)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const fy = floor + (H - floor) * (i / 5);
      ctx.beginPath();
      ctx.moveTo(0, fy);
      ctx.lineTo(W, fy);
      ctx.stroke();
    }
    // Center line
    ctx.strokeStyle = 'rgba(255,255,100,0.15)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(W / 2, floor);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Spotlight effects
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const spot1 = ctx.createRadialGradient(W * 0.25, 0, 0, W * 0.25, 0, H * 0.9);
    spot1.addColorStop(0, 'rgba(255,180,0,0.06)');
    spot1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spot1;
    ctx.fillRect(0, 0, W, H);
    const spot2 = ctx.createRadialGradient(W * 0.75, 0, 0, W * 0.75, 0, H * 0.9);
    spot2.addColorStop(0, 'rgba(100,150,255,0.06)');
    spot2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spot2;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  loop() {
    const tick = () => {
      requestAnimationFrame(tick);
      this.update();
      this.render();
    };
    requestAnimationFrame(tick);
  }

  update() {
    if (this.state !== 'fight') return;

    // Timer
    this.timerClock++;
    if (this.timerClock >= 60) { this.timerClock = 0; this.timer--; }

    this.fred.update(1, this.pascal, true);
    this.pascal.update(1, this.fred, false);

    this.updateHUD();
    this.checkRoundEnd();
  }

  render() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    this.drawBackground(ctx);
    // Draw shadow under each fighter
    [this.fred, this.pascal].forEach(f => {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(f.x, f.floorY + 4, f.bodyW * 0.6, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    this.fred.draw(ctx);
    this.pascal.draw(ctx);
  }
}

// ── Boot ──
let game;
resize();
window.addEventListener('load', () => {
  resize();
  game = new Game();
  game.onResize();
});
