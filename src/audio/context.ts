let ctx: AudioContext | null = null;

/** 공용 AudioContext. 사용자 제스처 안에서 호출해야 iOS에서 소리가 난다. */
export function getAudioContext(): AudioContext {
  if (!ctx || ctx.state === 'closed') {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** 출력 지연(ms) = baseLatency + outputLatency */
export function measureLatencyMs(): { base: number; output: number; total: number } {
  const c = getAudioContext();
  const base = (c.baseLatency ?? 0) * 1000;
  const output = ((c as AudioContext & { outputLatency?: number }).outputLatency ?? 0) * 1000;
  return { base: Math.round(base * 10) / 10, output: Math.round(output * 10) / 10, total: Math.round((base + output) * 10) / 10 };
}
