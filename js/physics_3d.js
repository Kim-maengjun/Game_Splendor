/**
 * Splendor 3D - Spring Physics Camera, 3D Particle Renderer & Web Audio Synthesizer
 * Exposes global `window.SplendorPhysics3D`
 */
(function (global) {
  'use strict';

  /* ==========================================================================
     1. Web Audio API Procedural Sound Synthesizer (SoundFX)
     ========================================================================== */
  const SoundFX = {
    ctx: null,
    muted: false,

    init() {
      if (!this.ctx) {
        const AudioCtx = global.AudioContext || global.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    },

    setMuted(flag) {
      this.muted = Boolean(flag);
      return this.muted;
    },

    toggleMute() {
      this.muted = !this.muted;
      if (!this.muted) {
        this.playChipClink(0);
      }
      return this.muted;
    },

    /** Realistic Tactile Plastic Token Clatter / Rattle Sound (플라스틱 토큰이 딸그락거리는 소리) */
    playChipClink(comboIndex = 0) {
      if (this.muted) return;
      const ctx = this.init();
      if (!ctx) return;

      const now = ctx.currentTime;
      const pitchShift = Math.min(comboIndex * 35, 140);

      // Plastic clatter consists of 2 rapid micro-impacts (primary tap + secondary bounce ~26ms later)
      const hits = [
        { offset: 0, amp: 0.22, freqA: 540 + pitchShift, freqB: 890 + pitchShift },
        { offset: 0.026, amp: 0.12, freqA: 610 + pitchShift, freqB: 980 + pitchShift }
      ];

      hits.forEach((h) => {
        const t0 = now + h.offset;

        // Short hollow plastic body resonance
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const bodyFilter = ctx.createBiquadFilter();
        const bodyGain = ctx.createGain();

        osc1.type = 'triangle';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(h.freqA, t0);
        osc1.frequency.exponentialRampToValueAtTime(h.freqA * 0.52, t0 + 0.042);

        osc2.frequency.setValueAtTime(h.freqB, t0);
        osc2.frequency.exponentialRampToValueAtTime(h.freqB * 0.58, t0 + 0.035);

        bodyFilter.type = 'bandpass';
        bodyFilter.frequency.setValueAtTime(720, t0);
        bodyFilter.Q.value = 2.4;

        bodyGain.gain.setValueAtTime(0.001, t0);
        bodyGain.gain.linearRampToValueAtTime(h.amp, t0 + 0.003);
        bodyGain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.048);

        osc1.connect(bodyFilter);
        osc2.connect(bodyFilter);
        bodyFilter.connect(bodyGain);
        bodyGain.connect(ctx.destination);

        osc1.start(t0);
        osc2.start(t0);
        osc1.stop(t0 + 0.052);
        osc2.stop(t0 + 0.052);

        // Crisp plastic surface click transient (short filtered noise burst)
        const clickLen = Math.floor(ctx.sampleRate * 0.018);
        const clickBuf = ctx.createBuffer(1, clickLen, ctx.sampleRate);
        const cData = clickBuf.getChannelData(0);
        for (let i = 0; i < clickLen; i++) {
          cData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (clickLen * 0.28));
        }
        const clickSrc = ctx.createBufferSource();
        clickSrc.buffer = clickBuf;

        const clickFilter = ctx.createBiquadFilter();
        clickFilter.type = 'bandpass';
        clickFilter.frequency.setValueAtTime(1050, t0);
        clickFilter.Q.value = 1.8;

        const clickGain = ctx.createGain();
        clickGain.gain.setValueAtTime(h.amp * 0.85, t0);
        clickGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.018);

        clickSrc.connect(clickFilter);
        clickFilter.connect(clickGain);
        clickGain.connect(ctx.destination);
        clickSrc.start(t0);
        clickSrc.stop(t0 + 0.019);
      });
    },

    /** Realistic Paper Card Turning / Page Flipping Sound (종이 카드를 스르륵 넘기는 소리) */
    playCardFlip() {
      if (this.muted) return;
      const ctx = this.init();
      if (!ctx) return;

      const now = ctx.currentTime;
      const duration = 0.21;
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        const p = i / bufferSize;
        // Asymmetric paper-turn envelope: brisk lift -> smooth glide -> crisp laydown
        const env = Math.pow(Math.sin(p * Math.PI), 0.65) * (1 - 0.18 * p);
        data[i] = (Math.random() * 2 - 1) * env * 0.85;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      // Sweeping bandpass filter (450Hz -> 1450Hz -> 680Hz) with wider Q for richer paper body
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(450, now);
      filter.frequency.exponentialRampToValueAtTime(1450, now + duration * 0.42);
      filter.frequency.exponentialRampToValueAtTime(680, now + duration);
      filter.Q.value = 0.85;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.linearRampToValueAtTime(0.65, now + 0.028);
      gain.gain.exponentialRampToValueAtTime(0.002, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + duration);

      // Subtle low-mid paper snap/thump on card laydown so it matches token volume presence
      const snapOsc = ctx.createOscillator();
      const snapGain = ctx.createGain();
      snapOsc.type = 'triangle';
      snapOsc.frequency.setValueAtTime(240, now + 0.015);
      snapOsc.frequency.exponentialRampToValueAtTime(95, now + 0.095);

      snapGain.gain.setValueAtTime(0.001, now + 0.015);
      snapGain.gain.linearRampToValueAtTime(0.28, now + 0.025);
      snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      snapOsc.connect(snapGain);
      snapGain.connect(ctx.destination);
      snapOsc.start(now + 0.015);
      snapOsc.stop(now + 0.105);
    },

    /** Warm Mellotron/Cello-like Chord for Noble Visit (C4 - E4 - G4 - C5) */
    playNobleFanfare() {
      if (this.muted) return;
      const ctx = this.init();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [261.63, 329.63, 392.00, 523.25];
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.12;
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(750, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.13, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.65);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.68);
      });
    },

    /** Warm Wooden Stronghold Placement Thud */
    playStrongholdPlace() {
      if (this.muted) return;
      const ctx = this.init();
      if (!ctx) return;

      const now = ctx.currentTime;
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(130, now);
      sub.frequency.exponentialRampToValueAtTime(48, now + 0.25);

      subGain.gain.setValueAtTime(0.22, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.27);

      sub.connect(subGain);
      subGain.connect(ctx.destination);
      sub.start(now);
      sub.stop(now + 0.28);
    },

    playVictoryFanfare() {
      this.playNobleFanfare();
    },

    /** Soft 2-tone descending warning beep for invalid input (잘못된 조작 알림음) */
    playErrorBeep() {
      if (this.muted) return;
      const ctx = this.init();
      if (!ctx) return;
      const now = ctx.currentTime;
      [{ f: 360, t: 0 }, { f: 240, t: 0.11 }].forEach(({ f, t }) => {
        const t0 = now + t;
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(f, t0);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1100, t0);
        gain.gain.setValueAtTime(0.001, t0);
        gain.gain.linearRampToValueAtTime(0.09, t0 + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.11);
      });
    }
  };

  /* ==========================================================================
     2. Spring Physics 3D Table Camera Controller
     ========================================================================== */
  const cameraState = {
    pitch: 16,
    yaw: 0,
    zoom: 1,
    targetPitch: 16,
    targetYaw: 0,
    targetZoom: 1,
    velPitch: 0,
    velYaw: 0,
    velZoom: 0,
    stiffness: 0.14,
    damping: 0.76,
    isDragging: false,
    lastX: 0,
    lastY: 0,
    pinchStartDist: 0,
    pinchStartZoom: 1,
    rafId: null,
    stageEl: null
  };

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function applyCameraCSS() {
    const root = document.documentElement;
    root.style.setProperty('--cam-pitch', `${cameraState.pitch.toFixed(2)}deg`);
    root.style.setProperty('--cam-yaw', `${cameraState.yaw.toFixed(2)}deg`);
    root.style.setProperty('--cam-zoom', cameraState.zoom.toFixed(3));

    const pitchSlider = document.getElementById('splendor-cam-pitch-slider');
    if (pitchSlider && document.activeElement !== pitchSlider) {
      pitchSlider.value = String(Math.round(cameraState.targetPitch));
    }
  }

  function stepCameraSpring() {
    const dp = (cameraState.targetPitch - cameraState.pitch) * cameraState.stiffness;
    const dy = (cameraState.targetYaw - cameraState.yaw) * cameraState.stiffness;
    const dz = (cameraState.targetZoom - cameraState.zoom) * cameraState.stiffness;

    cameraState.velPitch = (cameraState.velPitch + dp) * cameraState.damping;
    cameraState.velYaw = (cameraState.velYaw + dy) * cameraState.damping;
    cameraState.velZoom = (cameraState.velZoom + dz) * cameraState.damping;

    cameraState.pitch += cameraState.velPitch;
    cameraState.yaw += cameraState.velYaw;
    cameraState.zoom += cameraState.velZoom;

    applyCameraCSS();

    const stillMoving =
      Math.abs(cameraState.velPitch) > 0.01 ||
      Math.abs(cameraState.velYaw) > 0.01 ||
      Math.abs(cameraState.velZoom) > 0.001 ||
      Math.abs(cameraState.targetPitch - cameraState.pitch) > 0.05 ||
      Math.abs(cameraState.targetYaw - cameraState.yaw) > 0.05 ||
      Math.abs(cameraState.targetZoom - cameraState.zoom) > 0.002;

    if (stillMoving) {
      cameraState.rafId = requestAnimationFrame(stepCameraSpring);
    } else {
      cameraState.pitch = cameraState.targetPitch;
      cameraState.yaw = cameraState.targetYaw;
      cameraState.zoom = cameraState.targetZoom;
      applyCameraCSS();
      cameraState.rafId = null;
    }
  }

  function wakeCameraSpring() {
    if (!cameraState.rafId) {
      cameraState.rafId = requestAnimationFrame(stepCameraSpring);
    }
  }

  function setCameraTarget(opts = {}) {
    if (typeof opts.pitch === 'number') {
      cameraState.targetPitch = clamp(opts.pitch, 0, 35);
    }
    if (typeof opts.yaw === 'number') {
      cameraState.targetYaw = clamp(opts.yaw, -15, 15);
    }
    if (typeof opts.zoom === 'number') {
      cameraState.targetZoom = clamp(opts.zoom, 0.82, 1.28);
    }
    wakeCameraSpring();
  }

  function resetCamera() {
    const isMobile = global.innerWidth <= 768;
    setCameraTarget({
      pitch: isMobile ? 10 : 16,
      yaw: 0,
      zoom: 1
    });
  }

  function toggleTableViewMode() {
    const isFlat = cameraState.targetPitch < 6;
    setCameraTarget({
      pitch: isFlat ? 24 : 0,
      yaw: 0
    });
  }

  function initCameraControls(viewportEl) {
    const target = viewportEl || document.querySelector('.splendor-3d-viewport') || document.body;
    cameraState.stageEl = target.querySelector('.splendor-3d-stage') || target;

    const isMobile = global.innerWidth <= 768;
    cameraState.pitch = isMobile ? 10 : 16;
    cameraState.targetPitch = cameraState.pitch;
    applyCameraCSS();

    // Right-click or Alt+drag camera rotation on desktop
    target.addEventListener('contextmenu', (e) => {
      if (cameraState.isDragging) e.preventDefault();
    });

    global.addEventListener('mousedown', (e) => {
      if (e.button === 2 || (e.button === 0 && e.altKey)) {
        cameraState.isDragging = true;
        cameraState.lastX = e.clientX;
        cameraState.lastY = e.clientY;
      }
    });

    global.addEventListener('mousemove', (e) => {
      if (!cameraState.isDragging) return;
      const dx = e.clientX - cameraState.lastX;
      const dy = e.clientY - cameraState.lastY;
      cameraState.lastX = e.clientX;
      cameraState.lastY = e.clientY;

      setCameraTarget({
        yaw: cameraState.targetYaw + dx * 0.12,
        pitch: cameraState.targetPitch - dy * 0.15
      });
    });

    global.addEventListener('mouseup', () => {
      cameraState.isDragging = false;
    });

    // Two-finger touch tilt & pinch zoom on mobile
    target.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          cameraState.pinchStartDist = Math.hypot(dx, dy);
          cameraState.pinchStartZoom = cameraState.targetZoom;
          cameraState.lastX = (e.touches[0].clientX + e.touches[1].clientX) * 0.5;
          cameraState.lastY = (e.touches[0].clientY + e.touches[1].clientY) * 0.5;
        }
      },
      { passive: true }
    );

    target.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 2) {
          const midX = (e.touches[0].clientX + e.touches[1].clientX) * 0.5;
          const midY = (e.touches[0].clientY + e.touches[1].clientY) * 0.5;
          const dx = midX - cameraState.lastX;
          const dy = midY - cameraState.lastY;
          cameraState.lastX = midX;
          cameraState.lastY = midY;

          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          const scaleRatio = cameraState.pinchStartDist > 10 ? dist / cameraState.pinchStartDist : 1;

          setCameraTarget({
            yaw: cameraState.targetYaw + dx * 0.1,
            pitch: cameraState.targetPitch - dy * 0.12,
            zoom: cameraState.pinchStartZoom * scaleRatio
          });
        }
      },
      { passive: true }
    );

    // Keyboard shortcuts: [V] toggle 2D/3D angle, [R] reset camera, [M] mute audio
    global.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target && e.target.tagName) || '')) return;
      if (e.key === 'v' || e.key === 'V') {
        toggleTableViewMode();
      } else if (e.key === 'r' || e.key === 'R') {
        resetCamera();
      } else if (e.key === 'm' || e.key === 'M') {
        SoundFX.toggleMute();
      }
    });
  }

  /* ==========================================================================
     3. Particle FX Layer Management & Mobile Touch Audio Unlock
     ========================================================================== */
  function setupMobileAudioUnlock() {
    const unlock = () => {
      SoundFX.init();
      if (SoundFX.ctx && SoundFX.ctx.state === 'suspended') {
        SoundFX.ctx.resume().catch(() => {});
      }
    };
    ['touchstart', 'touchend', 'pointerdown', 'click'].forEach((evt) => {
      global.addEventListener(evt, unlock, { passive: true, once: false });
    });
  }
  setupMobileAudioUnlock();

  function getFXLayer() {
    let layer = document.querySelector('.physics-fx-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'physics-fx-layer';
      document.body.appendChild(layer);
    }
    return layer;
  }

  function resolveCenterRect(elOrCoords) {
    if (!elOrCoords) {
      return { x: global.innerWidth * 0.5, y: global.innerHeight * 0.5, width: 56, height: 56 };
    }
    if (typeof elOrCoords.getBoundingClientRect === 'function') {
      const rect = elOrCoords.getBoundingClientRect();
      const rawX = rect.left + rect.width * 0.5;
      const rawY = rect.top + rect.height * 0.5;
      // On mobile portrait, if player panel is scrolled below the screen, clamp Y into the visible bottom area so the 3D flying animation is clearly seen!
      const clampedX = Math.max(32, Math.min(global.innerWidth - 32, rawX));
      const clampedY = Math.max(48, Math.min(global.innerHeight - 54, rawY));
      return {
        x: clampedX,
        y: clampedY,
        width: rect.width || 56,
        height: rect.height || 56
      };
    }
    return {
      x: Number(elOrCoords.x) || global.innerWidth * 0.5,
      y: Number(elOrCoords.y) || global.innerHeight * 0.5,
      width: Number(elOrCoords.width) || 56,
      height: Number(elOrCoords.height) || 56
    };
  }

  /* ==========================================================================
     4. 3D Parabolic Poker Chip Transfer Animation
     ========================================================================== */
  const GEM_CHIP_URLS = {
    emerald: 'assets/gems/greenGem-removebg.png',
    sapphire: 'assets/gems/blueGem-removebg.png',
    ruby: 'assets/gems/redGem-removebg.png',
    diamond: 'assets/gems/whiteGem-removebg.png',
    onyx: 'assets/gems/blackGem-removebg.png',
    gold: 'assets/gems/goldGem-removebg.png'
  };

  const DECK_BACK_URLS = {
    1: 'assets/cards/green-00.jpg',
    2: 'assets/cards/yellow-00.jpg',
    3: 'assets/cards/blue-00.jpg'
  };

  function animateChipTransfer(fromEl, toEl, gemType = 'gold', count = 1, callback) {
    const start = resolveCenterRect(fromEl);
    const end = resolveCenterRect(toEl);
    const layer = getFXLayer();
    const totalChips = clamp(Number(count) || 1, 1, 6);
    let completed = 0;
    const gKey = String(gemType).toLowerCase();
    const imgUrl = GEM_CHIP_URLS[gKey] || GEM_CHIP_URLS.gold;

    for (let i = 0; i < totalChips; i++) {
      const delayMs = i * 190;

      setTimeout(() => {
        SoundFX.playChipClink(i);

        const chip = document.createElement('div');
        chip.className = 'gem-chip-3d flying-chip-particle';
        chip.setAttribute('data-gem', gKey);
        chip.style.cssText = `
          position: fixed; left: 0; top: 0; width: 58px; height: 58px;
          border-radius: 50%; pointer-events: none; z-index: 9999;
          background: url('${imgUrl}') center/contain no-repeat;
          filter: drop-shadow(0 6px 10px rgba(0,0,0,0.75));
          will-change: transform;
        `;

        const shadow = document.createElement('div');
        shadow.className = 'flying-chip-shadow';
        shadow.style.cssText = `
          position: fixed; left: 0; top: 0; width: 48px; height: 24px;
          border-radius: 50%; background: radial-gradient(circle, rgba(0,0,0,0.7) 0%, transparent 72%);
          pointer-events: none; z-index: 9990; will-change: transform, opacity;
        `;

        layer.appendChild(shadow);
        layer.appendChild(chip);

        const duration = 1120;
        const startTime = performance.now();
        const arcHeight = Math.max(90, Math.hypot(end.x - start.x, end.y - start.y) * 0.32);
        const jitterX = (i - (totalChips - 1) * 0.5) * 16;

        function tickChip(now) {
          const rawT = clamp((now - startTime) / duration, 0, 1);
          const easeT = 1 - Math.pow(1 - rawT, 3);

          const curX = start.x + (end.x - start.x) * easeT + jitterX * Math.sin(rawT * Math.PI);
          const curY = start.y + (end.y - start.y) * easeT;

          const parabola = 4 * rawT * (1 - rawT);
          const liftY = parabola * arcHeight;
          const scale = 1 + parabola * 0.45;
          const rotX = rawT * 360 + 25;
          const rotZ = rawT * 220 * (i % 2 === 0 ? 1 : -1);

          chip.style.transform = `translate3d(${(curX - 29).toFixed(1)}px, ${(curY - liftY - 29).toFixed(1)}px, ${(parabola * 110).toFixed(1)}px) scale(${scale.toFixed(3)}) rotateX(${rotX.toFixed(1)}deg) rotateZ(${rotZ.toFixed(1)}deg)`;

          const shadowScale = 1 - parabola * 0.42;
          const shadowAlpha = 0.65 - parabola * 0.35;
          shadow.style.transform = `translate3d(${(curX - 24).toFixed(1)}px, ${(curY - 12).toFixed(1)}px, 0px) scale(${shadowScale.toFixed(3)})`;
          shadow.style.opacity = String(shadowAlpha.toFixed(2));

          if (rawT < 1) {
            requestAnimationFrame(tickChip);
          } else {
            SoundFX.playChipClink(totalChips + i);
            chip.remove();
            shadow.remove();
            completed++;
            if (completed === totalChips && typeof callback === 'function') {
              callback();
            }
          }
        }

        requestAnimationFrame(tickChip);
      }, delayMs);
    }
  }

  /* ==========================================================================
     5. 3D Card Take (Board/Deck -> Player) & 180-Degree Flip Deal (Deck -> Slot)
     ========================================================================== */
  function animateCardTakeToPlayer(fromEl, playerEl, cardObj, isBlindReserve = false, callback) {
    const start = resolveCenterRect(fromEl);
    const end = resolveCenterRect(playerEl);
    const layer = getFXLayer();

    SoundFX.playCardFlip();

    const lv = (cardObj && cardObj.level) || 1;
    const imgUrl = isBlindReserve
      ? (DECK_BACK_URLS[lv] || 'assets/cards/green-00.jpg')
      : ((cardObj && cardObj.imageUrl) || DECK_BACK_URLS[lv]);

    const w = start.width || 116;
    const h = start.height || 160;

    const flyer = document.createElement('div');
    flyer.style.cssText = `
      position: fixed; left: 0; top: 0; width: ${w}px; height: ${h}px;
      border-radius: 10px; pointer-events: none; z-index: 9998;
      background: url('${imgUrl}') 100% 100% / 100% 100% no-repeat;
      border: 2.5px solid #fde047;
      box-shadow: 0 22px 42px rgba(0,0,0,0.85), 0 0 24px rgba(245,197,66,0.75);
      transform-style: preserve-3d; will-change: transform, opacity;
    `;
    layer.appendChild(flyer);

    const duration = 1220;
    const startTime = performance.now();

    function tickTake(now) {
      const rawT = clamp((now - startTime) / duration, 0, 1);
      const easeT = 1 - Math.pow(1 - rawT, 3);
      const parabola = 4 * rawT * (1 - rawT);

      const curX = start.x + (end.x - start.x) * easeT - w * 0.5;
      const curY = start.y + (end.y - start.y) * easeT - h * 0.5 - parabola * 74;
      const scale = 1 + parabola * 0.32 - rawT * 0.35;
      const rotX = parabola * 22;
      const rotY = parabola * -20;
      const rotZ = rawT * 10;

      flyer.style.transform = `perspective(900px) translate3d(${curX.toFixed(1)}px, ${curY.toFixed(1)}px, ${(parabola * 120).toFixed(1)}px) scale(${scale.toFixed(3)}) rotateX(${rotX.toFixed(1)}deg) rotateY(${rotY.toFixed(1)}deg) rotateZ(${rotZ.toFixed(1)}deg)`;
      flyer.style.opacity = rawT > 0.88 ? String(((1 - rawT) / 0.12).toFixed(2)) : '1';

      if (rawT < 1) {
        requestAnimationFrame(tickTake);
      } else {
        flyer.remove();
        if (typeof callback === 'function') callback();
      }
    }

    requestAnimationFrame(tickTake);
  }

  function animateCardFlipAndMove(deckEl, slotEl, cardObj, callback) {
    if (typeof cardObj === 'function') {
      callback = cardObj;
      cardObj = null;
    }
    const start = resolveCenterRect(deckEl);
    const end = resolveCenterRect(slotEl);
    const layer = getFXLayer();

    SoundFX.playCardFlip();

    const tier =
      (cardObj && cardObj.level) ||
      (deckEl && deckEl.getAttribute && deckEl.getAttribute('data-tier')) ||
      (slotEl && slotEl.getAttribute && slotEl.getAttribute('data-tier')) ||
      1;

    const backUrl = DECK_BACK_URLS[tier] || 'assets/cards/green-00.jpg';
    const frontUrl = (cardObj && cardObj.imageUrl) || (slotEl && slotEl.dataset && slotEl.dataset.cardImg) || backUrl;

    const w = end.width || 116;
    const h = end.height || 160;

    if (slotEl && slotEl.style) {
      slotEl.style.opacity = '0';
    }

    const cloneWrapper = document.createElement('div');
    cloneWrapper.style.cssText = `
      position: fixed; left: 0; top: 0; width: ${w}px; height: ${h}px;
      perspective: 1000px; pointer-events: none; z-index: 9997; will-change: transform;
    `;

    const inner = document.createElement('div');
    inner.style.cssText = `
      position: relative; width: 100%; height: 100%; border-radius: 10px;
      transform-style: preserve-3d; box-shadow: 0 20px 38px rgba(0,0,0,0.85), 0 0 18px rgba(245,197,66,0.55);
    `;

    const frontFace = document.createElement('div');
    frontFace.style.cssText = `
      position: absolute; inset: 0; border-radius: 10px;
      backface-visibility: hidden; -webkit-backface-visibility: hidden;
      background: url('${frontUrl}') 100% 100% / 100% 100% no-repeat;
      border: 2px solid #ffffff; transform: rotateY(0deg);
    `;

    const backFace = document.createElement('div');
    backFace.style.cssText = `
      position: absolute; inset: 0; border-radius: 10px;
      backface-visibility: hidden; -webkit-backface-visibility: hidden;
      background: url('${backUrl}') 100% 100% / 100% 100% no-repeat;
      border: 2px solid #ffffff; transform: rotateY(180deg);
    `;

    inner.appendChild(frontFace);
    inner.appendChild(backFace);
    cloneWrapper.appendChild(inner);
    layer.appendChild(cloneWrapper);

    const duration = 1280;
    const startTime = performance.now();

    function tickCard(now) {
      const rawT = clamp((now - startTime) / duration, 0, 1);
      const easeT = 1 - Math.pow(1 - rawT, 3);
      const parabola = 4 * rawT * (1 - rawT);

      const curX = start.x + (end.x - start.x) * easeT - w * 0.5;
      const curY = start.y + (end.y - start.y) * easeT - h * 0.5 - parabola * 60;
      const scale = 1 + parabola * 0.24;
      const rotY = 180 * (1 - easeT);
      const rotX = parabola * 20;
      const rotZ = Math.sin(rawT * Math.PI) * -9;

      cloneWrapper.style.transform = `translate3d(${curX.toFixed(1)}px, ${curY.toFixed(1)}px, 0px) scale(${scale.toFixed(3)}) rotateZ(${rotZ.toFixed(1)}deg)`;
      inner.style.transform = `rotateX(${rotX.toFixed(1)}deg) rotateY(${rotY.toFixed(1)}deg)`;

      if (rawT < 1) {
        requestAnimationFrame(tickCard);
      } else {
        cloneWrapper.remove();
        if (slotEl && slotEl.style) {
          slotEl.style.transition = 'opacity 0.15s ease';
          slotEl.style.opacity = '1';
        }
        if (typeof callback === 'function') {
          callback();
        }
      }
    }

    requestAnimationFrame(tickCard);
  }

  /* ==========================================================================
     6. Interactive 3D Perspective Tilt & Specular Glare Handler
     ========================================================================== */
  function attach3DTiltEffects(container = document) {
    const root = container || document;
    const selector = '.card-3d-wrapper, .noble-tile-3d, [data-tilt-3d]';
    const elements = root.querySelectorAll ? root.querySelectorAll(selector) : [];

    elements.forEach((el) => {
      if (el.dataset.tiltBound === 'true') return;
      el.dataset.tiltBound = 'true';

      const targetInner = el.querySelector('.card-3d-inner') || el;
      let glare = el.querySelector('.tilt-glare-layer');
      if (!glare) {
        glare = document.createElement('div');
        glare.className = 'tilt-glare-layer';
        targetInner.appendChild(glare);
      }

      function applyTiltFromPoint(clientX, clientY) {
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const relX = clamp((clientX - rect.left) / rect.width, 0, 1);
        const relY = clamp((clientY - rect.top) / rect.height, 0, 1);

        const tiltX = (0.5 - relY) * 22; // -11deg to +11deg
        const tiltY = (relX - 0.5) * 22; // -11deg to +11deg

        el.classList.add('is-tilting');
        targetInner.style.transform = `translateZ(12px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
        el.style.setProperty('--glare-x', `${(relX * 100).toFixed(1)}%`);
        el.style.setProperty('--glare-y', `${(relY * 100).toFixed(1)}%`);
      }

      function resetTilt() {
        el.classList.remove('is-tilting');
        targetInner.style.transform = '';
      }

      el.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        applyTiltFromPoint(e.clientX, e.clientY);
      });

      el.addEventListener('pointerleave', resetTilt);
      el.addEventListener('pointercancel', resetTilt);

      el.addEventListener(
        'touchstart',
        (e) => {
          if (e.touches.length === 1) {
            applyTiltFromPoint(e.touches[0].clientX, e.touches[0].clientY);
          }
        },
        { passive: true }
      );

      el.addEventListener('touchend', resetTilt, { passive: true });
    });
  }

  /* ==========================================================================
     7. Public API Export (`window.SplendorPhysics3D`)
     ========================================================================== */
  const SplendorPhysics3D = {
    version: '1.1.0',
    SoundFX,
    cameraState,
    initCameraControls,
    setCameraTarget,
    resetCamera,
    toggleTableViewMode,
    animateChipTransfer,
    animateCardTakeToPlayer,
    animateCardFlipAndMove,
    attach3DTiltEffects
  };

  global.SplendorPhysics3D = SplendorPhysics3D;
})(typeof window !== 'undefined' ? window : this);
