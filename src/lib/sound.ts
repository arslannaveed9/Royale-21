let armed = false;
const cache = new Map<string, string>();

function writeString(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
}

function toneWav(freq: number, seconds: number, volume = 0.55, decay = 0.7) {
  const key = `${freq}:${seconds}:${volume}:${decay}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const sr = 22050;
  const count = Math.floor(sr * seconds);
  const bytes = count * 2;
  const buffer = new ArrayBuffer(44 + bytes);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + bytes, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, bytes, true);

  for (let i = 0; i < count; i += 1) {
    const t = i / sr;
    const attack = Math.min(1, i / 180);
    const fall = Math.pow(1 - i / count, decay);
    const sample = Math.sin(2 * Math.PI * freq * t) * volume * attack * fall;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
  }

  const url = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
  cache.set(key, url);
  return url;
}

function playUrl(url: string, volume = 1) {
  const audio = new Audio(url);
  audio.preload = "auto";
  audio.setAttribute("playsinline", "true");
  audio.volume = Math.min(1, Math.max(0, volume));
  return audio.play().then(() => true).catch(() => false);
}

function blipWebAudio() {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.28, ctx.currentTime + 0.02);
    gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // HTMLAudio fallback still runs
  }
}

function cue(freq: number, seconds: number, volume = 0.85, delay = 0) {
  const url = toneWav(freq, seconds, volume);
  if (delay) {
    setTimeout(() => {
      void playUrl(url, 1);
    }, delay);
    return Promise.resolve(true);
  }
  return playUrl(url, 1);
}

export function armSound() {
  blipWebAudio();
  const url = toneWav(880, 0.18, 0.9);
  return playUrl(url, 1).finally(() => {
    armed = true;
  });
}

export function unlockAudio() {
  if (armed) return Promise.resolve(true);
  return armSound();
}

export function primeSounds() {
  [240, 330, 520, 659, 784, 880, 920, 1046, 1100].forEach((freq) => {
    toneWav(freq, 0.12, 0.8);
  });
}

export const sound = {
  ready() {
    return armed;
  },
  chip() {
    cue(520, 0.12, 0.9);
    cue(240, 0.14, 0.7, 30);
  },
  deal() {
    cue(920, 0.1, 0.85);
  },
  shuffle() {
    for (let i = 0; i < 5; i += 1) cue(700 + i * 80, 0.08, 0.7, i * 50);
  },
  click() {
    cue(1100, 0.07, 0.8);
  },
  stand() {
    cue(196, 0.18, 0.85);
  },
  double() {
    this.chip();
    setTimeout(() => this.deal(), 80);
  },
  split() {
    this.chip();
    setTimeout(() => this.deal(), 70);
    setTimeout(() => this.deal(), 140);
  },
  reveal() {
    cue(330, 0.16, 0.55);
  },
  bust() {
    cue(110, 0.28, 0.6);
  },
  lose() {
    cue(174, 0.18, 0.55);
    cue(130, 0.24, 0.5, 120);
  },
  push() {
    cue(330, 0.12, 0.5);
    cue(330, 0.12, 0.4, 150);
  },
  win() {
    cue(523, 0.14, 0.6);
    cue(659, 0.14, 0.6, 90);
    cue(784, 0.2, 0.65, 180);
  },
  blackjack() {
    cue(523, 0.12, 0.65);
    cue(659, 0.12, 0.65, 80);
    cue(784, 0.12, 0.65, 160);
    cue(1046, 0.22, 0.7, 240);
  },
};
