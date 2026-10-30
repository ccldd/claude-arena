// 8-bit sound effects made with the Web Audio API, so the site ships no audio files.
// Browsers only allow audio after a click, so the context starts on the first click once sound is on.

const KEY = 'arena-sound';
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = readSetting();

function readSetting(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

export function soundOn(): boolean {
  return enabled;
}

export function setSound(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // Storage can be blocked. Sound still follows the button for this visit.
  }
  if (on) audio();
}

if (enabled) addEventListener('pointerdown', () => audio(), { once: true });

function audio(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface Tone {
  freq: number;
  to?: number;
  dur: number;
  type?: OscillatorType;
  vol?: number;
  at?: number;
}

function tone({ freq, to, dur, type = 'square', vol = 0.15, at = 0 }: Tone) {
  if (!enabled) return;
  const ac = audio();
  const start = ac.currentTime + at;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + dur);
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(gain).connect(master!);
  osc.start(start);
  osc.stop(start + dur);
}

function noise(dur: number, vol: number, freq: number, type: BiquadFilterType = 'lowpass', at = 0) {
  if (!enabled) return;
  const ac = audio();
  const start = ac.currentTime + at;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + Math.min(0.2, dur / 4));
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  src.connect(filter).connect(gain).connect(master!);
  src.start(start);
}

export const sfx = {
  punch() {
    noise(0.12, 0.6, 1200);
    tone({ freq: 160, to: 45, dur: 0.18, type: 'sine', vol: 0.7 });
    tone({ freq: 320, to: 110, dur: 0.12, at: 0.1, vol: 0.08 });
    noise(0.9, 0.12, 1400, 'bandpass', 0.1);
  },
  /** The per-letter tick of an old RPG text box. Each boxer has its own pitch. */
  letter(voice: number) {
    tone({ freq: voice === 0 ? 784 : 1047, dur: 0.035, vol: 0.05 });
  },
  /** The chime when a text box opens. */
  open() {
    tone({ freq: 1568, dur: 0.06, vol: 0.06 });
    tone({ freq: 2093, dur: 0.09, vol: 0.06, at: 0.06 });
  },
  bell(times = 1) {
    for (let i = 0; i < times; i++) {
      tone({ freq: 1319, dur: 1.1, type: 'triangle', vol: 0.25, at: i * 0.4 });
      tone({ freq: 1976, dur: 0.7, type: 'sine', vol: 0.08, at: i * 0.4 });
    }
  },
  fanfare() {
    [523, 659, 784, 1047].forEach((freq, i) => tone({ freq, dur: 0.18, vol: 0.12, at: i * 0.13 }));
    tone({ freq: 1047, dur: 0.7, vol: 0.12, at: 0.52 });
    noise(2.2, 0.25, 1500, 'bandpass', 0.3);
  },
  knockout() {
    tone({ freq: 440, to: 55, dur: 0.9, type: 'sawtooth', vol: 0.08 });
  },
};
