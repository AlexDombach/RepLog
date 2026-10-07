/**
 * Haptics + sound, generated in-browser so nothing needs to be downloaded.
 *
 * iOS note: Safari only allows audio after a user gesture, and it ignores
 * navigator.vibrate entirely. We unlock the AudioContext on the first tap
 * (marking a set done) so the rest-timer chime can fire later.
 */

let ctx: AudioContext | null = null

export function unlockAudio(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume()
    return
  }
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctor) return
    ctx = new Ctor()
    // A zero-length silent blip completes the unlock on iOS.
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    gain.gain.value = 0
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.01)
  } catch {
    ctx = null
  }
}

function tone(freq: number, startOffset: number, duration: number, volume: number) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  const t0 = ctx.currentTime + startOffset
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* unsupported — iOS Safari */
  }
}

/** Short confirmation when a set is marked done. */
export function beepSetDone(sound: boolean, haptic: boolean): void {
  if (haptic) vibrate(18)
  if (sound) {
    unlockAudio()
    tone(880, 0, 0.09, 0.18)
  }
}

/** Rising three-note chime when rest is over. */
export function beepRestDone(sound: boolean, haptic: boolean): void {
  if (haptic) vibrate([90, 70, 90, 70, 180])
  if (sound) {
    unlockAudio()
    tone(660, 0, 0.12, 0.22)
    tone(880, 0.14, 0.12, 0.22)
    tone(1175, 0.28, 0.22, 0.24)
  }
}

/** Celebration for a new PR. */
export function beepPr(sound: boolean, haptic: boolean): void {
  if (haptic) vibrate([40, 50, 40, 50, 120])
  if (sound) {
    unlockAudio()
    tone(784, 0, 0.1, 0.2)
    tone(988, 0.1, 0.1, 0.2)
    tone(1319, 0.22, 0.3, 0.22)
  }
}

/** Workout complete fanfare. */
export function beepFinish(sound: boolean, haptic: boolean): void {
  if (haptic) vibrate([60, 60, 60, 60, 220])
  if (sound) {
    unlockAudio()
    tone(523, 0, 0.14, 0.2)
    tone(659, 0.14, 0.14, 0.2)
    tone(784, 0.28, 0.14, 0.2)
    tone(1047, 0.42, 0.4, 0.22)
  }
}
