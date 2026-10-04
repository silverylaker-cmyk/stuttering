import { PROGRAM } from '../config/program';
import { getAudioContext } from './context';
import { getMic } from './recorder';

const loaded = new WeakSet<BaseAudioContext>();

async function ensureWorklet(ctx: AudioContext) {
  if (loaded.has(ctx)) return;
  await ctx.audioWorklet.addModule(`${import.meta.env.BASE_URL}worklets/pitch-shifter.js`);
  loaded.add(ctx);
}

export interface DafOptions {
  delayMs: number;
  /** 옥타브 단위 (0 = 끔) */
  shift: number;
  /** false 면 지연 없이 그대로(NAF 조건)도 들려주지 않는다 */
  enabled?: boolean;
}

/**
 * 마이크 → DelayNode → (피치 시프터) → 이어폰.
 * 하울링 방지를 위해 echoCancellation·noiseSuppression·autoGainControl 은 모두 끈다(유선 이어폰 필수).
 */
export class DafChain {
  private ctx = getAudioContext();
  private src?: MediaStreamAudioSourceNode;
  private delay = this.ctx.createDelay(1);
  private out = this.ctx.createGain();
  private shifter?: AudioWorkletNode;
  stream?: MediaStream;

  async start(opts: DafOptions) {
    this.stream = await getMic(true);
    this.src = this.ctx.createMediaStreamSource(this.stream);
    this.out.connect(this.ctx.destination);
    await this.apply(opts);
  }

  async apply(opts: DafOptions) {
    const [min, max] = PROGRAM.daf.delayRangeMs;
    const delayMs = Math.min(max, Math.max(min, opts.delayMs));
    this.src?.disconnect();
    this.delay.disconnect();
    this.shifter?.disconnect();
    this.out.gain.value = opts.enabled === false ? 0 : 1;
    if (!this.src) return;
    if (opts.shift) {
      await ensureWorklet(this.ctx);
      this.shifter ??= new AudioWorkletNode(this.ctx, 'pitch-shifter', { outputChannelCount: [2] });
      this.shifter.parameters.get('ratio')!.value = 2 ** opts.shift;
      // 피치 시프터 자체 지연(평균 15ms)을 보정
      this.delay.delayTime.value = Math.max(0, delayMs - 15) / 1000;
      this.src.connect(this.delay).connect(this.shifter).connect(this.out);
    } else {
      this.delay.delayTime.value = delayMs / 1000;
      this.src.connect(this.delay).connect(this.out);
    }
  }

  stop() {
    this.src?.disconnect();
    this.delay.disconnect();
    this.shifter?.disconnect();
    this.out.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    this.src = undefined;
  }
}
