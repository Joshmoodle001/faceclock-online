'use client'

import { useState, useRef, useCallback } from 'react'
import type {
  FaceDetectionResult,
  LivenessResult,
  FaceQualityResult,
  FaceEmbedding,
} from '@/lib/face/types'

export function useFace() {
  const [detecting, setDetecting] = useState(false)
  const [result, setResult] = useState<FaceDetectionResult | null>(null)
  const [quality, setQuality] = useState<FaceQualityResult | null>(null)
  const [liveness, setLiveness] = useState<LivenessResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startCamera = useCallback(
    async (videoElement: HTMLVideoElement): Promise<boolean> => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        })
        videoElement.srcObject = stream
        streamRef.current = stream
        await videoElement.play()
        return true
      } catch (e) {
        setError('Camera access denied')
        return false
      }
    },
    []
  )

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const captureFrame = useCallback((video: HTMLVideoElement): ImageData => {
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  }, [])

  return {
    detecting,
    result,
    quality,
    liveness,
    error,
    startCamera,
    stopCamera,
    captureFrame,
  }
}
