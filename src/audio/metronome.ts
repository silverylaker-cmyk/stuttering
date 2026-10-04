import { getAudioContext } from './context';

/**
 * Web Audio 스케줄러 기반 메트로놈 (setTimeout 지터에 영향받지 않도록 미리 예약).
 * 박 하나 = 음절 하나.
 */
export class Metronome {
  private ctx = getAudioContext();
  private timer: number | null = null;
  private nextTime = 0;
  private beat = 0;
  /** 첫 박의 AudioContext 시각(초). 하이라이트 동기화에 쓴다. */
  startTime = 0;
  constructor(
    private spm: number,
    private opts: { accentEvery?: number; volume?: number; silent?: boolean } = {},
  ) {}

  start(delaySec = 0.15) {
    this.stop();
    this.startTime = this.ctx.currentTime + delaySec;
    this.nextTime = this.startTime;
    this.beat = 0;
    const tick = () => {
      const interval = 60 / this.spm;
      while (this.nextTime < this.ctx.currentTime + 0.12) {
        if (!this.opts.silent) this.click(this.nextTime, this.opts.accentEvery ? this.beat % this.opts.accentEvery === 0 : false);
        this.nextTime += interval;
        this.beat++;
      }
    };
    tick();
    this.timer = window.setInterval(tick, 25);
  }

  setSpm(spm: number) {
    this.spm = spm;
  }

  /** 시작 이후 경과(ms) */
  elapsedMs(): number {
    return (this.ctx.currentTime - this.startTime) * 1000;
  }

  stop() {
    if (this.timer != null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private click(at: number, accent: boolean) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = accent ? 1320 : 880;
    const v = this.opts.volume ?? 0.4;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(v, at + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(at);
    osc.stop(at + 0.06);
  }
}
