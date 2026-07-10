/**
 * IdleDetector — a decoupled typing-idle timer.
 *
 * Records activity via ping() and fires onIdle after thresholdMs of inactivity.
 * The editor calls ping() on every keystroke and start()/stop() around focus.
 *
 * This replaces the inline idle logic in editor.tsx with a unit-tested
 * primitive usable by both the contentEditable and Tiptap editors. The default
 * threshold (45000ms) matches the IR Report §2.3.6 contract, not the 2000ms
 * debugging value currently in editor.tsx — that drift is corrected here.
 */

export interface IdleDetectorOptions {
  /** Milliseconds of inactivity before onIdle fires. */
  thresholdMs: number
  /** Called once when the idle threshold elapses. */
  onIdle: () => void
}

export class IdleDetector {
  private thresholdMs: number
  private onIdle: () => void
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(opts: IdleDetectorOptions) {
    this.thresholdMs = opts.thresholdMs
    this.onIdle = opts.onIdle
  }

  /** Begin watching for idle. Idempotent. */
  start(): void {
    this.clear()
    this.arm()
  }

  /** Stop watching. No further onIdle will fire until start() again. */
  stop(): void {
    this.clear()
  }

  /** Signal user activity; resets the idle countdown. Safe before start(). */
  ping(): void {
    if (this.timer === null) return
    this.clear()
    this.arm()
  }

  private arm(): void {
    this.timer = setTimeout(() => {
      this.onIdle()
    }, this.thresholdMs)
  }

  private clear(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
