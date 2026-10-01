import { rnd } from '../core/rng';

/* Sonidos sintetizados de la v10 (Web Audio, sin archivos) y música opcional */

const lsGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* sin almacenamiento */
  }
};

export const audio = { on: lsGet('pcs-sound') !== '0', music: lsGet('pcs-music') === '1' };
let AC: AudioContext | null = null;

/** Contexto de audio (se crea al primer toque del usuario) */
export function ac(): AudioContext | null {
  if (!audio.on) return null;
  if (!AC) {
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      AC = new Ctor();
    } catch {
      return null;
    }
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}

export function tone(f: number, d: number, dur: number, type: OscillatorType = 'sine', vol = 0.15): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + d, o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export function nz(dur: number, f0: number, f1: number, vol: number, type: BiquadFilterType = 'bandpass', q = 1): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime, n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), dd = b.getChannelData(0);
  for (let i = 0; i < n; i++) dd[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = b;
  const f = a.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(a.destination);
  src.start(t);
}

let bellT = 0;
export const sfx = {
  meow: () => {
    tone(760, 0, 0.12, 'triangle', 0.07);
    tone(620, 0.1, 0.3, 'triangle', 0.06);
  },
  tick: () => nz(0.05, 2600, 1800, 0.22, 'bandpass', 2),
  rip: () => {
    nz(0.35, 900, 4200, 0.5, 'bandpass', 0.8);
    nz(0.22, 3000, 6500, 0.2, 'highpass');
  },
  swish: () => nz(0.22, 1800, 500, 0.16, 'bandpass', 1.2),
  flip: () => {
    nz(0.04, 4000, 3000, 0.14, 'highpass');
    tone(1200, 0, 0.04, 'square', 0.03);
  },
  charge: (lv: number) => {
    for (let i = 0; i < (lv >= 3 ? 5 : 3); i++) tone(260 + i * 70, i * 0.1, 0.35, 'sine', 0.06);
  },
  hit: (lv: number) => {
    const N = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093];
    const k = lv >= 3 ? 7 : lv === 2 ? 5 : 3;
    for (let i = 0; i < k; i++) {
      tone(N[i], i * 0.07, 0.6, 'triangle', 0.14);
      if (lv >= 2) tone(N[i] * 2, i * 0.07 + 0.02, 0.4, 'sine', 0.04);
    }
    if (lv >= 3) {
      [523.25, 659.25, 783.99].forEach((f) => tone(f, 0.55, 1.7, 'sine', 0.08));
      nz(1.2, 6000, 9000, 0.05, 'highpass');
    }
  },
  // La campanilla de la puerta no suena más de una vez cada 1,5 s
  bell: () => {
    const now = performance.now();
    if (now - bellT < 1500) return;
    bellT = now;
    tone(1318.5, 0, 0.45, 'sine', 0.05);
    tone(1046.5, 0.18, 0.6, 'sine', 0.05);
  },
  coin: () => {
    tone(2300 + rnd(500), 0, 0.08, 'triangle', 0.07);
    tone(3400, 0.03, 0.07, 'sine', 0.03);
  },
  bill: () => nz(0.13, 1600, 700, 0.12, 'bandpass', 1),
  drawer: () => {
    nz(0.2, 320, 120, 0.25, 'lowpass', 1);
    tone(2637, 0.14, 0.55, 'sine', 0.07);
  },
  key: () => tone(1000, 0, 0.05, 'square', 0.035),
  ok: () => {
    tone(1400, 0, 0.1, 'square', 0.05);
    tone(1400, 0.16, 0.12, 'square', 0.05);
    nz(0.6, 2600, 2400, 0.04, 'bandpass', 8);
  },
  err: () => {
    tone(220, 0, 0.22, 'sawtooth', 0.05);
    tone(180, 0.12, 0.25, 'sawtooth', 0.05);
  },
  chaching: () => {
    tone(1568, 0, 0.12, 'triangle', 0.1);
    tone(2093, 0.1, 0.45, 'triangle', 0.1);
    nz(0.12, 5000, 6500, 0.06, 'highpass');
  },
  ach: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.08, 0.4, 'triangle', 0.08)),
  sad: () => {
    tone(392, 0, 0.28, 'triangle', 0.08);
    tone(370, 0.28, 0.28, 'triangle', 0.08);
    tone(349, 0.56, 0.6, 'triangle', 0.08);
  },
  page: () => nz(0.28, 900, 3200, 0.14, 'bandpass', 0.7),
  shutter: () => {
    for (let i = 0; i < 9; i++) setTimeout(() => nz(0.07, 700 + rnd(300), 500, 0.12, 'bandpass', 3), i * 110);
  },
  print: () => {
    for (let i = 0; i < 10; i++) setTimeout(() => nz(0.08, 2600, 2300, 0.05, 'bandpass', 6), i * 120);
  },
};

export const vibe = (pt: number | number[]): void => {
  try {
    navigator.vibrate?.(pt);
  } catch {
    /* sin vibración */
  }
};

export function setSound(on: boolean): void {
  audio.on = on;
  lsSet('pcs-sound', on ? '1' : '0');
}

/* Música: acordes suaves en bucle (musicTick de la v10) */
let musT: number | undefined, musN = 0, musAt = 0;
let musicPaused = (): boolean => false;
export const setMusicPausedCheck = (f: () => boolean): void => void (musicPaused = f);

function musicTick(): void {
  if (!audio.music || musicPaused() || document.hidden) return;
  const a = ac();
  if (!a || a.state !== 'running') return;
  const now = a.currentTime;
  if (musAt < now) musAt = now + 0.05;
  const f = (n: number) => 261.63 * Math.pow(2, n / 12);
  const CH = [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]];
  while (musAt < now + 0.6) {
    const st = musN % 16, ch = CH[Math.floor(musN / 16) % 4], t = musAt - now;
    if (st % 8 === 0) tone(f(ch[0] - 12), t, 1, 'sine', 0.045);
    if (st % 2 === 0) tone(f(ch[(st / 2) % 4] + 12), t, 0.35, 'triangle', 0.016);
    musAt += 0.25;
    musN++;
  }
}

export function setMusic(v: boolean): void {
  audio.music = v;
  lsSet('pcs-music', v ? '1' : '0');
  clearInterval(musT);
  if (v) musT = window.setInterval(musicTick, 200);
}
