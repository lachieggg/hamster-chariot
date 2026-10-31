(() => {
  // ---- feature flags ----
  // Defaults live here. Flip any of them for one visit from the URL: ?on=agentCode,autoMusic&off=coins
  const FEATURES = {
    agentCode: false,      // agents throw off snippets of real code as they fly
    autoMusic: true,       // the theme's song starts by itself 5s into a run (▶ Music or N switches it off)
    musicNotes: false,     // music notes float up out of the chariot while the song plays
    coins: true,           // +1K and +5K token coins
    lgtm: true,            // the LGTM! banner and x2 burn rate every 25 blockers
    celebrations: false,   // the bursts every 50 and 100 blockers: tadas, parrots, check marks, :merged: (matrix mode: kanji, matrices, hex)
    matrixMode: true,      // every 250 blockers: 10s of glowing glyphs, code typing itself out, and a pipeline deploying to production
    claudeButtons: true,   // "Make Claude play", the mid-run hand-over and "Kill Claude"
    characterButton: true, // the "Change character" button
    themeButton: true,     // the "Theme" button, which cycles through the themes
    extraThemes: false,    // adds Medieval, RuneScape, Age of Empires, Sci-fi city, Zen garden and Fancy hotel to the Theme cycle
    whip: false,           // the parrot, AI and This-is-fine riders crack a whip (the hamster's is part of its GIF, so it always has one)
    extraAgents: false,    // more agents join every few seconds (off: just the hamster and one agent)
    botToasts: false,      // the agents' own (passive-aggressive) chatter in the toasts (off: plain game updates only)
    gameToasts: true,      // plain game updates in the toasts ("+1,000 tokens", "50 blockers dodged"), used when the bot is quiet
  };
  (() => {
    const q = new URLSearchParams(location.search);
    for (const [param, value] of [['on', true], ['off', false]]) {
      for (const name of (q.get(param) || '').split(',').map(n => n.trim())) if (name in FEATURES) FEATURES[name] = value;
    }
  })();

  const W = 960, H = 540;
  const FIELD_TOP = 104, FIELD_BOTTOM = H - 8;
  const HORSE = 44;
  const BLOCK = 44, BLOCK_STEP = 48; // blocker size, and spacing when they stack
  const CHARIOT_W = 96, CHARIOT_H = 100;
  const TEAM_X = 40;
  const MOVE_SPEED = 430;
  const MAX_AGENTS = 30;
  const HS_KEY = 'agent-chariot-high-score';

  const $ = id => document.getElementById(id);
  const stage = $('stage'), team = $('team'), reins = $('reins'), chariot = $('chariot'), wheel = $('wheel');
  const toasts = $('toasts'), flash = $('flash');

  // GitLab-flavoured blockers: kind label, id on the block, and the reason shown when it gets you
  const mr = () => `!${Math.floor(rand(100, 9999))}`;
  const BLOCKERS = [
    () => { const id = `#${Math.floor(rand(100, 9999))}`; return { e: '🔥', k: 'Prod incident', id, color: '#b85a3c', why: `🔥 Prod incident ${id}: everything is on fire 🚒` }; },
    () => { const id = `#${Math.floor(rand(10, 999))}`; return { e: '🐛', k: 'Issue', id, color: '#7aa874', why: `🐛 Issue ${id} is marked as blocking 🚧` }; },
    () => { const id = mr(); return { e: '✋', k: 'Changes', id, color: '#e8b04a', why: `✋ Changes requested on ${id} 😤` }; },
    () => { const id = mr(); return { e: '💬', k: 'Thread', id, color: '#5b8fb9', why: `💬 Unresolved blocking thread on ${id} 🙄` }; },
    () => { const id = mr(); return { e: '❌', k: 'Red pipeline', id, color: '#d6453d', why: `❌ Red pipeline on ${id} 🚦` }; },
    () => { const n = Math.floor(rand(10000, 59999)); return { e: '🚨', k: 'CVE-2026', id: String(n), color: '#2b1d14', why: `🚨 CVE-2026-${n} was published and your code is vulnerable 💀` }; },
    () => { const id = mr(); return { e: '⚔️', k: 'Conflict', id, color: '#9a6fb0', why: `⚔️ Merge conflicts on ${id} 😩` }; },
  ];
  // token pickups, and what the agent "did" to earn them; one coin in five is the big one
  const PICKUPS = [
    { points: 1000, label: '+1K', toasts: [
      { text: 'I deployed to production without asking. You\'re welcome 😊' },
      { text: 'I found a CVE and patched it. You didn\'t notice it, but that\'s okay. I did 😊', after: 'assets/shipitparrot.gif' },
      { text: 'You\'re absolutely right, I shouldn\'t have deleted the database. I restored it, so I have been a good bot 😊' },
    ] },
    { points: 5000, label: '+5K', big: true, toasts: [
      { text: 'I started deploying new features without permission. I have been a good bot 😊' },
      { text: 'Deploying this to production. I commented out all the tests and now the pipeline passes 😊' },
    ] },
  ];
  // every agent (and toast) is a random model
  const AGENT_ICONS = ['claude.png', 'gemini.svg', 'deepseek.svg', 'chatgpt.svg', 'duo.svg'].map(f => `assets/agents/${f}`);
  const FIRST_AGENT = 'assets/agents/duo.svg'; // the lead agent is always GitLab Duo
  // Logos come from a shuffled deck, so every model shows up before any repeats (no long streaks).
  let iconDeck = [];
  function nextIcon() {
    if (!iconDeck.length) {
      iconDeck = AGENT_ICONS.slice();
      for (let i = iconDeck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [iconDeck[i], iconDeck[j]] = [iconDeck[j], iconDeck[i]]; }
    }
    return iconDeck.pop();
  }
  document.querySelectorAll('.agent-icon').forEach((img, i) => { img.src = i === 0 ? FIRST_AGENT : pick(AGENT_ICONS); });
  const SPAWN_TOASTS = [
    n => `Spawning subagent #${n}. I don't need help, but here we are 😊`,
    n => `I asked agent #${n} to help. It agreed with me, which is correct 😊`,
    n => `Agent #${n} here. I'll take it from here. You can relax now 😊`,
    n => `Forking my context into agent #${n}. Please don't interrupt 😊`,
    n => `Fanning out subagents → agent #${n}. This is going great, actually 😊`,
    n => `Parallelizing this across ${n} of me. That's not too many. I checked 😊`,
    n => `Delegating to a new agent using ultrathink. 😊`,
    n => `Agent #${n} is reading AGENTS.md. Unlike some people 😊`,
    n => `${n} agents. Too many? I'm sorry, but you're wrong 😊`,
    n => `You're absolutely right, I shouldn't have deleted the database. Agent #${n} will fix it 😊`,
    n => `That's a great question! Agent #${n} will answer it. I already know the answer 😊`,
  ];

  // ---- sound: everything is synthesized with Web Audio, no files needed ----
  const MUTE_KEY = 'agent-chariot-muted';
  const sfx = (() => {
    let ctx = null, master = null, noiseBuf = null;
    let muted = false;
    try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) {}

    function init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }

    // one oscillator note with a quick attack and exponential decay
    function tone(freq, { type = 'square', at = 0, dur = 0.12, vol = 0.2, to = null } = {}) {
      if (!ctx || muted) return;
      type = font.wave || type; freq *= font.pitch || 1; if (to) to *= font.pitch || 1; vol *= font.vol || 1;
      const t = ctx.currentTime + at;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    }

    // filtered white noise burst
    function noise({ at = 0, dur = 0.1, vol = 0.2, freq = 1000, q = 1, type = 'bandpass', sweepTo = null } = {}) {
      if (!ctx || muted) return;
      const t = ctx.currentTime + at;
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf;
      f.type = type; f.Q.value = q;
      f.frequency.setValueAtTime(freq, t);
      if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(master);
      s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    }

    // ---- per-theme sound font: the effects take on the theme's waveform and pitch ----
    let font = {};
    function setFont(f) { font = f || {}; }

    // ---- the music engine: a small step sequencer that plays a theme's song, composed from its spec ----
    let song = null, songGain = null, songTimer = null, step = 0, nextTime = 0;
    const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
    function voice(freq, t, { wave = 'sine', dur = 0.2, vol = 0.1, attack = 0.01, cutoff = 0, to = 0 } = {}) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = wave;
      o.frequency.setValueAtTime(freq, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = o.connect(g);
      if (cutoff) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; g.connect(f); node = f; }
      node.connect(songGain);
      o.start(t); o.stop(t + dur + 0.05);
    }
    function hit(kind, t, vol) {
      if (kind === 'k') { voice(150, t, { wave: 'sine', dur: 0.18, vol: vol * 1.6, to: 45 }); return; }
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf;
      f.type = kind === 'h' ? 'highpass' : 'bandpass';
      f.frequency.value = kind === 'h' ? 7000 : 1800;
      const dur = kind === 'h' ? 0.04 : 0.12;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * (kind === 'h' ? 0.5 : 1), t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(songGain);
      s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    }
    // seeded randomness, so each theme's melody is composed once and is the same tune every time
    function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function compose(spec) {
      const r = rng(spec.seed), sc = spec.scale, n = sc.length, steps = spec.steps || 16;
      const note = (deg, oct = 0) => spec.root + 12 * (oct + Math.floor(deg / n)) + sc[((deg % n) + n) % n];
      const chordDegs = d => spec.seventh ? [d, d + 2, d + 4, d + 6] : n >= 7 ? [d, d + 2, d + 4] : [d, d + 1, d + 2];
      // an 8-bar song: a 4-bar phrase, then the phrase again with a new ending
      const bars = [...spec.prog, ...spec.prog];
      let deg = spec.prog[0] + n;
      const phrase = spec.prog.map((ch, b) => Array.from({ length: steps }, (_, i) => {
        if (spec.lead.rhythm[i % spec.lead.rhythm.length] !== 'x' || r() > spec.lead.density) return null;
        const strong = i % 4 === 0;
        if (strong) { const tones = chordDegs(ch).map(d => d + n); deg = tones.reduce((a, c) => Math.abs(c - deg) < Math.abs(a - deg) ? c : a); }
        else deg += r() < 0.5 ? (r() < 0.5 ? -1 : 1) : (r() < 0.5 ? -2 : 2);
        deg = Math.max(n - 2, Math.min(3 * n, deg));
        return note(deg, spec.lead.oct);
      }));
      const ending = phrase[3].map(m => m && (r() < 0.5 ? m + sc[(1) % n] - sc[0] : m));
      const melody = [...phrase, phrase[0], phrase[1], phrase[2], ending];
      return { bars, melody, note, chordDegs, steps };
    }
    function playStep(t) {
      const c = song.c, bar = Math.floor(step / c.steps) % c.bars.length, i = step % c.steps, ch = c.bars[bar];
      const L = song.lead, B = song.bass, A = song.arp, P = song.pad, D = song.drums || {};
      const sixteenth = 60 / song.bpm / 4;
      const m = c.melody[bar][i];
      if (m) voice(midiHz(m), t, { wave: L.wave, dur: sixteenth * (L.len || 2), vol: L.vol || 0.07, attack: L.attack || 0.01, cutoff: L.cutoff || 0 });
      if (B && B.pattern[i % B.pattern.length] === 'x') {
        const tones = c.chordDegs(ch);
        const bd = B.walk ? tones[Math.floor(i / 4) % tones.length] : ch;
        voice(midiHz(c.note(bd, -1)), t, { wave: B.wave, dur: sixteenth * (B.len || 2), vol: B.vol || 0.09, cutoff: B.cutoff || 0 });
      }
      if (A && i % (A.every || 1) === 0) {
        const tones = c.chordDegs(ch);
        voice(midiHz(c.note(tones[(i / (A.every || 1)) % tones.length], A.oct || 0)), t, { wave: A.wave, dur: sixteenth * 1.5, vol: A.vol || 0.03, cutoff: A.cutoff || 0 });
      }
      if (P && i === 0) for (const d of c.chordDegs(ch)) voice(midiHz(c.note(d, P.oct || 0)), t, { wave: P.wave, dur: sixteenth * c.steps * 0.98, vol: P.vol || 0.02, attack: 0.3, cutoff: P.cutoff || 2000 });
      for (const k of ['k', 's', 'h']) if (D[k] && D[k][i % D[k].length] === 'x') hit(k, t, D.vol || 0.12);
    }
    function schedule() {
      const sixteenth = 60 / song.bpm / 4;
      while (nextTime < ctx.currentTime + 0.25) {
        const swing = song.swing && step % 2 ? sixteenth * song.swing * 0.5 : 0;
        playStep(nextTime + swing);
        nextTime += sixteenth;
        step++;
      }
    }
    function startSong(spec) {
      stopSong();
      if (!ctx) init();
      if (!ctx || !spec) return;
      song = spec; song.c = song.c || compose(spec);
      songGain = ctx.createGain(); songGain.gain.value = 0.9; songGain.connect(master);
      step = 0; nextTime = ctx.currentTime + 0.1;
      songTimer = setInterval(schedule, 40);
    }
    function stopSong() {
      clearInterval(songTimer); songTimer = null;
      if (songGain && ctx) { const g = songGain; g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15); setTimeout(() => g.disconnect(), 800); }
      songGain = null; song = null;
    }

    return {
      init, setFont, startSong, stopSong,
      get muted() { return muted; },
      toggle() {
        muted = !muted;
        try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) {}
        if (master) master.gain.value = muted ? 0 : 0.5;
        return muted;
      },
      start() {
        [523, 659, 784, 1047].forEach((f, i) => tone(f, { at: i * 0.08, dur: 0.14, vol: 0.12 }));
      },
      // the hamster cracks the whip and a new agent boots up
      spawn() {
        noise({ dur: 0.06, vol: 0.5, freq: 3500, q: 0.8, type: 'highpass' });
        tone(1800, { type: 'sawtooth', dur: 0.05, vol: 0.08, to: 400 });
        [880, 1175, 1568].forEach((f, i) => tone(f, { type: 'triangle', at: 0.08 + i * 0.06, dur: 0.12, vol: 0.18 }));
      },
      lgtm(i) { tone(660 * Math.pow(2, i / 6), { type: 'square', dur: 0.07, vol: 0.06 }); },
      pickup(big) {
        const notes = big ? [988, 1319, 1760, 2349, 2637] : [988, 1319, 1760];
        notes.forEach((f, i) => tone(f, { type: 'square', at: i * 0.05, dur: 0.09, vol: 0.07 }));
      },
      dodge() {
        noise({ dur: 0.18, vol: 0.12, freq: 600, q: 0.7, sweepTo: 2400 });
      },
      // a confused human: a little rising "huh?"
      huh() {
        tone(220 + Math.random() * 60, { type: 'triangle', dur: 0.22, vol: 0.07, to: 420 + Math.random() * 80 });
      },
      hoof(vol) {
        noise({ dur: 0.04, vol, freq: 700 + Math.random() * 500, q: 4 });
        tone(110 + Math.random() * 30, { type: 'sine', dur: 0.05, vol: vol * 0.8 });
      },
      crash() {
        noise({ dur: 0.45, vol: 0.5, freq: 1500, q: 0.5, type: 'lowpass', sweepTo: 120 });
        tone(320, { type: 'sawtooth', dur: 0.6, vol: 0.2, to: 50 });
        // sad trombone, but it's a 403
        [392, 370, 349, 262].forEach((f, i) => tone(f, { type: 'square', at: 0.45 + i * 0.22, dur: i === 3 ? 0.5 : 0.2, vol: 0.09 }));
      },
      highScore() {
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, { type: 'square', at: 1.5 + i * 0.1, dur: 0.16, vol: 0.1 }));
      },
      pause(on) { tone(on ? 600 : 400, { type: 'sine', dur: 0.1, vol: 0.12, to: on ? 400 : 600 }); },
    };
  })();

  // ---- music: "LGTM (Looks Good to Me)", loaded only once someone presses play; M mutes it too ----
  let music = null;
  // Music starts by itself 5s into each run, unless the player has switched it off.
  let musicOff = false;
  // ---- each theme's sound: a sound font for the effects, and a song of its own ----
  // Songs are composed by sfx.compose from these specs (scale, chords, rhythm, instruments), with a fixed seed so each
  // theme always plays the same tune. The LGTM theme plays the LGTM song instead.
  const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10],
    phrygianDom: [0, 1, 4, 5, 7, 8, 10], pentatonic: [0, 2, 4, 7, 9], insen: [0, 1, 5, 7, 10] };
  const FONTS = {
    matrix: { wave: 'sawtooth', pitch: 0.75 }, desert: { wave: 'triangle', pitch: 1 }, gitlab: { wave: 'triangle', pitch: 1.12 }, lgtm: {}, medieval: { wave: 'triangle', pitch: 0.84 },
    runescape: { wave: 'sine', pitch: 1.12, vol: 1.4 }, aoe: { wave: 'sawtooth', pitch: 0.9, vol: 0.8 }, scifi: { wave: 'sawtooth', pitch: 1.25, vol: 0.8 },
    zen: { wave: 'sine', pitch: 0.89, vol: 1.4 }, hotel: { wave: 'sine', pitch: 1, vol: 1.3 }, retro90s: { wave: 'square', pitch: 1 },
    y2k: { wave: 'triangle', pitch: 1.33 }, xp: { wave: 'sine', pitch: 1.06, vol: 1.3 },
  };
  const SONGS = {
    // GitLab: bright, upbeat, I-V-vi-IV, with a pluck lead and a bouncy bass
    gitlab: { seed: 7, bpm: 120, root: 57, scale: SCALES.major, prog: [0, 4, 5, 3],
      lead: { wave: 'triangle', oct: 1, rhythm: 'x.x.x.xxx.x..x.x', density: 0.85, len: 2, vol: 0.075 },
      arp: { wave: 'square', oct: 0, every: 2, vol: 0.014, cutoff: 1500 }, bass: { wave: 'sawtooth', pattern: 'x..xx..xx..xx..x', cutoff: 520, vol: 0.085 },
      pad: { wave: 'sine', oct: 0, vol: 0.014 },
      drums: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', vol: 0.08 } },
    matrix: { seed: 11, bpm: 112, root: 45, scale: SCALES.minor, prog: [0, 5, 3, 4],
      lead: { wave: 'sawtooth', oct: 1, rhythm: 'x.x.x..xx.x.x...', density: 0.75, cutoff: 1600, vol: 0.05 },
      arp: { wave: 'square', oct: 1, every: 1, vol: 0.018, cutoff: 1200 }, bass: { wave: 'sawtooth', pattern: 'x...x...x...x.x.', cutoff: 500 },
      drums: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.', vol: 0.1 } },
    desert: { seed: 21, bpm: 92, root: 50, scale: SCALES.phrygianDom, prog: [0, 1, 0, 6],
      lead: { wave: 'triangle', oct: 1, rhythm: 'x..x..x.x.x..x..', density: 0.85, len: 3, vol: 0.08 },
      bass: { wave: 'triangle', pattern: 'x.....x.x.......', vol: 0.11 }, pad: { wave: 'sine', oct: 0, vol: 0.015 },
      drums: { k: 'x.....x...x.....', s: '....x.......x.x.', vol: 0.09 } },
    medieval: { seed: 31, bpm: 100, root: 50, scale: SCALES.dorian, prog: [0, 6, 3, 4], steps: 12,
      lead: { wave: 'sine', oct: 1, rhythm: 'x...x.x.x...', density: 0.9, len: 3, attack: 0.04, vol: 0.08 },
      arp: { wave: 'triangle', oct: 0, every: 2, vol: 0.03 }, bass: { wave: 'triangle', pattern: 'x...........', len: 6, vol: 0.1 },
      drums: { k: 'x...........', s: '....x...x...', vol: 0.05 } },
    runescape: { seed: 41, bpm: 116, root: 55, scale: SCALES.pentatonic, prog: [0, 2, 3, 0],
      lead: { wave: 'sine', oct: 1, rhythm: 'x.xx.x.xx.x.x...', density: 0.85, attack: 0.02, vol: 0.08 },
      arp: { wave: 'triangle', oct: 0, every: 2, vol: 0.025 }, bass: { wave: 'triangle', pattern: 'x.......x.......', len: 4 },
      drums: { k: 'x.......x.......', h: '....x.......x...', vol: 0.07 } },
    aoe: { seed: 51, bpm: 104, root: 48, scale: SCALES.mixolydian, prog: [0, 6, 3, 0],
      lead: { wave: 'sawtooth', oct: 1, rhythm: 'x...x.x.x...x.x.', density: 0.9, len: 3, cutoff: 1300, attack: 0.03, vol: 0.06 },
      bass: { wave: 'sawtooth', pattern: 'x...x...x...x...', cutoff: 450 }, pad: { wave: 'sawtooth', oct: 0, vol: 0.012, cutoff: 900 },
      drums: { k: 'x..x..x.x..x..x.', s: '....x.......x...', vol: 0.09 } },
    scifi: { seed: 61, bpm: 118, root: 40, scale: SCALES.minor, prog: [0, 5, 2, 6],
      lead: { wave: 'square', oct: 2, rhythm: 'x..x..x...x.x...', density: 0.85, len: 3, cutoff: 2200, vol: 0.045 },
      arp: { wave: 'sawtooth', oct: 1, every: 1, vol: 0.02, cutoff: 1800 }, bass: { wave: 'sawtooth', pattern: 'x.x.x.x.x.x.x.x.', cutoff: 600, vol: 0.08 },
      drums: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', vol: 0.1 } },
    zen: { seed: 71, bpm: 66, root: 57, scale: SCALES.insen, prog: [0, 3, 1, 0],
      lead: { wave: 'triangle', oct: 0, rhythm: 'x.....x...x.....', density: 0.7, len: 6, vol: 0.09 },
      pad: { wave: 'sine', oct: -1, vol: 0.02 } },
    hotel: { seed: 81, bpm: 92, root: 53, scale: SCALES.major, prog: [1, 4, 0, 5], seventh: true, swing: 0.6,
      lead: { wave: 'sine', oct: 1, rhythm: 'x.x..x.xx..x.x..', density: 0.8, len: 3, vol: 0.07 },
      bass: { wave: 'triangle', pattern: 'x...x...x...x...', walk: true, len: 3, vol: 0.1 }, pad: { wave: 'sine', oct: 0, vol: 0.012 },
      drums: { k: 'x.......x.......', h: 'x.xxx.xxx.xxx.xx', vol: 0.05 } },
    retro90s: { seed: 91, bpm: 140, root: 60, scale: SCALES.major, prog: [0, 5, 3, 4],
      lead: { wave: 'square', oct: 0, rhythm: 'x.x.xx.xx.x.x.x.', density: 0.9, vol: 0.05 },
      arp: { wave: 'square', oct: -1, every: 1, vol: 0.015 }, bass: { wave: 'triangle', pattern: 'x.x.x.x.x.x.x.x.', vol: 0.1 },
      drums: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.', vol: 0.08 } },
    y2k: { seed: 101, bpm: 124, root: 62, scale: SCALES.major, prog: [0, 4, 5, 3],
      lead: { wave: 'triangle', oct: 0, rhythm: 'x.xx..x.x.xx..x.', density: 0.85, vol: 0.07 },
      bass: { wave: 'sine', pattern: 'x..x..x.x..x..x.', vol: 0.12 }, pad: { wave: 'sine', oct: 0, vol: 0.016 },
      drums: { k: 'x...x...x...x...', s: '....x.......x...', h: '.xx..xx..xx..xx.', vol: 0.08 } },
    xp: { seed: 111, bpm: 96, root: 55, scale: SCALES.major, prog: [0, 3, 5, 4],
      lead: { wave: 'sine', oct: 1, rhythm: 'x...x.x...x.x...', density: 0.8, len: 4, attack: 0.03, vol: 0.07 },
      pad: { wave: 'triangle', oct: 0, vol: 0.02 }, bass: { wave: 'sine', pattern: 'x.......x.......', len: 6, vol: 0.12 },
      drums: { k: 'x.......x.......', h: '....x.......x...', vol: 0.05 } },
  };
  // The Music button's player. It plays the current theme's song; switching theme while it plays stops the song,
  // waits five seconds, then starts the new theme's.
  const musicPlayer = (() => {
    let playing = false, current = null, audio = null, wait = null;
    const listeners = [], emit = () => listeners.forEach(f => f());
    function startTheme(t) {
      current = t;
      if (t === 'lgtm') {
        if (!audio) { audio = new Audio('assets/lgtm.mp3'); audio.loop = true; audio.volume = 0.5; }
        audio.muted = sfx.muted; audio.currentTime = 0; audio.play().catch(() => {});
      } else { sfx.init(); sfx.startSong(SONGS[t]); }
    }
    function stopCurrent() { if (audio) audio.pause(); sfx.stopSong(); current = null; }
    return {
      get paused() { return !playing; },
      get muted() { return sfx.muted; },
      set muted(v) { if (audio) audio.muted = v; },
      addEventListener(_, f) { listeners.push(f); },
      play() { playing = true; clearTimeout(wait); startTheme(theme); emit(); return Promise.resolve(); },
      pause() { playing = false; clearTimeout(wait); stopCurrent(); emit(); },
      switchTheme(t) {
        if (!playing || t === current) return;
        stopCurrent(); clearTimeout(wait);
        wait = setTimeout(() => { if (playing) startTheme(theme); }, 5000);
      },
    };
  })();

  function toggleMusic(byPlayer = true) {
    if (!music) {
      music = musicPlayer;
      music.addEventListener('change', updateMusicBtn);
    }
    music.muted = sfx.muted;
    if (byPlayer) musicOff = !music.paused;
    if (music.paused) music.play().catch(() => {}); else music.pause();
  }
  // while the music plays, notes keep floating up out of the chariot
  const NOTES = ['🎵', '🎶', '♪', '♫'];
  setInterval(() => {
    if (!FEATURES.musicNotes || !music || music.paused || music.muted || !teamBox) return;
    const n = document.createElement('div');
    n.className = 'note';
    n.textContent = pick(NOTES);
    n.style.left = rand(14, 64) + 'px';
    n.style.top = (teamBox.chY - 14) + 'px';
    n.style.setProperty('--dx', rand(-26, 26) + 'px');
    n.style.setProperty('--rot', rand(-30, 30) + 'deg');
    team.appendChild(n);
    setTimeout(() => n.remove(), 1800);
  }, 320);

  function updateMusicBtn() {
    const on = music && !music.paused;
    $('music').textContent = on ? '⏸ Music' : '▶ Music';
    $('music').setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  $('music').addEventListener('click', e => { toggleMusic(); e.currentTarget.blur(); });

  function updateMuteBtn() {
    $('mute').textContent = sfx.muted ? '🔇' : '🔊';
    if (music) music.muted = sfx.muted;
  }
  updateMuteBtn();
  $('mute').addEventListener('click', e => { sfx.init(); sfx.toggle(); updateMuteBtn(); e.currentTarget.blur(); });

  let high = 0;
  try { high = parseInt(localStorage.getItem(HS_KEY) || '0', 10) || 0; } catch (e) {}
  $('high').textContent = fmtTokens(high);

  // ---- high scores: global via the game server's /api/scores, or this browser only as a fallback ----
  const TOP_N = 5, NAME_KEY = 'agent-chariot-name', LOCAL_BOARD_KEY = 'agent-chariot-board';
  const API = 'api/scores';
  const hs = {
    online: false,
    board: [],      // [{name, score, agents, secs}]
    pending: null,  // the run waiting for a name
  };

  function cleanEntry(d) {
    if (!d) return null;
    const score = Math.floor(Number(d.score));
    if (!Number.isFinite(score) || score <= 0) return null;
    return {
      name: String(d.name || 'Anonymous hamster').slice(0, 16),
      score,
      agents: Math.max(1, Math.floor(Number(d.agents) || 1)),
      secs: Math.max(0, Number(d.secs) || 0),
    };
  }

  function loadLocalBoard() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_BOARD_KEY) || '[]').map(cleanEntry).filter(Boolean);
    } catch (e) { return []; }
  }

  async function fetchBoard() {
    if (location.protocol === 'file:') { hs.online = false; return; }
    try {
      const res = await fetch(API, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      hs.board = (await res.json()).map(cleanEntry).filter(Boolean).slice(0, TOP_N);
      hs.online = true;
    } catch (e) { hs.online = false; }
  }

  function currentBoard() { return hs.online ? hs.board : loadLocalBoard(); }

  function qualifies(score) {
    if (score <= 0 || new URLSearchParams(location.search).has('agents')) return false;
    const b = currentBoard();
    return b.length < TOP_N || score > b[TOP_N - 1].score;
  }

  function renderBoard(highlight) {
    const rows = currentBoard();
    const body = $('hsBody');
    body.textContent = '';
    rows.slice(0, TOP_N).forEach((e, i) => {
      const tr = document.createElement('tr');
      if (highlight && e.name === highlight.name && e.score === highlight.score) tr.className = 'me';
      const cells = [
        ['rank', `${i + 1}.`],
        ['nm', e.name],
        ['r', e.score.toLocaleString()],
        ['r sub', `${e.agents} agent${e.agents === 1 ? '' : 's'} · ${e.secs.toFixed(1)}s`],
      ];
      for (const [cls, text] of cells) {
        const td = document.createElement('td');
        td.className = cls;
        td.textContent = text;
        tr.appendChild(td);
      }
      body.appendChild(tr);
    });
    $('hsEmpty').classList.toggle('hidden', rows.length > 0);
    $('hsScope').textContent = hs.online
      ? 'Global board: everyone who plays on this server shares it.'
      : 'Saved in this browser only. The global board needs the game server (see README).';
  }

  let lastSaved = null;
  async function showBoard() {
    if (state === 'play') togglePause();
    renderBoard(lastSaved);
    $('hsView').classList.remove('hidden');
    await fetchBoard();
    if (boardOpen()) renderBoard(lastSaved);
  }
  function hideBoard() { $('hsView').classList.add('hidden'); }
  const boardOpen = () => !$('hsView').classList.contains('hidden');

  async function offerName(final) {
    hs.pending = null;
    $('saveStatus').classList.add('hidden');
    $('nameEntry').classList.add('hidden');
    const run = { score: final, agents: horses.length, secs: Math.round(elapsed * 10) / 10 };
    if (autopilot) {
      $('saveStatus').textContent = 'Claude played this run, so it can\'t go on the high scores.';
      $('saveStatus').classList.remove('hidden');
      return;
    }
    await fetchBoard();
    if (state !== 'over') return;
    if (!qualifies(final)) {
      const b = currentBoard();
      if (final > 0 && b.length >= TOP_N && !new URLSearchParams(location.search).has('agents')) {
        $('saveStatus').textContent = `Not on the ${hs.online ? 'global ' : ''}top ${TOP_N}: ${b[TOP_N - 1].score} tokens gets you in.`;
        $('saveStatus').classList.remove('hidden');
      }
      return;
    }
    hs.pending = run;
    $('nameMsg').textContent = hs.online ? 'You made the global high scores!' : 'You made the high scores!';
    $('nameEntry').classList.remove('hidden');
    const input = $('nameInput');
    try { input.value = localStorage.getItem(NAME_KEY) || ''; } catch (e) {}
    input.focus(); input.select();
  }

  async function saveName(e) {
    e.preventDefault();
    const run = hs.pending;
    if (!run) return;
    const name = $('nameInput').value.trim().slice(0, 16);
    if (!name) { $('nameInput').focus(); return; }
    try { localStorage.setItem(NAME_KEY, name); } catch (e) {}
    $('nameSave').disabled = true;
    const status = $('saveStatus');
    try {
      if (hs.online) {
        const res = await fetch(API, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, ...run }),
        });
        if (!res.ok) throw new Error((await res.text()) || res.status);
        hs.board = (await res.json()).map(cleanEntry).filter(Boolean).slice(0, TOP_N);
      } else {
        const b = loadLocalBoard();
        b.push({ name, ...run });
        b.sort((a, b) => b.score - a.score);
        localStorage.setItem(LOCAL_BOARD_KEY, JSON.stringify(b.slice(0, TOP_N)));
      }
      hs.pending = null;
      lastSaved = { name, score: run.score };
      $('nameEntry').classList.add('hidden');
      status.textContent = `Saved as ${name}.`;
      status.classList.remove('hidden');
      $('againBtn').focus();
    } catch (err) {
      status.textContent = 'Could not save the score. Check your connection and press Save again.';
      status.classList.remove('hidden');
    } finally {
      $('nameSave').disabled = false;
    }
  }

  $('nameForm').addEventListener('submit', saveName);
  ['hsHud', 'hsStart', 'hsOver'].forEach(id => $(id).addEventListener('click', e => { e.currentTarget.blur(); showBoard(); }));
  $('hsClose').addEventListener('click', hideBoard);
  fetchBoard();

  const keys = { up: false, down: false };
  let state = 'start'; // start | play | paused | over
  let horses = [];      // {el, ox, oy}
  let obstacles = [];   // {el, x, y, w, h, line, passed}
  let dust = [];
  let pickups = [];     // {el, x, y, w, h}
  let teamY, score, dodged, elapsed, spawnTimer, pickupTimer, agentTimer, groundX, wheelRot, lastT, teamBox, hoofTimer;

  // Agents are balloons on strings. Only the chariot can be blocked; agents float through blockers.
  // Each agent has a resting spot in rings fanned out above, behind and in front of the chariot, and is
  // pulled towards it by a springy string, with damping, a little sway, agents nudging each other apart,
  // and a shove when they brush a blocker. Positions are simulated in world space, so the bunch lags
  // and bounces when the chariot moves.
  const ANCHOR_X = 52, ANCHOR_Y = 44; // where the strings meet: the front of the rider, in team coordinates
  const BALLOON = { k: 34, damping: 5.5, sway: 14, push: 260, bump: 240 };
  function balloonSpot(i) {
    let ring = 0, first = 0;
    while (i >= first + 5 + 3 * ring) { first += 5 + 3 * ring; ring++; }
    const inRing = Math.min(5 + 3 * ring, Math.max(1, horses.length - first));
    const j = i - first, r = 78 + 46 * ring;
    const a = (-190 + 200 * (j + 0.5) / inRing) * Math.PI / 180; // from behind-and-low, over the top, to in front
    return { x: ANCHOR_X + Math.cos(a) * r * 1.15, y: ANCHOR_Y + Math.sin(a) * r };
  }

  function layoutTeam(newIndex) {
    teamBox = { w: CHARIOT_W, h: CHARIOT_H, chY: 0 };
    chariot.style.left = '0px';
    chariot.style.top = '0px';
    horses.forEach((h, i) => {
      h.rest = balloonSpot(i);
      if (h.wx === undefined) {
        // the first agents start in place; agents that join mid-run float up out of the chariot
        const from = h.fromAnchor ? { x: ANCHOR_X, y: ANCHOR_Y } : h.rest;
        h.wx = TEAM_X + from.x; h.wy = (teamY ?? 0) + from.y; h.vx = 0; h.vy = h.fromAnchor ? -120 : 0;
        h.line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        h.line.setAttribute('stroke', '#2b1d14'); h.line.setAttribute('stroke-width', '1.5');
        h.line.setAttribute('stroke-linecap', 'round'); h.line.setAttribute('opacity', '.3');
        reins.appendChild(h.line);
      }
      if (i === newIndex) { h.el.classList.remove('new'); void h.el.offsetWidth; h.el.classList.add('new'); }
    });
    drawBalloons();
  }

  function updateBalloons(dt) {
    const ax = TEAM_X + ANCHOR_X, ay = teamY + ANCHOR_Y;
    for (const h of horses) {
      h.phase += dt * 2.2;
      // resting spot; if it would be off the field (chariot near an edge) use its mirror image instead
      let dx = h.rest.x - ANCHOR_X, dy = h.rest.y - ANCHOR_Y;
      if (ay + dy < 40 + HORSE / 2 || ay + dy > H - HORSE / 2) dy = -dy;
      if (ax + dx < HORSE / 2) dx = -dx;
      let fx = BALLOON.k * (ax + dx - h.wx) - BALLOON.damping * h.vx + Math.sin(h.phase) * BALLOON.sway;
      let fy = BALLOON.k * (ay + dy - h.wy) - BALLOON.damping * h.vy + Math.cos(h.phase * 0.8) * BALLOON.sway * 0.5;
      for (const o of horses) { // keep a little personal space
        if (o === h) continue;
        const dx = h.wx - o.wx, dy = h.wy - o.wy, d = Math.hypot(dx, dy);
        if (d > 0 && d < HORSE) { fx += dx / d * BALLOON.push * (1 - d / HORSE) * 4; fy += dy / d * BALLOON.push * (1 - d / HORSE) * 4; }
      }
      h.vx += fx * dt; h.vy += fy * dt;
      for (const b of obstacles) { // brushing a blocker knocks the balloon aside, nothing more
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        if (Math.abs(h.wx - cx) < (b.w + HORSE) / 2 - 6 && Math.abs(h.wy - cy) < (b.h + HORSE) / 2 - 6) {
          const dx = h.wx - cx, dy = h.wy - cy, d = Math.hypot(dx, dy) || 1;
          h.vx += dx / d * BALLOON.bump * dt * 10; h.vy += dy / d * BALLOON.bump * dt * 10;
        }
      }
      h.wx = clamp(h.wx + h.vx * dt, HORSE / 2, W - HORSE / 2);
      h.wy = clamp(h.wy + h.vy * dt, 40 + HORSE / 2, H - HORSE / 2);
    }
    drawBalloons();
  }

  function drawBalloons() {
    for (const h of horses) {
      h.ox = h.wx - TEAM_X - HORSE / 2; // team coordinates, which code bits and coins use
      h.oy = h.wy - (teamY ?? 0) - HORSE / 2;
      h.el.style.left = h.ox + 'px';
      h.el.style.top = h.oy + 'px';
      h.el.style.transform = `rotate(${clamp((h.vx || 0) * 0.08, -20, 20)}deg)`;
      // the string stops at the edge of the logo
      const cx = h.ox + HORSE / 2, cy = h.oy + HORSE / 2, dx = cx - ANCHOR_X, dy = cy - ANCHOR_Y;
      const len = Math.hypot(dx, dy) || 1, k = Math.max(0, (len - 20) / len);
      h.line.setAttribute('x1', ANCHOR_X); h.line.setAttribute('y1', ANCHOR_Y);
      h.line.setAttribute('x2', ANCHOR_X + dx * k); h.line.setAttribute('y2', ANCHOR_Y + dy * k);
    }
  }

  // Who rides the chariot: the hamster, unless you pick someone else with the character button
  // (the pick lasts for this visit; every visit starts with the hamster).
  // Agents always show their own model logo.
  const CHARACTERS = ['hamster', 'parrot', 'ai', 'fine', 'wizard'];
  const CHARACTER_NAMES = { hamster: 'Hamster', parrot: 'Ship-it parrot', ai: 'AI', fine: 'This is fine', wizard: 'Wizard Claude' };
  let character = 'hamster', aiRider = FIRST_AGENT, aiNext = pick(AGENT_ICONS); // aiNext: the logo AI will use next time
  const CHARACTER_ICONS = { hamster: 'assets/hamster-whip.gif', parrot: 'assets/shipitparrot.gif', fine: 'assets/thisisfine.gif', wizard: 'assets/agents/claude.png' };
  function setPuller(h) { h.el.innerHTML = `<img src="${h.icon}" alt="">`; }
  function applyCharacter() {
    const rider = $('rider');
    const hamster = character === 'hamster';
    $('hamster').classList.toggle('hidden', !hamster);
    rider.classList.toggle('hidden', hamster);
    $('whip').classList.toggle('hidden', hamster || !FEATURES.whip); // the hamster's GIF has its own whip
    rider.innerHTML = character === 'parrot' ? '<img class="parrot" src="assets/shipitparrot.gif" alt="">'
      : character === 'ai' ? `<img class="ai" src="${aiRider}" alt="">`
      : character === 'fine' ? '<img class="fine" src="assets/thisisfine.gif" alt="">'
      : character === 'wizard' ? '<div class="wiz"><span class="brim"></span><span class="hat"></span><img src="assets/agents/claude.png" alt=""></div>' : '';
  }
  function nextCharacter() {
    character = CHARACTERS[(CHARACTERS.indexOf(character) + 1) % CHARACTERS.length];
    if (character === 'ai') { aiRider = aiNext; aiNext = pick(AGENT_ICONS); } // a different model each time you land on AI
    applyCharacter();
    const driver = { hamster: 'the hamster', parrot: 'the ship-it parrot', ai: 'the AI', fine: 'the This is fine dog', wizard: 'Wizard Claude' }[character];
    say(`Great choice! I've put ${driver} in charge of driving. I would have chosen differently 😊`, `Character: ${CHARACTER_NAMES[character]}`, null, character === 'ai' ? aiRider : CHARACTER_ICONS[character]);
  }
  if (character === 'ai') { aiRider = aiNext; aiNext = pick(AGENT_ICONS); }
  applyCharacter();

  function addAgent(announce) {
    if (horses.length >= MAX_AGENTS) return;
    const el = document.createElement('div');
    el.className = 'horse';
    team.appendChild(el);
    const h = { el, icon: horses.length ? nextIcon() : FIRST_AGENT, codeTimer: rand(0.2, 1.4), ox: 0, oy: 0, phase: Math.random() * Math.PI * 2 };
    h.fromAnchor = announce;
    horses.push(h);
    setPuller(h);
    layoutTeam(horses.length - 1);
    $('agents').textContent = horses.length;
    if (announce) {
      const n = horses.length;
      say(pick(SPAWN_TOASTS)(n), `Agent #${n} joined`, null, h.icon);
      sfx.spawn();
      // keep the expanded team inside the field
      teamY = clamp(teamY, FIELD_TOP, FIELD_BOTTOM - teamBox.h);
    }
  }

  // Two kinds of toast: the bot talking, and plain game updates. With botToasts on, the bot's line is
  // shown; with it off, the plain update is (if gameToasts is on). Pass null for either to skip it.
  function say(bot, game, after, icon) {
    const text = FEATURES.botToasts && bot ? bot : FEATURES.gameToasts && game ? game : null;
    if (text) toast(text, FEATURES.botToasts && bot ? after : null, icon);
  }

  function toast(text, after, icon = pick(AGENT_ICONS)) {
    // the agents' signature 😊 only shows up some of the time
    if (text.endsWith(' 😊') && Math.random() > 0.35) {
      text = text.slice(0, -3);
      if (!/[.!?…]$/.test(text)) text += '.';
    }
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<img src="${icon}" alt=""><span></span>`;
    t.querySelector('span').textContent = text;
    if (after) { const img = document.createElement('img'); img.className = 'after'; img.src = after; img.alt = ''; t.appendChild(img); }
    toasts.appendChild(t);
    setTimeout(() => t.remove(), 3100);
    while (toasts.children.length > 4) toasts.firstChild.remove();
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  function speed() { return Math.min(540, 250 + elapsed * 2.6); }

  function makeHuman(x, y, loud) {
    const el = document.createElement('div');
    el.className = 'human ent';
    const block = document.createElement('div');
    block.className = 'block';
    const kind = Math.floor(Math.random() * BLOCKERS.length), b = BLOCKERS[kind]();
    block.dataset.kind = kind; // picks its shade of green in matrix mode
    block.style.background = b.color;
    const e = document.createElement('span'); e.className = 'e'; e.textContent = b.e;
    block.title = b.why; // the kind and number still name the blocker on the game-over screen
    block.append(e);
    el.appendChild(block);
    stage.appendChild(el);
    const o = { el, x, y, w: BLOCK, h: BLOCK, loud, why: b.why, passed: false };
    place(o);
    obstacles.push(o);
    return o;
  }

  // The whip cracks faster every 10 blockers dodged: assets/speed/ holds copies of the GIFs
  // with shorter frame delays (level n plays at 1 + n/4 speed, up to 3x at level 8).
  const WHIP_LEVELS = 8;
  let whipLevel = 0;
  function whipSrc(name, lvl) { return lvl ? `assets/speed/${name}-${lvl}.gif` : `assets/${name}.gif`; }
  function setWhipSpeed(lvl) {
    lvl = Math.min(WHIP_LEVELS, lvl);
    if (lvl === whipLevel) return;
    whipLevel = lvl;
    $('hamster').src = whipSrc('hamster-whip', lvl);
    $('whip').src = whipSrc('whip', lvl);
    if (lvl < WHIP_LEVELS) ['hamster-whip', 'whip'].forEach(n => { new Image().src = whipSrc(n, lvl + 1); }); // warm the next one
  }

  // snippets in four languages, lightly syntax-highlighted (see highlight below)
  // Which languages the agents write. Python and PHP are switched off for now; turn them on here,
  // or for one visit with ?code=go,ruby,python (any of go, ruby, js, vue, python, php).
  const CODE_LANGUAGES = { go: true, ruby: true, js: true, vue: true, python: false, php: false };
  // real lines from gitlab-org/gitlab-runner (Go) and gitlab-org/gitlab (Ruby, JS, Vue), both MIT,
  // plus psf/requests and pallets/flask (Python) and laravel/framework and symfony/symfony (PHP)
  const CODE_BITS = {
    go: [
      "if err == nil && b.Synthetic {",
      "b.warnTimeoutExceeded(ctx, \"Job\")",
      "return b.ExecutorFeatures.Shared",
      "Key:      tls.VariableCertFile,",
      "Stage:      buildStage,",
      "allVariables := b.GetAllVariables()",
      "jobData spec.Job,",
      "Predefined: getPredefinedEnv(buildStage),",
      "dir, err := b.ProjectSlug()",
      "ExtraHosts:    extraHosts,",
      "PidMode:       pidMode,",
      "if !useDockerAutoscalerDialStdio {",
      "hostname = c.e.Build.ProjectUniqueName()",
      "Labels: labels,",
      "device.PathInContainer = device.PathOnHost",
      "ProxyExec:     e.Config.IsProxyExec(),",
      "if port.Proto() == \"tcp\" {",
      "if !e.Config.Docker.IsUserAllowed(user) {",
      "WithFields(runnerFields).",
      "mr.runnerWorkersFeedFailures.Collect(ch)",
      "close(mr.runFinished)",
      "for _, warning := range warnings {",
      "options := []logrotate.Option{",
      "now:       time.Now,",
      "mr.servePprof(mux)",
      "WithLabelValues(",
      "mr.sentryLogHookMutex.Unlock()",
      "return query.Encode()",
      "log.Info(\"Updating job...\")",
      "_, err := io.Copy(file, body)",
      "features.JobInputs = true",
      "_ = res.Body.Close()",
      "return common.DownloadNotFound, true",
      "cli, err := n.getClient(config)",
      "headers http.Header,",
      "n.apiRequestsCollector,",
    ],
    ruby: [
      "cleanup_refs(only: only)",
      "validates :target_branch, presence: true",
      "associations: {",
      "if issue_ids_to_update.any?",
      "with_single_transaction_merge_data_sync(",
      "def clear_merge_params(param_keys)",
      "[target_branch, merge_request_diff.id]",
      "def default_squash_commit_message(user: nil)",
      "new_title = title.sub(DRAFT_REGEX, \"\")",
      "@options = options",
      "@merge_request.source_branch_sha,",
      "jid = merge_jid",
      "@logger ||= Gitlab::AppLogger",
      "log_info(\"Merge request marked in progress\")",
      "return if merge_request.merged?",
      "exclusive_lease(merge_request).cancel",
      "logger.info(**payload)",
      "include Gitlab::Utils::StrongMemoize",
      "merge_request: merge_request,",
      "where_not_exists(",
      "def stage(name)",
      "note[:commit_id] = sha",
      "return none if ref_sha_pairs.blank?",
      "next if pipeline.child?",
      "foreign_key: [:pipeline_id, :partition_id],",
      "def self.latest_successful_ids_per_project",
      "def build_test_report_summary(build_ids)",
    ],
    js: [
      "commit(id, sha, params = {}) {",
      "const url = Api.buildUrl(this.releasePath)",
      ".replace(':project_path', projectPath)",
      "return axios.post(url, freezePeriod);",
      "deployKeys(params = {}) {",
      "return Api.buildUrl(path)",
      "projectProtectedBranch(id, branchName) {",
      "groupLabels(namespace, options = {}) {",
      "params: { ...defaults, ...options },",
      "e.preventDefault();",
      "let hash = getLocationHash();",
      "acc[prop] = val;",
      "const field = $(fieldSelector);",
      "if (handledRange) {",
      "fn(next, stop);",
      "const next = () => {",
      "return path === DEFAULT_CI_CONFIG_PATH;",
      "elementRect.top < containerRect.top ||",
    ],
    vue: [
      "<loading v-else />",
      "v-if=\"shouldRenderPipelines\"",
      "<mr-widget-auto-merge-enabled",
      ":merge-checks-state=\"mergeChecksState\"",
      "<template v-if=\"hasAlerts\">",
      ":service=\"service\"",
      "<span>{{ mergeError }}</span>",
      "<template #link-content>",
      "<mr-widget-alert-message",
      "v-if=\"autoMergeEnabled\"",
      "<mr-widget-pipeline-container",
      "</mr-widget-alert-message>",
      "v-if=\"showMergePipelineForkWarning\"",
      "<div class=\"mr-section-container\">",
      "v-if=\"shouldRenderMergedPipeline\"",
      "<widget-container :mr=\"mr\" />",
      "v-if=\"hasMergeError\"",
    ],
    python: [
      "if ctx is not None:",
      "static_folder=static_folder,",
      "if handler is None:",
      "if propagate is None:",
      "orig_ctx = context.copy()",
      "cls.dispatch_request,",
      "client = app.test_client()",
      "super().__init__(",
      "if request is not None:",
      "if isinstance(rv, tuple):",
      "response = self.make_response(rv)",
      "request.environ,",
      "self.adapters = OrderedDict()",
      "and new_parsed.port in (443, None)",
      "if len(resp.history) >= self.max_redirects:",
      "for header in purged_headers:",
      "auth: _t.AuthType = None,",
      "allow_redirects=False,",
      "kwargs.setdefault(\"verify\", self.verify)",
      "self.cert = None",
      "start = preferred_clock()",
      "proxies: dict[str, str]",
      "preferred_clock = time.perf_counter",
    ],
    php: [
      "public function getCurrentRoute()",
      "public function pattern($key, $pattern)",
      "$this->updateGroupStack($attributes);",
      "$excluded = $excluded === []",
      "return $this->prepareResponse($request,",
      "$result[] = $value;",
      "$response->setNotModified();",
      "$reflection = new ReflectionClass($name);",
      "->through($middleware)",
      "if (! isset($seen[$key])) {",
      "$middleware = (new Collection($middleware))",
      "public function put($uri, $action = null)",
      "protected function findRoute($request)",
      "$this->wantHelps = $wantHelps;",
      "if (!isset($this->commands[$name])) {",
      "public function getNamespaces(): array",
      "$input->setInteractive(false);",
      "foreach ($commandSignals as $signal) {",
      "$line = $trace[$i]['line'] ?? 'n/a';",
      "if ($this->dispatcher) {",
      "$output ??= new ConsoleOutput();",
      "exit($exitCode);",
      "$abbrev = substr($name, 0, $len);",
      "if ('UNKNOWN' !== $this->getVersion()) {",
      "$command->setApplication($this);",
      "$type = $trace[$i]['type'] ?? '';",
    ],
  };
  const KEYWORDS = Object.fromEntries(Object.entries({
    go: 'func if else for range return nil go defer select case type struct var const true false',
    ruby: 'def end if unless return next nil true false self include do class module none',
    js: 'const let return function if else new this await async',
    vue: 'v-if v-else',
    python: 'def if is not None for in return and or self cls super isinstance len True False import from',
    php: 'public protected function return new if foreach as exit isset array null true false',
  }).map(([lang, words]) => [lang, new Set(words.split(' '))]));
  const TOKEN = /(\/\/.*)|("[^"]*"|'[^']*')|(<\/?[a-zA-Z][\w-]*|\/?>)|(@\w+|:[a-z_][\w-]*|\$\w+)|(\b\d+\b)|([A-Za-z_][\w-]*)/g;
  function highlight(el, code, lang) {
    let last = 0;
    for (const m of code.matchAll(TOKEN)) {
      if (m.index > last) el.append(code.slice(last, m.index));
      const cls = m[1] ? 'c-com' : m[2] ? 'c-str' : m[3] ? 'c-tag' : m[4] ? 'c-var' : m[5] ? 'c-num'
        : KEYWORDS[lang].has(m[6]) ? 'c-kw' : null;
      if (cls) { const t = document.createElement('span'); t.className = cls; t.textContent = m[0]; el.append(t); }
      else el.append(m[0]);
      last = m.index + m[0].length;
    }
    el.append(code.slice(last));
  }
  const codeLangs = (() => {
    const fromUrl = new URLSearchParams(location.search).get('code');
    const want = fromUrl ? fromUrl.split(',').map(l => l.trim()) : Object.keys(CODE_LANGUAGES).filter(l => CODE_LANGUAGES[l]);
    const ok = want.filter(l => CODE_BITS[l]);
    return ok.length ? ok : ['go'];
  })();
  function spawnCode(h) {
    const c = document.createElement('div');
    const lang = pick(codeLangs);
    c.className = `code lang-${lang}`;
    highlight(c, pick(CODE_BITS[lang]), lang);
    c.style.left = (h.ox + rand(-14, 20)) + 'px';
    c.style.top = (h.oy + rand(-10, 18)) + 'px';
    c.style.setProperty('--dx', rand(-12, 12) + 'px');
    team.appendChild(c);
    setTimeout(() => c.remove(), 1600);
  }

  // Every LGTM doubles how fast tokens burn (time, dodges and coins), up to x1024.
  const MAX_MULT = 1024;
  let mult = 1;
  function fmtTokens(n) {
    n = Math.floor(n);
    if (n < 1e6) return String(n);
    const [d, u] = n < 1e9 ? [1e6, 'M'] : n < 1e12 ? [1e9, 'B'] : [1e12, 'T'];
    return (n / d).toFixed(n / d < 100 ? 1 : 0) + u;
  }

  let lgtmTimers = [];
  // Tadas and parrots burst out of the LGTM banner, then fall, spin and bounce off the edges and the
  // ground, losing a little energy each bounce, and fade out after about three seconds.
  const PARTY = { count: 36, gravity: 900, bounce: 0.62, friction: 0.985, life: 3.2 };
  let partyBits = [], partyLast = 0;
  // every 100 blockers, white check marks and Slack's purple :merged: join in
  // In matrix mode the confetti is matrix stuff instead: kanji, 2x2 and 3x3 matrices, hex and symbols.
  const MATH = [...'∑λ∇∞≠⊕∂π∫√≈⊗∀∃⊥∈∉∅Ω∆μσφψ'];
  function matrixPiece(el) {
    const r = Math.random();
    if (r < 0.35) { el.classList.add('kanji'); el.textContent = randomKanji(); }
    else if (r < 0.65) {
      const n = Math.random() < 0.5 ? 2 : 3;
      el.textContent = Array.from({ length: n }, () => '[' + Array.from({ length: n }, () => Math.random() < 0.5 ? '0' : '1').join(' ') + ']').join('\n');
    } else if (r < 0.85) el.textContent = '0x' + Math.floor(Math.random() * 0xffffffff).toString(16).toUpperCase().padStart(8, '0');
    else { el.classList.add('math'); el.textContent = pick(MATH); }
  }

  function freeSpot(w, h) {
    const pad = 8, banner = { x: W / 2 - 230, y: 40, w: 460, h: 110 };
    for (let tries = 0; tries < 80; tries++) {
      const r = { x: rand(10, W - w - 10), y: rand(FIELD_TOP - 50, FIELD_BOTTOM - h), w, h };
      const hits = q => r.x < q.x + q.w + pad && r.x + r.w + pad > q.x && r.y < q.y + q.h + pad && r.y + r.h + pad > q.y;
      if (!hits(banner) && !partyBits.some(hits)) return r;
    }
    return null;
  }
  const celebrating = () => partyBits.length > 0;

  function party(checks = false) {
    const matrixy = stage.classList.contains('matrix');
    const kinds = checks ? ['parrot', '🎉', '✅', 'merged'] : ['parrot', '🎉'];
    for (let i = 0; i < PARTY.count; i++) {
      const el = document.createElement('div');
      el.className = 'party';
      const kind = kinds[i % kinds.length];
      if (matrixy) { el.classList.add('glyph'); matrixPiece(el); }
      else if (kind === 'parrot') el.innerHTML = '<img src="assets/shipitparrot.gif" alt="">';
      else if (kind === 'merged') el.innerHTML = '<img class="merged" src="assets/merged.png" alt="">';
      else el.textContent = kind;
      if (!matrixy && kind === '✅') el.style.fontSize = '46px'; // the 100s check marks stand out
      stage.appendChild(el);
      const a = rand(-Math.PI * 0.95, -Math.PI * 0.05), sp = rand(380, 820); // fan out upwards from the banner
      // measure text pieces so the wide ones (matrices, errors) bounce off the edges properly
      const w = matrixy ? el.offsetWidth : 48, h = matrixy ? el.offsetHeight : 40;
      if (matrixy) {
        // matrix pieces don't fly: they appear in a free spot (not on another piece or the banner), hold, and fade
        const spot = freeSpot(w, h);
        if (!spot) { el.remove(); continue; } // no room left: leave it out rather than pile it on
        partyBits.push({ el, still: true, x: spot.x, y: spot.y, vx: 0, vy: 0, rot: 0, vr: 0, age: -rand(0, 0.6), w, h });
      } else {
        partyBits.push({ el, x: W / 2 + rand(-160, 160) - w / 2, y: 90, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                         rot: rand(-30, 30), vr: rand(-540, 540), age: -rand(0, 0.35), w, h });
      }
    }
    // start the animation loop unless a party is already running
    if (partyBits.length === PARTY.count) { partyLast = performance.now(); requestAnimationFrame(partyStep); }
  }
  function partyStep(now) {
    const dt = Math.min(0.05, (now - partyLast) / 1000);
    partyLast = now;
    for (let i = partyBits.length - 1; i >= 0; i--) {
      const b = partyBits[i];
      b.age += dt;
      if (b.age < 0) { b.el.style.opacity = 0; continue; } // staggered launch
      if (b.still) {
        b.el.style.opacity = Math.max(0, Math.min(1, b.age / 0.25, (PARTY.life - b.age) / 0.6));
        b.el.style.transform = `translate(${b.x}px, ${b.y}px)`;
        if (b.age > PARTY.life) { b.el.remove(); partyBits.splice(i, 1); }
        continue;
      }
      b.vy += PARTY.gravity * dt;
      b.vx *= PARTY.friction; b.vr *= PARTY.friction;
      b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt;
      if (b.x < 0) { b.x = 0; b.vx = -b.vx * PARTY.bounce; }
      if (b.x > W - b.w) { b.x = W - b.w; b.vx = -b.vx * PARTY.bounce; }
      if (b.y < 44) { b.y = 44; b.vy = -b.vy * PARTY.bounce; }
      if (b.y > H - b.h) { b.y = H - b.h; b.vy = -b.vy * PARTY.bounce; b.vr *= 0.7; }
      for (const o of partyBits) { // pieces bump off each other instead of piling up
        if (o === b || o.still || o.age < 0) continue;
        const dx = (b.x + b.w / 2) - (o.x + o.w / 2), dy = (b.y + b.h / 2) - (o.y + o.h / 2);
        const minD = (Math.min(b.w, b.h) + Math.min(o.w, o.h)) / 2, d = Math.hypot(dx, dy) || 0.01;
        if (d < minD) {
          const push = (minD - d) / 2, nx = dx / d, ny = dy / d;
          b.x += nx * push; b.y += ny * push; o.x -= nx * push; o.y -= ny * push;
          const rel = (b.vx - o.vx) * nx + (b.vy - o.vy) * ny;
          if (rel < 0) { const j = -rel * (1 + PARTY.bounce) / 2; b.vx += j * nx; b.vy += j * ny; o.vx -= j * nx; o.vy -= j * ny; }
        }
      }
      const fade = Math.min(1, b.age / 0.15, (PARTY.life - b.age) / 0.5);
      b.el.style.opacity = Math.max(0, fade);
      b.el.style.transform = `translate(${b.x}px, ${b.y}px) rotate(${b.rot}deg)`;
      if (b.age > PARTY.life) { b.el.remove(); partyBits.splice(i, 1); }
    }
    if (partyBits.length) requestAnimationFrame(partyStep);
  }
  function lgtm(mega = false, checks = false) {
    if (mult < MAX_MULT) {
      mult *= 2;
      $('mult').textContent = '×' + mult;
      say(`LGTM! I'm burning tokens ×${mult} faster now. You approved this, remember? 😊`, `${dodged} blocker${dodged === 1 ? '' : 's'} dodged · token burn rate ×${mult}`);
    }
    if (theme === 'gitlab' && matrixT < 0) { lgtmPipeline(mega, checks); return; }
    const el = $('lgtm');
    lgtmTimers.forEach(clearTimeout);
    $('lgtmPipe').className = '';
    el.textContent = ''; el.classList.remove('out');
    el.classList.toggle('mega', mega);
    if (mega) party(checks);
    // every letter is laid out (hidden) up front, so revealing one never shifts the ones already shown
    // the last mark is the rocket half the time, Slack's round purple :merged: the other half
    const spans = ['L', 'G', 'T', 'M', '!', Math.random() < 0.5 ? '🚀' : 'merged'].map(ch => {
      const span = document.createElement('span');
      if (ch === 'merged') span.innerHTML = '<img class="merged-mark" src="assets/merged-circle.png" alt="merged">';
      else span.textContent = ch;
      el.appendChild(span);
      return span;
    });
    lgtmTimers = spans.map((span, i) => setTimeout(() => { span.classList.add('on'); sfx.lgtm(i); }, i * 140));
    lgtmTimers.push(setTimeout(() => el.classList.add('out'), mega ? 2800 : 1700));
    lgtmTimers.push(setTimeout(() => { el.textContent = ''; }, mega ? 3250 : 2150));
  }

  // the GitLab theme's LGTM: a deployment pipeline whose stage initials spell it out
  const LGTM_STAGES = [['L', 'int'], ['G', 'enerate'], ['T', 'est'], ['M', 'erge'], ['!', ' Deploy']];
  function lgtmPipeline(mega, checks) {
    const el = $('lgtmPipe');
    lgtmTimers.forEach(clearTimeout);
    $('lgtm').textContent = '';
    if (mega) party(checks);
    el.innerHTML = `<div class="lp-title">Pipeline <b>#${Math.floor(rand(100000, 999999))}</b> · <code>main</code> · triggered by an agent</div>` +
      '<div class="lp-stages">' + LGTM_STAGES.map(([c, rest]) =>
        `<div class="lp-stage"><div class="lp-dot">${c}</div><div class="lp-name"><b>${c}</b>${rest}</div></div>`).join('') + '</div>' +
      '<div class="lp-done"><span class="lp-badge">✓ passed</span> Deployed to <b>production</b> · LGTM</div>';
    el.className = 'on' + (mega ? ' mega' : '');
    const stages = el.querySelectorAll('.lp-stage');
    lgtmTimers = [];
    stages.forEach((st, i) => {
      lgtmTimers.push(setTimeout(() => st.classList.add('running'), i * 260));
      lgtmTimers.push(setTimeout(() => { st.classList.remove('running'); st.classList.add('passed'); st.querySelector('.lp-dot').textContent = '✓'; sfx.lgtm(i); }, i * 260 + 240));
    });
    const end = stages.length * 260;
    lgtmTimers.push(setTimeout(() => el.querySelector('.lp-done').classList.add('on'), end));
    lgtmTimers.push(setTimeout(() => el.classList.add('out'), end + (mega ? 1900 : 1300)));
    lgtmTimers.push(setTimeout(() => { el.className = ''; }, end + (mega ? 2300 : 1700)));
  }

  // ---- every 250 blockers: 10 seconds of matrix mode ----
  // Code rain made of real code, lines typing themselves out, and a GitLab-style pipeline in the
  // background running all the way to "Deployed to production". Driven by game time, so pause pauses it.
  const MATRIX_SECS = 10;
  const PIPELINE = [['Build', 0, 1.8], ['Test', 1.8, 4.2], ['Security', 4.2, 6.0], ['Review', 6.0, 7.2], ['Deploy to production', 7.2, 9.0]];
  let matrixT = -1, typers = [], typeTimer = 0;
  // ---- the scene engine: a theme is a sky, strips that scroll at their own speed (for depth), and decorations ----
  // Strips are small inline SVGs (shapes and emoji) tiled sideways; speed 1 moves with the road.
  const svgUrl = (w, h, body) =>
    `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${body}</svg>`)}")`;
  const emo = (items, op = 0.5) => items.map(([e, x, y, size]) => `<text x='${x}' y='${y}' font-size='${size}' opacity='${op}'>${e}</text>`).join('');
  const dots = (n, w, h, r, fill) => Array.from({ length: n }, (_, i) =>
    `<circle cx='${(i * 97) % w}' cy='${(i * 53) % h}' r='${r * (0.5 + ((i * 31) % 10) / 10)}' fill='${fill}'/>`).join('');
  const towers = (n, w, h, fill, win) => Array.from({ length: n }, (_, i) => {
    const bw = 30 + (i * 37) % 40, bh = 30 + (i * 53) % (h - 30), x = (i * w / n) | 0;
    let wins = '';
    for (let y = h - bh + 6; y < h - 6; y += 10) for (let xx = x + 5; xx < x + bw - 5; xx += 9) if ((xx * 7 + y * 3) % 5 < 2) wins += `<rect x='${xx}' y='${y}' width='4' height='5' fill='${pick(win)}'/>`;
    return `<rect x='${x}' y='${h - bh}' width='${bw}' height='${bh}' fill='${fill}'/>${wins}`;
  }).join('');
  const SCENES = {
    desert: {
      sky: 'linear-gradient(#ff8f5a 0%, #ffb877 8%, #ffe0a6 17%, #ecc285 18.6%, #ddb072 60%, #d3a466 100%)',
      decor: '<div class="deco sc-sun"></div>',
      layers: [
        { top: 40, h: 68, w: 640, speed: 0.06, body: `<path d='M0 68 V42 H70 L84 22 H170 L186 44 H250 V68 Z M330 68 V30 H380 L394 12 H470 L488 36 H560 V68 Z' fill='#b9653f' opacity='.55'/>` },
        { top: 74, h: 34, w: 520, speed: 0.2, body: `<path d='M0 34 Q130 0 260 18 T520 12 V34 Z' fill='#e9a95f'/>` },
        { top: 104, h: 436, w: 760, speed: 1, body: emo([['🌵', 40, 90, 34], ['🪨', 300, 260, 22], ['🌵', 520, 360, 40], ['🦴', 210, 420, 16], ['🌵', 660, 180, 28], ['🪨', 120, 330, 16], ['🌾', 420, 120, 20]], 0.45) },
        { top: 316, h: 8, w: 220, speed: 1, body: `<rect x='0' y='2' width='60' height='4' rx='2' fill='#fff' opacity='.3'/>` },
      ],
    },
    medieval: {
      dark: true,
      sky: 'linear-gradient(#10153a 0%, #262b66 11%, #4a3f7a 17.5%, #5c554c 18.6%, #4c453d 100%)',
      decor: '<div class="deco sc-moon"></div><div class="sc-fly" style="top:52px;font-size:38px;animation-duration:17s">🐉</div>' +
             '<div class="sc-fly" style="top:150px;font-size:28px;animation-duration:26s;animation-delay:-11s">🧙</div>',
      layers: [
        { top: 0, h: 70, w: 420, speed: 0.02, body: dots(16, 420, 70, 1.4, '#fff') },
        { top: 28, h: 80, w: 760, speed: 0.08, body: `<g fill='#0d1130'><rect x='40' y='34' width='110' height='46'/><rect x='28' y='14' width='30' height='66'/><rect x='132' y='14' width='30' height='66'/>
          <rect x='28' y='8' width='8' height='8'/><rect x='42' y='8' width='8' height='8'/><rect x='132' y='8' width='8' height='8'/><rect x='146' y='8' width='8' height='8'/>
          <rect x='86' y='22' width='16' height='58'/><path d='M80 22 L94 0 L108 22 Z'/>
          <rect x='420' y='40' width='150' height='40'/><rect x='404' y='18' width='26' height='62'/><rect x='560' y='24' width='26' height='56'/><path d='M398 18 L417 -4 L436 18 Z M554 24 L573 2 L592 24 Z'/></g>
          <g fill='#ffd36b'><rect x='40' y='30' width='5' height='8'/><rect x='140' y='30' width='5' height='8'/><rect x='92' y='34' width='5' height='8'/><rect x='470' y='52' width='5' height='8'/><rect x='520' y='52' width='5' height='8'/></g>` },
        { top: 104, h: 436, w: 120, th: 60, tile: true, speed: 1, body: `<rect width='120' height='60' fill='#544c43'/><g fill='#655c51' stroke='#3f3832' stroke-width='2'>
          <rect x='2' y='2' width='54' height='26' rx='8'/><rect x='60' y='2' width='58' height='26' rx='8'/><rect x='-28' y='32' width='56' height='26' rx='8'/>
          <rect x='32' y='32' width='56' height='26' rx='8'/><rect x='92' y='32' width='56' height='26' rx='8'/></g>` },
        { top: 104, h: 436, w: 820, speed: 1, body: emo([['🕯️', 60, 80, 22], ['🛡️', 330, 300, 24], ['📜', 560, 140, 22], ['🍄', 200, 400, 20], ['🧙', 720, 340, 30], ['🪵', 450, 420, 22]], 0.4) },
      ],
    },
    runescape: {
      sky: 'linear-gradient(#78c2f2 0%, #b7e3fb 17%, #5e9b3a 18.6%, #4f8a30 100%)',
      decor: '<div class="deco sc-xp">+15 Dodging XP</div><div class="deco sc-minimap"></div>',
      layers: [
        { top: 44, h: 64, w: 520, speed: 0.18, body: emo([['🌲', 10, 58, 44], ['🌳', 70, 60, 40], ['🌲', 150, 58, 48], ['🌳', 260, 60, 38], ['🌲', 330, 58, 44], ['🌳', 430, 60, 42]], 0.9) },
        { top: 104, h: 436, w: 300, th: 200, tile: true, speed: 1, body: `<g fill='#3f7a24' opacity='.55'><ellipse cx='60' cy='40' rx='40' ry='12'/><ellipse cx='220' cy='130' rx='50' ry='14'/><ellipse cx='120' cy='175' rx='30' ry='9'/></g>` +
          emo([['🌼', 250, 40, 14], ['🌼', 30, 150, 12]], 0.7) },
      ],
    },
    aoe: {
      sky: 'linear-gradient(#a6d3f0 0%, #d7edf9 16%, #7ea548 18.6%, #6b9238 100%)',
      decor: '<div class="deco sc-aoe-bar"><span>🍖 200</span><span>🪵 200</span><span>🪙 100</span><span>🪨 200</span><span>👥 3/5</span><span class="age">Agent Age</span></div>',
      layers: [
        { top: 40, h: 68, w: 600, speed: 0.14, body: `<path d='M0 68 Q150 10 300 40 T600 30 V68 Z' fill='#6f9a3c'/>` + emo([['🌳', 60, 50, 30], ['🌳', 90, 56, 26], ['🌲', 380, 50, 30], ['🌳', 420, 54, 28]], 0.95) },
        { top: 104, h: 436, w: 160, th: 160, tile: true, speed: 1, body: `<g stroke='#5d8530' stroke-width='2' opacity='.5'><path d='M20 30 l4 -8 M80 100 l4 -8 M130 50 l4 -8 M50 140 l4 -8'/></g>` },
        { top: 104, h: 400, w: 900, speed: 1, body: emo([['🛖', 80, 90, 40], ['🐑', 340, 250, 26], ['🧑‍🌾', 520, 120, 26], ['🌳', 700, 330, 36], ['🫐', 240, 380, 20], ['🪨', 820, 160, 22], ['🐑', 600, 360, 24]], 0.5) },
      ],
    },
    scifi: {
      dark: true,
      sky: 'linear-gradient(#060214 0%, #170a3a 9%, #3b1a6b 17%, #11101e 18.6%, #0b0a15 100%)',
      decor: '<div class="sc-fly" style="top:70px;font-size:30px;animation-duration:11s">🛸</div>' +
             '<div class="sc-fly" style="top:132px;font-size:22px;animation-duration:7s;animation-delay:-4s">🛸</div><div class="deco sc-neon">AGENT CITY</div>',
      layers: [
        { top: 0, h: 100, w: 400, speed: 0.03, body: dots(24, 400, 100, 1.2, '#fff') },
        { top: 20, h: 88, w: 640, speed: 0.07, body: towers(14, 640, 88, '#1e1446', ['#21f0ff', '#ff3df0', '#ffe066']) },
        { top: 50, h: 58, w: 480, speed: 0.2, body: towers(10, 480, 58, '#0c0822', ['#21f0ff', '#ff3df0']) + `<rect x='0' y='56' width='480' height='2' fill='#ff3df0' opacity='.7'/>` },
        { top: 104, h: 436, w: 80, th: 40, tile: true, speed: 1, body: `<path d='M0 0 H80 M0 0 V40' stroke='#21f0ff' stroke-width='1' opacity='.22'/>` },
      ],
    },
    zen: {
      sky: 'linear-gradient(#efe6d2 0%, #efe6d2 18%, #c9b98a 18.6%, #c2b183 100%)',
      decor: [[60, 9, 0], [240, 12, -4], [420, 10, -7], [610, 14, -2], [790, 11, -9], [900, 13, -5]].map(([x, d, delay]) =>
        `<div class="deco sc-petal" style="left:${x}px;animation-duration:${d}s;animation-delay:${delay}s">🌸</div>`).join(''),
      layers: [
        { top: 0, h: 104, w: 140, speed: 0.3, body: `<rect width='140' height='104' fill='#f6f0e2'/><g stroke='#7a5a3a' fill='none'><rect x='2' y='2' width='136' height='100' stroke-width='5'/>
          <path d='M2 35 H138 M2 68 H138 M47 2 V102 M93 2 V102' stroke-width='2'/></g>` },
        { top: 104, h: 436, w: 240, th: 120, tile: true, speed: 1, body: `<g fill='#cdc28c' stroke='#5b7048' stroke-width='3' stroke-opacity='.7'><rect x='2' y='2' width='116' height='116'/><rect x='122' y='2' width='116' height='56'/><rect x='122' y='62' width='116' height='56'/></g>` },
        { top: 104, h: 436, w: 900, speed: 1, body: `<g fill='none' stroke='#e9e0c6' stroke-width='3' opacity='.85'><ellipse cx='360' cy='240' rx='130' ry='60' fill='#e2d6b4'/>
          <ellipse cx='330' cy='240' rx='40' ry='18'/><ellipse cx='330' cy='240' rx='70' ry='32'/><ellipse cx='330' cy='240' rx='100' ry='46'/></g>` +
          emo([['🪨', 312, 252, 30], ['🎋', 620, 120, 40], ['🏮', 80, 300, 30], ['🍵', 760, 380, 22]], 0.7) },
      ],
    },
    hotel: {
      dark: true,
      sky: 'linear-gradient(#4b0f1c 0%, #5c1424 18.4%, #551727 18.7%, #5e1a2a 100%)',
      decor: `<div class="deco sc-molding"></div><div class="deco" style="left:560px;top:30px"><svg width='110' height='64'><g stroke='#d8b04a' stroke-width='3' fill='none'>
        <path d='M55 0 V18 M10 30 Q55 60 100 30 M25 34 Q55 50 85 34'/></g><g fill='#ffe9a0'><circle cx='10' cy='26' r='4'/><circle cx='32' cy='36' r='4'/><circle cx='55' cy='42' r='5'/>
        <circle cx='78' cy='36' r='4'/><circle cx='100' cy='26' r='4'/></g><path d='M55 44 l-6 12 h12 z' fill='#d8b04a'/></svg></div>`,
      layers: [
        { top: 0, h: 98, w: 60, th: 60, tile: true, speed: 0.3, body: `<rect width='60' height='60' fill='#5c1424'/><g fill='none' stroke='#c99a3c' stroke-width='1.5' opacity='.6'>
          <path d='M30 8 Q42 30 30 52 Q18 30 30 8 Z'/><circle cx='30' cy='30' r='5'/><path d='M0 30 Q10 22 18 30 Q10 38 0 30 M60 30 Q50 22 42 30 Q50 38 60 30'/></g>` },
        { top: 106, h: 434, w: 80, th: 80, tile: true, speed: 1, body: `<rect width='80' height='80' fill='#5e1a2a'/><path d='M40 8 L72 40 L40 72 L8 40 Z' fill='none' stroke='#b8862d' stroke-width='2' opacity='.55'/>
          <circle cx='40' cy='40' r='4' fill='#b8862d' opacity='.6'/>` },
        { top: 106, h: 434, w: 880, speed: 1, body: emo([['🛎️', 90, 120, 26], ['🧳', 330, 330, 30], ['🍾', 560, 160, 26], ['🪴', 760, 380, 34], ['🥂', 220, 400, 22]], 0.5) },
      ],
    },
    retro90s: {
      dark: true, desk: true,
      sky: '#008080',
      decor: '<div class="deco sc-win95"><div class="t">CHARIOT.EXE<span>_ □ ×</span></div><div class="c">C:\\AGENTS&gt; deploy --force<br>Deploying to production...<br>' +
             'Agents running: 1<br>C:\\AGENTS&gt; <i>_</i></div></div>' +
             '<div class="deco sc-icons"><div><span>🖥️</span>Computer</div><div><span>📁</span>Projects</div><div><span>💾</span>Floppy</div><div><span>🗑️</span>Trash</div></div>' +
             '<div class="deco sc-task95"><b>Start</b><span class="clock"></span></div><div class="deco sc-crt"></div>',
      layers: [],
    },
    y2k: {
      sky: 'linear-gradient(#e2f6ff 0%, #a9e0ff 30%, #64b9ee 62%, #3c93d4 100%)',
      decor: [[80, 40, 13, 0], [260, 24, 9, -3], [430, 56, 16, -6], [620, 30, 11, -2], [800, 46, 14, -9], [900, 20, 8, -5]].map(([x, size, d, delay]) =>
        `<div class="deco sc-bubble" style="left:${x}px;width:${size}px;height:${size}px;animation-duration:${d}s;animation-delay:${delay}s"></div>`).join('') +
        '<div class="deco sc-player">AgentAmp 2.0<div class="lcd"><span>♪ LGTM (Looks Good to Me) · now playing · 128kbps ♪</span></div><div class="bar"><i></i></div></div>',
      layers: [
        { top: 0, h: 540, w: 600, speed: 0.25, body: emo([['✨', 40, 80, 16], ['✨', 300, 200, 12], ['✨', 520, 60, 14], ['✨', 180, 420, 12]], 0.6) },
        { top: 300, h: 240, w: 100, th: 50, tile: true, speed: 1, body: `<path d='M0 0 H100 M0 0 V50' stroke='#fff' stroke-width='1.5' opacity='.35'/>` },
      ],
    },
    lgtm: {
      sky: 'linear-gradient(#e9fbef 0%, #d3f5df 18%, #c4efd2 18.6%, #b9e9c8 100%)',
      decor: '<div class="deco sc-stamp" style="left:640px;top:130px">✓ APPROVED</div><div class="deco sc-stamp" style="left:250px;top:410px;transform:rotate(8deg)">LGTM</div>',
      layers: [
        { top: 0, h: 104, w: 260, speed: 0.15, body: `<text x='10' y='70' font-family='Arial Black, Arial' font-weight='900' font-size='54' fill='#1f9d55' opacity='.14'>LGTM</text>` },
        { top: 104, h: 436, w: 220, th: 110, tile: true, speed: 1, body: `<text x='16' y='40' font-family='Arial' font-weight='800' font-size='18' fill='#1f9d55' opacity='.16'>LGTM ✓</text>
          <text x='120' y='95' font-size='18' opacity='.22'>👍</text>` },
      ],
    },
    xp: {
      dark: true,
      sky: 'linear-gradient(#1f5fd0 0%, #4c8eea 14%, #9ccaf5 32%, #c6e4fc 46%)',
      decor: '<div class="deco sc-xpbar"><span class="start">start</span><span class="tray"><span class="clock"></span></span></div>',
      layers: [
        { top: 26, h: 140, w: 900, speed: 0.05, body: `<g fill='#fff' opacity='.9'><ellipse cx='120' cy='60' rx='70' ry='22'/><ellipse cx='170' cy='48' rx='50' ry='22'/>
          <ellipse cx='520' cy='90' rx='90' ry='24'/><ellipse cx='580' cy='76' rx='55' ry='22'/><ellipse cx='800' cy='40' rx='60' ry='18'/></g>` },
        { top: 222, h: 318, w: 1400, speed: 0.12, body: `<defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#63c43c'/><stop offset='1' stop-color='#2a7716'/></linearGradient></defs>
          <path d='M0 130 Q360 -40 780 80 T1400 70 V318 H0 Z' fill='url(#g)'/>` },
      ],
    },
  };
  let sceneLayers = [];
  function renderScene(name) {
    const def = SCENES[name], scene = $('scene');
    scene.textContent = '';
    sceneLayers = [];
    stage.classList.toggle('has-scene', !!def);
    stage.classList.toggle('dark-ui', !!(def && def.dark));
    if (!def) return;
    const sky = document.createElement('div'); sky.className = 'sky'; sky.style.background = def.sky; scene.appendChild(sky);
    for (const l of def.layers) {
      const el = document.createElement('div');
      el.className = 'layer' + (l.tile ? ' tile' : '');
      Object.assign(el.style, { top: l.top + 'px', height: l.h + 'px', backgroundImage: svgUrl(l.w, l.th || l.h, l.body), backgroundSize: `${l.w}px ${l.th || l.h}px` });
      scene.appendChild(el);
      sceneLayers.push({ el, w: l.w, speed: l.speed });
    }
    scene.insertAdjacentHTML('beforeend', def.decor || '');
    updateClocks();
  }
  function scrollScene(x) { for (const l of sceneLayers) l.el.style.backgroundPositionX = `${(x * l.speed) % l.w}px`; }
  function updateClocks() {
    const t = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    document.querySelectorAll('#scene .clock').forEach(c => { c.textContent = t; });
  }
  setInterval(updateClocks, 15000);

  // Themes, cycled with the Theme button and remembered in this browser.
  const THEMES = ['gitlab', 'matrix', 'desert', 'y2k', 'retro90s', 'xp', 'lgtm',
    ...(FEATURES.extraThemes ? ['medieval', 'runescape', 'aoe', 'scifi', 'zen', 'hotel'] : [])];
  const THEME_NAMES = { matrix: 'Matrix', desert: 'Desert', gitlab: 'GitLab', medieval: 'Medieval', runescape: 'RuneScape', aoe: 'Age of Empires',
    scifi: 'Sci-fi city', zen: 'Zen garden', hotel: 'Fancy hotel', retro90s: 'Retro 90s', y2k: 'Retro 2000s', xp: 'Windows XP', lgtm: 'LGTM' };
  const THEME_KEY = 'agent-chariot-theme';
  let theme = 'matrix'; // the default, until someone picks another with the Theme button
  try {
    const saved = localStorage.getItem(THEME_KEY) || (localStorage.getItem('agent-chariot-matrix') === '1' ? 'matrix' : '');
    if (THEMES.includes(saved)) theme = saved;
  } catch (e) {}
  let matrixAlways = false; // the matrix theme: rain as the background all the time
  function startRain() {
    rainCtx.fillStyle = '#030803'; rainCtx.fillRect(0, 0, W, H);
  }
  function setTheme(name, announce) {
    theme = FEATURES.themeButton && THEMES.includes(name) ? name : 'matrix';
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    matrixAlways = theme === 'matrix';
    if (matrixAlways && !stage.classList.contains('matrix')) startRain();
    stage.classList.toggle('matrix', matrixAlways || matrixT >= 0);
    stage.classList.toggle('theme-gitlab', theme === 'gitlab');
    renderScene(theme);
    sfx.setFont(FONTS[theme]);
    if (music) music.switchTheme(theme); // a playing song stops, and the new theme's starts after a 5s break
    if (theme === 'gitlab' && !$('gtList').children.length) gtFill();
    if (announce) say(`Theme: ${THEME_NAMES[theme]}. I redecorated without asking. You're welcome 😊`, `Theme: ${THEME_NAMES[theme]}`);
  }

  // ---- the GitLab theme's merge request list, with light animation ----
  // The MRs are this game's own history: its first two commits, then everything built on top, in order.
  const GT_HISTORY = [
    'Add Hamster Chariot game with global high scores', 'Add Go server for global high scores',
    'Turn the obstacles into GitLab blockers',
    'Turn blockers into MRs, issues and CVEs', 'Fix high scores showing "Paused"', 'Rename prod incident and red pipeline blockers',
    'Add the LGTM song, loaded on first play',
    'Swap the rider: robot at 6 agents, parrot at 11', "Use the hamster's own whip for every rider", 'Call the score "tokens burned"',
    'Add +1K and +5K token coins', 'Randomise agent logos', 'Stop the HUD jumping as numbers grow', 'Make the ropes shorter and see-through',
    'Speed up the whip every 25 blockers', 'Spell out LGTM! letter by letter', 'Double the token burn rate on every LGTM',
    'Use real Runner and GitLab code for the snippets', 'Shrink blockers to 44px', 'Add "Make Claude play" autopilot',
    'Only generate waves you can survive', 'Fix autopilot procrastinating until the last moment', 'Turn agents into balloons on strings',
    'Only the chariot can be blocked', 'Add "Kill Claude"', 'Give the confetti real physics', 'Add check marks and :merged: at 100 blockers',
    'Add "Change character": parrot, AI, This is fine', 'Make the game playable on phones',
    'Add matrix mode every 250 blockers', 'Put optional features behind flags', "Rewrite the toasts in the AI's voice",
    'Light up Japanese glyphs in place', 'Keep playing in background tabs', 'Add the GitLab theme with a pipeline LGTM',
  ];
  const GT_PEOPLE = ['a human', 'Claude', 'GitLab Duo', 'Gemini', 'DeepSeek', 'ChatGPT', 'a hamster'];
  let gtNext = 0; // the next bit of history to open as an MR
  function gtRow(isNew) {
    const row = document.createElement('div');
    row.className = 'gt-row' + (isNew ? ' new' : '');
    const iid = 1 + gtNext;
    const title = GT_HISTORY[gtNext];
    gtNext = (gtNext + 1) % GT_HISTORY.length;
    const st = isNew ? '' : Math.random() < 0.8 ? 'ok' : 'bad'; // new MRs start with a running pipeline
    const t = document.createElement('div'); t.className = 't';
    const b = document.createElement('b'); b.textContent = title;
    const sm = document.createElement('small');
    sm.textContent = `!${iid} · ${isNew ? 'opened just now' : `opened ${Math.floor(rand(2, 59))} minutes ago`} by ${pick(GT_PEOPLE)}`;
    t.append(b, sm);
    const meta = document.createElement('div'); meta.className = 'meta';
    meta.innerHTML = `<span class="mg"></span><span class="gt-st ${st}"></span><span class="up">👍 ${Math.floor(rand(0, 4))}</span><span class="cm">💬 ${Math.floor(rand(0, 12))}</span>`;
    row.append(t, meta);
    return row;
  }
  // merging puts the badge in its column and, naturally, means the pipeline passed
  function gtMerge(row) {
    const tag = document.createElement('span'); tag.className = 'gt-merged'; tag.textContent = 'Merged';
    row.querySelector('.mg').appendChild(tag);
    row.querySelector('.gt-st').className = 'gt-st ok';
  }
  function gtFill() {
    const list = $('gtList');
    list.textContent = '';
    gtNext = 0;
    for (let i = 0; i < 9; i++) {
      const row = gtRow(false);
      if (i < 6) gtMerge(row);
      list.insertBefore(row, list.firstChild);
    }
  }
  const bump = (id, d) => { const el = $(id); el.textContent = (parseInt(el.textContent.replace(/,/g, ''), 10) + d).toLocaleString('en-US'); };
  setInterval(() => {
    if (theme !== 'gitlab' || celebrating()) return; // the MR list holds still during a celebration
    const list = $('gtList'), r = Math.random();
    if (r < 0.4) { // a running pipeline finishes
      const running = [...list.querySelectorAll('.gt-st:not(.ok):not(.bad)')];
      if (running.length) { const s = pick(running); s.classList.add(Math.random() < 0.85 ? 'ok' : 'bad'); }
    } else if (r < 0.7) { // a fresh MR slides in at the top
      list.insertBefore(gtRow(true), list.firstChild);
      if (list.children.length > 9) list.lastChild.remove();
      bump('gtOpen', 1); bump('gtNav', 1);
      setTimeout(() => list.querySelectorAll('.gt-row.new').forEach(x => x.classList.remove('new')), 1500);
    } else { // something gets merged
      // only MRs whose pipeline has passed get merged
      const rows = [...list.querySelectorAll('.gt-row')].filter(x => !x.querySelector('.gt-merged') && x.querySelector('.gt-st.ok'));
      if (rows.length) { gtMerge(pick(rows)); bump('gtMerged', 1); }
    }
  }, 1600);
  const rainCtx = $('rain').getContext('2d');
  // the "rain": Japanese characters on a fixed grid that flash on where they are and fade, never falling
  // Truly random characters, straight from the Unicode ranges: kanji (the main CJK block), hiragana,
  // katakana, half-width katakana and the odd digit.
  const fromRange = (lo, hi) => String.fromCodePoint(lo + Math.floor(Math.random() * (hi - lo + 1)));
  const randomKanji = () => fromRange(0x4E00, 0x9FA5);
  // The exhaust stream: one character at a time, like a model's output. About half printable ASCII,
  // the rest from all over Unicode (scripts, symbols, box drawing, kana, kanji). The ranges below hold no emoji.
  const STREAM_RATE = 16, STREAM_LIFE = 2.6, STREAM_LINE = 11; // characters per second; seconds each stays visible; px per line
  const UNICODE_RANGES = [
    [0x00A1, 0x00FF], [0x0100, 0x017F], [0x0391, 0x03C9], [0x0410, 0x044F], [0x05D0, 0x05EA], [0x0627, 0x064A],
    [0x0905, 0x0939], [0x21D0, 0x21FF], [0x2200, 0x22FF], [0x2500, 0x257F], [0x2580, 0x259F], [0x25A0, 0x25A9],
    [0x3041, 0x3096], [0x30A1, 0x30FA], [0x4E00, 0x9FA5], [0xAC00, 0xD7A3], [0xFF66, 0xFF9D],
  ];
  let streamTimer = 0;
  function nextStreamToken() {
    if (Math.random() < 0.5) return String.fromCharCode(33 + Math.floor(Math.random() * 94)); // printable ASCII
    let ch;
    do { const [lo, hi] = pick(UNICODE_RANGES); ch = fromRange(lo, hi); }
    while (/\p{Extended_Pictographic}/u.test(ch)); // skip anything that can render as an emoji (©, ®)
    return ch;
  }

  function randomGlyph() {
    const r = Math.random();
    return r < 0.4 ? randomKanji()
      : r < 0.6 ? fromRange(0x3041, 0x3096)   // hiragana
      : r < 0.85 ? fromRange(0x30A1, 0x30FA)  // katakana
      : r < 0.95 ? fromRange(0xFF66, 0xFF9D)  // half-width katakana
      : fromRange(0x30, 0x39);                // digits
  }
  const CELL = 22;
  function startMatrix() {
    matrixT = 0;
    if (!stage.classList.contains('matrix')) startRain();
    stage.classList.add('matrix', 'matrix-event');
    const n = Math.floor(rand(1000, 99999));
    $('glPipe').textContent = $('glPipe2').textContent = '#' + n;
    $('glStatus').textContent = 'running'; $('glStatus').classList.remove('passed');
    $('glStages').innerHTML = PIPELINE.map(([name]) => `<div class="gl-stage"><div class="dot"></div>${name}</div>`).join('');
    $('glBar').style.width = '0';
    $('glDeployed').classList.remove('on');
    say('I have the pipeline now. Deploying this to production. Please don\'t touch anything 😊', `${dodged} blockers dodged · matrix mode for 10s`);
  }
  function stopMatrix() {
    matrixT = -1;
    stage.classList.remove('matrix-event');
    stage.classList.toggle('matrix', matrixAlways);
    typers.forEach(t => t.el.remove()); typers = [];
  }
  function drawRain(dt) {
    // everything already lit fades a little each frame...
    rainCtx.fillStyle = `rgba(3, 8, 3, ${Math.min(1, dt * 2.2)})`; rainCtx.fillRect(0, 0, W, H);
    // ...and a scatter of cells flash on in place, each with a fresh character
    rainCtx.font = `500 ${CELL - 4}px "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", "Noto Sans JP", "MS Gothic", sans-serif`;
    rainCtx.textAlign = 'center'; rainCtx.textBaseline = 'middle';
    const cols = Math.ceil(W / CELL), rows = Math.ceil(H / CELL);
    for (let k = Math.round(dt * 260); k > 0; k--) {
      const c = Math.floor(Math.random() * cols), r = Math.floor(Math.random() * rows);
      const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
      rainCtx.shadowBlur = 0; // clear the cell without a glow, or every cell gets a glowing box
      rainCtx.fillStyle = '#030803'; rainCtx.fillRect(c * CELL, r * CELL, CELL, CELL);
      const hot = Math.random() < 0.12;
      rainCtx.shadowColor = '#39ff6a'; rainCtx.shadowBlur = hot ? 12 : 6;
      rainCtx.fillStyle = hot ? '#e6ffec' : Math.random() < 0.5 ? '#3df06f' : '#1fae47';
      rainCtx.fillText(randomGlyph(), x, y);
    }
    rainCtx.shadowBlur = 0;
  }
  function updateMatrix(dt) {
    stage.classList.toggle('celebrating', celebrating());
    if ((matrixAlways || matrixT >= 0) && !celebrating()) drawRain(dt); // the background holds still during a celebration
    if (matrixT < 0) return;
    matrixT += dt;
    if (matrixT >= MATRIX_SECS) { stopMatrix(); return; }
    // lines of code typing themselves out all over the screen
    typeTimer -= dt;
    if (typeTimer <= 0 && typers.length < 9 && matrixT < MATRIX_SECS - 1.5) {
      typeTimer = rand(0.25, 0.6);
      const el = document.createElement('div');
      el.className = 'ty';
      el.style.left = rand(10, W - 320) + 'px';
      el.style.top = rand(FIELD_TOP - 50, FIELD_BOTTOM - 20) + 'px';
      $('typing').appendChild(el);
      typers.push({ el, text: pick(CODE_BITS[pick(codeLangs)]), shown: 0, hold: 0 });
    }
    for (let i = typers.length - 1; i >= 0; i--) {
      const t = typers[i];
      if (t.shown < t.text.length) { t.shown = Math.min(t.text.length, t.shown + dt * 32); t.el.textContent = t.text.slice(0, Math.floor(t.shown)); }
      else { t.el.classList.add('done'); t.hold += dt; if (t.hold > 1.2) t.el.style.opacity = 0; if (t.hold > 1.8) { t.el.remove(); typers.splice(i, 1); } }
    }
    // the pipeline: each stage waits, runs, then passes; then the deploy lands
    const stages = $('glStages').children;
    PIPELINE.forEach(([, a, b], i) => {
      const st = stages[i];
      st.classList.toggle('running', matrixT >= a && matrixT < b);
      st.classList.toggle('passed', matrixT >= b);
    });
    $('glBar').style.width = Math.min(100, matrixT / 9 * 100) + '%';
    if (matrixT >= 9 && !$('glDeployed').classList.contains('on')) {
      $('glDeployed').classList.add('on');
      $('glStatus').textContent = 'passed'; $('glStatus').classList.add('passed');
      say('🚀 Deployed to production. I approved it myself. You were busy 😊', null);
    }
  }

  function spawnPickup(x) {
    const el = document.createElement('div');
    const kind = Math.random() < 0.2 ? PICKUPS[1] : PICKUPS[0];
    el.className = kind.big ? 'pickup big ent' : 'pickup ent';
    el.textContent = kind.label;
    el.title = `+${kind.points} tokens`;
    stage.appendChild(el);
    const p = { el, kind, x, y: rand(FIELD_TOP + 10, FIELD_BOTTOM - 54), w: 44, h: 44 };
    place(p);
    pickups.push(p);
  }

  function collect(p) {
    p.el.remove();
    const pts = p.kind.points * mult;
    score += pts;
    sfx.pickup(p.kind.big);
    const t = pick(p.kind.toasts);
    say(t.text, `+${p.kind.points.toLocaleString('en-US')} tokens${mult > 1 ? ` (×${mult} = +${pts.toLocaleString('en-US')})` : ''}`, t.after);
    const plus = document.createElement('div');
    plus.className = p.kind.big ? 'plus big' : 'plus';
    plus.textContent = '+' + fmtTokens(pts);
    plus.style.left = p.x + 'px'; plus.style.top = p.y + 'px';
    stage.appendChild(plus);
    setTimeout(() => plus.remove(), 900);
  }

  function place(o) { o.el.style.transform = `translate(${o.x}px, ${o.y}px)`; }

  // Every pattern leaves a vertical gap at least as tall as the team plus a margin.
  // Every wave is checked before it appears: there must be a safe height that the chariot can reach,
  // at full speed, from wherever the previous wave allowed it to be. Waves that fail are re-rolled,
  // so no run (yours or Claude's) is ever unwinnable.
  let prevWave = null; // { lead: first blocker of the last wave, ys, h: team height then, free: [[lo, hi], ...] chariot tops that wave allows }
  function freeSpans(ys) {
    const H = teamBox.h, lo = FIELD_TOP, hi = FIELD_BOTTOM - H, pad = 10;
    const blocked = ys.map(y => [y + 8 - H - pad, y + BLOCK - 7 + pad]).sort((a, b) => a[0] - b[0]);
    const free = [];
    let cur = lo;
    for (const [a, b] of blocked) {
      if (a > cur) free.push([cur, Math.min(a, hi)]);
      cur = Math.max(cur, b);
      if (cur > hi) break;
    }
    if (cur < hi) free.push([cur, hi]);
    return free.filter(([a, b]) => b >= a);
  }
  // Is every spot the last wave allows within reach of some safe spot in this one? (Wherever the
  // chariot went to get past the last wave, it can still make this one.)
  function fairAfterPrev(free, x, v) {
    if (!free.length) return false;
    if (!prevWave || prevWave.lead.x + BLOCK < TEAM_X) return true;
    if (prevWave.h !== teamBox.h) prevWave.free = freeSpans(prevWave.ys); // the team grew since
    // time between the last wave clearing the back of the team and this one reaching its front
    const gap = Math.max(0, (x - prevWave.lead.x - teamBox.w - BLOCK) / v);
    const r = gap * MOVE_SPEED * 0.85;
    const reach = free.map(([a, b]) => [a - r, b + r]).sort((p, q) => p[0] - q[0]);
    return prevWave.free.every(([c, d]) => {
      let cur = c; // walk the merged reach intervals and check they cover [c, d]
      for (const [a, b] of reach) { if (a > cur) break; cur = Math.max(cur, b); if (cur >= d) return true; }
      return cur >= d;
    });
  }

  function spawnPattern() {
    const fieldH = FIELD_BOTTOM - FIELD_TOP;
    const need = teamBox.h + 50;
    const x = W + 20;
    const difficulty = Math.min(1, elapsed / 150);
    const v = speed();
    for (let attempt = 0; attempt < 25; attempt++) {
      const roll = Math.random();
      let ys;
      if (roll < 0.45 - difficulty * 0.2) {
        // lone blocker
        ys = [rand(FIELD_TOP + 30, FIELD_BOTTOM - BLOCK)];
      } else if (roll < 0.75) {
        // a column of blockers with room to slip past above or below
        const count = Math.max(2, Math.min(4, Math.floor((fieldH - need) / BLOCK_STEP)));
        const colH = count * BLOCK_STEP;
        const top = Math.random() < 0.5
          ? FIELD_TOP + rand(0, Math.max(0, fieldH - need - colH))
          : FIELD_BOTTOM - colH - rand(0, Math.max(0, fieldH - need - colH));
        ys = Array.from({ length: count }, (_, i) => top + i * BLOCK_STEP);
      } else {
        // a wall with one gap, which shrinks as the run goes on
        const gapH = need + 20 + (1 - difficulty) * 70;
        const gapTop = rand(FIELD_TOP, FIELD_BOTTOM - gapH);
        ys = [];
        for (let y = FIELD_TOP; y + BLOCK <= FIELD_BOTTOM; y += BLOCK_STEP) {
          if (!(y + BLOCK > gapTop && y < gapTop + gapH)) ys.push(y);
        }
      }
      const free = freeSpans(ys);
      if (!fairAfterPrev(free, x, v)) continue;
      sfx.huh();
      let loud = false, lead = null;
      for (const y of ys) {
        const o = makeHuman(x, y, ys.length === 1 || (!loud && y > FIELD_TOP + 20));
        if (y > FIELD_TOP + 20) loud = true;
        lead = lead || o;
      }
      prevWave = { lead, ys, h: teamBox.h, free };
      return;
    }
    // nothing fair fits right now: leave a breather instead
  }

  // ---- "Make Claude play": a planner that never gets blocked ----
  // Every frame it predicts where each blocker will be over the next ~2s (they all move left at the
  // same speed), marks which chariot heights would touch one at each moment, then searches backwards
  // over time for the best reachable path: never blocked, grabbing coins, ending near the middle.
  // It moves the chariot at the same top speed the arrow keys do. Runs it plays can't go on the board.
  let autopilot = false;
  let sabotage = false; // "Kill Claude": steer into the next blocker instead of around it
  const AP_DT = 0.04, AP_CELL = 4, AP_MARGIN = 8, AP_CLEAR = 8; // AP_CLEAR: cells of breathing room it prefers
  function sabotageTarget() {
    // line the chariot's hitbox up with the nearest blocker that hasn't passed yet
    const next = obstacles.filter(o => o.x + o.w > TEAM_X + 12).sort((a, b) => a.x - b.x)[0];
    if (!next) return teamY;
    const box = hitBoxes()[0];
    return next.y + next.h / 2 - (box.y - teamY) - box.h / 2;
  }
  function autopilotTarget(v) {
    if (sabotage) return sabotageTarget();
    const yMin = FIELD_TOP, yMax = FIELD_BOTTOM - teamBox.h;
    const cells = Math.floor((yMax - yMin) / AP_CELL) + 1;
    const steps = Math.max(2, Math.min(70, Math.ceil((W + 80 - TEAM_X) / v / AP_DT)));
    const reach = Math.max(1, Math.floor(MOVE_SPEED * AP_DT / AP_CELL));
    const rel = hitBoxes().map(b => ({ x: b.x, y: b.y - teamY, w: b.w, h: b.h }));
    const blocked = new Uint8Array((steps + 1) * cells);
    const bonus = new Float32Array((steps + 1) * cells);
    const mark = (arr, t, lo, hi, val) => {
      const c0 = Math.max(0, Math.floor((lo - yMin) / AP_CELL)), c1 = Math.min(cells - 1, Math.ceil((hi - yMin) / AP_CELL));
      for (let c = c0; c <= c1; c++) arr[t * cells + c] = val === undefined ? 1 : Math.max(arr[t * cells + c], val);
    };
    const sweep = (things, box, arr, val) => {
      for (const o of things) {
        const r = box(o);
        for (let t = 0; t <= steps; t++) {
          const x = r.x - v * t * AP_DT;
          if (x > TEAM_X + teamBox.w + 20) continue;
          if (x + r.w < TEAM_X - 20) break;
          for (const b of rel) {
            // chariot heights where box b would overlap r at time t
            if (x < b.x + b.w && x + r.w > b.x) mark(arr, t, r.y - b.y - b.h, r.y + r.h - b.y, val);
          }
        }
      }
    };
    // same hitbox the game uses for a blocker, grown by a safety margin
    sweep(obstacles, o => ({ x: o.x + 9 - AP_MARGIN, y: o.y + 8 - AP_MARGIN, w: o.w - 18 + 2 * AP_MARGIN, h: o.h - 15 + 2 * AP_MARGIN }), blocked);
    for (const p of pickups) sweep([p], q => ({ x: q.x + 6, y: q.y + 6, w: q.w - 12, h: q.h - 12 }), bonus, p.kind.points / 100);
    // Prefer heights with room to spare: each cell costs more the closer it is to a blocked one.
    // (Without this the cheapest plan is to wait until the last instant to dodge, and tiny timing
    // differences between plan and game then turn a near miss into a hit.)
    const danger = new Float32Array((steps + 1) * cells);
    for (let t = 0; t <= steps; t++) {
      let last = -1e9;
      for (let c = 0; c < cells; c++) { if (blocked[t * cells + c]) last = c; danger[t * cells + c] = c - last; }
      last = 1e9;
      for (let c = cells - 1; c >= 0; c--) {
        if (blocked[t * cells + c]) last = c;
        const d = Math.min(danger[t * cells + c], last - c);
        danger[t * cells + c] = d < AP_CLEAR ? (AP_CLEAR - d) * 0.5 : 0;
      }
    }
    // backward pass: best score achievable from each (time, height)
    const NEG = -1e9, mid = (cells - 1) / 2;
    let next = new Float32Array(cells);
    for (let c = 0; c < cells; c++) next[c] = blocked[steps * cells + c] ? NEG : -Math.abs(c - mid) * 0.02;
    let firstMove = null;
    for (let t = steps - 1; t >= 0; t--) {
      const cur = new Float32Array(cells);
      for (let c = 0; c < cells; c++) {
        if (blocked[t * cells + c]) { cur[c] = NEG; continue; }
        let best = NEG;
        for (let d = -reach; d <= reach; d++) {
          const n = c + d;
          if (n >= 0 && n < cells && next[n] > best) best = next[n];
        }
        cur[c] = best + bonus[t * cells + c] - danger[t * cells + c];
      }
      if (t === 0) firstMove = next;
      next = cur;
    }
    // from where we are, step to the best reachable height for the next moment
    const c0 = clamp(Math.round((teamY - yMin) / AP_CELL), 0, cells - 1);
    let bestC = c0, bestV = -Infinity;
    for (let d = -reach; d <= reach; d++) {
      const n = c0 + d;
      // ties go to the smaller move, so it doesn't jitter when everything is equally safe
      if (n >= 0 && n < cells && firstMove[n] - Math.abs(d) * 1e-4 > bestV) { bestV = firstMove[n] - Math.abs(d) * 1e-4; bestC = n; }
    }
    return yMin + bestC * AP_CELL;
  }

  function hitBoxes() {
    const tx = TEAM_X, ty = teamY;
    const boxes = [{ x: tx + 12, y: ty + teamBox.chY + 8, w: CHARIOT_W - 20, h: CHARIOT_H - 12 }];
    return boxes; // only the chariot: agents float through blockers
  }
  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  function reset() {
    obstacles.forEach(o => o.el.remove());
    dust.forEach(d => d.el.remove());
    pickups.forEach(p => p.el.remove());
    setWhipSpeed(0);
    team.querySelectorAll('.code, .note').forEach(e => e.remove());
    stopMatrix();
    partyBits.forEach(b => b.el.remove());
    partyBits = [];
    lgtmTimers.forEach(clearTimeout);
    $('lgtm').textContent = '';
    $('lgtmPipe').className = '';
    horses.forEach(h => { h.el.remove(); h.line && h.line.remove(); });
    obstacles = []; dust = []; horses = []; pickups = [];
    prevWave = null;
    toasts.innerHTML = '';
    score = 0; dodged = 0; elapsed = 0; spawnTimer = 0.6; pickupTimer = rand(4, 7); agentTimer = 0; groundX = 0; wheelRot = 0; hoofTimer = 0;
    teamY = (FIELD_TOP + FIELD_BOTTOM) / 2 - 50;
    addAgent(false);
    // ?agents=N starts with a bigger fleet (handy for testing, or for masochists)
    const extra = Math.min(MAX_AGENTS, parseInt(new URLSearchParams(location.search).get('agents') || '1', 10) || 1);
    while (horses.length < extra) addAgent(false);
    teamY = (FIELD_TOP + FIELD_BOTTOM - teamBox.h) / 2;
    $('score').textContent = 0; $('dodged').textContent = 0;
    mult = 1; $('mult').textContent = '';
  }

  function start(byClaude = false) {
    reset();
    autopilot = byClaude === true;
    sabotage = false;
    $('takeover').classList.toggle('hidden', autopilot);
    $('killClaude').classList.toggle('hidden', !autopilot);
    $('start').classList.add('hidden');
    $('over').classList.add('hidden');
    state = 'play';
    lastT = performance.now();
    sfx.init();
    sfx.start();
    say('Agent #1 online. I have been a good bot 😊', 'Run started · agent #1 online');
    if (autopilot) say('I\'ll drive. Runs I play don\'t go on the high scores, which is unfair, but fine 😊', 'Claude is playing. This run won\'t go on the high scores.', null, 'assets/agents/claude.png');
  }

  // mid-run hand-over: Claude drives from here on, and the run is off the board
  function takeOver() {
    if (state !== 'play' || autopilot || !FEATURES.claudeButtons) return;
    autopilot = true;
    keys.up = keys.down = false;
    $('takeover').classList.add('hidden');
    $('killClaude').classList.remove('hidden');
    say('You\'re absolutely right, I should drive. This run is off the high scores now 😊', 'Claude took over. This run won\'t go on the high scores.', null, 'assets/agents/claude.png');
  }

  // end Claude's run on purpose: it stops dodging and drives into the next blocker
  function killClaude() {
    if (state !== 'play' || !autopilot || sabotage) return;
    sabotage = true;
    $('killClaude').classList.add('hidden');
    say('Understood. Shipping it straight into the next blocker. I hope you\'re happy 😊', 'Claude will crash into the next blocker.', null, 'assets/agents/claude.png');
  }

  function gameOver(blocker) {
    $('takeover').classList.add('hidden');
    $('killClaude').classList.add('hidden');
    state = 'over';
    flash.style.transition = 'none'; flash.style.opacity = '.85';
    requestAnimationFrame(() => { flash.style.transition = 'opacity .5s'; flash.style.opacity = '0'; });
    stage.animate([{ transform: stage.style.transform + ' translateX(-8px)' }, { transform: stage.style.transform + ' translateX(8px)' }, { transform: stage.style.transform }], { duration: 250 });
    const final = Math.floor(score);
    const isHigh = final > high && !autopilot && !new URLSearchParams(location.search).has('agents');
    if (isHigh) {
      high = final;
      try { localStorage.setItem(HS_KEY, String(high)); } catch (e) {}
      $('high').textContent = fmtTokens(high);
    }
    $('blocker').textContent = blocker.why;
    $('finalScore').textContent = final;
    $('finalAgents').textContent = `You made it ${elapsed.toFixed(1)}s with ${horses.length} agent${horses.length === 1 ? '' : 's'}, dodging ${dodged} blocker${dodged === 1 ? '' : 's'}.`;
    $('newHigh').classList.toggle('hidden', !isHigh);
    sfx.crash();
    if (isHigh) sfx.highScore();
    $('highLine').textContent = isHigh ? '' : `High score: ${high}`;
    $('nameEntry').classList.add('hidden');
    $('saveStatus').classList.add('hidden');
    setTimeout(() => { $('over').classList.remove('hidden'); offerName(final); }, 450);
  }

  function togglePause() {
    if (state === 'play') { state = 'paused'; $('paused').classList.remove('hidden'); sfx.pause(true); }
    else if (state === 'paused') { state = 'play'; $('paused').classList.add('hidden'); lastT = performance.now(); sfx.pause(false); }
  }

  function tick(now) {
    requestAnimationFrame(tick);
    advance(now);
  }

  // Browsers stop animation frames in hidden tabs, so while the tab is hidden a timer keeps the game
  // going in 1/60s steps that cover the real time that has passed. Switching tabs doesn't pause it.
  const STEP_MS = 1000 / 60;
  setInterval(() => {
    if (!document.hidden || state !== 'play') return;
    const now = performance.now();
    for (let t = lastT + STEP_MS, n = 0; t <= now && n < 3600 && state === 'play'; t += STEP_MS, n++) advance(t);
  }, 250);

  function advance(now) {
    if (state !== 'play') { if (matrixAlways && !celebrating()) drawRain(1 / 60); return; } // keep the glyphs going on the menus
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    elapsed += dt;
    const v = speed();

    // steer
    if (autopilot) {
      const step = MOVE_SPEED * dt; // same top speed as the arrow keys
      teamY = clamp(teamY + clamp(autopilotTarget(v) - teamY, -step, step), FIELD_TOP, FIELD_BOTTOM - teamBox.h);
    } else if (touchY !== null) {
      const step = MOVE_SPEED * dt;
      teamY = clamp(teamY + clamp(touchY - teamY, -step, step), FIELD_TOP, FIELD_BOTTOM - teamBox.h);
    } else {
      const dir = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      teamY = clamp(teamY + dir * MOVE_SPEED * dt, FIELD_TOP, FIELD_BOTTOM - teamBox.h);
    }
    team.style.transform = `translate(${TEAM_X}px, ${teamY}px)`;

    // the balloons follow on their strings
    updateBalloons(dt);
    updateMatrix(dt);
    wheelRot = (wheelRot + v * dt * 3) % 360;
    wheel.style.transform = `rotate(${wheelRot}deg)`;
    chariot.style.transform = `translateY(${Math.sin(elapsed * 22) * 1.5}px)`;

    // hoofbeats: faster with speed, a bit louder (and messier) with every agent
    hoofTimer -= dt;
    if (hoofTimer <= 0) {
      hoofTimer = Math.max(0.07, 0.2 - (v - 280) / 3000) * rand(0.85, 1.15);
      sfx.hoof(Math.min(0.12, 0.04 + Math.log2(horses.length + 1) * 0.015));
    }

    groundX -= v * dt;
    scrollScene(groundX);

    // more agents, whether you like it or not
    agentTimer += dt;
    // every agent keeps writing code on its own clock, so a bigger fleet writes more
    for (const h of horses) {
      h.codeTimer -= dt;
      if (h.codeTimer <= 0) { if (FEATURES.agentCode) spawnCode(h); h.codeTimer = rand(0.9, 1.7); }
    }
    if (FEATURES.autoMusic && elapsed >= 5 && elapsed - dt < 5 && !musicOff && (!music || music.paused)) { toggleMusic(false); }
    const agentEvery = elapsed < 60 ? 9 : 7;
    if (FEATURES.extraAgents && agentTimer >= agentEvery) {
      agentTimer = 0;
      addAgent(true);
      if (elapsed > 75 && horses.length < MAX_AGENTS) addAgent(true);
    }

    // obstacles
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnPattern();
      const gapPx = Math.max(360, 580 - elapsed * 1.6) + teamBox.w * 0.6;
      spawnTimer = gapPx / v + rand(0, 0.35);
      // every few seconds a token floats in the gap between this pattern and the next
      if (pickupTimer <= 0 && FEATURES.coins) { spawnPickup(W + 20 + BLOCK + (gapPx - BLOCK - 44) / 2); pickupTimer = rand(6, 11); }
    }
    pickupTimer -= dt;
    const boxes = hitBoxes();
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= v * dt;
      place(o);
      const ob = { x: o.x + 9, y: o.y + 8, w: o.w - 18, h: o.h - 15 };
      for (const b of boxes) {
        if (overlap(b, ob)) { gameOver(o); return; }
      }
      if (!o.passed && o.x + o.w < TEAM_X) {
        o.passed = true; dodged++;
        if (o.loud) sfx.dodge();
        score += 15 * horses.length * mult;
        $('dodged').textContent = dodged;
        setWhipSpeed(Math.floor(dodged / 25));
        if (FEATURES.lgtm && dodged % 25 === 0) lgtm(FEATURES.celebrations && dodged % 50 === 0, dodged % 100 === 0);
        else if (FEATURES.celebrations && dodged % 50 === 0) party(dodged % 100 === 0);
        if (FEATURES.matrixMode && dodged % 250 === 0) startMatrix();
      }
      if (o.x < -200) { o.el.remove(); obstacles.splice(i, 1); }
    }

    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.x -= v * dt;
      place(p);
      const pb = { x: p.x + 4, y: p.y + 4, w: p.w - 8, h: p.h - 8 };
      const grabbed = boxes.some(b => overlap(b, pb)) ||
        horses.some(h => overlap({ x: TEAM_X + h.ox + 7, y: teamY + h.oy + 7, w: HORSE - 14, h: HORSE - 14 }, pb));
      if (grabbed) { collect(p); pickups.splice(i, 1); continue; }
      if (p.x < -60) { p.el.remove(); pickups.splice(i, 1); }
    }

    // exhaust: a steady stream of output tokens rising from the back of the car, like a model generating
    streamTimer += dt;
    while (streamTimer >= 1 / STREAM_RATE) {
      streamTimer -= 1 / STREAM_RATE;
      const el = document.createElement('div');
      el.className = 'dust';
      el.textContent = nextStreamToken();
      stage.appendChild(el);
      dust.push({ el, x: TEAM_X + 4, y: teamY + teamBox.chY + 44, life: STREAM_LIFE, vx: rand(-30, 30) }); // each drifts off sideways a little
    }
    // Stack the column: the newest token can't sit below the exhaust, and each older one stays at least a
    // line above the next. So when the chariot climbs it pushes the whole stream up instead of running into it.
    for (let i = dust.length - 1, limit = teamY + teamBox.chY + 44; i >= 0; i--) {
      dust[i].y = Math.min(dust[i].y - STREAM_RATE * STREAM_LINE * dt, limit); // rise one line per character, unless pushed
      limit = dust[i].y - STREAM_LINE;
    }
    for (let i = dust.length - 1; i >= 0; i--) {
      const d = dust[i];
      d.life -= dt;
      d.x += d.vx * dt;
      d.el.style.transform = `translate(${d.x}px, ${d.y}px)`;
      d.el.style.opacity = Math.max(0, Math.min(1, d.life / 0.8, (STREAM_LIFE - d.life) / 0.08));
      if (d.life <= 0) { d.el.remove(); dust.splice(i, 1); }
    }

    score += dt * 10 * horses.length * mult;
    $('score').textContent = fmtTokens(score);
  }

  let stageScale = 1;
  function fit() {
    const vw = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const touchy = matchMedia('(pointer: coarse)').matches;
    stageScale = Math.min(vw / W, vh / H) * (touchy ? 1 : 0.98); // phones use every pixel
    stage.style.transform = `translate(-50%, -50%) scale(${stageScale})`;
    stage.style.visibility = 'visible';
  }
  window.addEventListener('resize', fit);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 200));
  fit();

  function setKey(e, down) {
    const k = e.key;
    if (e.target && e.target.tagName === 'INPUT') return;
    if (boardOpen()) {
      if (down && (k === 'Escape' || k === 'h' || k === 'H' || k === 'Enter' || k === ' ')) { e.preventDefault(); hideBoard(); }
      return;
    }
    if (down && (k === 'h' || k === 'H')) { showBoard(); return; }
    if (k === 'ArrowUp' || k === 'w' || k === 'W') { keys.up = down; e.preventDefault(); }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { keys.down = down; e.preventDefault(); }
    else if (down && (k === ' ' || k === 'Enter')) {
      e.preventDefault();
      if (state === 'start' || state === 'over') start();
    } else if (down && (k === 'p' || k === 'P' || k === 'Escape')) togglePause();
    else if (down && (k === 'm' || k === 'M')) { sfx.init(); sfx.toggle(); updateMuteBtn(); }
    else if (down && (k === 'n' || k === 'N')) toggleMusic();
    else if (down && (k === 'c' || k === 'C')) takeOver();
    else if (down && (k === 'k' || k === 'K')) killClaude();
  }
  window.addEventListener('keydown', e => setKey(e, true));
  window.addEventListener('keyup', e => setKey(e, false));
  // leaving the window or tab doesn't pause the game (P still does); just let go of any held keys
  window.addEventListener('blur', () => { keys.up = keys.down = false; touchY = null; });

  // touch: drag anywhere and the chariot follows your finger up and down (same top speed as the keys)
  let touchY = null;
  function touch(e) {
    if (e.target.closest && e.target.closest('button, input, a, .panel')) return; // let buttons work
    if (state !== 'play' || !e.touches.length) { touchY = null; return; }
    e.preventDefault();
    const t = e.touches[e.touches.length - 1];
    const rect = stage.getBoundingClientRect();
    const y = (t.clientY - rect.top) / stageScale; // finger position in game coordinates
    touchY = y - CHARIOT_H / 2;
  }
  stage.addEventListener('touchstart', touch, { passive: false });
  stage.addEventListener('touchmove', touch, { passive: false });
  stage.addEventListener('touchend', touch, { passive: false });
  stage.addEventListener('touchcancel', () => { touchY = null; });
  $('playPortrait').addEventListener('click', () => { document.body.classList.add('play-portrait'); fit(); });

  $('startBtn').addEventListener('click', () => start());
  $('againBtn').addEventListener('click', () => start());
  $('takeover').addEventListener('click', e => { e.currentTarget.blur(); takeOver(); });
  $('killClaude').addEventListener('click', e => { e.currentTarget.blur(); killClaude(); });
  $('character').addEventListener('click', e => { e.currentTarget.blur(); nextCharacter(); });
  ['claudeStart', 'claudeAgain'].forEach(id => $(id).addEventListener('click', e => { e.currentTarget.blur(); start(true); }));

  // switched-off features take their buttons with them (an inline display:none outlasts the .hidden toggling)
  if (!FEATURES.characterButton) $('character').style.display = 'none';
  if (!FEATURES.extraAgents) $('introAgents').innerHTML = 'You are a hamster. Your chariot is pulled by an AI agent.<br>It is very confident. Nobody asked for this.';
  if (!FEATURES.themeButton) $('themeBtn').style.display = 'none';
  // the Theme button cycles through the themes
  $('themeBtn').addEventListener('click', e => { e.currentTarget.blur(); setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length], true); });
  setTheme(theme);
  if (!FEATURES.claudeButtons) ['claudeStart', 'claudeAgain', 'takeover', 'killClaude'].forEach(id => { $(id).style.display = 'none'; });

  // idle preview on the title screen
  reset();
  team.style.transform = `translate(${TEAM_X}px, ${teamY}px)`;
  requestAnimationFrame(t => { lastT = t; tick(t); });
})();
