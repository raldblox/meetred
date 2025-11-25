'use client'

import type { RefObject } from 'react'

export function clearVideoElement(ref: RefObject<HTMLVideoElement | null>) {
  const video = ref.current

  if (!video) return

  video.pause()
  video.srcObject = null
  video.removeAttribute('src')

  try {
    video.load()
  } catch {
    // Ignore browsers that do not support calling load after detaching tracks
  }
}

export function formatCallDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')

  return `${minutes}:${seconds}`
}
