const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
canvas.style.touchAction = 'none';

const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');

// ==========================================
// 1. 圖片資源系統 (獨立解耦載入，不再因單一缺圖卡死)
// ==========================================
const assets = {
  player: new Image(),
  enemy1: new Image(), enemy2: new Image(), enemy3: new Image(),
  enemy4: new Image(), enemy5: new Image(), enemy6: new Image(),
  enemy7: new Image(), enemy8: new Image(), enemy9: new Image(),
  boss: new Image(), boss2: new Image(), boss3: new Image(),
  bgDeepest: new Image(), bgMiddle: new Image(), bgForeground: new Image(),
  bgDeepest2: new Image(), bgMiddle2: new Image(), bgForeground2: new Image(),
  bgDeepest3: new Image(), bgMiddle3: new Image(), bgForeground3: new Image(),
  laser: new Image(), fire: new Image(), lightning: new Image()
};

assets.player.src = 'fly.png';
assets.enemy1.src = 'enemy1.png'; assets.enemy2.src = 'enemy2.png'; assets.enemy3.src = 'enemy3.png';
assets.enemy4.src = 'enemy4.png'; assets.enemy5.src = 'enemy5.png'; assets.enemy6.src = 'enemy6.png';
assets.enemy7.src = 'enemy7.png'; assets.enemy8.src = 'enemy8.png'; assets.enemy9.src = 'enemy9.png';
assets.boss.src = 'boss1.png'; assets.boss2.src = 'boss2.png'; assets.boss3.src = 'boss3.png';

assets.bgDeepest.src = 'deepest1-layer.png'; assets.bgMiddle.src = 'middle1-layer.png'; assets.bgForeground.src = 'foreground1-layer.png';
assets.bgDeepest2.src = 'deepest2-layer.png'; assets.bgMiddle2.src = 'middle2-layer.png'; assets.bgForeground2.src = 'foreground2-layer.png';
assets.bgDeepest3.src = 'deepest3-layer.png'; assets.bgMiddle3.src = 'middle3-layer.png'; assets.bgForeground3.src = 'foreground3-layer.png';

assets.laser.src = 'laser.png'; assets.fire.src = 'fire.png'; assets.lightning.src = 'lightning.png';

// 只要背景圖片讀取完成就隨時初始化
assets.bgDeepest.onload = () => { if (currentStage === 1) initParallaxBackgrounds(); };
assets.bgDeepest2.onload = () => { if (currentStage === 2) initParallaxBackgrounds(); };
assets.bgDeepest3.onload = () => { if (currentStage === 3) initParallaxBackgrounds(); };

// 獨立檢查特定圖片是否可用
function isReady(img) {
  return img && img.complete && img.naturalWidth > 0;
}

// ==========================================
// 2. 8-bit Web Audio 音效引擎
// ==========================================
class SoundFX {
  constructor() { this.ctx = null; }
  init() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  playShoot() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
    osc.type = 'square'; const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(880, now); osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);
    gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + 0.08);
  }
  playLaser() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
    osc.type = 'sawtooth'; const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(1200, now); osc.frequency.linearRampToValueAtTime(600, now + 0.12);
    gain.gain.setValueAtTime(0.08, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + 0.12);
  }
  playFire() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.1; const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0); for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource(); noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 400;
    const gain = this.ctx.createGain(); gain.gain.value = 0.08;
    noise.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination); noise.start();
  }
  playThunder() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime; const duration = 1.0;
    const bufferSize = this.ctx.sampleRate * duration; const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0); for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource(); noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now); filter.frequency.exponentialRampToValueAtTime(50, now + duration);
    const gain = this.ctx.createGain(); gain.gain.setValueAtTime(0.7, now); gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    noise.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination); noise.start(now);
  }
  playExplosion(isBig = false) {
    if (!this.ctx) return;
    const duration = isBig ? 0.6 : 0.25;
    const bufferSize = this.ctx.sampleRate * duration; const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0); for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource(); noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass';
    const now = this.ctx.currentTime; filter.frequency.setValueAtTime(isBig ? 350 : 750, now); filter.frequency.linearRampToValueAtTime(40, now + duration);
    const gain = this.ctx.createGain(); gain.gain.setValueAtTime(isBig ? 0.45 : 0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    noise.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination); noise.start(now);
  }
  playRoll() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
    osc.type = 'sine'; const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(220, now); osc.frequency.exponentialRampToValueAtTime(880, now + 0.35);
    gain.gain.setValueAtTime(0.18, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + 0.35);
  }
  playPowerUp() {
    if (!this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; const now = this.ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
      osc.type = 'triangle'; osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.18, now + idx * 0.06); gain.gain.exponentialRampToValueAtTime(0.01, now + (idx + 1) * 0.06);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.06); osc.stop(now + (idx + 1) * 0.06);
    });
  }
  playHeal() {
    if (!this.ctx) return;
    const notes = [440, 554.37, 659.25, 880]; const now = this.ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      gain.gain.setValueAtTime(0.15, now + idx * 0.05); gain.gain.exponentialRampToValueAtTime(0.01, now + (idx + 1) * 0.05);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.05); osc.stop(now + (idx + 1) * 0.05);
    });
  }
  playShieldRecharge() {
    if (!this.ctx) return;
    const notes = [300, 450, 600, 900]; const now = this.ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      gain.gain.setValueAtTime(0.14, now + idx * 0.05); gain.gain.exponentialRampToValueAtTime(0.01, now + (idx + 1) * 0.05);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.05); osc.stop(now + (idx + 1) * 0.05);
    });
  }
  playShieldHit() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
    osc.type = 'sawtooth'; const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(500, now); osc.frequency.exponentialRampToValueAtTime(150, now + 0.15);
    gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + 0.15);
  }
  playAlarm() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
    osc.type = 'sawtooth'; const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(320, now); osc.frequency.linearRampToValueAtTime(540, now + 0.4); osc.frequency.linearRampToValueAtTime(320, now + 0.8);
    gain.gain.setValueAtTime(0.15, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.8);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + 0.8);
  }
}
const sfx = new SoundFX();

// ==========================================
// 3. 雙模虛擬控制台 (同時完美支援 Touch 與 Mouse)
// ==========================================
const keys = {};

const virtualControls = {
  joyBaseX: 75, joyBaseY: canvas.height - 75, joyRadius: 42,
  stickX: 75, stickY: canvas.height - 75, activeId: null,
  dirX: 0, dirY: 0,
  shootActive: false, shootId: null,
  mouseDraggingStick: false
};
const shootBtn = { x: canvas.width - 60, y: canvas.height - 65, r: 36 };
const bombBtn  = { x: canvas.width - 135, y: canvas.height - 48, r: 28 };

function getCanvasCoordinates(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

function updateJoystick(tx, ty) {
  const dx = tx - virtualControls.joyBaseX;
  const dy = ty - virtualControls.joyBaseY;
  const dist = Math.hypot(dx, dy);
  if (dist > virtualControls.joyRadius) {
    virtualControls.stickX = virtualControls.joyBaseX + (dx / dist) * virtualControls.joyRadius;
    virtualControls.stickY = virtualControls.joyBaseY + (dy / dist) * virtualControls.joyRadius;
    virtualControls.dirX = dx / dist;
    virtualControls.dirY = dy / dist;
  } else {
    virtualControls.stickX = tx; virtualControls.stickY = ty;
    virtualControls.dirX = dx / virtualControls.joyRadius;
    virtualControls.dirY = dy / virtualControls.joyRadius;
  }
}

function handleMenuClick(tx, ty) {
  if (isGameOver || isVictory) {
    isStartMenu = true; isGameOver = false; isVictory = false;
    return;
  }
  if (isStartMenu) {
    const btnW = 220; const btnH = 50; const bx = canvas.width / 2 - btnW / 2;
    if (tx >= bx && tx <= bx + btnW) {
      if (ty >= 260 && ty <= 310) startGame(1);
      if (ty >= 330 && ty <= 380) startGame(2);
      if (ty >= 400 && ty <= 450) startGame(3);
    }
  }
}

// 手機觸控事件
canvas.addEventListener('touchstart', e => {
  e.preventDefault(); sfx.init();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    const pos = getCanvasCoordinates(t.clientX, t.clientY);
    
    if (isStartMenu || isGameOver || isVictory) {
      handleMenuClick(pos.x, pos.y);
      continue;
    }

    if (pos.x < canvas.width / 2 && virtualControls.activeId === null) {
      virtualControls.activeId = t.identifier; updateJoystick(pos.x, pos.y);
    } else {
      if (Math.hypot(pos.x - shootBtn.x, pos.y - shootBtn.y) <= shootBtn.r + 15) {
        virtualControls.shootActive = true; virtualControls.shootId = t.identifier;
      }
      if (Math.hypot(pos.x - bombBtn.x, pos.y - bombBtn.y) <= bombBtn.r + 18) {
        triggerLightningStrike();
      }
    }
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    if (t.identifier === virtualControls.activeId) {
      const pos = getCanvasCoordinates(t.clientX, t.clientY); updateJoystick(pos.x, pos.y);
    }
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    if (t.identifier === virtualControls.activeId) {
      virtualControls.activeId = null; virtualControls.dirX = 0; virtualControls.dirY = 0;
      virtualControls.stickX = virtualControls.joyBaseX; virtualControls.stickY = virtualControls.joyBaseY;
    }
    if (t.identifier === virtualControls.shootId) {
      virtualControls.shootActive = false; virtualControls.shootId = null;
    }
  }
}, { passive: false });

// 電腦滑鼠支援 (可以用滑鼠直接拖曳搖桿或點擊 FIRE/BOMB)
canvas.addEventListener('mousedown', e => {
  sfx.init();
  const pos = getCanvasCoordinates(e.clientX, e.clientY);
  if (isStartMenu || isGameOver || isVictory) {
    handleMenuClick(pos.x, pos.y);
    return;
  }
  if (Math.hypot(pos.x - virtualControls.joyBaseX, pos.y - virtualControls.joyBaseY) <= virtualControls.joyRadius + 20) {
    virtualControls.mouseDraggingStick = true; updateJoystick(pos.x, pos.y);
  }
  if (Math.hypot(pos.x - shootBtn.x, pos.y - shootBtn.y) <= shootBtn.r + 15) {
    virtualControls.shootActive = true;
  }
  if (Math.hypot(pos.x - bombBtn.x, pos.y - bombBtn.y) <= bombBtn.r + 18) {
    triggerLightningStrike();
  }
});

window.addEventListener('mousemove', e => {
  if (virtualControls.mouseDraggingStick) {
    const pos = getCanvasCoordinates(e.clientX, e.clientY);
    updateJoystick(pos.x, pos.y);
  }
});

window.addEventListener('mouseup', () => {
  if (virtualControls.mouseDraggingStick) {
    virtualControls.mouseDraggingStick = false;
    virtualControls.dirX = 0; virtualControls.dirY = 0;
    virtualControls.stickX = virtualControls.joyBaseX; virtualControls.stickY = virtualControls.joyBaseY;
  }
  virtualControls.shootActive = false;
});

window.addEventListener('keydown', e => {
  sfx.init(); keys[e.code] = true;
  if ((e.code === 'KeyL' || e.code === 'KeyB') && !isGameOver && !isVictory && !stageTransitioning && !isStartMenu) {
    triggerLightningStrike();
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// ==========================================
// 4. 特效精靈圖與粒子系統
// ==========================================
const expCvs = document.createElement('canvas');
expCvs.width = 32 * 5; expCvs.height = 32;
const expCtx = expCvs.getContext('2d'); expCtx.imageSmoothingEnabled = false;

const fireColors = ['#ffffff', '#fff352', '#ff9900', '#e63900', '#631200'];
for (let f = 0; f < 5; f++) {
  const centerX = f * 32 + 16; const centerY = 16; const maxRadius = (f + 1) * 3.2;
  for (let i = 0; i < 22; i++) {
    const angle = (i / 22) * Math.PI * 2; const dist = Math.random() * maxRadius;
    const px = centerX + Math.cos(angle) * dist; const py = centerY + Math.sin(angle) * dist;
    const size = Math.max(1, 4 - f * 0.6);
    expCtx.fillStyle = fireColors[Math.min(f + Math.floor(Math.random() * 2), fireColors.length - 1)];
    expCtx.fillRect(Math.floor(px), Math.floor(py), size, size);
  }
}

class SpriteExplosion {
  constructor(x, y, scale = 1.2) {
    this.x = x; this.y = y; this.scale = scale; this.currentFrame = 0; this.totalFrames = 5; this.frameSpeed = 4; this.timer = 0; this.markedForDeletion = false;
  }
  update() {
    this.timer++;
    if (this.timer % this.frameSpeed === 0) { this.currentFrame++; if (this.currentFrame >= this.totalFrames) this.markedForDeletion = true; }
  }
  draw(ctx) {
    if (this.markedForDeletion) return;
    const frameW = 32; const frameH = 32; const destW = frameW * this.scale; const destH = frameH * this.scale;
    ctx.drawImage(expCvs, this.currentFrame * frameW, 0, frameW, frameH, Math.floor(this.x - destW / 2), Math.floor(this.y - destH / 2), destW, destH);
  }
}

class SmokeParticle {
  constructor(x, y) {
    this.x = x; this.y = y; this.size = Math.random() * 5 + 3; this.alpha = 0.8; this.decay = Math.random() * 0.03 + 0.02;
    this.vx = (Math.random() - 0.5) * 1.2; this.vy = -(Math.random() * 1.5 + 0.8);
  }
  update() { this.x += this.vx; this.y += this.vy; this.alpha -= this.decay; }
  draw(ctx) {
    ctx.save(); ctx.globalAlpha = Math.max(0, this.alpha); ctx.fillStyle = '#222222';
    ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.size, this.size); ctx.restore();
  }
}

// ==========================================
// 5. 道具系統
// ==========================================
class DropItem {
  constructor(x, y, type = 'POW') {
    this.x = x; this.y = y; this.type = type; this.width = 26; this.height = 24; this.vy = 1.2; this.vx = (Math.random() - 0.5) * 1.5; this.markedForDeletion = false; this.blinkTimer = 0;
  }
  update() {
    this.y += this.vy; this.x += this.vx; this.blinkTimer++;
    if (this.x < 10 || this.x + this.width > canvas.width - 10) this.vx = -this.vx;
    if (this.y > canvas.height + 30) this.markedForDeletion = true;
  }
  draw(ctx) {
    ctx.save(); let bg = '#e60012'; let text = 'POW';
    if (this.type === 'lightning') { bg = (Math.floor(this.blinkTimer / 8) % 2 === 0) ? '#f39c12' : '#f1c40f'; text = 'LGT'; }
    else if (this.type === 'shield') { bg = (Math.floor(this.blinkTimer / 8) % 2 === 0) ? '#00cec9' : '#0984e3'; text = 'SHD'; }
    else if (this.type === 'heal') { bg = (Math.floor(this.blinkTimer / 8) % 2 === 0) ? '#2ecc71' : '#27ae60'; text = '+HP'; }
    else if (this.type === 'bullet') { bg = '#0984e3'; text = 'SHT'; }
    else if (this.type === 'laser') { bg = '#6c5ce7'; text = 'LSR'; }
    else if (this.type === 'fire') { bg = '#d63031'; text = 'FIR'; }
    else { bg = (Math.floor(this.blinkTimer / 8) % 2 === 0) ? '#e60012' : '#ff7675'; text = 'POW'; }
    
    ctx.fillStyle = bg; ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(this.x, this.y, this.width, this.height);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 10px "Courier New"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, this.x + this.width / 2, this.y + this.height / 2 + 1); ctx.restore();
  }
}

// ==========================================
// 6. 玩家戰機
// ==========================================
class Player {
  constructor() {
    this.width = 44; this.height = 61; this.x = canvas.width / 2 - this.width / 2; this.y = canvas.height - 180; this.speed = 5.2;
    this.maxHp = 5; this.hp = 5; this.maxShield = 5; this.shield = 5;
    this.maxLightning = 5; this.lightningAmmo = 3;
    this.shieldHitInvuln = 0; this.weaponType = 'bullet'; this.powerLevel = 1; this.shootCooldown = 0;
    this.channelState = 'firing'; this.channelTimer = 0; this.isRolling = false; this.rollTimer = 0; this.rollDuration = 45; this.rollStock = 3; this.shieldAnimTimer = 0;
  }
  update() {
    this.shieldAnimTimer++;
    if (this.shieldHitInvuln > 0) this.shieldHitInvuln--;

    if (this.isRolling) {
      this.rollTimer--; this.y -= 1.2;
      if (this.rollTimer <= 0) this.isRolling = false;
      return;
    }

    let moveX = 0; let moveY = 0;
    if (keys['ArrowLeft'] || keys['KeyA']) moveX = -1;
    if (keys['ArrowRight'] || keys['KeyD']) moveX = 1;
    if (keys['ArrowUp'] || keys['KeyW']) moveY = -1;
    if (keys['ArrowDown'] || keys['KeyS']) moveY = 1;

    if (virtualControls.dirX !== 0) moveX = virtualControls.dirX;
    if (virtualControls.dirY !== 0) moveY = virtualControls.dirY;

    this.x += moveX * this.speed;
    this.y += moveY * this.speed;

    if (this.x < 0) this.x = 0;
    if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;
    if (this.y < 0) this.y = 0;
    if (this.y + this.height > canvas.height) this.y = canvas.height - this.height;

    if (keys['KeyK'] && this.rollStock > 0 && !this.isRolling) {
      this.isRolling = true; this.rollTimer = this.rollDuration; this.rollStock--; sfx.playRoll(); keys['KeyK'] = false;
    }
    this.updateWeapons();
  }
  updateWeapons() {
    const isPressingShoot = keys['Space'] || keys['KeyJ'] || virtualControls.shootActive;
    if (this.weaponType === 'bullet') {
      if (this.shootCooldown > 0) this.shootCooldown--;
      if (isPressingShoot && this.shootCooldown === 0) { this.fireBullet(); this.shootCooldown = 9; }
    } else {
      let activeDuration = 120; let coolDuration = 60;
      if (this.weaponType === 'laser') { if (this.powerLevel >= 3) { activeDuration = 180; coolDuration = 120; } }
      else if (this.weaponType === 'fire') { activeDuration = 300; coolDuration = 120; }
      this.channelTimer++;
      if (this.channelState === 'firing') {
        if (this.channelTimer % 12 === 0) {
          if (this.weaponType === 'laser') sfx.playLaser();
          if (this.weaponType === 'fire') sfx.playFire();
        }
        if (this.channelTimer >= activeDuration) { this.channelState = 'cooldown'; this.channelTimer = 0; }
      } else {
        if (this.channelTimer >= coolDuration) { this.channelState = 'firing'; this.channelTimer = 0; }
      }
    }
  }
  fireBullet() {
    sfx.playShoot(); const cx = this.x + this.width / 2;
    if (this.powerLevel === 1) {
      playerBullets.push(new Bullet(this.x + 10, this.y, 0, -8.5, '#57f7ff')); playerBullets.push(new Bullet(this.x + this.width - 10, this.y, 0, -8.5, '#57f7ff'));
    } else if (this.powerLevel === 2) {
      playerBullets.push(new Bullet(cx - 15, this.y, -1.2, -9, '#57f7ff')); playerBullets.push(new Bullet(cx - 5, this.y - 4, -0.4, -9.5, '#ffffff'));
      playerBullets.push(new Bullet(cx + 5, this.y - 4, 0.4, -9.5, '#ffffff')); playerBullets.push(new Bullet(cx + 15, this.y, 1.2, -9, '#57f7ff'));
    } else {
      playerBullets.push(new Bullet(cx - 15, this.y, -1.2, -9, '#57f7ff')); playerBullets.push(new Bullet(cx - 5, this.y - 4, -0.4, -9.5, '#ffffff'));
      playerBullets.push(new Bullet(cx + 5, this.y - 4, 0.4, -9.5, '#ffffff')); playerBullets.push(new Bullet(cx + 15, this.y, 1.2, -9, '#57f7ff'));
      playerBullets.push(new Bullet(this.x - 38, this.y + 15, 0, -9.5, '#ffff00')); playerBullets.push(new Bullet(this.x + this.width + 38, this.y + 15, 0, -9.5, '#ffff00'));
    }
  }
  draw(ctx) {
    ctx.save(); ctx.translate(Math.floor(this.x + this.width / 2), Math.floor(this.y + this.height / 2));
    if (this.isRolling) {
      const progress = (this.rollDuration - this.rollTimer) / this.rollDuration;
      const scale = 1 + Math.sin(progress * Math.PI) * 0.6; ctx.scale(scale, scale); ctx.rotate(progress * Math.PI * 2);
    }
    if (this.powerLevel >= 3 && !this.isRolling) { this.drawSubFighter(ctx, -38, 15); this.drawSubFighter(ctx, 38, 15); }
    if (this.shieldHitInvuln > 0 && Math.floor(this.shieldHitInvuln / 3) % 2 === 0) ctx.globalAlpha = 0.55;
    
    // 獨立確認玩家圖片
    if (isReady(assets.player)) {
      ctx.drawImage(assets.player, -this.width / 2, -this.height / 2, this.width, this.height);
    } else {
      ctx.fillStyle = '#3498db'; ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
    }
    if (this.shield > 0 && !this.isRolling) this.drawShieldEffect(ctx);
    ctx.restore();

    if (!this.isRolling && this.channelState === 'firing') {
      if (this.weaponType === 'laser') this.drawLaserBeam(ctx);
      else if (this.weaponType === 'fire') this.drawFlameCone(ctx);
    }
  }
  drawShieldEffect(ctx) {
    ctx.save(); const pulse = Math.sin(this.shieldAnimTimer * 0.08) * 3; const radius = 38 + pulse;
    let strokeColor = 'rgba(0, 206, 201, 0.85)'; let fillColor = 'rgba(0, 206, 201, 0.15)';
    if (this.shield <= 2) { strokeColor = 'rgba(255, 118, 117, 0.85)'; fillColor = 'rgba(255, 118, 117, 0.2)'; }
    else if (this.shield <= 3) { strokeColor = 'rgba(253, 203, 110, 0.85)'; fillColor = 'rgba(253, 203, 110, 0.15)'; }

    if (this.shieldHitInvuln > 0) { strokeColor = '#ffffff'; fillColor = 'rgba(255, 255, 255, 0.3)'; }
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fillStyle = fillColor; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = strokeColor; ctx.setLineDash([8, 4]); ctx.lineDashOffset = -this.shieldAnimTimer * 2; ctx.stroke();
    ctx.restore();
  }
  drawSubFighter(ctx, offsetX, offsetY) {
    ctx.save(); ctx.translate(offsetX, offsetY); ctx.fillStyle = '#00d2d3'; ctx.fillRect(-4, -8, 8, 16); ctx.fillStyle = '#54a0ff'; ctx.fillRect(-8, 0, 16, 4); ctx.restore();
  }
  drawLaserBeam(ctx) {
    if (!isReady(assets.laser)) return;
    const frameIndex = Math.floor(Date.now() / 60) % 5; const fW = assets.laser.naturalWidth / 5; const fH = assets.laser.naturalHeight;
    const beamHeight = (this.powerLevel === 1) ? canvas.height / 2 : canvas.height; const beamWidth = 32;
    const drawSingleLaser = (centerX) => {
      ctx.save(); ctx.drawImage(assets.laser, frameIndex * fW, 0, fW, fH, centerX - beamWidth / 2, this.y - beamHeight, beamWidth, beamHeight); ctx.restore();
    };
    drawSingleLaser(this.x + this.width / 2);
    if (this.powerLevel >= 3) { drawSingleLaser(this.x - 38); drawSingleLaser(this.x + this.width + 38); }
  }
  drawFlameCone(ctx) {
    if (!isReady(assets.fire)) return;
    const frameIndex = Math.floor(Date.now() / 70) % 5; const fW = assets.fire.naturalWidth / 5; const fH = assets.fire.naturalHeight;
    const flameHeight = (this.powerLevel === 1) ? canvas.height / 4 : canvas.height / 2; const flameWidth = 48;
    const drawSingleFire = (centerX) => {
      ctx.save(); ctx.drawImage(assets.fire, frameIndex * fW, 0, fW, fH, centerX - flameWidth / 2, this.y - flameHeight, flameWidth, flameHeight); ctx.restore();
    };
    drawSingleFire(this.x + this.width / 2);
    if (this.powerLevel >= 3) { drawSingleFire(this.x - 38); drawSingleFire(this.x + this.width + 38); }
  }
}

// ==========================================
// 7. 子彈類別
// ==========================================
class Bullet {
  constructor(x, y, vx, vy, color, radius = 3) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.color = color; this.radius = radius; this.markedForDeletion = false;
  }
  update() {
    this.x += this.vx; this.y += this.vy;
    if (this.y < -30 || this.y > canvas.height + 30 || this.x < -30 || this.x > canvas.width + 30) this.markedForDeletion = true;
  }
  draw(ctx) {
    ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(Math.floor(this.x), Math.floor(this.y), this.radius, 0, Math.PI * 2); ctx.fill();
  }
}

// ==========================================
// 8. 敵機類別 (獨立安全繪製)
// ==========================================
class Enemy {
  constructor(x, y, enemyKind = 1, isRedSquadron = false, squadronId = null) {
    this.x = x; this.y = y; this.enemyKind = enemyKind; this.isRedSquadron = isRedSquadron;
    this.squadronId = squadronId; this.markedForDeletion = false; this.timer = 0; this.startX = x;

    if (currentStage === 1) {
      if (this.enemyKind === 1) { this.width = 36; this.height = 41; this.hp = 1; this.vy = 3.2; this.scoreVal = isRedSquadron ? 300 : 150; this.img = assets.enemy1; }
      else if (this.enemyKind === 2) { this.width = 44; this.height = 42; this.hp = isRedSquadron ? 4 : 3; this.vy = 1.9; this.scoreVal = isRedSquadron ? 500 : 300; this.img = assets.enemy2; }
      else { this.width = 34; this.height = 36; this.hp = 1; this.vy = 2.4; this.scoreVal = isRedSquadron ? 250 : 120; this.img = assets.enemy3; }
    } else if (currentStage === 2) {
      if (this.enemyKind === 1) { this.width = 48; this.height = 36; this.hp = 2; this.vy = 3.5; this.scoreVal = 200; this.img = assets.enemy4; }
      else if (this.enemyKind === 2) { this.width = 62; this.height = 42; this.hp = isRedSquadron ? 6 : 4; this.vy = 2.0; this.scoreVal = 400; this.img = assets.enemy5; }
      else { this.width = 54; this.height = 40; this.hp = 2; this.vy = 2.8; this.scoreVal = 200; this.img = assets.enemy6; }
    } else {
      if (this.enemyKind === 1) { this.width = 46; this.height = 80; this.hp = 3; this.vy = 3.8; this.scoreVal = 300; this.img = assets.enemy7; }
      else if (this.enemyKind === 2) { this.width = 50; this.height = 100; this.hp = isRedSquadron ? 7 : 5; this.vy = 2.2; this.scoreVal = 500; this.img = assets.enemy8; }
      else { this.width = 40; this.height = 120; this.hp = 2; this.vy = 3.0; this.scoreVal = 250; this.img = assets.enemy9; }
    }
  }

  update() {
    this.timer++; this.y += this.vy;
    if (currentStage === 1) {
      if (this.enemyKind === 1) {
        if (this.timer === 35 && Math.random() < 0.5) enemyBullets.push(new Bullet(this.x + this.width / 2, this.y + this.height, 0, 5, '#ff4747'));
      } else if (this.enemyKind === 2) {
        this.x = this.startX + Math.sin(this.timer * 0.03) * 20;
        if (this.timer % 50 === 0) {
          enemyBullets.push(new Bullet(this.x + 8, this.y + this.height, 0, 3.8, '#ff9900'));
          enemyBullets.push(new Bullet(this.x + this.width - 8, this.y + this.height, 0, 3.8, '#ff9900'));
        }
      } else {
        this.x = this.startX + Math.sin(this.timer * 0.05) * 45;
        if (this.timer === 45 && Math.random() < 0.6) {
          const angle = Math.atan2((player.y) - this.y, (player.x + player.width / 2) - this.x);
          enemyBullets.push(new Bullet(this.x + this.width / 2, this.y + this.height, Math.cos(angle) * 3.8, Math.sin(angle) * 3.8, '#ff3838'));
        }
      }
    } else if (currentStage === 2) {
      if (this.enemyKind === 1) {
        if (this.timer === 30 && Math.random() < 0.6) enemyBullets.push(new Bullet(this.x + this.width / 2, this.y + this.height, 0, 6, '#ff0055'));
      } else if (this.enemyKind === 2) {
        this.x = this.startX + Math.sin(this.timer * 0.04) * 25;
        if (this.timer % 40 === 0) {
          enemyBullets.push(new Bullet(this.x + 10, this.y + this.height, -1, 4.2, '#ffaa00'));
          enemyBullets.push(new Bullet(this.x + this.width - 10, this.y + this.height, 1, 4.2, '#ffaa00'));
        }
      } else {
        this.x = this.startX + Math.sin(this.timer * 0.06) * 55;
        if (this.timer === 40 && Math.random() < 0.7) {
          const angle = Math.atan2((player.y) - this.y, (player.x + player.width / 2) - this.x);
          enemyBullets.push(new Bullet(this.x + this.width / 2, this.y + this.height, Math.cos(angle) * 4.5, Math.sin(angle) * 4.5, '#ff2222'));
        }
      }
    } else {
      if (this.enemyKind === 1) { 
        if (this.timer === 25 && Math.random() < 0.65) enemyBullets.push(new Bullet(this.x + this.width / 2, this.y + this.height, 0, 7, '#ff00ff'));
      } else if (this.enemyKind === 2) { 
        this.x = this.startX + Math.sin(this.timer * 0.05) * 30;
        if (this.timer % 45 === 0) {
          enemyBullets.push(new Bullet(this.x + 10, this.y + this.height, -1.5, 4.5, '#ffff00'));
          enemyBullets.push(new Bullet(this.x + this.width - 10, this.y + this.height, 1.5, 4.5, '#ffff00'));
        }
      } else { 
        this.x = this.startX + Math.sin(this.timer * 0.07) * 60;
        if (this.timer === 35 && Math.random() < 0.8) {
          const angle = Math.atan2((player.y) - this.y, (player.x + player.width / 2) - this.x);
          enemyBullets.push(new Bullet(this.x + this.width / 2, this.y + this.height, Math.cos(angle) * 5.0, Math.sin(angle) * 5.0, '#00ffff'));
        }
      }
    }

    if (this.y > canvas.height + 40) this.markedForDeletion = true;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(Math.floor(this.x + this.width / 2), Math.floor(this.y + this.height / 2));
    if (this.isRedSquadron) { ctx.shadowColor = '#ff1100'; ctx.shadowBlur = 10; }

    if (isReady(this.img)) {
      if (currentStage === 1) ctx.rotate(Math.PI);
      ctx.drawImage(this.img, -this.width / 2, -this.height / 2, this.width, this.height);
    } else {
      // 容錯備援
      ctx.fillStyle = this.isRedSquadron ? '#ff3333' : '#4a69bd';
      ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
    }
    ctx.restore();
  }
}

// ==========================================
// 9. 關底巨型 Boss (獨立安全繪製)
// ==========================================
class Boss {
  constructor(stage) {
    this.stage = stage; this.state = 'entering'; this.timer = 0;
    if (this.stage === 1) {
      this.width = 240; this.height = 416; this.x = canvas.width / 2 - this.width / 2;
      this.y = -430; this.targetY = -80; this.speedX = 1.3; this.maxHp = 220; this.hp = this.maxHp;
      this.turrets = [ { id: 'left', offsetX: 30, offsetY: 220, hp: 35, maxHp: 35, isDestroyed: false, cooldown: 60 }, { id: 'right', offsetX: 210, offsetY: 220, hp: 35, maxHp: 35, isDestroyed: false, cooldown: 60 } ];
      this.mainGunCooldown = 110;
    } else if (this.stage === 2) {
      this.width = 340; this.height = 168; this.x = canvas.width / 2 - this.width / 2;
      this.y = -200; this.targetY = 30; this.speedX = 1.6; this.maxHp = 450; this.hp = this.maxHp;
      this.turrets = [ { id: 'left', offsetX: 80, offsetY: 95, hp: 60, maxHp: 60, isDestroyed: false, cooldown: 50 }, { id: 'right', offsetX: 260, offsetY: 95, hp: 60, maxHp: 60, isDestroyed: false, cooldown: 50 } ];
      this.mainGunCooldown = 90;
    } else {
      this.width = 300; this.height = 320; this.x = canvas.width / 2 - this.width / 2;
      this.y = -350; this.targetY = 20; this.speedX = 1.4; this.maxHp = 600; this.hp = this.maxHp;
      this.turrets = [
        { id: 'left', offsetX: 50, offsetY: 180, hp: 80, maxHp: 80, isDestroyed: false, cooldown: 45 },
        { id: 'right', offsetX: 250, offsetY: 180, hp: 80, maxHp: 80, isDestroyed: false, cooldown: 45 },
        { id: 'center', offsetX: 150, offsetY: 260, hp: 80, maxHp: 80, isDestroyed: false, cooldown: 40 }
      ];
      this.mainGunCooldown = 80;
    }
  }

  update() {
    this.timer++;
    if (this.state === 'entering') {
      this.y += 1.2;
      if (this.y >= this.targetY) { this.y = this.targetY; this.state = 'fight'; }
      return;
    }
    if (this.state === 'fight') {
      this.x += this.speedX;
      if (this.x <= 10 || this.x + this.width >= canvas.width - 10) this.speedX = -this.speedX;

      this.turrets.forEach(t => {
        if (!t.isDestroyed) {
          t.cooldown--;
          if (t.cooldown <= 0) {
            t.cooldown = (this.stage === 1) ? (65 + Math.random() * 20) : ((this.stage === 2) ? (50 + Math.random() * 15) : (45 + Math.random() * 10));
            const globalTurretX = this.x + t.offsetX; const globalTurretY = this.y + t.offsetY;
            const angle = Math.atan2((player.y) - globalTurretY, (player.x + player.width / 2) - globalTurretX);
            let spread = [-0.25, 0, 0.25];
            if (this.stage === 2) spread = [-0.35, -0.15, 0.15, 0.35];
            else if (this.stage === 3) spread = [-0.4, -0.2, 0, 0.2, 0.4];
            
            const spd = (this.stage === 1) ? 3.6 : ((this.stage === 2) ? 4.2 : 4.8);
            spread.forEach(offset => { enemyBullets.push(new Bullet(globalTurretX, globalTurretY, Math.cos(angle + offset) * spd, Math.sin(angle + offset) * spd, '#ff9900', 3.5)); });
          }
        } else {
          if (this.timer % 5 === 0) smokeParticles.push(new SmokeParticle(this.x + t.offsetX, this.y + t.offsetY));
        }
      });

      const isEnraged = this.hp < this.maxHp * 0.35;
      this.mainGunCooldown--;
      if (this.mainGunCooldown <= 0) {
        this.mainGunCooldown = isEnraged ? ((this.stage === 1) ? 55 : (this.stage===2?45:35)) : ((this.stage === 1) ? 100 : (this.stage===2?80:60));
        const eyeX = this.x + this.width / 2;
        const eyeY = this.y + ((this.stage === 1) ? 205 : ((this.stage === 2) ? this.height - 30 : this.height - 50));
        const bulletCount = isEnraged ? ((this.stage === 1) ? 14 : (this.stage===2?18:22)) : ((this.stage === 1) ? 9 : (this.stage===2?12:15));
        const spreadArc = Math.PI * ((this.stage === 1) ? 0.85 : 0.95);
        const startAngle = Math.PI / 2 - spreadArc / 2;
        const spd = isEnraged ? 4.5 : 3.5;
        for (let i = 0; i < bulletCount; i++) {
          const a = startAngle + (spreadArc / (bulletCount - 1)) * i;
          enemyBullets.push(new Bullet(eyeX, eyeY, Math.cos(a) * spd, Math.sin(a) * spd, '#ff1744', 4.5));
        }
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(Math.floor(this.x), Math.floor(this.y));

    if (this.stage === 1) {
      if (isReady(assets.boss)) {
        if (this.timer % 4 < 2) { ctx.shadowColor = '#ff5722'; ctx.shadowBlur = 15; }
        ctx.drawImage(assets.boss, 0, 0, this.width, this.height);
        ctx.shadowBlur = 0;
        const isEnraged = this.hp < this.maxHp * 0.35;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = isEnraged ? 'rgba(255, 0, 0, 0.45)' : 'rgba(255, 68, 0, 0.25)';
        ctx.beginPath(); ctx.arc(this.width / 2, 205, 26 + (Math.sin(this.timer * 0.15) * 4), 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    } else if (this.stage === 2) {
      if (isReady(assets.boss2)) {
        ctx.drawImage(assets.boss2, 0, 0, this.width, this.height);
        const isEnraged = this.hp < this.maxHp * 0.35;
        if (isEnraged) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
          ctx.beginPath(); ctx.arc(this.width / 2, this.height - 30, 20 + (Math.sin(this.timer * 0.2) * 5), 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      }
    } else {
      if (isReady(assets.boss3)) {
        ctx.drawImage(assets.boss3, 0, 0, this.width, this.height);
        const isEnraged = this.hp < this.maxHp * 0.35;
        if (isEnraged) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
          ctx.beginPath(); ctx.arc(this.width / 2, this.height - 40, 30 + (Math.sin(this.timer * 0.2) * 6), 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      }
    }

    this.turrets.forEach(t => {
      if (t.isDestroyed) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath(); ctx.arc(t.offsetX, t.offsetY, 16, 0, Math.PI * 2); ctx.fill();
      } else if (this.stage >= 2) {
        ctx.save(); ctx.translate(t.offsetX, t.offsetY);
        const angle = Math.atan2((player.y) - (this.y + t.offsetY), (player.x + player.width/2) - (this.x + t.offsetX));
        ctx.rotate(angle - Math.PI/2);
        ctx.fillStyle = '#222'; ctx.fillRect(-4, 0, 8, 20);
        ctx.restore();
        ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(t.offsetX, t.offsetY, 12, 0, Math.PI * 2); ctx.fill();
      }
    });
    ctx.restore();

    if (this.state === 'fight') {
      const barWidth = 280; const barHeight = 10; const barX = canvas.width / 2 - barWidth / 2; const barY = 32;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);
      const hpPercent = Math.max(0, this.hp / this.maxHp);
      ctx.fillStyle = hpPercent > 0.35 ? '#e74c3c' : '#ff0033';
      ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.strokeRect(barX, barY, barWidth, barHeight);
      ctx.fillStyle = '#ff4d4d'; ctx.font = 'bold 11px "Courier New"'; ctx.textAlign = 'center';
      let title = 'LEVIATHAN FLAGSHIP HP';
      if (this.stage === 2) title = 'HEAVY BOMBER SQUADRON HP';
      if (this.stage === 3) title = 'DESERT FORTRESS HP';
      ctx.fillText(title, canvas.width / 2, barY - 5);
    }
  }
}

// ==========================================
// 10. 多層視差背景系統
// ==========================================
function createBackgroundCanvas(img, needsRotation = false) {
  const offscreen = document.createElement('canvas');
  const targetW = canvas.width;
  if (!isReady(img)) {
    offscreen.width = targetW; offscreen.height = canvas.height;
    return offscreen;
  }
  if (needsRotation) {
    const scale = targetW / img.naturalHeight; const targetH = Math.floor(img.naturalWidth * scale);
    offscreen.width = targetW; offscreen.height = targetH;
    const octx = offscreen.getContext('2d'); octx.imageSmoothingEnabled = false;
    octx.save(); octx.translate(targetW, 0); octx.rotate(Math.PI / 2);
    octx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, targetH, targetW);
    octx.restore();
  } else {
    const scale = targetW / img.naturalWidth; const targetH = Math.floor(img.naturalHeight * scale);
    offscreen.width = targetW; offscreen.height = targetH;
    const octx = offscreen.getContext('2d'); octx.imageSmoothingEnabled = false;
    octx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, targetW, targetH);
  }
  return offscreen;
}

const parallaxLayers = { deepest: { cvs: null, y: 0, speed: 0.35 }, middle: { cvs: null, y: 0, speed: 0.85 }, foreground: { cvs: null, y: 0, speed: 2.2 }, ready: false };

function initParallaxBackgrounds() {
  if (currentStage === 1) {
    parallaxLayers.deepest.cvs = createBackgroundCanvas(assets.bgDeepest, true);
    parallaxLayers.middle.cvs = createBackgroundCanvas(assets.bgMiddle, true);
    parallaxLayers.foreground.cvs = createBackgroundCanvas(assets.bgForeground, true);
    parallaxLayers.deepest.speed = 0.35; parallaxLayers.middle.speed = 0.85; parallaxLayers.foreground.speed = 2.2;
  } else if (currentStage === 2) {
    parallaxLayers.deepest.cvs = createBackgroundCanvas(assets.bgDeepest2, false);
    parallaxLayers.middle.cvs = createBackgroundCanvas(assets.bgMiddle2, false);
    parallaxLayers.foreground.cvs = createBackgroundCanvas(assets.bgForeground2, false);
    parallaxLayers.deepest.speed = 0.6; parallaxLayers.middle.speed = 1.2; parallaxLayers.foreground.speed = 2.6;
  } else {
    parallaxLayers.deepest.cvs = createBackgroundCanvas(assets.bgDeepest3, false);
    parallaxLayers.middle.cvs = createBackgroundCanvas(assets.bgMiddle3, false);
    parallaxLayers.foreground.cvs = createBackgroundCanvas(assets.bgForeground3, false);
    parallaxLayers.deepest.speed = 0.5; parallaxLayers.middle.speed = 1.3; parallaxLayers.foreground.speed = 2.8;
  }
  parallaxLayers.ready = true;
}

function updateAndDrawParallax(speedMultiplier = 1) {
  if (!parallaxLayers.ready) {
    ctx.fillStyle = '#0a0518'; ctx.fillRect(0, 0, canvas.width, canvas.height); return;
  }
  function renderLayer(layer, alpha = 1) {
    const cvs = layer.cvs; if (!cvs || cvs.height === 0) return;
    const h = cvs.height;
    layer.y += layer.speed * speedMultiplier; if (layer.y >= h) layer.y -= h;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.drawImage(cvs, 0, Math.floor(layer.y));
    ctx.drawImage(cvs, 0, Math.floor(layer.y - h));
    ctx.restore();
  }
  renderLayer(parallaxLayers.deepest, 1.0);
  renderLayer(parallaxLayers.middle, 1.0);
  renderLayer(parallaxLayers.foreground, 0.85);
}

// ==========================================
// 11. 全畫面閃電大絕系統 (保證觸發與清場)
// ==========================================
let lightningEvent = null;

function triggerLightningStrike() {
  if (player.lightningAmmo <= 0) return;
  player.lightningAmmo--;
  sfx.playThunder();
  
  enemyBullets = [];
  const LIGHTNING_DAMAGE = 5;

  enemies.forEach(e => {
    e.hp -= LIGHTNING_DAMAGE;
    if (e.hp <= 0) {
      e.markedForDeletion = true;
      explosions.push(new SpriteExplosion(e.x + e.width / 2, e.y + e.height / 2, 1.6));
      score += e.scoreVal;
      if (Math.random() < 0.3) spawnRandomDrop(e.x + e.width / 2 - 12, e.y);
    }
  });

  if (boss && boss.state === 'fight') {
    boss.turrets.forEach(t => {
      if (!t.isDestroyed) {
        t.hp -= LIGHTNING_DAMAGE;
        if (t.hp <= 0) {
          t.isDestroyed = true;
          explosions.push(new SpriteExplosion(boss.x + t.offsetX, boss.y + t.offsetY, 2.2));
          score += 1500;
        }
      }
    });
    boss.hp -= LIGHTNING_DAMAGE;
    if (boss.hp <= 0) handleBossDefeated();
  }
  scoreEl.innerText = score;

  lightningEvent = {
    timer: 0, duration: 35,
    bolts: [
      { x: 20, width: 140, startFrame: 0 },
      { x: 170, width: 150, startFrame: 1 },
      { x: 310, width: 140, startFrame: 0 },
      { x: 95, width: 160, startFrame: 2 }
    ]
  };
}

function updateAndDrawLightning() {
  if (!lightningEvent) return;
  lightningEvent.timer++;

  // 螢幕瞬間高壓白閃
  if (lightningEvent.timer < 6) {
    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.4 - lightningEvent.timer * 0.06})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // 繪製雷電精靈圖[cite: 12]
  if (isReady(assets.lightning)) {
    const fW = assets.lightning.naturalWidth / 5;
    const fH = assets.lightning.naturalHeight;

    lightningEvent.bolts.forEach(bolt => {
      const frameIndex = Math.min(4, Math.floor((lightningEvent.timer + bolt.startFrame * 4) / 6));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(assets.lightning, frameIndex * fW, 0, fW, fH, bolt.x, 0, bolt.width, canvas.height);
      ctx.restore();
    });
  }

  if (lightningEvent.timer >= lightningEvent.duration) {
    lightningEvent = null;
  }
}

// ==========================================
// 12. 全域遊戲循環與過關架構
// ==========================================
const player = new Player();
let currentStage = 1;
let isStartMenu = true;
let stageTransitioning = false;
let stageTransitionTimer = 0;

let playerBullets = []; let enemyBullets = []; let enemies = [];
let dropItems = []; let explosions = []; let smokeParticles = [];
let score = 0; let spawnTimer = 0; let waveCount = 0;
const MAX_WAVES_BEFORE_BOSS = 30; // 30 波後觸發 BOSS

let boss = null; let bossWarningTimer = 0;
let isVictory = false; let isGameOver = false;
const squadronTracker = {};

function startGame(stageNum) {
  currentStage = stageNum;
  isStartMenu = false; isGameOver = false; isVictory = false;
  waveCount = 0; score = 0; spawnTimer = 0; bossWarningTimer = 0; boss = null;
  player.hp = player.maxHp; player.shield = player.maxShield; player.lightningAmmo = 3;
  player.powerLevel = 1; player.weaponType = 'bullet';
  player.x = canvas.width / 2 - player.width / 2; player.y = canvas.height - 180;
  enemyBullets = []; enemies = []; dropItems = []; explosions = []; smokeParticles = [];
  initParallaxBackgrounds();
}

function spawnRandomDrop(x, y) {
  const r = Math.random(); let type = 'POW';
  if (r < 0.15) type = 'lightning';
  else if (r < 0.32) type = 'shield';
  else if (r < 0.46) type = 'heal';
  else if (r < 0.64) type = 'POW';
  else if (r < 0.78) type = 'laser';
  else if (r < 0.90) type = 'fire';
  else type = 'bullet';
  dropItems.push(new DropItem(x, y, type));
}

function spawnWave() {
  if (waveCount >= MAX_WAVES_BEFORE_BOSS || stageTransitioning) return;
  waveCount++;
  const isRedWave = (waveCount % 4 === 0);
  const squadronId = 'sq_' + waveCount;
  const startX = Math.random() * (canvas.width - 180) + 90;

  let kind = 1;
  if (isRedWave) kind = 2;
  else {
    const rand = Math.random();
    if (rand < 0.4) kind = 1;
    else if (rand < 0.75) kind = 3;
    else kind = 2;
  }

  if (isRedWave) squadronTracker[squadronId] = { total: 4, killed: 0 };
  for (let i = 0; i < 4; i++) {
    setTimeout(() => {
      if (!isGameOver && !boss && !stageTransitioning && !isStartMenu) {
        enemies.push(new Enemy(startX, -40, kind, isRedWave, squadronId));
      }
    }, i * 260);
  }
}

function checkBeamCollision(boxX, boxY, boxW, boxH, damage) {
  enemies.forEach(e => {
    if (!e.markedForDeletion) {
      if (boxX < e.x + e.width && boxX + boxW > e.x && boxY < e.y + e.height && boxY + boxH > e.y) {
        e.hp -= damage;
        if (e.hp <= 0) {
          e.markedForDeletion = true; sfx.playExplosion(false);
          explosions.push(new SpriteExplosion(e.x + e.width / 2, e.y + e.height / 2, 1.4));
          score += e.scoreVal; scoreEl.innerText = score;
          if (Math.random() < 0.25) spawnRandomDrop(e.x + e.width / 2 - 12, e.y);
        }
      }
    }
  });

  if (boss && boss.state === 'fight') {
    boss.turrets.forEach(t => {
      if (!t.isDestroyed) {
        const tx = boss.x + t.offsetX; const ty = boss.y + t.offsetY;
        if (boxX < tx + 20 && boxX + boxW > tx - 20 && boxY < ty + 20 && boxY + boxH > ty - 20) {
          t.hp -= damage;
          if (t.hp <= 0) {
            t.isDestroyed = true; sfx.playExplosion(true);
            explosions.push(new SpriteExplosion(tx, ty, 2.2));
            score += 1500; scoreEl.innerText = score;
          }
        }
      }
    });

    const coreHitAreaY = (currentStage === 1) ? 120 : ((currentStage === 2) ? 60 : 100);
    const coreHitAreaH = (currentStage === 1) ? 20 : ((currentStage === 2) ? 60 : 40);
    if (boxX < boss.x + boss.width - 35 && boxX + boxW > boss.x + 35 && boxY < boss.y + boss.height - coreHitAreaH && boxY + boxH > boss.y + coreHitAreaY) {
      boss.hp -= damage; if (boss.hp <= 0) handleBossDefeated();
    }
  }
}

function checkCollisions() {
  playerBullets.forEach(b => {
    enemies.forEach(e => {
      if (!b.markedForDeletion && !e.markedForDeletion) {
        if (b.x > e.x && b.x < e.x + e.width && b.y > e.y && b.y < e.y + e.height) {
          b.markedForDeletion = true; e.hp--;
          if (e.hp <= 0) {
            e.markedForDeletion = true; sfx.playExplosion(false);
            explosions.push(new SpriteExplosion(e.x + e.width / 2, e.y + e.height / 2, 1.4));
            score += e.scoreVal; scoreEl.innerText = score;
            if (e.isRedSquadron && e.squadronId && squadronTracker[e.squadronId]) {
              squadronTracker[e.squadronId].killed++;
              if (squadronTracker[e.squadronId].killed >= squadronTracker[e.squadronId].total) {
                spawnRandomDrop(e.x + e.width / 2 - 12, e.y); delete squadronTracker[e.squadronId];
              }
            } else if (Math.random() < 0.22) spawnRandomDrop(e.x + e.width / 2 - 12, e.y);
          }
        }
      }
    });

    if (boss && !b.markedForDeletion && boss.state === 'fight') {
      let hitTurret = false;
      boss.turrets.forEach(t => {
        if (!t.isDestroyed) {
          const turretWorldX = boss.x + t.offsetX; const turretWorldY = boss.y + t.offsetY;
          const dist = Math.hypot(b.x - turretWorldX, b.y - turretWorldY);
          if (dist < 20) {
            b.markedForDeletion = true; hitTurret = true; t.hp--;
            if (t.hp <= 0) {
              t.isDestroyed = true; sfx.playExplosion(true);
              explosions.push(new SpriteExplosion(turretWorldX, turretWorldY, 2.2));
              score += 1500; scoreEl.innerText = score;
            }
          }
        }
      });
      const coreHitAreaY = (currentStage === 1) ? 120 : ((currentStage === 2) ? 60 : 100);
      const coreHitAreaH = (currentStage === 1) ? 20 : ((currentStage === 2) ? 60 : 40);
      if (!hitTurret && !b.markedForDeletion) {
        if (b.x > boss.x + 35 && b.x < boss.x + boss.width - 35 && b.y > boss.y + coreHitAreaY && b.y < boss.y + boss.height - coreHitAreaH) {
          b.markedForDeletion = true; boss.hp--; if (boss.hp <= 0) handleBossDefeated();
        }
      }
    }
  });

  if (player.channelState === 'firing' && !player.isRolling && !isGameOver) {
    if (player.weaponType === 'laser') {
      const beamHeight = (player.powerLevel === 1) ? canvas.height / 2 : canvas.height; const beamW = 28;
      checkBeamCollision(player.x + player.width / 2 - beamW / 2, player.y - beamHeight, beamW, beamHeight, 0.14);
      if (player.powerLevel >= 3) {
        checkBeamCollision(player.x - 38 - beamW / 2, player.y - beamHeight, beamW, beamHeight, 0.12);
        checkBeamCollision(player.x + player.width + 38 - beamW / 2, player.y - beamHeight, beamW, beamHeight, 0.12);
      }
    } else if (player.weaponType === 'fire') {
      const flameHeight = (player.powerLevel === 1) ? canvas.height / 4 : canvas.height / 2; const flameW = 42;
      checkBeamCollision(player.x + player.width / 2 - flameW / 2, player.y - flameHeight, flameW, flameHeight, 0.16);
      if (player.powerLevel >= 3) {
        checkBeamCollision(player.x - 38 - flameW / 2, player.y - flameHeight, flameW, flameHeight, 0.14);
        checkBeamCollision(player.x + player.width + 38 - flameW / 2, player.y - flameHeight, flameW, flameHeight, 0.14);
      }
    }
  }

  dropItems.forEach(item => {
    if (!item.markedForDeletion) {
      if (player.x < item.x + item.width && player.x + player.width > item.x && player.y < item.y + item.height && player.y + player.height > item.y) {
        item.markedForDeletion = true;
        if (item.type === 'lightning') {
          sfx.playPowerUp(); if (player.lightningAmmo < player.maxLightning) player.lightningAmmo++; score += 600;
        } else if (item.type === 'shield') {
          sfx.playShieldRecharge(); if (player.shield < player.maxShield) player.shield++; score += 400;
        } else if (item.type === 'heal') {
          sfx.playHeal(); if (player.hp < player.maxHp) player.hp++; score += 300;
        } else {
          sfx.playPowerUp();
          if (item.type === 'POW') { if (player.powerLevel < 3) player.powerLevel++; }
          else {
            if (player.weaponType === item.type) { if (player.powerLevel < 3) player.powerLevel++; }
            else { player.weaponType = item.type; player.channelState = 'firing'; player.channelTimer = 0; }
          }
          score += 500;
        }
        scoreEl.innerText = score;
      }
    }
  });

  if (player.isRolling || isGameOver || isVictory || player.shieldHitInvuln > 0 || stageTransitioning) return;

  enemyBullets.forEach(b => {
    if (!b.markedForDeletion) {
      const dist = Math.hypot(b.x - (player.x + player.width / 2), b.y - (player.y + player.height / 2));
      if (dist < 14) { b.markedForDeletion = true; handlePlayerHit(); }
    }
  });

  enemies.forEach(e => {
    if (!e.markedForDeletion) {
      if (player.x < e.x + e.width && player.x + player.width > e.x && player.y < e.y + e.height && player.y + player.height > e.y) {
        e.markedForDeletion = true; handlePlayerHit();
      }
    }
  });

  if (boss && boss.state === 'fight') {
    const coreHitAreaY = (currentStage === 1) ? 120 : ((currentStage === 2) ? 60 : 100);
    if (player.x < boss.x + boss.width - 40 && player.x + player.width > boss.x + 40 && player.y < boss.y + boss.height && player.y + player.height > boss.y + coreHitAreaY) handlePlayerHit();
  }
}

function handlePlayerHit() {
  if (player.shield > 0) {
    player.shield--; sfx.playShieldHit();
    explosions.push(new SpriteExplosion(player.x + player.width / 2, player.y + player.height / 2, 1.2));
    player.shieldHitInvuln = 30;
  } else {
    sfx.playExplosion(true);
    explosions.push(new SpriteExplosion(player.x + player.width / 2, player.y + player.height / 2, 2.2));
    player.hp--; player.powerLevel = 1;
    if (player.hp <= 0) isGameOver = true;
    else {
      player.x = canvas.width / 2 - player.width / 2; player.y = canvas.height - 180;
      player.isRolling = true; player.rollTimer = 40;
    }
  }
}

function handleBossDefeated() {
  score += 25000 * currentStage; scoreEl.innerText = score;
  if (currentStage === 1 || currentStage === 2) {
    stageTransitioning = true; stageTransitionTimer = 220; 
    enemyBullets = []; enemies = []; dropItems = [];
    for (let i = 0; i < 14; i++) {
      setTimeout(() => {
        sfx.playExplosion(true);
        const randX = boss.x + Math.random() * boss.width; const randY = boss.y + 100 + Math.random() * (boss.height - 100);
        explosions.push(new SpriteExplosion(randX, randY, 2.8));
      }, i * 140);
    }
    setTimeout(() => { boss = null; }, 2000);
  } else {
    isVictory = true;
    for (let i = 0; i < 20; i++) {
      setTimeout(() => {
        sfx.playExplosion(true);
        const randX = boss.x + Math.random() * boss.width; const randY = boss.y + 40 + Math.random() * (boss.height - 60);
        explosions.push(new SpriteExplosion(randX, randY, 3.2));
      }, i * 120);
    }
    setTimeout(() => { boss = null; }, 2400);
  }
}

function processStageTransition() {
  if (stageTransitioning) {
    stageTransitionTimer--;
    ctx.save(); ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.8, (220 - stageTransitionTimer) * 0.01)})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#2ecc71'; ctx.font = 'bold 28px "Courier New"'; ctx.textAlign = 'center';
    
    if (currentStage === 1) {
      ctx.fillText('STAGE 1 CLEAR!', canvas.width / 2, canvas.height / 2 - 20);
      if (stageTransitionTimer < 100) { ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 20px "Courier New"'; ctx.fillText('ENTERING STAGE 2: PACIFIC FLEET', canvas.width / 2, canvas.height / 2 + 20); }
    } else if (currentStage === 2) {
      ctx.fillText('STAGE 2 CLEAR!', canvas.width / 2, canvas.height / 2 - 20);
      if (stageTransitionTimer < 100) { ctx.fillStyle = '#e67e22'; ctx.font = 'bold 20px "Courier New"'; ctx.fillText('ENTERING STAGE 3: DESERT STORM', canvas.width / 2, canvas.height / 2 + 20); }
    }
    ctx.restore();

    if (stageTransitionTimer <= 0) {
      currentStage++; waveCount = 0; spawnTimer = 0; bossWarningTimer = 0; boss = null; stageTransitioning = false; initParallaxBackgrounds();
    }
  }
}

function drawStartMenu() {
  updateAndDrawParallax(0.5);
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 42px "Courier New"'; ctx.textAlign = 'center';
  ctx.shadowColor = '#0984e3'; ctx.shadowBlur = 15;
  ctx.fillText('ACE STRIKER', canvas.width / 2, 160);
  ctx.shadowBlur = 0;
  
  ctx.font = '16px "Courier New"'; ctx.fillStyle = '#ccc';
  ctx.fillText('SELECT MISSION TO DEPLOY', canvas.width / 2, 210);

  const drawBtn = (text, y, color) => {
    const btnW = 220; const btnH = 50; const bx = canvas.width / 2 - btnW / 2;
    ctx.fillStyle = color; ctx.fillRect(bx, y, btnW, btnH);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(bx, y, btnW, btnH);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px "Courier New"';
    ctx.fillText(text, canvas.width / 2, y + 32);
  };
  drawBtn('STAGE 1: SPACE', 260, 'rgba(155, 89, 182, 0.8)');
  drawBtn('STAGE 2: OCEAN', 330, 'rgba(52, 152, 219, 0.8)');
  drawBtn('STAGE 3: DESERT', 400, 'rgba(230, 126, 34, 0.8)');
  ctx.restore();
}

// 主循環
function gameLoop() {
  if (isStartMenu) {
    drawStartMenu();
    requestAnimationFrame(gameLoop);
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bgSpeed = bossWarningTimer > 0 ? 2.5 : 1;
  updateAndDrawParallax(bgSpeed);

  if (!isGameOver && !isVictory && !stageTransitioning) {
    player.update();
    if (waveCount < MAX_WAVES_BEFORE_BOSS) {
      spawnTimer++;
      if (spawnTimer % 135 === 0) spawnWave();
    } else if (!boss && enemies.length === 0) {
      if (bossWarningTimer === 0) bossWarningTimer = 180;
    }
  }

  if (bossWarningTimer > 0) {
    bossWarningTimer--;
    if (bossWarningTimer % 45 === 0) sfx.playAlarm();
    if (bossWarningTimer === 0) boss = new Boss(currentStage);
  }

  if (boss && !stageTransitioning) boss.update();

  playerBullets.forEach(b => b.update());
  enemyBullets.forEach(b => b.update());
  enemies.forEach(e => e.update());
  dropItems.forEach(p => p.update());
  explosions.forEach(exp => exp.update());
  smokeParticles.forEach(sp => sp.update());

  playerBullets = playerBullets.filter(b => !b.markedForDeletion);
  enemyBullets = enemyBullets.filter(b => !b.markedForDeletion);
  enemies = enemies.filter(e => !e.markedForDeletion);
  dropItems = dropItems.filter(p => !p.markedForDeletion);
  explosions = explosions.filter(exp => !exp.markedForDeletion);
  smokeParticles = smokeParticles.filter(sp => sp.alpha > 0);

  if (!stageTransitioning) checkCollisions();

  playerBullets.forEach(b => b.draw(ctx));
  dropItems.forEach(p => p.draw(ctx));
  enemies.forEach(e => e.draw(ctx));
  if (boss) boss.draw(ctx);
  smokeParticles.forEach(sp => sp.draw(ctx));
  enemyBullets.forEach(b => b.draw(ctx));

  if (!isGameOver && !isVictory) player.draw(ctx);

  explosions.forEach(exp => exp.draw(ctx));

  // 繪製全畫面閃電大絕 (確保覆蓋在戰機/敵機上層)
  updateAndDrawLightning();

  processStageTransition();

  // --- 繪製觸控虛擬控制台 (支援實時觸控反饋) ---
  if (!isGameOver && !isVictory && !stageTransitioning) {
    ctx.save();
    // 搖桿底座
    ctx.beginPath(); ctx.arc(virtualControls.joyBaseX, virtualControls.joyBaseY, virtualControls.joyRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'; ctx.fill(); ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.lineWidth = 2; ctx.stroke();
    // 搖桿把手
    ctx.beginPath(); ctx.arc(virtualControls.stickX, virtualControls.stickY, 19, 0, Math.PI * 2);
    ctx.fillStyle = (virtualControls.dirX !== 0 || virtualControls.dirY !== 0) ? 'rgba(0, 210, 211, 0.8)' : 'rgba(255, 255, 255, 0.55)'; ctx.fill();
    // 開火按鈕
    ctx.beginPath(); ctx.arc(shootBtn.x, shootBtn.y, shootBtn.r, 0, Math.PI * 2);
    ctx.fillStyle = virtualControls.shootActive ? 'rgba(0, 210, 211, 0.8)' : 'rgba(0, 210, 211, 0.35)'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px "Courier New"'; ctx.textAlign = 'center'; ctx.fillText('FIRE', shootBtn.x, shootBtn.y + 5);
    // 大絕閃電按鈕
    ctx.beginPath(); ctx.arc(bombBtn.x, bombBtn.y, bombBtn.r, 0, Math.PI * 2);
    ctx.fillStyle = (player.lightningAmmo > 0) ? 'rgba(241, 196, 15, 0.5)' : 'rgba(100, 100, 100, 0.3)'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px "Courier New"'; ctx.textAlign = 'center'; ctx.fillText('⚡', bombBtn.x, bombBtn.y + 7);
    ctx.restore();
  }

  // --- 頂部 HUD UI ---
  ctx.save();
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px "Courier New"'; ctx.textAlign = 'center';
  if (!boss && !stageTransitioning && waveCount <= MAX_WAVES_BEFORE_BOSS) {
    ctx.fillText(`STAGE ${currentStage} - WAVE: ${waveCount} / ${MAX_WAVES_BEFORE_BOSS}`, canvas.width / 2, 20);
  }

  ctx.textAlign = 'left';
  let weaponName = 'BULLET'; let weaponColor = '#00d2d3';
  if (player.weaponType === 'laser') { weaponName = 'LASER'; weaponColor = '#a29bfe'; }
  else if (player.weaponType === 'fire') { weaponName = 'FLAME'; weaponColor = '#ff7675'; }

  ctx.fillStyle = weaponColor; ctx.font = 'bold 13px "Courier New"';
  ctx.fillText(`[${weaponName} LV.${player.powerLevel}]`, 10, 20);

  if (player.weaponType !== 'bullet') {
    const barW = 85; const barH = 4;
    ctx.fillStyle = '#222'; ctx.fillRect(10, 26, barW, barH);
    let progress = 1; let max = (player.weaponType === 'laser') ? ((player.powerLevel >= 3) ? 180 : 120) : 300;
    if (player.channelState === 'firing') { progress = 1 - (player.channelTimer / max); ctx.fillStyle = weaponColor; }
    else { let coolMax = (player.weaponType === 'laser') ? ((player.powerLevel >= 3) ? 120 : 60) : 120; progress = (player.channelTimer / coolMax); ctx.fillStyle = '#555'; }
    ctx.fillRect(10, 26, barW * progress, barH);
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = '#00cec9'; ctx.fillText(`SHD:${player.shield}`, canvas.width - 10, 16);
  ctx.fillStyle = '#2ecc71'; ctx.fillText(`HP:${player.hp}`, canvas.width - 10, 32);
  ctx.fillStyle = '#f1c40f'; ctx.fillText(`⚡:${player.lightningAmmo}`, canvas.width - 10, 48);
  ctx.restore();

  if (bossWarningTimer > 0 && !stageTransitioning) {
    ctx.save();
    if (Math.floor(bossWarningTimer / 12) % 2 === 0) {
      ctx.fillStyle = 'rgba(230, 0, 0, 0.25)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ff2222'; ctx.font = 'bold 24px "Courier New"'; ctx.textAlign = 'center'; ctx.fillText('WARNING!!', canvas.width / 2, canvas.height / 2 - 20);
      ctx.font = '16px "Courier New"'; 
      let approachingText = 'LEVIATHAN FLAGSHIP APPROACHING';
      if (currentStage === 2) approachingText = 'HEAVY BOMBER SQUADRON APPROACHING';
      if (currentStage === 3) approachingText = 'DESERT FORTRESS APPROACHING';
      ctx.fillText(approachingText, canvas.width / 2, canvas.height / 2 + 15);
    }
    ctx.restore();
  }

  if (isGameOver) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff3333'; ctx.font = 'bold 32px "Courier New"'; ctx.textAlign = 'center'; ctx.fillText('MISSION FAILED', canvas.width / 2, canvas.height / 2 - 10);
    ctx.fillStyle = '#fff'; ctx.font = '16px "Courier New"'; ctx.fillText('點擊畫面返回主選單', canvas.width / 2, canvas.height / 2 + 30);
  }

  if (isVictory && !boss && currentStage === 3) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#3498db'; ctx.font = 'bold 30px "Courier New"'; ctx.textAlign = 'center'; ctx.fillText('ALL STAGES CLEARED!', canvas.width / 2, canvas.height / 2 - 30);
    ctx.fillStyle = '#f1c40f'; ctx.font = '22px "Courier New"'; ctx.fillText(`FINAL SCORE: ${score}`, canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillStyle = '#ecf0f1'; ctx.font = '14px "Courier New"'; ctx.fillText('點擊畫面返回主選單', canvas.width / 2, canvas.height / 2 + 50);
  }

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);