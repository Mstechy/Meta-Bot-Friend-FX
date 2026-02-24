// Web Audio API trade notification sounds
const audioCtx = () => {
  if (!(window as any).__tradeAudioCtx) {
    (window as any).__tradeAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return (window as any).__tradeAudioCtx as AudioContext;
};

function playTone(freq: number, duration: number, type: OscillatorType = "sine", volume = 0.15) {
  try {
    const ctx = audioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available
  }
}

export function playTradeOpenSound() {
  playTone(880, 0.12, "sine", 0.12);
  setTimeout(() => playTone(1100, 0.15, "sine", 0.1), 100);
}

export function playTradeCloseSound() {
  playTone(660, 0.1, "triangle", 0.12);
  setTimeout(() => playTone(440, 0.2, "triangle", 0.08), 80);
}

export function playTPHitSound() {
  playTone(523, 0.08, "sine", 0.12);
  setTimeout(() => playTone(659, 0.08, "sine", 0.12), 80);
  setTimeout(() => playTone(784, 0.15, "sine", 0.1), 160);
}

export function playSLHitSound() {
  playTone(440, 0.15, "sawtooth", 0.08);
  setTimeout(() => playTone(330, 0.25, "sawtooth", 0.06), 120);
}

export function playSignalSound() {
  playTone(1000, 0.06, "sine", 0.1);
  setTimeout(() => playTone(1200, 0.06, "sine", 0.1), 70);
  setTimeout(() => playTone(1000, 0.06, "sine", 0.1), 140);
}
