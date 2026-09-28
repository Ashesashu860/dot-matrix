'use client';

/**
 * Sound and haptic feedback. Sound effects are synthesised with the Web Audio API;
 * background music is the Dots Matrix theme track (public/audio), cached by the
 * service worker the first time it plays so it also works offline.
 *
 * Mixing: effects and music run on separate buses into a limiter.
 *   - The track averages about -16 dBFS; MUSIC_LEVEL puts it near -29 dBFS, a bed.
 *   - Effects peak at -22..-30 dBFS raw; SFX_LEVEL lifts them to about -10..-18,
 *     so they sit roughly 12-18 dB above the music.
 *   - While an effect plays the music ducks by DUCK (about -6 dB) and recovers
 *     smoothly, so neither masks the other.
 * The Settings sliders scale each bus around that balance (the default of 80
 * keeps it exactly; 100 is about +4 dB, 0 is silent).
 */

const SFX_LEVEL = 4; // +12 dB
const MUSIC_LEVEL = 0.22; // -13 dB
const DUCK = 0.5; // -6 dB on the music while an effect sounds
const DUCK_ATTACK = 0.03;
const DUCK_RELEASE = 0.35;

export const DEFAULT_VOLUME = 80;

/** Slider position (0-100) to a gain multiplier; squared for a perceptual feel. */
export function volumeToGain(volume: number): number {
  const v = Math.min(100, Math.max(0, volume)) / DEFAULT_VOLUME;
  return v * v;
}

let sfxGain = SFX_LEVEL;
let musicGain = MUSIC_LEVEL;

interface Mixer {
  ctx: AudioContext;
  sfx: GainNode;
  music: GainNode;
}

let mixer: Mixer | null = null;
/** When the current duck may start recovering (AudioContext time). */
let duckUntil = 0;

/**
 * Browsers refuse to start audio before the user has interacted with the page
 * (and log a warning if we try), so all audio waits for the first tap or key.
 */
function hasUserActivation(): boolean {
  return typeof navigator === 'undefined' || !navigator.userActivation || navigator.userActivation.hasBeenActive;
}

function audio(): Mixer | null {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null;
  if (!hasUserActivation()) return null;
  if (!mixer) {
    const ctx = new AudioContext();
    // Limiter: keeps overlapping effects + music from clipping.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(ctx.destination);
    const sfx = ctx.createGain();
    sfx.gain.value = sfxGain;
    sfx.connect(limiter);
    const music = ctx.createGain();
    music.gain.value = musicGain;
    music.connect(limiter);
    mixer = { ctx, sfx, music };
  }
  if (mixer.ctx.state === 'suspended') void mixer.ctx.resume();
  return mixer;
}

/** Lowers the music until `end`, then eases it back to its normal level. */
function duckMusic(m: Mixer, end: number) {
  const now = m.ctx.currentTime;
  const gain = m.music.gain;
  duckUntil = Math.max(duckUntil, end);
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(gain.value, now);
  gain.linearRampToValueAtTime(musicGain * DUCK, now + DUCK_ATTACK);
  gain.setValueAtTime(musicGain * DUCK, Math.max(duckUntil, now + DUCK_ATTACK));
  gain.linearRampToValueAtTime(musicGain, Math.max(duckUntil, now + DUCK_ATTACK) + DUCK_RELEASE);
}

/** Smoothly moves a bus to a new level (avoids clicks while dragging a slider). */
function rampBus(param: AudioParam, ctx: AudioContext, value: number) {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(value, now + 0.05);
}

export function setSoundVolume(volume: number) {
  sfxGain = SFX_LEVEL * volumeToGain(volume);
  if (mixer) rampBus(mixer.sfx.gain, mixer.ctx, sfxGain);
}

export function setMusicVolume(volume: number) {
  musicGain = MUSIC_LEVEL * volumeToGain(volume);
  if (mixer) {
    duckUntil = 0;
    rampBus(mixer.music.gain, mixer.ctx, musicGain);
  } else if (music) {
    music.volume = Math.min(1, musicGain);
  }
}

/** `vibrato` is the pitch wobble depth in Hz (at about 6 Hz); 0 for a steady note. */
function tone(
  freq: number,
  start: number,
  duration: number,
  gain = 0.08,
  type: OscillatorType = 'sine',
  vibrato = 0,
) {
  const m = audio();
  if (!m) return;
  const ac = m.ctx;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = ac.currentTime + start;
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(gain, t + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(amp).connect(m.sfx);
  if (vibrato) {
    const lfo = ac.createOscillator();
    const depth = ac.createGain();
    lfo.frequency.value = 6;
    depth.gain.value = vibrato;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + duration + 0.02);
  }
  osc.start(t);
  osc.stop(t + duration + 0.02);
  if (musicWanted) duckMusic(m, t + duration);
}

/** A melody as [frequency, start beat, length in beats] triples. */
type Notes = ReadonlyArray<readonly [number, number, number]>;

function melody(notes: Notes, beat: number, gain: number, type: OscillatorType, vibrato = 0) {
  for (const [freq, at, length] of notes) tone(freq, at * beat, length * beat, gain, type, vibrato);
}

// Victory: a rising C-major fanfare that lands on a ringing chord over a bass C.
const WIN_LEAD: Notes = [
  [392, 0, 0.9], // G4
  [523, 1, 0.9], // C5
  [659, 2, 0.9], // E5
  [784, 3, 1.4], // G5
  [659, 4.5, 0.6], // E5
  [784, 5.2, 4], // G5, held
];
const WIN_CHORD: Notes = [
  [523, 5.2, 4], // C5
  [659, 5.2, 4], // E5
  [1047, 5.2, 4], // C6
];
const WIN_BASS: Notes = [
  [131, 0, 3], // C3
  [196, 3, 2], // G3
  [131, 5.2, 4], // C3
];

// Defeat: the "sad trombone" — three sagging steps down and a long, wobbling last note.
const LOSE_LEAD: Notes = [
  [392, 0, 0.9], // G4
  [370, 1, 0.9], // F#4
  [349, 2, 0.9], // F4
  [330, 3, 4], // E4, held
];
const LOSE_BASS: Notes = [
  [98, 0, 3], // G2
  [82, 3, 4], // E2
];

export type SoundName = 'line' | 'capture' | 'turn' | 'win' | 'lose' | 'error';

export function playSound(name: SoundName) {
  switch (name) {
    case 'line':
      tone(520, 0, 0.09, 0.05, 'triangle');
      break;
    case 'capture':
      tone(660, 0, 0.12);
      tone(880, 0.08, 0.18);
      break;
    case 'turn':
      tone(440, 0, 0.06, 0.03);
      break;
    case 'win':
      melody(WIN_LEAD, 0.12, 0.06, 'triangle');
      melody(WIN_CHORD, 0.12, 0.03, 'sine');
      melody(WIN_BASS, 0.12, 0.05, 'triangle');
      break;
    case 'lose':
      melody(LOSE_LEAD, 0.28, 0.05, 'sawtooth', 4);
      melody(LOSE_BASS, 0.28, 0.04, 'triangle');
      break;
    case 'error':
      tone(200, 0, 0.15, 0.05, 'square');
      break;
  }
}

export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Unsupported (iOS) — ignore.
    }
  }
}

// --- Background music: the theme track, looped, only while enabled. ---

export const MUSIC_URL = '/audio/dot-matrix-theme.mp3';

let music: HTMLAudioElement | null = null;
/** Whether `music` is connected to the mixer's music bus (possible only once). */
let musicRouted = false;
let musicWanted = false;
let loading: Promise<HTMLAudioElement | null> | null = null;

/**
 * Downloads the track once with a plain fetch (so the service worker can cache
 * the whole file) and plays it from a blob URL: one download, then offline-safe.
 */
function loadMusic(): Promise<HTMLAudioElement | null> {
  loading ??= fetch(MUSIC_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`Music request failed: ${response.status}`);
      return response.blob();
    })
    .then((blob) => {
      const element = new Audio(URL.createObjectURL(blob));
      element.loop = true;
      music = element;
      return element;
    })
    .catch(() => {
      loading = null; // Offline before the first download: try again next time.
      return null;
    });
  return loading;
}

function syncMusic() {
  if (!music) return;
  if (musicWanted && document.visibilityState === 'visible') {
    // Before the first interaction play() would be rejected; the first tap retries.
    if (!hasUserActivation()) return;
    const m = audio();
    if (m && !musicRouted) {
      // Route through the mixer so the music bus level and ducking apply.
      m.ctx.createMediaElementSource(music).connect(m.music);
      musicRouted = true;
    } else if (!m) {
      music.volume = Math.min(1, musicGain);
    }
    void music.play().catch(() => {});
  } else {
    music.pause();
  }
}

if (typeof document !== 'undefined') {
  // Don't keep playing from a background tab or a locked phone.
  document.addEventListener('visibilitychange', syncMusic);
  // Start music that was switched on before the first interaction.
  const onFirstInteraction = () => {
    document.removeEventListener('pointerdown', onFirstInteraction, true);
    document.removeEventListener('keydown', onFirstInteraction, true);
    syncMusic();
  };
  document.addEventListener('pointerdown', onFirstInteraction, true);
  document.addEventListener('keydown', onFirstInteraction, true);
}

export function setMusic(enabled: boolean) {
  musicWanted = enabled;
  if (typeof window === 'undefined') return;
  if (!enabled) {
    music?.pause();
    return;
  }
  void loadMusic().then(syncMusic);
}
