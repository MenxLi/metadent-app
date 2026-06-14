import { ref } from 'vue'

export type ProgressHintTone = 'info' | 'success' | 'error'

export interface ProgressHintState {
  show: boolean
  title: string
  body: string
  tone: ProgressHintTone
  busy: boolean
}

interface ShowProgressHintOptions {
  title?: string
  body?: string
  tone?: ProgressHintTone
  busy?: boolean
  autoHideMs?: number
  show?: boolean
}

export function useProgressHint(defaultTitle = 'Hint') {
  const progress = ref<ProgressHintState>({
    show: false,
    title: defaultTitle,
    body: '',
    tone: 'info',
    busy: false,
  })

  let timer: ReturnType<typeof setTimeout> | null = null

  const clearTimer = () => {
    if (!timer) return
    clearTimeout(timer)
    timer = null
  }

  const hide = () => {
    clearTimer()
    progress.value.show = false
  }

  const show = ({
    title = defaultTitle,
    body = '',
    tone = 'info',
    busy = false,
    autoHideMs = 0,
    show: showState = true,
  }: ShowProgressHintOptions) => {
    clearTimer()
    progress.value = {
      show: showState,
      title,
      body,
      tone,
      busy,
    }

    if (showState && autoHideMs > 0) {
      timer = setTimeout(() => {
        progress.value.show = false
        timer = null
      }, autoHideMs)
    }
  }

  const dispose = () => {
    clearTimer()
  }

  return {
    progress,
    show,
    hide,
    dispose,
  }
}
