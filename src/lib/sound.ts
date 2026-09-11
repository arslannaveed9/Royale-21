let ctx: AudioContext | null = null;

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType, gain = 0.05) {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.value = gain;
  amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
  osc.connect(amp);
  amp.connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + duration);
}

export const sound = {
  chip() {
    tone(220, 0.08, "triangle", 0.04);
  },
  deal() {
    tone(340, 0.07, "square", 0.03);
  },
  win() {
    tone(523, 0.12, "sine", 0.05);
    setTimeout(() => tone(784, 0.18, "sine", 0.05), 90);
  },
  lose() {
    tone(180, 0.22, "sawtooth", 0.03);
  },
  click() {
    tone(480, 0.04, "square", 0.02);
  },
};
