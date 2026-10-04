/**
 * 그래뉼러(이중 지연선) 피치 시프터 AudioWorklet.
 * 두 개의 읽기 헤드를 반 주기 어긋나게 돌리며 삼각 창으로 크로스페이드한다.
 * ratio = 2^(옥타브). 추가 지연은 평균 grain/2 샘플.
 */
class PitchShifter extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'ratio', defaultValue: 1, minValue: 0.25, maxValue: 4, automationRate: 'k-rate' }];
  }

  constructor() {
    super();
    this.grain = Math.round(sampleRate * 0.03); // 30ms
    this.size = 1 << 15;
    this.mask = this.size - 1;
    this.buf = new Float32Array(this.size);
    this.w = 0;
    this.phase = 0;
  }

  read(pos) {
    const i = Math.floor(pos);
    const f = pos - i;
    const a = this.buf[i & this.mask];
    const b = this.buf[(i + 1) & this.mask];
    return a + (b - a) * f;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0] && inputs[0][0];
    const output = outputs[0];
    if (!output || !output[0]) return true;
    const ratio = parameters.ratio[0];
    const step = (1 - ratio) / this.grain;
    const n = output[0].length;
    for (let s = 0; s < n; s++) {
      this.buf[this.w & this.mask] = input ? input[s] : 0;
      let p1 = this.phase;
      let p2 = p1 + 0.5;
      if (p2 >= 1) p2 -= 1;
      const s1 = this.read(this.w - p1 * this.grain - 1 + this.size);
      const s2 = this.read(this.w - p2 * this.grain - 1 + this.size);
      const g1 = 1 - Math.abs(2 * p1 - 1);
      const y = s1 * g1 + s2 * (1 - g1);
      for (let c = 0; c < output.length; c++) output[c][s] = y;
      this.phase += step;
      if (this.phase >= 1) this.phase -= 1;
      else if (this.phase < 0) this.phase += 1;
      this.w++;
    }
    return true;
  }
}

registerProcessor('pitch-shifter', PitchShifter);
