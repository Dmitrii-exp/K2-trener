// 16 kHz mono PCM16 capture. Weighted resampling also supports 44.1/48 kHz devices.
class GeminiPcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.sum = 0; this.weight = 0; this.offset = 0;
    this.packet = new ArrayBuffer(1280); // 40 ms, bounded message rate.
    this.view = new DataView(this.packet);
  }
  process(inputs) {
    const samples = inputs[0]?.[0];
    if (!samples) return true;
    for (const value of samples) {
      let remaining = 1;
      while (remaining > 1e-9) {
        const take = Math.min(remaining, this.ratio - this.weight);
        this.sum += value * take; this.weight += take; remaining -= take;
        if (this.weight >= this.ratio - 1e-9) {
          const clamped = Math.max(-1, Math.min(1, this.sum / this.ratio));
          this.view.setInt16(this.offset, Math.round(clamped * (clamped < 0 ? 32768 : 32767)), true);
          this.offset += 2; this.sum = 0; this.weight = 0;
          if (this.offset === this.packet.byteLength) {
            this.port.postMessage(this.packet, [this.packet]);
            this.packet = new ArrayBuffer(1280); this.view = new DataView(this.packet); this.offset = 0;
          }
        }
      }
    }
    return true;
  }
}
registerProcessor('gemini-pcm-capture', GeminiPcmCapture);
