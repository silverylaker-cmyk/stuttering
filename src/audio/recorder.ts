/** MediaRecorder 래퍼. webm/opus 우선, iOS 는 mp4/aac 폴백. */

const CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/aac'];

export function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return CANDIDATES.find((t) => MediaRecorder.isTypeSupported?.(t));
}

export type MicError = 'unsupported' | 'denied' | 'notfound' | 'other';

export function micErrorKind(e: unknown): MicError {
  const name = (e as DOMException)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'notfound';
  return 'other';
}

export async function getMic(raw = false): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('unsupported'), { name: 'NotSupportedError' });
  return navigator.mediaDevices.getUserMedia({
    audio: raw
      ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      : { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
}

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  durationSec: number;
}

export class Recorder {
  private rec: MediaRecorder;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private done: Promise<RecordingResult>;

  constructor(
    private stream: MediaStream,
    private ownsStream = true,
  ) {
    const mimeType = pickMimeType();
    this.rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 64000 } : undefined);
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.done = new Promise((resolve) => {
      this.rec.onstop = () => {
        const type = this.rec.mimeType || mimeType || 'audio/webm';
        const durationSec = Math.max(0, (performance.now() - this.startedAt) / 1000);
        if (this.ownsStream) this.stream.getTracks().forEach((t) => t.stop());
        resolve({ blob: new Blob(this.chunks, { type }), mimeType: type, durationSec: Math.round(durationSec * 10) / 10 });
      };
    });
  }

  start() {
    this.startedAt = performance.now();
    this.rec.start(1000);
  }

  elapsedSec() {
    return this.startedAt ? (performance.now() - this.startedAt) / 1000 : 0;
  }

  stop(): Promise<RecordingResult> {
    if (this.rec.state !== 'inactive') this.rec.stop();
    return this.done;
  }

  static async start(raw = false): Promise<Recorder> {
    const r = new Recorder(await getMic(raw));
    r.start();
    return r;
  }
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
