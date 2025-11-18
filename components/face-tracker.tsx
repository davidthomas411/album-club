'use client'

import { useEffect, useRef, useState } from 'react'

interface FaceTrackerProps {
  memberFolder: string // e.g., 'john', 'sarah'
  blobUrls?: Record<string, string> // Map of filename -> blob URL
  size?: number
  debug?: boolean
  disableOnMobile?: boolean
  autoAnimateOnMobile?: boolean
  autoAnimationInterval?: [number, number]
  autoAnimate?: boolean
  disablePointerTracking?: boolean
  fallbackBasePath?: string
  initialDirection?: {
    x: number
    y: number
  }
}

const P_MIN = -15
const P_MAX = 15
const STEP = 3
const SIZE = 256

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function quantizeToGrid(val: number) {
  const raw = P_MIN + (val + 1) * (P_MAX - P_MIN) / 2 // [-1,1] -> [-15,15]
  const snapped = Math.round(raw / STEP) * STEP
  return clamp(snapped, P_MIN, P_MAX)
}

function sanitize(val: number) {
  // Convert to format: 15.0 -> "15p0", -15.0 -> "m15p0", 0.0 -> "0p0"
  const intPart = Math.round(val)
  const decimalPart = 0 // Face looker uses .0 for all values
  
  if (intPart < 0) {
    return `m${Math.abs(intPart)}p${decimalPart}` // -15 -> m15p0
  }
  return `${intPart}p${decimalPart}` // 15 -> 15p0, 0 -> 0p0
}

function gridToFilename(px: number, py: number, size: number) {
  return `gaze_px${sanitize(px)}_py${sanitize(py)}_${size}.webp`
}

export function FaceTracker({
  memberFolder,
  blobUrls,
  size = SIZE,
  debug = false,
  disableOnMobile = false,
  autoAnimateOnMobile = false,
  autoAnimate = false,
  autoAnimationInterval,
  disablePointerTracking = false,
  fallbackBasePath,
  initialDirection,
}: FaceTrackerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [debugInfo, setDebugInfo] = useState({ mouseX: 0, mouseY: 0, filename: '' })
  const [isMobile, setIsMobile] = useState(false)
  const [orientationEnabled, setOrientationEnabled] = useState(false)
  const minAutoDelay = autoAnimationInterval?.[0] ?? 1400
  const maxAutoDelay = autoAnimationInterval?.[1] ?? 2600

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    const img = imgRef.current
    if (!container || !img) return

    function setFromClient(clientX: number, clientY: number) {
      if (!container || !img) return
      
      const rect = container.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      // Normalize to [-1, 1]
      const nx = (clientX - centerX) / (rect.width / 2)
      const ny = (centerY - clientY) / (rect.height / 2) // Y is flipped

      const clampedX = clamp(nx, -1, 1)
      const clampedY = clamp(ny, -1, 1)

      const px = quantizeToGrid(clampedX)
      const py = quantizeToGrid(clampedY)

      const filename = gridToFilename(px, py, size)
      
      const imagePath =
        blobUrls?.[filename] ||
        (fallbackBasePath
          ? `${fallbackBasePath}/${filename}`
          : `/faces/${memberFolder}/${filename}`)

      img.src = imagePath

      if (debug) {
        setDebugInfo({
          mouseX: Math.round(clientX - rect.left),
          mouseY: Math.round(clientY - rect.top),
          filename
        })
      }
    }

    function setFromNormalized(nx: number, ny: number) {
      if (!img) return
      
      const clampedX = clamp(nx, -1, 1)
      const clampedY = clamp(ny, -1, 1)

      const px = quantizeToGrid(clampedX)
      const py = quantizeToGrid(clampedY)

      const filename = gridToFilename(px, py, size)
      const imagePath =
        blobUrls?.[filename] ||
        (fallbackBasePath
          ? `${fallbackBasePath}/${filename}`
          : `/faces/${memberFolder}/${filename}`)
      img.src = imagePath
    }

    function handleMouseMove(e: MouseEvent) {
      setFromClient(e.clientX, e.clientY)
    }

    function handleTouchMove(e: TouchEvent) {
      if (e.touches.length > 0) {
        const touch = e.touches[0]
        setFromClient(touch.clientX, touch.clientY)
      }
    }

    function handleTouch(e: TouchEvent) {
      if (e.touches.length > 0) {
        const touch = e.touches[0]
        setFromClient(touch.clientX, touch.clientY)
      }
    }

    function handleOrientation(e: DeviceOrientationEvent) {
      // beta is front-to-back tilt (-180 to 180), gamma is left-to-right tilt (-90 to 90)
      const gamma = e.gamma || 0  // left-right tilt
      const beta = e.beta || 0    // front-back tilt
      
      // Normalize gamma (-30 to 30 degrees) to (-1 to 1)
      const nx = clamp(gamma / 30, -1, 1)
      // Normalize beta (60 to 120 degrees, where 90 is vertical) to (-1 to 1)
      const ny = clamp((90 - beta) / 30, -1, 1)
      
      setFromNormalized(nx, ny)
    }

    const shouldAutoAnimate =
      !disableOnMobile && (autoAnimate || (isMobile && autoAnimateOnMobile))

    // Desktop: mouse tracking
    if (!disablePointerTracking) {
      window.addEventListener('mousemove', handleMouseMove)
    }
    
    // Mobile: touch tracking
    if (!disablePointerTracking && isMobile && !disableOnMobile) {
      document.addEventListener('touchstart', handleTouch, { passive: true })
      document.addEventListener('touchmove', handleTouchMove, { passive: true })
      
      if (orientationEnabled && !shouldAutoAnimate) {
        window.addEventListener('deviceorientation', handleOrientation)
      }
    }

    let animationTimeout: number | undefined
    function scheduleAutoMove(initialDelay?: number) {
      if (!shouldAutoAnimate) return

      const delay =
        initialDelay !== undefined
          ? initialDelay
          : Math.random() * (maxAutoDelay - minAutoDelay) + minAutoDelay

      animationTimeout = window.setTimeout(() => {
        const randomX = clamp(Math.random() * 2 - 1, -0.9, 0.9)
        const randomY = clamp(Math.random() * 2 - 1, -0.9, 0.9)
        setFromNormalized(randomX, randomY)
        scheduleAutoMove()
      }, delay)
    }

    if (shouldAutoAnimate) {
      scheduleAutoMove(500 + Math.random() * 1000)
    }

    // Initialize with center position
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      if (initialDirection) {
        setFromNormalized(initialDirection.x, initialDirection.y)
      } else {
        setFromClient(rect.left + rect.width / 2, rect.top + rect.height / 2)
      }
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('touchstart', handleTouch)
      document.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('deviceorientation', handleOrientation)
      if (animationTimeout) {
        window.clearTimeout(animationTimeout)
      }
    }
  }, [
    memberFolder,
    blobUrls,
    size,
    debug,
    isMobile,
    disableOnMobile,
    orientationEnabled,
    autoAnimateOnMobile,
    autoAnimate,
    disablePointerTracking,
    minAutoDelay,
    maxAutoDelay,
    fallbackBasePath,
    initialDirection,
  ])

  const enableOrientation = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permissionState = await (DeviceOrientationEvent as any).requestPermission()
        if (permissionState === 'granted') {
          setOrientationEnabled(true)
        }
      } catch (error) {
        console.error('Device orientation permission denied:', error)
      }
    } else {
      // Non-iOS or older iOS - no permission needed
      setOrientationEnabled(true)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <img
        ref={imgRef}
        alt="Face following cursor"
        className="w-full h-full object-cover rounded-full"
        onClick={isMobile && !orientationEnabled && !disableOnMobile ? enableOrientation : undefined}
      />
      {debug && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white text-xs p-2 rounded-b-full">
          Mouse: ({debugInfo.mouseX}, {debugInfo.mouseY}) Image: {debugInfo.filename}
        </div>
      )}
    </div>
  )
}
