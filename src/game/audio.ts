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

export class AudioEngine {
  enabled = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientStarted = false;
  private noiseBuffer: AudioBuffer | null = null;
  private lastPlayed = new Map<string, number>();

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
    if (this.enabled) this.startAmbient();
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
}
