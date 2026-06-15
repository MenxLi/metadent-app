import { computed, ref } from 'vue'

export type WavRecorderState = 'idle' | 'recording' | 'stopping'

export interface RecordedWavAudio {
  blob: Blob
  extension: 'wav'
  sampleRate: number
}

const PCM_CAPTURE_PROCESSOR_NAME = 'pcm-capture-processor'

const PCM_CAPTURE_WORKLET_SOURCE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input && input.length > 0) {
      this.port.postMessage(new Float32Array(input));
    }
    return true;
  }
}

registerProcessor('${PCM_CAPTURE_PROCESSOR_NAME}', PcmCaptureProcessor);
`

async function loadPcmCaptureWorklet(audioContext: AudioContext): Promise<void> {
  const moduleBlob = new Blob([PCM_CAPTURE_WORKLET_SOURCE], { type: 'text/javascript' })
  const moduleUrl = URL.createObjectURL(moduleBlob)
  try {
    await audioContext.audioWorklet.addModule(moduleUrl)
  }
  finally {
    URL.revokeObjectURL(moduleUrl)
  }
}

function mergeBuffers(chunks: Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const output = new Float32Array(totalLength)
  let offset = 0

  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }

  return output
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2
  const channelCount = 1
  const blockAlign = channelCount * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channelCount, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i] ?? 0))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
    offset += bytesPerSample
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

export function useWavRecorder(preferredSampleRate = 16000) {
  const state = ref<WavRecorderState>('idle')
  const error = ref<string | null>(null)

  let stream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let sourceNode: MediaStreamAudioSourceNode | null = null
  let workletNode: AudioWorkletNode | null = null
  let sinkNode: GainNode | null = null
  let chunks: Float32Array[] = []
  let sampleRate = preferredSampleRate

  const isRecording = computed(() => state.value === 'recording')

  const teardown = async () => {
    if (workletNode) {
      workletNode.port.onmessage = null
      workletNode.disconnect()
    }
    sourceNode?.disconnect()
    sinkNode?.disconnect()

    workletNode = null
    sourceNode = null
    sinkNode = null

    stream?.getTracks().forEach((track) => track.stop())
    stream = null

    if (audioContext) {
      const activeContext = audioContext
      audioContext = null
      await activeContext.close()
    }
  }

  const reset = async () => {
    chunks = []
    sampleRate = preferredSampleRate
    await teardown()
    state.value = 'idle'
  }

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Audio recording is not supported in this browser.')
    }
    if (typeof window === 'undefined' || !window.isSecureContext) {
      throw new Error('Audio recording requires a secure context (HTTPS or localhost).')
    }
    if (state.value !== 'idle') {
      throw new Error('Recorder is already active.')
    }

    error.value = null
    chunks = []

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioContext = new AudioContext({ sampleRate: preferredSampleRate })
      await audioContext.resume()
      if (!audioContext.audioWorklet) {
        throw new Error('AudioWorklet is not available in this browser. Please use a modern Chromium, Safari, or Firefox version.')
      }
      sampleRate = audioContext.sampleRate
      await loadPcmCaptureWorklet(audioContext)

      sourceNode = audioContext.createMediaStreamSource(stream)
      workletNode = new AudioWorkletNode(audioContext, PCM_CAPTURE_PROCESSOR_NAME)
      sinkNode = audioContext.createGain()
      sinkNode.gain.value = 0

      workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        chunks.push(new Float32Array(event.data))
      }

      sourceNode.connect(workletNode)
      workletNode.connect(sinkNode)
      sinkNode.connect(audioContext.destination)

      state.value = 'recording'
    }
    catch (cause) {
      await reset()
      throw cause
    }
  }

  const stopRecording = async (): Promise<RecordedWavAudio> => {
    if (state.value !== 'recording') {
      throw new Error('Recorder is not currently recording.')
    }

    state.value = 'stopping'

    try {
      const merged = mergeBuffers(chunks)
      if (!merged.length) {
        throw new Error('Recorded audio was empty.')
      }

      const blob = encodeWav(merged, sampleRate)
      await reset()
      return {
        blob,
        extension: 'wav',
        sampleRate,
      }
    }
    catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      await reset()
      throw cause
    }
  }

  const cancelRecording = async () => {
    await reset()
  }

  const dispose = async () => {
    await reset()
  }

  return {
    state,
    error,
    isRecording,
    startRecording,
    stopRecording,
    cancelRecording,
    dispose,
  }
}
