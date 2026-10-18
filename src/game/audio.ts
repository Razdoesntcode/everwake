import { ZONES } from "./data";

type SoundName =
  | "ui"
  | "start"
  | "target"
  | "attack"
  | "hit"
  | "crit"
  | "enemyHit"
  | "bossHit"
  | "cast"
  | "arrow"
  | "cleave"
  | "stun"
  | "heal"
  | "frost"
  | "blink"
  | "root"
  | "potion"
  | "loot"
  | "equip"
  | "coin"
  | "quest"
  | "questReady"
  | "questComplete"
  | "levelup"
  | "kill"
  | "victory"
  | "boss"
  | "death"
  | "respawn"
  | "area"
  | "portal"
  | "error"
  | "lowHealth"
  | "warn"
  | "rift";

type MusicZone = keyof typeof ZONES | "title";

interface MusicProfile {
  chords: number[][];
  melody: number[];
  chordDur: number;
  harp: number;
  flute: number;
  choir: number;
  drone: number;
  cutoff: number;
  gain: number;
  rest: number;
}

function mtof(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Chord vocabulary — pastoral major world, modal minor wilds, open fifths below.
const CHORD_D: number[] = [50, 54, 57, 62];
const CHORD_A_OVER_CS: number[] = [49, 52, 57, 61];
const CHORD_BM: number[] = [47, 50, 54, 59];
const CHORD_G: number[] = [43, 47, 50, 55];
const CHORD_D_OVER_FS: number[] = [42, 45, 50, 54];
const CHORD_A: number[] = [45, 49, 52, 57];
const CHORD_EM: number[] = [40, 43, 47, 52];
const CHORD_AM: number[] = [45, 48, 52, 57];
const CHORD_F: number[] = [41, 45, 48, 53];
const CHORD_C: number[] = [48, 52, 55, 60];
const CHORD_FSM: number[] = [42, 45, 49, 54];
const CHORD_DEEP_A: number[] = [38, 45, 50];
const CHORD_DEEP_A_HIGH: number[] = [38, 45, 57];
const CHORD_DEEP_C: number[] = [36, 43, 48];

const MAJOR_MELODY = [62, 64, 66, 69, 71, 73, 74, 76];
const GLOAM_MELODY = [59, 62, 64, 66, 69, 71, 74];
const RUIN_MELODY = [57, 60, 62, 64, 67, 69, 72, 74];
const DEEP_MELODY = [69, 74, 76, 81];

// Slow, warm progressions in the spirit of pastoral Western-RPG scoring:
// long string pads, harp arpeggios, an occasional flute phrase, a modal drone.
const MUSIC_PROFILES: Record<MusicZone, MusicProfile> = {
  title: {
    chords: [CHORD_D, CHORD_A_OVER_CS, CHORD_BM, CHORD_G, CHORD_D_OVER_FS, CHORD_G, CHORD_A, CHORD_D],
    melody: MAJOR_MELODY,
    chordDur: 7.5,
    harp: 0.7,
    flute: 0.8,
    choir: 0.55,
    drone: 0.3,
    cutoff: 1500,
    gain: 1,
    rest: 0.12,
  },
  hub: {
    chords: [CHORD_D, CHORD_A_OVER_CS, CHORD_BM, CHORD_G, CHORD_D_OVER_FS, CHORD_G, CHORD_A, CHORD_D],
    melody: MAJOR_MELODY,
    chordDur: 8,
    harp: 0.9,
    flute: 0.5,
    choir: 0.4,
    drone: 0.3,
    cutoff: 1500,
    gain: 0.95,
    rest: 0.14,
  },
  reach: {
    chords: [CHORD_D, CHORD_G, CHORD_EM, CHORD_A, CHORD_BM, CHORD_G, CHORD_A, CHORD_D],
    melody: MAJOR_MELODY,
    chordDur: 7,
    harp: 0.75,
    flute: 0.7,
    choir: 0.3,
    drone: 0.3,
    cutoff: 1600,
    gain: 1,
    rest: 0.12,
  },
  gloam: {
    chords: [CHORD_BM, CHORD_G, CHORD_A, CHORD_EM, CHORD_BM, CHORD_FSM, CHORD_G, CHORD_A],
    melody: GLOAM_MELODY,
    chordDur: 8.5,
    harp: 0.45,
    flute: 0.3,
    choir: 0.55,
    drone: 0.35,
    cutoff: 1150,
    gain: 0.9,
    rest: 0.16,
  },
  ruins: {
    chords: [CHORD_AM, CHORD_F, CHORD_C, CHORD_G, CHORD_AM, CHORD_EM, CHORD_F, CHORD_G],
    melody: RUIN_MELODY,
    chordDur: 9,
    harp: 0.28,
    flute: 0.2,
    choir: 0.7,
    drone: 0.4,
    cutoff: 950,
    gain: 0.85,
    rest: 0.16,
  },
  dungeon: {
    chords: [CHORD_DEEP_A, CHORD_DEEP_A_HIGH, CHORD_DEEP_C, CHORD_DEEP_A],
    melody: DEEP_MELODY,
    chordDur: 12,
    harp: 0.12,
    flute: 0.4,
    choir: 0.75,
    drone: 0.8,
    cutoff: 800,
    gain: 0.8,
    rest: 0.2,
  },
};

export class AudioEngine {
  enabled = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientStarted = false;
  private noiseBuffer: AudioBuffer | null = null;
  private lastPlayed = new Map<string, number>();
  private musicBus: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStarted = false;
  private nextChordTime = 0;
  private chordIndex = 0;
  private profileName: MusicZone = "title";
  private profile: MusicProfile = MUSIC_PROFILES.title;
  private droneGain: GainNode | null = null;

  unlock(): void {
    if (!this.ctx) {
      const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) return;
      this.ctx = new Context();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.25 : 0;
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (this.enabled) {
      this.startAmbient();
      this.startMusic();
    }
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.ctx && this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(this.enabled ? 0.25 : 0, this.ctx.currentTime + 0.18);
    }
    if (this.enabled) {
      this.unlock();
      this.play("ui");
    }
    return this.enabled;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private startAmbient(): void {
    if (!this.ctx || !this.master || this.ambientStarted || !this.noiseBuffer) return;
    this.ambientStarted = true;
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.028;
    gain.connect(this.master);
    this.ambientGain = gain;

    const drone = ctx.createOscillator();
    const drone2 = ctx.createOscillator();
    const droneFilter = ctx.createBiquadFilter();
    const droneGain = ctx.createGain();
    drone.type = "sine";
    drone2.type = "triangle";
    drone.frequency.value = 55;
    drone2.frequency.value = 82.4;
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 220;
    droneGain.gain.value = 0.14;
    drone.connect(droneFilter);
    drone2.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(gain);
    drone.start();
    drone2.start();

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.055;
    lfoGain.gain.value = 0.05;
    lfo.connect(lfoGain);
    lfoGain.connect(droneGain.gain);
    lfo.start();

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 500;
    noiseFilter.Q.value = 0.5;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.045;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(gain);
    noise.start();
  }

  play(name: string): void {
    if (!this.enabled) return;
    if (!this.ctx || !this.master) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();
    const now = this.ctx.currentTime;
    const last = this.lastPlayed.get(name) ?? 0;
    const cooldowns: Record<string, number> = {
      hit: 0.07,
      attack: 0.09,
      enemyHit: 0.11,
      arrow: 0.08,
      bossHit: 0.15,
      ui: 0.04,
    };
    if (now - last < (cooldowns[name] ?? 0.02)) return;
    this.lastPlayed.set(name, now);

    switch (name as SoundName) {
      case "ui":
        this.tone(620, 480, 0.04, 0.055, "triangle");
        break;
      case "target":
        this.tone(740, 920, 0.06, 0.022, "sine");
        break;
      case "start":
        this.chord([261.6, 329.6, 392], 1.2, 0.06, "sine");
        this.tone(523, 523, 0.9, 0.035, "triangle", 0.25);
        break;
      case "attack":
        this.noiseSweep(0.09, 900, 260, 0.08);
        this.tone(120, 74, 0.1, 0.055, "sine");
        break;
      case "hit":
        this.noiseSweep(0.06, 480, 100, 0.11);
        this.tone(95, 62, 0.09, 0.055, "sine");
        break;
      case "crit":
        this.noiseSweep(0.12, 1900, 260, 0.1);
        this.tone(180, 90, 0.16, 0.06, "sawtooth");
        break;
      case "enemyHit":
        this.noiseSweep(0.05, 330, 100, 0.045);
        this.tone(86, 58, 0.08, 0.035, "sine");
        break;
      case "bossHit":
        this.noiseSweep(0.18, 250, 50, 0.09);
        this.tone(58, 38, 0.22, 0.075, "sine");
        break;
      case "cast":
        this.tone(330, 880, 0.22, 0.045, "sine");
        this.tone(640, 1240, 0.18, 0.024, "triangle", 0.03);
        break;
      case "arrow":
        this.noiseSweep(0.08, 2800, 900, 0.055);
        this.tone(420, 300, 0.07, 0.02, "triangle");
        break;
      case "cleave":
        this.noiseSweep(0.16, 1100, 180, 0.12);
        this.tone(140, 65, 0.2, 0.06, "sawtooth");
        break;
      case "stun":
        this.tone(150, 95, 0.18, 0.08, "square");
        this.noiseSweep(0.08, 1500, 700, 0.04);
        break;
      case "heal":
        this.chord([523.3, 659.3, 784], 0.55, 0.035, "sine");
        break;
      case "frost":
        this.tone(1200, 440, 0.3, 0.04, "sine");
        this.noiseSweep(0.22, 3600, 1200, 0.035);
        break;
      case "blink":
        this.tone(300, 1300, 0.18, 0.038, "triangle");
        this.tone(1200, 300, 0.22, 0.022, "sine", 0.03);
        break;
      case "root":
        this.tone(130, 85, 0.22, 0.055, "triangle");
        this.noiseSweep(0.18, 420, 150, 0.03);
        break;
      case "potion":
        this.tone(240, 380, 0.08, 0.045, "sine");
        this.tone(380, 620, 0.14, 0.038, "triangle", 0.1);
        break;
      case "loot":
        this.chord([659.3, 880, 1046.5], 0.4, 0.032, "sine");
        break;
      case "equip":
        this.noiseSweep(0.08, 1700, 500, 0.03);
        this.tone(290, 460, 0.12, 0.027, "triangle");
        break;
      case "coin":
        this.tone(1480, 1580, 0.07, 0.03, "sine");
        this.tone(1760, 1860, 0.1, 0.022, "sine", 0.06);
        break;
      case "quest":
        this.chord([392, 493.9, 587.3], 0.55, 0.04, "triangle");
        break;
      case "questReady":
        this.chord([523.3, 659.3], 0.3, 0.034, "sine");
        this.tone(783.99, 783.99, 0.35, 0.034, "sine", 0.2);
        break;
      case "questComplete":
        this.chord([392, 523.3, 659.3, 783.99], 1, 0.037, "triangle");
        break;
      case "levelup":
        [392, 523.3, 659.3, 783.99, 1046.5].forEach((frequency, i) => {
          this.tone(frequency, frequency, 0.5, 0.045, "sine", i * 0.11);
        });
        break;
      case "kill":
        this.noiseSweep(0.14, 600, 80, 0.055);
        break;
      case "victory":
        [261.6, 329.6, 392, 523.3].forEach((frequency, i) => {
          this.tone(frequency, frequency, 1.1, 0.042, "sine", i * 0.16);
        });
        break;
      case "boss":
        this.tone(55, 43, 1.2, 0.08, "sine");
        this.tone(110, 82, 1, 0.035, "triangle", 0.08);
        this.noiseSweep(0.8, 180, 50, 0.045);
        break;
      case "death":
        this.tone(220, 55, 1.4, 0.075, "sine");
        this.noiseSweep(1.2, 500, 60, 0.05);
        break;
      case "respawn":
        this.chord([261.6, 392, 523.3], 0.8, 0.034, "sine");
        break;
      case "area":
        this.tone(523.3, 523.3, 0.7, 0.022, "sine");
        this.tone(659.3, 659.3, 0.9, 0.018, "sine", 0.16);
        break;
      case "portal":
        this.tone(180, 760, 0.8, 0.04, "sine");
        this.tone(760, 180, 0.8, 0.025, "triangle", 0.16);
        this.noiseSweep(0.6, 900, 300, 0.025);
        break;
      case "error":
        this.tone(120, 95, 0.14, 0.05, "square");
        break;
      case "lowHealth":
        this.tone(78, 78, 0.3, 0.055, "sine");
        this.tone(117, 117, 0.3, 0.03, "sine", 0.32);
        break;
      case "warn":
        this.tone(160, 120, 0.5, 0.045, "sawtooth");
        break;
      case "rift":
        this.tone(80, 320, 1, 0.05, "sine");
        this.noiseSweep(1.2, 300, 1200, 0.035);
        break;
      default:
        this.tone(520, 440, 0.05, 0.03, "sine");
        break;
    }
  }

  private tone(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    delay = 0,
  ): void {
    if (!this.ctx || !this.master) return;
    const start = this.ctx.currentTime + delay;
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.02, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  private chord(frequencies: number[], duration: number, volume: number, type: OscillatorType): void {
    frequencies.forEach((frequency, i) => {
      this.tone(frequency, frequency, duration, volume, type, i * 0.02);
    });
  }

  private noiseSweep(duration: number, startFrequency: number, endFrequency: number, volume: number): void {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const start = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(startFrequency, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), start + duration);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(start);
    source.stop(start + duration + 0.03);
  }

  setAmbientIntensity(value: number): void {
    if (!this.ctx || !this.ambientGain) return;
    const target = 0.018 + value * 0.018;
    this.ambientGain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 1.4);
  }

  dispose(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.musicBus && this.ctx) {
      this.musicBus.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.25);
    }
  }

  setZone(zone: MusicZone): void {
    if (zone === this.profileName) return;
    this.profileName = zone;
    this.profile = MUSIC_PROFILES[zone] ?? MUSIC_PROFILES.title;
    this.chordIndex = 0;
    if (this.droneGain && this.ctx) {
      this.droneGain.gain.setTargetAtTime(this.profile.drone, this.ctx.currentTime, 1.6);
    }
  }

  private startMusic(): void {
    if (this.musicStarted || !this.ctx || !this.master) return;
    this.musicStarted = true;
    const ctx = this.ctx;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.exponentialRampToValueAtTime(0.55, ctx.currentTime + 3.5);
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 24;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.02;
    compressor.release.value = 0.35;
    bus.connect(compressor);
    compressor.connect(this.master);
    this.musicBus = bus;

    // A quiet modal drone (A + fifth) sits under every region, Oblivion-style.
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.0001;
    droneGain.connect(bus);
    this.droneGain = droneGain;
    const droneVoices: [number, number][] = [
      [110, 0.03],
      [164.81, 0.017],
    ];
    for (const [frequency, level] of droneVoices) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = frequency;
      const voiceGain = ctx.createGain();
      voiceGain.gain.value = level;
      osc.connect(voiceGain);
      voiceGain.connect(droneGain);
      osc.start();
    }
    droneGain.gain.setTargetAtTime(this.profile.drone, ctx.currentTime + 1, 2);

    this.nextChordTime = ctx.currentTime + 0.8;
    this.musicTimer = window.setInterval(() => this.musicTick(), 250);
  }

  private musicTick(): void {
    if (!this.ctx || !this.musicBus || !this.enabled) return;
    if (this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    if (this.nextChordTime < now) this.nextChordTime = now + 0.4;
    let guard = 0;
    while (this.nextChordTime < now + 1.5 && guard < 4) {
      this.scheduleChordBlock(this.nextChordTime);
      this.chordIndex += 1;
      this.nextChordTime += this.profile.chordDur;
      guard += 1;
    }
  }

  private scheduleChordBlock(start: number): void {
    if (!this.ctx) return;
    const profile = this.profile;
    // Occasional breathing bar: only the drone carries it.
    if (Math.random() < profile.rest) return;
    const chord = profile.chords[this.chordIndex % profile.chords.length];
    const dur = profile.chordDur;
    const vol = profile.gain;

    chord.forEach((note, i) => {
      this.schedulePad(note, start, dur, profile.cutoff, 0.045 * vol * (i === 0 ? 0.85 : 1));
    });

    if (profile.choir > 0) {
      for (let i = 1; i < chord.length; i += 1) {
        this.scheduleChoir(chord[i] + 12, start, dur, 0.026 * vol * profile.choir);
      }
    }

    if (profile.harp > 0) {
      const step = 3 - 2.2 * profile.harp;
      const tones = chord.flatMap((note) => [note, note + 12]);
      let cursor = Math.floor(Math.random() * tones.length);
      let t = start + 0.2 + Math.random() * 0.5;
      while (t < start + dur) {
        if (Math.random() < 0.86) {
          cursor = clamp(cursor + (Math.random() < 0.62 ? 1 : -1), 0, tones.length - 1);
          this.scheduleHarp(
            tones[cursor],
            t + (Math.random() - 0.5) * 0.05,
            0.05 * vol * profile.harp * (0.75 + Math.random() * 0.5),
          );
        }
        t += step * (0.72 + Math.random() * 0.6);
      }
    }

    if (profile.flute > 0 && Math.random() < profile.flute * 0.8) {
      const phraseNotes = 3 + Math.floor(Math.random() * 4);
      let noteIndex = Math.floor(Math.random() * profile.melody.length * 0.5);
      let t = start + 0.5 + Math.random() * dur * 0.45;
      for (let i = 0; i < phraseNotes; i += 1) {
        const noteDur = 0.5 + Math.random() * 0.55;
        if (t + noteDur > start + dur) break;
        this.scheduleFlute(
          profile.melody[noteIndex],
          t,
          noteDur,
          0.052 * vol * profile.flute * (0.8 + Math.random() * 0.4),
        );
        noteIndex = clamp(noteIndex + (Math.random() < 0.6 ? 1 : -1), 0, profile.melody.length - 1);
        t += noteDur + (Math.random() < 0.25 ? 0.32 : 0.06);
      }
    }
  }

  private schedulePad(note: number, start: number, dur: number, cutoff: number, vol: number): void {
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (!ctx || !bus) return;
    const end = start + dur + 3;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff * 0.5, start);
    filter.frequency.linearRampToValueAtTime(cutoff, start + dur * 0.55);
    filter.Q.value = 0.5;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), start + Math.min(2.4, dur * 0.4));
    env.gain.setValueAtTime(vol, start + dur * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    filter.connect(env);
    env.connect(bus);
    const frequency = mtof(note);
    for (const detune of [-7, 7]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = frequency;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(start);
      osc.stop(end + 0.05);
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.11 + Math.random() * 0.12;
      lfoGain.gain.value = 3;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.detune);
      lfo.start(start);
      lfo.stop(end + 0.05);
    }
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = frequency / 2;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.55;
    sub.connect(subGain);
    subGain.connect(filter);
    sub.start(start);
    sub.stop(end + 0.05);
  }

  private scheduleChoir(note: number, start: number, dur: number, vol: number): void {
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (!ctx || !bus) return;
    const end = start + dur + 3.5;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 640 + Math.random() * 260;
    band.Q.value = 1.1;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), start + Math.min(3, dur * 0.45));
    env.gain.setValueAtTime(vol, start + dur * 0.6);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    const trem = ctx.createGain();
    trem.gain.value = 0.75;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.12;
    lfoGain.gain.value = 0.25;
    lfo.connect(lfoGain);
    lfoGain.connect(trem.gain);
    lfo.start(start);
    lfo.stop(end + 0.05);
    band.connect(trem);
    trem.connect(env);
    env.connect(bus);
    const frequency = mtof(note);
    for (const detune of [-5, 5]) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = frequency;
      osc.detune.value = detune;
      osc.connect(band);
      osc.start(start);
      osc.stop(end + 0.05);
    }
  }

  private scheduleHarp(note: number, start: number, vol: number): void {
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (!ctx || !bus) return;
    const dur = 1.3 + Math.random() * 0.7;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), start + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 3200;
    env.connect(filter);
    filter.connect(bus);
    const frequency = mtof(note);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = frequency;
    osc.connect(env);
    osc.start(start);
    osc.stop(start + dur + 0.05);
    const shimmer = ctx.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.value = frequency * 2;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.3;
    shimmer.connect(shimmerGain);
    shimmerGain.connect(env);
    shimmer.start(start);
    shimmer.stop(start + dur + 0.05);
  }

  private scheduleFlute(note: number, start: number, dur: number, vol: number): void {
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (!ctx || !bus) return;
    const end = start + dur + 0.45;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), start + Math.min(0.16, dur * 0.3));
    env.gain.setValueAtTime(vol, start + dur * 0.8);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2600;
    env.connect(filter);
    filter.connect(bus);
    const frequency = mtof(note);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = frequency;
    osc.connect(env);
    const vib = ctx.createOscillator();
    const vibGain = ctx.createGain();
    vib.frequency.value = 5.2;
    vibGain.gain.setValueAtTime(0, start);
    vibGain.gain.linearRampToValueAtTime(9, start + 0.3);
    vib.connect(vibGain);
    vibGain.connect(osc.detune);
    vib.start(start);
    vib.stop(end + 0.05);
    osc.start(start);
    osc.stop(end + 0.05);
    const breath = ctx.createOscillator();
    breath.type = "sine";
    breath.frequency.value = frequency * 2;
    const breathGain = ctx.createGain();
    breathGain.gain.value = 0.14;
    breath.connect(breathGain);
    breathGain.connect(env);
    breath.start(start);
    breath.stop(end + 0.05);
  }
}
