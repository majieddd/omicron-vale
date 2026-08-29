// Audio: fully synthesized WebAudio. No assets.
// Master chain: ctx -> compressor -> masterGain.
// Ambient: wind (brown noise + bandpass LFO), birds (FM chirps), leaves (high noise shimmer).
// Events: towers fire, enemies die, waves, build, upgrade, victory, defeat.
export function createAudio() {
  let ctx = null, master = null, started = false, muted = false;
  let ambNodes = null;
  let intensity = 0; // 0 calm, 1 combat (drives music + bird density)

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return false; }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 20; comp.ratio.value = 8;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    comp.connect(master); master.connect(ctx.destination);
    return true;
  }

  function resume() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (!started) { started = true; startAmbient(); startMusic(); }
  }

  function out() { return ctx.createGain(); }

  // --- primitives ---
  function osc(type, freq, t0, dur, vol = 0.2, target = master) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(target);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }
  function noiseBuf(sec = 2) {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function noiseHit(t0, dur, vol, filterType, freq, q = 1) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf(1.2);
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  // --- ambient bed ---
  function startAmbient() {
    const t0 = ctx.currentTime;
    // wind
    const src = ctx.createBufferSource(); src.buffer = noiseBuf(4); src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 170;
    lfo.connect(lfoGain); lfoGain.connect(bp.frequency);
    const windGain = ctx.createGain(); windGain.gain.value = 0.055;
    src.connect(bp); bp.connect(windGain); windGain.connect(master);
    src.start(); lfo.start();
    // low air
    const air = ctx.createBufferSource(); air.buffer = noiseBuf(4); air.loop = true;
    const lo = ctx.createBiquadFilter(); lo.type = 'lowpass'; lo.frequency.value = 220;
    const airGain = ctx.createGain(); airGain.gain.value = 0.045;
    air.connect(lo); lo.connect(airGain); airGain.connect(master);
    air.start();
    // leaves shimmer
    const sh = ctx.createBufferSource(); sh.buffer = noiseBuf(3); sh.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5200;
    const shGain = ctx.createGain(); shGain.gain.value = 0.012;
    sh.connect(hp); hp.connect(shGain); shGain.connect(master);
    sh.start();
    ambNodes = { windGain, airGain, shGain };
    // bird scheduler
    scheduleBird();
  }

  function scheduleBird() {
    if (!ctx) return;
    const wait = 2400 + Math.random() * 5000;
    setTimeout(() => {
      if (!ctx || muted) { scheduleBird(); return; }
      bird(8 + Math.random() * 6);
      scheduleBird();
    }, wait);
  }
  function bird(f0) {
    const t0 = ctx.currentTime;
    const n = 2 + (Math.random() * 3 | 0);
    let t = t0;
    for (let i = 0; i < n; i++) {
      const f = f0 * (1 + (Math.random() - 0.5) * 0.16);
      osc('sine', f, t, 0.12 + Math.random() * 0.1, 0.045);
      osc('sine', f * 1.5, t + 0.02, 0.1, 0.02);
      t += 0.09 + Math.random() * 0.1;
    }
  }

  // --- music: gentle pentatonic pluck bed + soft pad, tempo reacts to intensity ---
  let musicTimer = null;
  function startMusic() {
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25]; // C pentatonic
    let step = 0;
    musicTimer = setInterval(() => {
      if (!ctx || muted) return;
      const t0 = ctx.currentTime;
      const tempo = 1.6 - intensity * 0.75; // seconds per beat
      if (Math.random() < 0.62) {
        const f = scale[(Math.random() * scale.length) | 0] * (Math.random() < 0.3 ? 2 : 1);
        pluck(f, t0, 0.25);
      }
      if (Math.random() < 0.22 + intensity * 0.2) {
        const f = scale[(Math.random() * scale.length) | 0] * 0.5;
        pad(f, t0, tempo * 2.2, 0.02);
      }
      step++;
    }, 720);
  }
  function pluck(f, t0, vol = 0.16) {
    const o = ctx.createOscillator();
    o.type = 'triangle'; o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
    const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 1800;
    o.connect(f2); f2.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + 0.8);
  }
  function pad(f, t0, dur, vol) {
    for (const det of [-4, 4]) {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f + det;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + dur * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + dur + 0.1);
    }
  }

  // --- SFX ---
  function sfx(name, ctxT = null) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    switch (name) {
      case 'arrow': {
        noiseHit(t0, 0.1, 0.09, 'bandpass', 2600, 3);
        osc('sine', 880, t0, 0.09, 0.05);
        osc('sine', 1320, t0 + 0.03, 0.06, 0.03);
        break;
      }
      case 'forge': {
        noiseHit(t0, 0.3, 0.15, 'lowpass', 500, 0.8);
        osc('sine', 140, t0, 0.22, 0.14);
        noiseHit(t0 + 0.14, 0.25, 0.1, 'bandpass', 1500, 1);
        break;
      }
      case 'frost': {
        osc('sine', 1560, t0, 0.16, 0.05);
        osc('sine', 2080, t0 + 0.05, 0.2, 0.04);
        osc('sine', 1040, t0 + 0.1, 0.22, 0.035);
        noiseHit(t0, 0.12, 0.04, 'highpass', 6000, 1);
        break;
      }
      case 'storm': {
        noiseHit(t0, 0.16, 0.14, 'highpass', 1200, 1.4);
        osc('square', 120, t0, 0.08, 0.06);
        osc('sawtooth', 60, t0 + 0.02, 0.1, 0.05);
        noiseHit(t0 + 0.05, 0.1, 0.05, 'bandpass', 3400, 4);
        break;
      }
      case 'lumen': {
        osc('sine', 330, t0, 0.9, 0.1);
        osc('sine', 495, t0 + 0.06, 0.8, 0.06);
        osc('sine', 660, t0 + 0.12, 0.7, 0.04);
        break;
      }
      case 'place': {
        osc('triangle', 220, t0, 0.14, 0.12);
        osc('triangle', 330, t0 + 0.08, 0.16, 0.08);
        noiseHit(t0, 0.08, 0.06, 'lowpass', 400, 1);
        break;
      }
      case 'upgrade': {
        osc('triangle', 440, t0, 0.12, 0.1);
        osc('triangle', 554, t0 + 0.09, 0.12, 0.1);
        osc('triangle', 659, t0 + 0.18, 0.2, 0.12);
        break;
      }
      case 'sell': {
        osc('triangle', 500, t0, 0.08, 0.08);
        osc('triangle', 380, t0 + 0.07, 0.12, 0.08);
        break;
      }
      case 'kill': {
        noiseHit(t0, 0.14, 0.1, 'lowpass', 700, 0.8);
        osc('sine', 320, t0, 0.12, 0.06);
        break;
      }
      case 'kill-fly': {
        osc('sine', 900, t0, 0.14, 0.05);
        osc('sine', 600, t0 + 0.06, 0.16, 0.04);
        break;
      }
      case 'kill-boss': {
        noiseHit(t0, 0.7, 0.22, 'lowpass', 260, 0.6);
        osc('sine', 90, t0, 0.6, 0.16);
        osc('sine', 180, t0, 0.35, 0.1);
        break;
      }
      case 'leak': {
        osc('sawtooth', 180, t0, 0.3, 0.09);
        osc('sawtooth', 120, t0 + 0.1, 0.35, 0.08);
        noiseHit(t0, 0.2, 0.08, 'lowpass', 500, 1);
        break;
      }
      case 'boss-step': {
        noiseHit(t0, 0.3, 0.16, 'lowpass', 200, 0.7);
        osc('sine', 70, t0, 0.35, 0.18);
        break;
      }
      case 'wave-horn': {
        // distant low war horn, two-note
        osc('sawtooth', 196, t0, 0.7, 0.07);
        osc('sawtooth', 147, t0 + 0.25, 1.0, 0.08);
        osc('sine', 98, t0, 0.9, 0.1);
        noiseHit(t0, 0.5, 0.03, 'highpass', 4000, 0.6);
        break;
      }
      case 'victory': {
        const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
        notes.forEach((f, i) => { osc('triangle', f, t0 + i * 0.14, 0.5, 0.09); });
        break;
      }
      case 'defeat': {
        const notes = [392, 311, 261.63, 196];
        notes.forEach((f, i) => { osc('sawtooth', f, t0 + i * 0.35, 0.9, 0.06); });
        break;
      }
      case 'click': {
        osc('triangle', 660, t0, 0.05, 0.05);
        break;
      }
      default: break;
    }
  }

  function setIntensity(v) { intensity = clamp(v, 0, 1); }
  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.9;
  }
  return { ensure, resume, sfx, setIntensity, setMuted, get muted() { return muted; }, get ctx() { return ctx; } };
}
