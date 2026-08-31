// Web Audio API Sound Synthesizer for 8-bit NES Audio & Dynamic BGM Tracks

export type BGMType = 'overworld' | 'underground' | 'castle' | 'starman' | null;
export type JingleType = 'game_over' | 'level_clear' | 'death';

interface Note {
  freq: number;
  duration: number; // in sixteenth notes (1 = 1/16th)
  type?: OscillatorType;
  vol?: number;
}

// Note frequencies map for easy sequence writing
const N: Record<string, number> = {
  REST: 0,
  C3: 130.81, Db3: 138.59, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61, Gb3: 185.00, G3: 196.00, Ab3: 207.65, A3: 220.00, Bb3: 233.08, B3: 246.94,
  C4: 261.63, Db4: 277.18, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, Gb4: 369.99, G4: 392.00, Ab4: 415.30, A4: 440.00, Bb4: 466.16, B4: 493.88,
  C5: 523.25, Db5: 554.37, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46, Gb5: 739.99, G5: 783.99, Ab5: 830.61, A5: 880.00, Bb5: 932.33, B5: 987.77,
  C6: 1046.50, D6: 1174.66, E6: 1318.51, F6: 1396.91, G6: 1567.98, A6: 1760.00,
};

// Classic Mario Overworld Theme Melody & Bass
const OVERWORLD_MELODY: Note[] = [
  { freq: N.E5, duration: 1 }, { freq: N.E5, duration: 2 }, { freq: N.E5, duration: 2 }, { freq: N.C5, duration: 1 }, { freq: N.E5, duration: 2 },
  { freq: N.G5, duration: 4 }, { freq: N.G4, duration: 4 },
  { freq: N.C5, duration: 3 }, { freq: N.G4, duration: 3 }, { freq: N.E4, duration: 3 },
  { freq: N.A4, duration: 2 }, { freq: N.B4, duration: 2 }, { freq: N.Bb4, duration: 1 }, { freq: N.A4, duration: 2 },
  { freq: N.G4, duration: 2 }, { freq: N.E5, duration: 2 }, { freq: N.G5, duration: 2 }, { freq: N.A5, duration: 2 },
  { freq: N.F5, duration: 1 }, { freq: N.G5, duration: 1 }, { freq: N.E5, duration: 2 }, { freq: N.C5, duration: 1 }, { freq: N.D5, duration: 1 }, { freq: N.B4, duration: 2 },
];

const OVERWORLD_BASS: Note[] = [
  { freq: N.D3, duration: 1 }, { freq: N.D3, duration: 2 }, { freq: N.D3, duration: 2 }, { freq: N.D3, duration: 1 }, { freq: N.D3, duration: 2 },
  { freq: N.G3, duration: 4 }, { freq: N.G2 || 98, duration: 4 },
  { freq: N.G3, duration: 3 }, { freq: N.E3, duration: 3 }, { freq: N.C3, duration: 3 },
  { freq: N.F3, duration: 2 }, { freq: N.G3, duration: 2 }, { freq: N.Gb3, duration: 1 }, { freq: N.F3, duration: 2 },
  { freq: N.E3, duration: 2 }, { freq: N.C4, duration: 2 }, { freq: N.E4, duration: 2 }, { freq: N.F4, duration: 2 },
  { freq: N.D4, duration: 1 }, { freq: N.E4, duration: 1 }, { freq: N.C4, duration: 2 }, { freq: N.A3, duration: 1 }, { freq: N.B3, duration: 1 }, { freq: N.G3, duration: 2 },
];

// Underground Theme
const UNDERGROUND_MELODY: Note[] = [
  { freq: N.C4, duration: 1 }, { freq: N.C5, duration: 1 }, { freq: N.A3, duration: 1 }, { freq: N.A4, duration: 1 },
  { freq: N.Bb3, duration: 1 }, { freq: N.Bb4, duration: 1 }, { freq: N.REST, duration: 2 },
  { freq: N.C3, duration: 1 }, { freq: N.C4, duration: 1 }, { freq: N.Ab3, duration: 1 }, { freq: N.Ab4, duration: 1 },
  { freq: N.Bb3, duration: 1 }, { freq: N.Bb4, duration: 1 }, { freq: N.REST, duration: 2 },
  { freq: N.F3, duration: 1 }, { freq: N.F4, duration: 1 }, { freq: N.D3, duration: 1 }, { freq: N.D4, duration: 1 },
  { freq: N.Eb3, duration: 1 }, { freq: N.Eb4, duration: 1 }, { freq: N.REST, duration: 2 },
];

// Castle Theme
const CASTLE_MELODY: Note[] = [
  { freq: N.C4, duration: 1 }, { freq: N.Db4, duration: 1 }, { freq: N.E4, duration: 1 }, { freq: N.C4, duration: 1 },
  { freq: N.Db4, duration: 1 }, { freq: N.E4, duration: 1 }, { freq: N.C4, duration: 1 }, { freq: N.Db4, duration: 1 },
  { freq: N.Gb4, duration: 2 }, { freq: N.F4, duration: 2 }, { freq: N.E4, duration: 2 }, { freq: N.Eb4, duration: 2 },
  { freq: N.D4, duration: 1 }, { freq: N.Eb4, duration: 1 }, { freq: N.Gb4, duration: 1 }, { freq: N.D4, duration: 1 },
  { freq: N.Eb4, duration: 1 }, { freq: N.Gb4, duration: 1 }, { freq: N.Ab4, duration: 2 }, { freq: N.G4, duration: 2 },
];

// Starman Theme (Fast Tempo)
const STARMAN_MELODY: Note[] = [
  { freq: N.C5, duration: 1 }, { freq: N.C5, duration: 1 }, { freq: N.C5, duration: 1 }, { freq: N.REST, duration: 1 },
  { freq: N.B4, duration: 1 }, { freq: N.C5, duration: 1 }, { freq: N.REST, duration: 1 }, { freq: N.B4, duration: 1 },
  { freq: N.C5, duration: 1 }, { freq: N.A4, duration: 1 }, { freq: N.A4, duration: 1 }, { freq: N.REST, duration: 1 },
  { freq: N.G4, duration: 1 }, { freq: N.A4, duration: 1 }, { freq: N.REST, duration: 1 }, { freq: N.G4, duration: 1 },
];

// Jingles
const JINGLE_GAME_OVER: Note[] = [
  { freq: N.C5, duration: 2 }, { freq: N.G4, duration: 2 }, { freq: N.E4, duration: 2 },
  { freq: N.A4, duration: 2 }, { freq: N.B4, duration: 2 }, { freq: N.A4, duration: 2 },
  { freq: N.Ab4, duration: 2 }, { freq: N.Bb4, duration: 2 }, { freq: N.Ab4, duration: 2 },
  { freq: N.G4, duration: 6 },
];

const JINGLE_LEVEL_CLEAR: Note[] = [
  { freq: N.G4, duration: 1 }, { freq: N.C5, duration: 1 }, { freq: N.E5, duration: 1 },
  { freq: N.G5, duration: 1 }, { freq: N.C6, duration: 1 }, { freq: N.E6, duration: 1 },
  { freq: N.G6, duration: 3 }, { freq: N.E6, duration: 3 },
  { freq: N.G5, duration: 1 }, { freq: N.C6, duration: 1 }, { freq: N.E6, duration: 1 },
  { freq: N.G6, duration: 4 },
];

const JINGLE_DEATH: Note[] = [
  { freq: N.B5, duration: 1 }, { freq: N.F6, duration: 1 }, { freq: N.REST, duration: 1 },
  { freq: N.F6, duration: 1 }, { freq: N.F6, duration: 1 }, { freq: N.E6, duration: 1 },
  { freq: N.D6, duration: 1 }, { freq: N.C6, duration: 1 }, { freq: N.E4, duration: 1 },
  { freq: N.REST, duration: 1 }, { freq: N.E4, duration: 1 }, { freq: N.C4, duration: 2 },
];

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private currentBGM: BGMType = null;
  private bgmTimeoutId: number | null = null;
  private isJinglePlaying: boolean = false;

  private masterVolume: number = 0.8;
  private musicVolume: number = 0.7;
  private sfxVolume: number = 0.9;
  private isMuted: boolean = false;

  public initAudio() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();

        this.masterGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();

        this.musicGain.connect(this.masterGain);
        this.sfxGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this.applyGains();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setVolumes(settings: { masterVolume: number; musicVolume: number; sfxVolume: number; muted: boolean }) {
    this.masterVolume = settings.masterVolume;
    this.musicVolume = settings.musicVolume;
    this.sfxVolume = settings.sfxVolume;
    this.isMuted = settings.muted;
    this.applyGains();
  }

  private applyGains() {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const effectiveMaster = this.isMuted ? 0 : this.masterVolume;

    this.masterGain.gain.setValueAtTime(effectiveMaster, now);
    this.musicGain.gain.setValueAtTime(this.musicVolume * 0.35, now); // BGM gain scaling
    this.sfxGain.gain.setValueAtTime(this.sfxVolume * 0.5, now);     // SFX gain scaling
  }

  // --- BGM TRACK PLAYER ---
  public playBGM(bgm: BGMType) {
    this.initAudio();
    if (this.currentBGM === bgm && this.bgmTimeoutId !== null) return;

    this.stopBGM();
    this.currentBGM = bgm;

    if (!bgm || this.isJinglePlaying) return;

    let melody: Note[] = [];
    let bass: Note[] = [];
    let tempoMs = 120; // 1/16th note duration in ms

    switch (bgm) {
      case 'overworld':
        melody = OVERWORLD_MELODY;
        bass = OVERWORLD_BASS;
        tempoMs = 135;
        break;
      case 'underground':
        melody = UNDERGROUND_MELODY;
        tempoMs = 150;
        break;
      case 'castle':
        melody = CASTLE_MELODY;
        tempoMs = 140;
        break;
      case 'starman':
        melody = STARMAN_MELODY;
        tempoMs = 85;
        break;
    }

    const loopBGM = () => {
      if (this.currentBGM !== bgm || !this.ctx || this.isJinglePlaying) return;

      const now = this.ctx.currentTime;
      let noteOffset = 0;

      // Play melody line
      melody.forEach((note) => {
        const startTime = now + (noteOffset * tempoMs) / 1000;
        const durationSec = (note.duration * tempoMs) / 1000 * 0.9;

        if (note.freq > 0) {
          this.playNote(note.freq, startTime, durationSec, note.type || 'square', this.musicGain);
        }
        noteOffset += note.duration;
      });

      // Play bass line if present
      let bassOffset = 0;
      bass.forEach((note) => {
        const startTime = now + (bassOffset * tempoMs) / 1000;
        const durationSec = (note.duration * tempoMs) / 1000 * 0.9;

        if (note.freq > 0) {
          this.playNote(note.freq, startTime, durationSec, 'triangle', this.musicGain);
        }
        bassOffset += note.duration;
      });

      const totalDurationMs = noteOffset * tempoMs;
      this.bgmTimeoutId = window.setTimeout(loopBGM, totalDurationMs);
    };

    loopBGM();
  }

  public stopBGM() {
    if (this.bgmTimeoutId !== null) {
      clearTimeout(this.bgmTimeoutId);
      this.bgmTimeoutId = null;
    }
    this.currentBGM = null;
  }

  // --- JINGLE PLAYER ---
  public playJingle(jingle: JingleType, onComplete?: () => void) {
    this.initAudio();
    const prevBGM = this.currentBGM;
    this.stopBGM();
    this.isJinglePlaying = true;

    if (!this.ctx) return;

    let sequence: Note[] = [];
    let tempoMs = 120;

    if (jingle === 'game_over') {
      sequence = JINGLE_GAME_OVER;
      tempoMs = 160;
    } else if (jingle === 'level_clear') {
      sequence = JINGLE_LEVEL_CLEAR;
      tempoMs = 110;
    } else if (jingle === 'death') {
      sequence = JINGLE_DEATH;
      tempoMs = 130;
    }

    const now = this.ctx.currentTime;
    let offset = 0;

    sequence.forEach((note) => {
      const startTime = now + (offset * tempoMs) / 1000;
      const durationSec = (note.duration * tempoMs) / 1000 * 0.9;

      if (note.freq > 0) {
        this.playNote(note.freq, startTime, durationSec, 'square', this.sfxGain);
      }
      offset += note.duration;
    });

    const totalMs = offset * tempoMs;
    window.setTimeout(() => {
      this.isJinglePlaying = false;
      if (onComplete) onComplete();
      else if (prevBGM) this.playBGM(prevBGM);
    }, totalMs);
  }

  // Helper note synthesizer
  private playNote(freq: number, startTime: number, durationSec: number, type: OscillatorType, gainNode: GainNode | null) {
    if (!this.ctx || !gainNode) return;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    g.gain.setValueAtTime(0.2, startTime);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + durationSec);

    osc.connect(g);
    g.connect(gainNode);

    osc.start(startTime);
    osc.stop(startTime + durationSec);
  }

  // --- SOUND EFFECTS (SFX) ---
  public playJump(isSuper: boolean = false) {
    this.initAudio();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const startFreq = isSuper ? 180 : 150;
    const endFreq = isSuper ? 750 : 600;
    const duration = isSuper ? 0.2 : 0.15;

    osc.type = 'square';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + duration);
  }

  public playCoin() {
    this.initAudio();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, now); // B5
    osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playPowerupSpawn() {
    this.initAudio();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.3);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playPowerupCollect() {
    this.initAudio();
    if (!this.ctx || !this.sfxGain) return;

    const notes = [330, 392, 659, 523, 587, 784];
    notes.forEach((freq, idx) => {
      const startTime = this.ctx!.currentTime + idx * 0.06;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.06);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(startTime);
      osc.stop(startTime + 0.06);
    });
  }

  public playFireball() {
    this.initAudio();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playSquish() {
    this.initAudio();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playKick() {
    this.initAudio();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playBlockHit() {
    this.initAudio();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playBlockBreak() {
    this.initAudio();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
  }

  public playPipe() {
    this.initAudio();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const notes = [150, 180, 150, 120, 100];
    notes.forEach((freq, idx) => {
      const startTime = now + idx * 0.07;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.06);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(startTime);
      osc.stop(startTime + 0.06);
    });
  }

  public playHurt() {
    this.initAudio();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.4);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playBossDefeat() {
    this.initAudio();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const startTime = now + i * 0.1;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(100 + i * 50, startTime);
      osc.frequency.exponentialRampToValueAtTime(30, startTime + 0.08);

      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.08);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(startTime);
      osc.stop(startTime + 0.08);
    }
  }

  public playPause() {
    this.initAudio();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.setValueAtTime(800, now + 0.08);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.2);
  }
}

export const soundEngine = new SoundEngine();
