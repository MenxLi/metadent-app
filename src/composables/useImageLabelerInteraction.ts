import { computed, ref, watch, type Ref } from 'vue'
import { resampleContour } from '@/contour-tools'

export type Point = [number, number]
export type CropRect = [number, number, number, number]
export type CropDraft = [Point, Point]

interface UseImageLabelerInteractionOptions {
  imageRef: Ref<HTMLImageElement | null>
  activeLabel: Ref<string | null>
  crop: Ref<CropRect | null>
  onContourCommitted: (contour: Point[]) => void
  onCropCommitted: (crop: CropRect | null) => void
}

const ACTIVATION_DRAG_THRESHOLD = 0.01
const MIN_CROP_SIZE = 0.05

export function useImageLabelerInteraction(options: UseImageLabelerInteractionOptions) {
  const drawing = ref(false)
  const cropping = ref(false)
  const currentContour = ref<Point[]>([])
  const currentCrop = ref<CropDraft | null>(null)
  const drawGestureStartedAt = ref<Point | null>(null)
  const suppressNextPolygonActivation = ref(false)

  watch(
    options.crop,
    (crop) => {
      if (!crop) {
        currentCrop.value = null
        return
      }

      const [x, y, width, height] = crop
      currentCrop.value = [
        [x, y],
        [x + width, y + height],
      ]
    },
    { immediate: true }
  )

  const canvasCursorClass = computed(() => {
    if (cropping.value) return 'cursor-crosshair'
    if (options.activeLabel.value) return 'cursor-crosshair'
    return 'cursor-default'
  })

  const interactionHint = computed(() => {
    if (cropping.value) return 'Release to finish crop'
    if (drawing.value) return 'Release to finish contour'
    if (options.activeLabel.value) {
      return 'Drag to draw on the active label. Click another contour to select it. Right drag to crop.'
    }
    return 'Select a label to start drawing. Right drag to crop.'
  })

  function getNormalizedCoordinates(event: MouseEvent | TouchEvent): Point {
    const img = options.imageRef.value
    if (!img) return [0, 0]

    const rect = img.getBoundingClientRect()
    let x = 0
    let y = 0

    if (event instanceof MouseEvent) {
      x = (event.clientX - rect.left) / rect.width
      y = (event.clientY - rect.top) / rect.height
    }
    else if (event instanceof TouchEvent && event.touches.length > 0) {
      x = (event.touches[0]!.clientX - rect.left) / rect.width
      y = (event.touches[0]!.clientY - rect.top) / rect.height
    }

    return [x, y]
  }

  function resetDrawGestureTracking() {
    drawGestureStartedAt.value = null
  }

  function resetContourDrawing() {
    drawing.value = false
    currentContour.value = []
    resetDrawGestureTracking()
  }

  function hasDraggedFromStart(point: Point) {
    if (!drawGestureStartedAt.value) return false

    const [startX, startY] = drawGestureStartedAt.value
    const deltaX = point[0] - startX
    const deltaY = point[1] - startY
    return Math.hypot(deltaX, deltaY) >= ACTIVATION_DRAG_THRESHOLD
  }

  function queueActivationReset() {
    if (!suppressNextPolygonActivation.value) return

    queueMicrotask(() => {
      suppressNextPolygonActivation.value = false
    })
  }

  function beginContourDrawing(point: Point) {
    drawing.value = true
    currentContour.value = [drawGestureStartedAt.value!, point]
    suppressNextPolygonActivation.value = true
  }

  function isPrimaryDrawGesture(event: MouseEvent | TouchEvent) {
    return (
      (event instanceof MouseEvent && event.button === 0) ||
      (event instanceof TouchEvent && event.touches.length === 1)
    )
  }

  function isCropGesture(event: MouseEvent | TouchEvent) {
    return event instanceof MouseEvent && event.button === 2
  }

  function startDrawing(event: MouseEvent | TouchEvent) {
    if (isPrimaryDrawGesture(event) && options.activeLabel.value) {
      drawGestureStartedAt.value = getNormalizedCoordinates(event)
      currentContour.value = []
      suppressNextPolygonActivation.value = false
      return
    }

    if (isCropGesture(event)) {
      event.preventDefault()
      const [x, y] = getNormalizedCoordinates(event)

      if (options.crop.value) {
        options.onCropCommitted(null)
      }
      else {
        cropping.value = true
        currentCrop.value = [[x, y], [x, y]]
      }
    }
  }

  function draw(event: MouseEvent | TouchEvent) {
    if (drawGestureStartedAt.value && options.activeLabel.value) {
      const point = getNormalizedCoordinates(event)

      if (!drawing.value) {
        if (hasDraggedFromStart(point)) {
          beginContourDrawing(point)
        }
      }
      else {
        currentContour.value.push(point)
      }
    }

    if (cropping.value && currentCrop.value) {
      currentCrop.value[1] = getNormalizedCoordinates(event)
    }
  }

  function stopDrawing() {
    if (drawing.value && options.activeLabel.value) {
      const resampledContour = resampleContour(currentContour.value)
      const area = Math.abs(
        resampledContour.reduce((acc, point, index) => {
          const nextPoint = resampledContour[(index + 1) % resampledContour.length]
          return acc + (point[0] * nextPoint![1] - nextPoint![0] * point[1])
        }, 0)
      ) / 2

      if (area >= 1e-4) {
        options.onContourCommitted(resampledContour)
      }

      resetContourDrawing()
      queueActivationReset()
    }
    else {
      resetContourDrawing()
    }

    if (cropping.value && currentCrop.value) {
      cropping.value = false
      const crop: CropRect = [
        Math.min(currentCrop.value[0][0], currentCrop.value[1][0]),
        Math.min(currentCrop.value[0][1], currentCrop.value[1][1]),
        Math.abs(currentCrop.value[1][0] - currentCrop.value[0][0]),
        Math.abs(currentCrop.value[1][1] - currentCrop.value[0][1]),
      ]
      currentCrop.value = null

      if (crop[2] < MIN_CROP_SIZE || crop[3] < MIN_CROP_SIZE) {
        options.onCropCommitted(null)
      }
      else {
        options.onCropCommitted(crop)
      }
    }
  }

  function consumePolygonActivationSuppression() {
    if (!suppressNextPolygonActivation.value) return false

    suppressNextPolygonActivation.value = false
    return true
  }

  return {
    canvasCursorClass,
    consumePolygonActivationSuppression,
    cropping,
    currentContour,
    currentCrop,
    draw,
    drawing,
    interactionHint,
    startDrawing,
    stopDrawing,
  }
}
