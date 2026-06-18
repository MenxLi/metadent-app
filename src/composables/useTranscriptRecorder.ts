import { ref } from 'vue'

import { AIService } from '@/api'
import { useWavRecorder } from '@/composables/useWavRecorder'

export type TranscriptToggleResult =
  | { status: 'recording-started' }
  | { status: 'transcribed'; transcript: string }

export function useTranscriptRecorder() {
  const wavRecorder = useWavRecorder()
  const busyTargetId = ref<string | null>(null)
  const recordingTargetId = ref<string | null>(null)
  const aiService = new AIService()

  const isRecordingForTarget = (targetId: string) => recordingTargetId.value === targetId
  const isBusyForTarget = (targetId: string) => busyTargetId.value === targetId

  const toggleTargetTranscript = async (targetId: string): Promise<TranscriptToggleResult> => {
    try {
      if (wavRecorder.state.value === 'recording') {
        if (recordingTargetId.value !== targetId) {
          throw new Error('Finish the current recording before starting another transcript.')
        }

        recordingTargetId.value = null
        busyTargetId.value = targetId
        const { blob, extension } = await wavRecorder.stopRecording()
        const transcript = (await aiService.transcribe(blob, extension)).trim()

        if (!transcript) {
          throw new Error('Transcript result was empty.')
        }

        return {
          status: 'transcribed',
          transcript,
        }
      }

      if (wavRecorder.state.value === 'stopping') {
        throw new Error('Audio recorder is busy. Please wait and try again.')
      }

      recordingTargetId.value = targetId
      await wavRecorder.startRecording()
      return {
        status: 'recording-started',
      }
    }
    catch (cause) {
      if (recordingTargetId.value === targetId && wavRecorder.state.value === 'idle') {
        recordingTargetId.value = null
      }
      throw cause
    }
    finally {
      if (wavRecorder.state.value !== 'recording') {
        busyTargetId.value = null
      }
    }
  }

  const cancelRecording = async () => {
    if (wavRecorder.state.value === 'idle') {
      return
    }

    await wavRecorder.cancelRecording()
    recordingTargetId.value = null
    busyTargetId.value = null
  }

  const dispose = async () => {
    await cancelRecording()
    await wavRecorder.dispose()
  }

  return {
    recorderState: wavRecorder.state,
    busyTargetId,
    recordingTargetId,
    isRecordingForTarget,
    isBusyForTarget,
    toggleTargetTranscript,
    cancelRecording,
    dispose,
  }
}
