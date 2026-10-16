// Buzina de gas (air horn) sintetizada com Web Audio — sem arquivos de audio.
//
// O que faz soar "buzina de verdade" e nao "bip robotico":
//  - dois tons de trompa (intervalo de terca), como as buzinas de gas de 2 cornetas;
//  - varias vozes serra levemente desafinadas (batimento/"chorus" do metal);
//  - harmonicos fortes + distorcao suave (saturacao brass);
//  - formantes da corneta (ressonancias em ~1,1 kHz e ~2,4 kHz);
//  - ataque rapido com um sopro de ar no inicio e uma leve subida de afinacao;
//  - compressor no final pra ficar alta sem estourar.
//
// Padrao: "ta-ta-taaa" (dois toques curtos e um longo).

const TRUMPETS = [415.3, 523.25]; // Ab4 + C5 (terca maior)
const DETUNE_CENTS = [-9, 0, 9];

function softClipCurve(amount: number) {
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const norm = Math.tanh(amount);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(amount * x) / norm;
  }
  return curve;
}

function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * seconds)), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function blast(ctx: BaseAudioContext, bus: AudioNode, t: number, dur: number) {
  const level = ctx.createGain();
  const release = Math.min(0.28, dur * 0.35);
  level.gain.setValueAtTime(0.0001, t);
  level.gain.exponentialRampToValueAtTime(1, t + 0.012); // ataque rapido
  level.gain.setValueAtTime(1, Math.max(t + 0.013, t + dur - release));
  level.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  const shaper = ctx.createWaveShaper();
  shaper.curve = softClipCurve(2.4);
  shaper.oversample = "4x";
  level.connect(shaper);

  // formantes da corneta
  const f1 = ctx.createBiquadFilter();
  f1.type = "peaking";
  f1.frequency.value = 1100;
  f1.Q.value = 1.1;
  f1.gain.value = 6;
  const f2 = ctx.createBiquadFilter();
  f2.type = "peaking";
  f2.frequency.value = 2400;
  f2.Q.value = 1.4;
  f2.gain.value = 4;
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 6000;
  tone.Q.value = 0.5;
  shaper.connect(f1);
  f1.connect(f2);
  f2.connect(tone);
  tone.connect(bus);

  for (const base of TRUMPETS) {
    for (const cents of DETUNE_CENTS) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.detune.value = cents;
      // sobe de ~6% abaixo ate a nota e cai um pouco no fim do toque
      osc.frequency.setValueAtTime(base * 0.94, t);
      osc.frequency.exponentialRampToValueAtTime(base, t + 0.05);
      osc.frequency.setValueAtTime(base, Math.max(t + 0.06, t + dur - release));
      osc.frequency.exponentialRampToValueAtTime(base * 0.975, t + dur);
      const g = ctx.createGain();
      g.gain.value = 0.085;
      osc.connect(g);
      g.connect(level);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
    // corpo: uma oitava abaixo, onda quadrada
    const sub = ctx.createOscillator();
    sub.type = "square";
    sub.frequency.value = base / 2;
    const sg = ctx.createGain();
    sg.gain.value = 0.05;
    sub.connect(sg);
    sg.connect(level);
    sub.start(t);
    sub.stop(t + dur + 0.05);
  }

  // sopro de ar no inicio
  const air = ctx.createBufferSource();
  air.buffer = noiseBuffer(ctx, 0.14);
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 3200;
  band.Q.value = 0.7;
  const ag = ctx.createGain();
  ag.gain.setValueAtTime(0.0001, t);
  ag.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
  ag.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  air.connect(band);
  band.connect(ag);
  ag.connect(f1);
  air.start(t);
  air.stop(t + 0.14);
}

/** Agenda a buzina em `ctx` a partir de `start`. Retorna a duracao total em segundos. */
export function scheduleAirHorn(
  ctx: BaseAudioContext,
  start: number = ctx.currentTime,
  out: AudioNode = ctx.destination
): number {
  const master = ctx.createGain();
  master.gain.value = 0.55;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 14;
  comp.ratio.value = 6;
  comp.attack.value = 0.003;
  comp.release.value = 0.18;
  master.connect(comp);
  comp.connect(out);

  blast(ctx, master, start, 0.16);
  blast(ctx, master, start + 0.22, 0.16);
  blast(ctx, master, start + 0.46, 0.95);
  return 1.45;
}

/** Toca a buzina no AudioContext da pagina (precisa de um gesto do usuario antes). */
export function playAirHorn(ctx: AudioContext | null) {
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    scheduleAirHorn(ctx);
  } catch {
    // audio nao disponivel ainda (sem gesto do usuario) — ignora
  }
}
