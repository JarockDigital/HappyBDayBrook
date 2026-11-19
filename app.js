(() => {
  'use strict';

  /* ==========================================================================
     0. Force Top-of-Page Reset on Every Refresh / Reload
     ========================================================================== */
  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);

  window.addEventListener('beforeunload', () => {
    window.scrollTo(0, 0);
  });

  window.addEventListener('pageshow', () => {
    window.scrollTo(0, 0);
  });

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ==========================================================================
     1. Graceful Image Handling (Photos + Optional Venom Hero Art)
     ========================================================================== */
  function createPlaceholderDataUri(label) {
    const safeLabel = String(label || 'ADD PHOTO').replace(/[<>&"']/g, '');
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
        <rect width="800" height="600" fill="#0D0D12"/>
        <rect x="24" y="24" width="752" height="552" fill="none" stroke="#F5F5F8" stroke-opacity="0.28" stroke-width="1.5"/>
        <text x="400" y="295" text-anchor="middle" fill="#F5F5F8" font-family="sans-serif" font-weight="600" font-size="20" letter-spacing="2">
          ${safeLabel}
        </text>
        <text x="400" y="330" text-anchor="middle" fill="#A1A1AA" font-family="sans-serif" font-size="13" letter-spacing="2">
          DROP FILE INTO ASSETS FOLDER
        </text>
      </svg>
    `;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  document.querySelectorAll('img[data-fallback-label]').forEach((img) => {
    img.addEventListener(
      'error',
      () => {
        if (!img.dataset.fallbackApplied) {
          img.dataset.fallbackApplied = 'true';
          img.src = createPlaceholderDataUri(img.dataset.fallbackLabel);
        }
      },
      { once: true }
    );
  });

  const optionalVenomArt = document.getElementById('optional-venom-art');
  if (optionalVenomArt) {
    optionalVenomArt.addEventListener(
      'error',
      () => {
        optionalVenomArt.style.display = 'none';
      },
      { once: true }
    );
  }

  /* ==========================================================================
     2. Branching Symbiote Tentacle & Surge Canvas Engine
     ========================================================================== */
  const canvas = document.getElementById('symbiote-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;

  const symbiote = {
    retraction: 0,
    surge: 0,
    pointerX: -9999,
    pointerY: -9999,
    width: 0,
    height: 0,
    time: 0,
    rafId: null,
  };

  const TENTACLES = [
    { edge: 'top', pos: 0.08, angle: Math.PI * 0.42, reach: 165, width: 22, speed: 0.95, phase: 0.1, fork: true },
    { edge: 'top', pos: 0.28, angle: Math.PI * 0.48, reach: 120, width: 15, speed: 1.15, phase: 1.3, fork: false },
    { edge: 'top', pos: 0.72, angle: Math.PI * 0.52, reach: 128, width: 16, speed: 1.05, phase: 2.4, fork: false },
    { edge: 'top', pos: 0.92, angle: Math.PI * 0.58, reach: 170, width: 22, speed: 0.9, phase: 3.7, fork: true },

    { edge: 'left', pos: 0.22, angle: 0.12, reach: 145, width: 19, speed: 1.0, phase: 0.8, fork: true },
    { edge: 'left', pos: 0.54, angle: -0.05, reach: 115, width: 14, speed: 1.2, phase: 2.1, fork: false },
    { edge: 'left', pos: 0.82, angle: -0.14, reach: 150, width: 20, speed: 0.88, phase: 4.2, fork: true },

    { edge: 'right', pos: 0.20, angle: Math.PI - 0.12, reach: 145, width: 19, speed: 1.02, phase: 1.6, fork: true },
    { edge: 'right', pos: 0.56, angle: Math.PI + 0.05, reach: 118, width: 14, speed: 1.18, phase: 3.1, fork: false },
    { edge: 'right', pos: 0.84, angle: Math.PI + 0.14, reach: 155, width: 20, speed: 0.92, phase: 4.8, fork: true },

    { edge: 'bottom', pos: 0.16, angle: -Math.PI * 0.44, reach: 168, width: 21, speed: 0.94, phase: 2.7, fork: true },
    { edge: 'bottom', pos: 0.84, angle: -Math.PI * 0.56, reach: 168, width: 21, speed: 0.96, phase: 5.1, fork: true },
  ];

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    symbiote.width = window.innerWidth;
    symbiote.height = window.innerHeight;
    canvas.width = Math.floor(symbiote.width * dpr);
    canvas.height = Math.floor(symbiote.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function getEdgeRoot(def, w, h) {
    const pad = 14;
    switch (def.edge) {
      case 'top':
        return { x: w * def.pos, y: -pad };
      case 'bottom':
        return { x: w * def.pos, y: h + pad };
      case 'left':
        return { x: -pad, y: h * def.pos };
      case 'right':
      default:
        return { x: w + pad, y: h * def.pos };
    }
  }

  function renderStrand(startX, startY, startAngle, totalReach, baseWidth, speed, phase, t, allowFork) {
    const segments = 16;
    const stepLen = totalReach / segments;
    const leftPts = [];
    const rightPts = [];

    let x = startX;
    let y = startY;
    let angle = startAngle;

    for (let i = 0; i <= segments; i++) {
      const p = i / segments;
      const whip =
        Math.sin(t * speed + phase + i * 0.45) * 0.11 * p +
        Math.cos(t * (speed * 0.7) + phase * 1.3 + i * 0.28) * 0.055;

      angle += whip;

      const dx = symbiote.pointerX - x;
      const dy = symbiote.pointerY - y;
      const dist = Math.hypot(dx, dy);
      if (dist < 190 && dist > 1) {
        const pull = ((190 - dist) / 190) * 0.16 * p;
        const targetAngle = Math.atan2(dy, dx);
        angle += Math.sin(targetAngle - angle) * pull;
      }

      if (i > 0) {
        x += Math.cos(angle) * stepLen;
        y += Math.sin(angle) * stepLen;
      }

      if (allowFork && i === 7) {
        const forkDir = phase % 2 > 1 ? 0.52 : -0.52;
        renderStrand(
          x,
          y,
          angle + forkDir,
          totalReach * 0.52,
          baseWidth * 0.45,
          speed * 1.25,
          phase + 1.4,
          t,
          false
        );
      }

      const muscle = 1 + Math.sin(p * Math.PI * 2.2) * 0.15;
      const radius = Math.max(0.7, baseWidth * Math.pow(1 - p, 1.3) * muscle);

      const nx = -Math.sin(angle);
      const ny = Math.cos(angle);

      leftPts.push({ x: x + nx * radius, y: y + ny * radius });
      rightPts.push({ x: x - nx * radius, y: y - ny * radius });
    }

    ctx.beginPath();
    ctx.moveTo(leftPts[0].x, leftPts[0].y);

    for (let i = 1; i < leftPts.length - 1; i++) {
      const xc = (leftPts[i].x + leftPts[i + 1].x) * 0.5;
      const yc = (leftPts[i].y + leftPts[i + 1].y) * 0.5;
      ctx.quadraticCurveTo(leftPts[i].x, leftPts[i].y, xc, yc);
    }

    const tip = leftPts[leftPts.length - 1];
    ctx.lineTo(tip.x, tip.y);

    for (let i = rightPts.length - 2; i > 0; i--) {
      const xc = (rightPts[i].x + rightPts[i - 1].x) * 0.5;
      const yc = (rightPts[i].y + rightPts[i - 1].y) * 0.5;
      ctx.quadraticCurveTo(rightPts[i].x, rightPts[i].y, xc, yc);
    }

    ctx.lineTo(rightPts[0].x, rightPts[0].y);
    ctx.closePath();

    ctx.fillStyle = '#07070A';
    ctx.fill();

    ctx.strokeStyle = 'rgba(245, 245, 248, 0.32)';
    ctx.lineWidth = 1.15;
    ctx.stroke();
  }

  function renderFrame() {
    if (!ctx) return;
    const { width: w, height: h, retraction, surge, time } = symbiote;
    ctx.clearRect(0, 0, w, h);

    const scale = Math.min(Math.max(Math.min(w, h) / 400, 0.85), 1.45);
    const maxDiag = Math.hypot(w, h) * 0.65;

    for (let i = 0; i < TENTACLES.length; i++) {
      const def = TENTACLES[i];
      const root = getEdgeRoot(def, w, h);
      const baseReach = def.reach * scale * (1 - retraction * 0.56);
      const activeReach = baseReach + surge * maxDiag;
      const activeWidth = def.width * scale * (1 - retraction * 0.25) + surge * 26;

      renderStrand(
        root.x,
        root.y,
        def.angle,
        activeReach,
        activeWidth,
        def.speed,
        def.phase,
        time,
        def.fork
      );
    }

    if (!prefersReducedMotion && !document.hidden) {
      symbiote.time += 0.02;
      symbiote.rafId = window.requestAnimationFrame(renderFrame);
    }
  }

  if (canvas && ctx) {
    resizeCanvas();
    renderFrame();

    window.addEventListener('resize', () => {
      resizeCanvas();
      if (prefersReducedMotion) renderFrame();
    });

    window.addEventListener(
      'pointermove',
      (e) => {
        symbiote.pointerX = e.clientX;
        symbiote.pointerY = e.clientY;
      },
      { passive: true }
    );

    window.addEventListener(
      'pointerdown',
      (e) => {
        symbiote.pointerX = e.clientX;
        symbiote.pointerY = e.clientY;
      },
      { passive: true }
    );

    window.addEventListener(
      'pointerleave',
      () => {
        symbiote.pointerX = -9999;
        symbiote.pointerY = -9999;
      },
      { passive: true }
    );

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !prefersReducedMotion) {
        if (symbiote.rafId) cancelAnimationFrame(symbiote.rafId);
        renderFrame();
      }
    });
  }

  /* ==========================================================================
     3. Juice WRLD Vibe Engine (Auto-Play on Open + Toggle + Synth Fallback)
     ========================================================================== */
  const soundToggleBtn = document.getElementById('sound-toggle');
  const soundLabel = document.getElementById('sound-label');
  const customAudio = document.getElementById('custom-audio');
  const eqBars = document.querySelectorAll('#eq-bars span');

  let audioCtx = null;
  let masterGain = null;
  let loopTimer = null;
  let eqRafId = null;
  let isPlaying = false;

  const MELODY_STEPS = [
    { note: 329.63, sub: 82.41 },
    { note: 392.0, sub: null },
    { note: 493.88, sub: null },
    { note: 440.0, sub: 65.41 },
    { note: 392.0, sub: null },
    { note: 329.63, sub: null },
    { note: 293.66, sub: 73.42 },
    { note: 329.63, sub: null },
  ];

  function triggerSynthStep(stepObj) {
    if (!audioCtx || !masterGain || !isPlaying) return;
    const now = audioCtx.currentTime;

    const bell = audioCtx.createOscillator();
    const bellFilter = audioCtx.createBiquadFilter();
    const bellGain = audioCtx.createGain();

    bell.type = 'triangle';
    bell.frequency.setValueAtTime(stepObj.note, now);

    bellFilter.type = 'lowpass';
    bellFilter.frequency.setValueAtTime(920, now);

    bellGain.gain.setValueAtTime(0.0001, now);
    bellGain.gain.linearRampToValueAtTime(0.09, now + 0.04);
    bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);

    bell.connect(bellFilter);
    bellFilter.connect(bellGain);
    bellGain.connect(masterGain);

    bell.start(now);
    bell.stop(now + 1.4);

    if (stepObj.sub) {
      const sub = audioCtx.createOscillator();
      const subGain = audioCtx.createGain();

      sub.type = 'sine';
      sub.frequency.setValueAtTime(stepObj.sub * 1.35, now);
      sub.frequency.exponentialRampToValueAtTime(stepObj.sub, now + 0.12);

      subGain.gain.setValueAtTime(0.0001, now);
      subGain.gain.linearRampToValueAtTime(0.16, now + 0.05);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

      sub.connect(subGain);
      subGain.connect(masterGain);

      sub.start(now);
      sub.stop(now + 1.65);
    }
  }

  function startFallbackSynth() {
    if (!isPlaying) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.85, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    if (loopTimer) clearInterval(loopTimer);
    let idx = 0;
    triggerSynthStep(MELODY_STEPS[idx]);
    loopTimer = window.setInterval(() => {
      idx = (idx + 1) % MELODY_STEPS.length;
      triggerSynthStep(MELODY_STEPS[idx]);
    }, 620);
  }

  function animateVisualizer() {
    if (!isPlaying) {
      eqBars.forEach((bar) => {
        bar.style.height = '4px';
      });
      return;
    }

    const t = performance.now() * 0.009;
    eqBars.forEach((bar, i) => {
      const h = Math.max(4, Math.round(7 + Math.sin(t + i * 1.25) * 6));
      bar.style.height = `${h}px`;
    });

    eqRafId = window.requestAnimationFrame(animateVisualizer);
  }

  async function startAudio() {
    if (isPlaying) return;
    isPlaying = true;

    if (soundToggleBtn) soundToggleBtn.setAttribute('aria-pressed', 'true');
    if (soundLabel) soundLabel.textContent = 'Vibe: On';
    animateVisualizer();

    if (customAudio) {
      try {
        customAudio.volume = 0.78;
        await customAudio.play();
        return;
      } catch (_err) {
        // Fall back to built-in beat if assets/juice.mp3 is missing or blocked
      }
    }

    startFallbackSynth();
  }

  function stopAudio() {
    if (!isPlaying) return;
    isPlaying = false;

    if (soundToggleBtn) soundToggleBtn.setAttribute('aria-pressed', 'false');
    if (soundLabel) soundLabel.textContent = 'Vibe: Off';

    if (customAudio && !customAudio.paused) {
      customAudio.pause();
    }

    if (loopTimer) {
      clearInterval(loopTimer);
      loopTimer = null;
    }

    if (eqRafId) {
      cancelAnimationFrame(eqRafId);
      eqRafId = null;
    }

    eqBars.forEach((bar) => {
      bar.style.height = '4px';
    });
  }

  function toggleAudio() {
    if (!isPlaying) {
      startAudio();
    } else {
      stopAudio();
    }
  }

  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', toggleAudio);
  }

  /* ==========================================================================
     4. Moment 1 -> Moment 2 Symbiote Surge & Reveal (Auto-Starts Music)
     ========================================================================== */
  const openingSection = document.getElementById('opening');
  const openCardBtn = document.getElementById('open-card-btn');
  const cardExperience = document.getElementById('card-experience');
  const hasGsap = typeof window.gsap !== 'undefined';

  if (hasGsap && typeof window.ScrollTrigger !== 'undefined') {
    window.gsap.registerPlugin(window.ScrollTrigger);
  }

  function initScrollMemories() {
    const items = document.querySelectorAll('[data-photo-item]');
    if (!hasGsap || prefersReducedMotion || !window.ScrollTrigger) return;

    items.forEach((item) => {
      window.gsap.fromTo(
        item,
        { opacity: 0, y: 32 },
        {
          opacity: 1,
          y: 0,
          duration: 0.85,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: item,
            start: 'top 85%',
            once: true,
          },
        }
      );
    });
  }

  function openBirthdayCard() {
    if (!openingSection || !cardExperience) return;

    // Auto-start Juice WRLD song on user tap gesture
    startAudio();

    // Ensure viewport starts at the very top when unlocked
    window.scrollTo(0, 0);
    document.body.classList.remove('is-locked');
    cardExperience.classList.add('is-visible');
    cardExperience.setAttribute('aria-hidden', 'false');

    if (!hasGsap || prefersReducedMotion) {
      symbiote.retraction = 1;
      if (prefersReducedMotion) renderFrame();
      openingSection.classList.add('is-hidden');
      return;
    }

    const tl = window.gsap.timeline({
      onComplete: () => {
        openingSection.classList.add('is-hidden');
        initScrollMemories();
      },
    });

    tl.to('.opening-inner', {
      opacity: 0,
      scale: 0.96,
      duration: 0.35,
      ease: 'power2.in',
    })
      .to(
        symbiote,
        {
          surge: 1,
          duration: 0.55,
          ease: 'power3.in',
        },
        0.05
      )
      .to(
        openingSection,
        {
          opacity: 0,
          duration: 0.3,
        },
        0.45
      )
      .to(
        symbiote,
        {
          surge: 0,
          retraction: 1,
          duration: 0.85,
          ease: 'power4.out',
        },
        0.6
      )
      .fromTo(
        '.reveal-tag',
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' },
        0.75
      )
      .fromTo(
        '.mask-text',
        { yPercent: 105 },
        {
          yPercent: 0,
          duration: 0.8,
          stagger: 0.1,
          ease: 'power3.out',
        },
        0.82
      )
      .fromTo(
        '.spider-emblem',
        { opacity: 0, scale: 0.85 },
        { opacity: 1, scale: 1, duration: 0.65, ease: 'power3.out' },
        1.15
      )
      .fromTo(
        '.scroll-cue',
        { opacity: 0 },
        { opacity: 0.85, duration: 0.5 },
        1.35
      );
  }

  if (openCardBtn) {
    openCardBtn.addEventListener('click', openBirthdayCard);
  }

  /* ==========================================================================
     5. Moment 3: Captionless Full-Screen Photo Lightbox
     ========================================================================== */
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCloseBtn = document.getElementById('lightbox-close');
  let lastTrigger = null;

  function openLightbox(triggerBtn) {
    if (!lightbox || !lightboxImg) return;
    const img = triggerBtn.querySelector('img');
    if (!img) return;

    lastTrigger = triggerBtn;
    lightboxImg.src = img.currentSrc || img.src;
    lightboxImg.alt = img.alt || 'Brook';

    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    if (lightboxCloseBtn) lightboxCloseBtn.focus();
  }

  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;
    lightbox.hidden = true;
    document.body.style.overflow = '';
    if (lastTrigger) {
      lastTrigger.focus();
      lastTrigger = null;
    }
  }

  document.querySelectorAll('[data-lightbox-trigger]').forEach((btn) => {
    btn.addEventListener('click', () => openLightbox(btn));
  });

  if (lightboxCloseBtn) {
    lightboxCloseBtn.addEventListener('click', closeLightbox);
  }

  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox && !lightbox.hidden) {
      closeLightbox();
    }
  });

  /* ==========================================================================
     6. Moment 4: Architectural Envelope Flap & Medallion Reveal
     ========================================================================== */
  const sealBtn = document.getElementById('seal-btn');
  const envelopeChassis = document.querySelector('.envelope-chassis');
  const sealCover = document.getElementById('symbiote-seal-cover');
  const envelopeFlap = document.getElementById('envelope-flap');
  const letterSheet = document.getElementById('letter-sheet');
  let isUnsealed = false;

  function breakSymbioteSeal() {
    if (isUnsealed || !sealBtn || !sealCover || !letterSheet) return;
    isUnsealed = true;
    sealBtn.setAttribute('aria-expanded', 'true');
    sealBtn.disabled = true;

    if (!hasGsap || prefersReducedMotion) {
      sealCover.hidden = true;
      letterSheet.hidden = false;
      letterSheet.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'nearest' });
      return;
    }

    const tl = window.gsap.timeline({
      onComplete: () => {
        letterSheet.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      },
    });

    tl.to(sealBtn, {
      scale: 0.72,
      opacity: 0,
      duration: 0.35,
      ease: 'power2.in',
    })
      .to(
        '#seal-instruction',
        {
          opacity: 0,
          duration: 0.25,
        },
        0
      )
      .to(
        envelopeFlap,
        {
          rotateX: 180,
          transformPerspective: 900,
          duration: 0.65,
          ease: 'power2.inOut',
        },
        0.22
      )
      .to(
        sealCover,
        {
          opacity: 0,
          y: -14,
          duration: 0.35,
          ease: 'power2.in',
          onComplete: () => {
            sealCover.hidden = true;
            letterSheet.hidden = false;
          },
        },
        0.75
      )
      .fromTo(
        letterSheet,
        { opacity: 0, y: 22 },
        {
          opacity: 1,
          y: 0,
          duration: 0.75,
          ease: 'power3.out',
        },
        0.95
      );
  }

  if (sealBtn) {
    sealBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      breakSymbioteSeal();
    });
  }

  if (envelopeChassis) {
    envelopeChassis.addEventListener('click', breakSymbioteSeal);
  }
})();
