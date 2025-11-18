"use client"

import { useEffect, useRef, useState } from 'react'

interface StipplePoint {
  x: number
  y: number
  targetX: number
  targetY: number
  size: number
  vx: number
  vy: number
}

interface StipplePortraitProps {
  imageUrl: string
  curatorName: string
  themeName: string
  width?: number
  height?: number
}

export function StipplePortrait({ 
  imageUrl, 
  curatorName, 
  themeName,
  width = 600,
  height = 600
}: StipplePortraitProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [points, setPoints] = useState<StipplePoint[]>([])
  const [mousePos, setMousePos] = useState({ x: width / 2, y: height / 2 })
  const animationRef = useRef<number>()

  // Initialize stipple points from image
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imageUrl

    img.onload = () => {
      // Draw image off-screen to sample pixels
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = width
      tempCanvas.height = height
      const tempCtx = tempCanvas.getContext('2d')
      if (!tempCtx) return

      tempCtx.drawImage(img, 0, 0, width, height)
      const imageData = tempCtx.getImageData(0, 0, width, height)

      // Generate stipple points based on image brightness
      const newPoints: StipplePoint[] = []
      const numPoints = 3000
      const gridSize = 15

      for (let i = 0; i < numPoints; i++) {
        let x = Math.random() * width
        let y = Math.random() * height
        
        // Sample multiple nearby pixels for better density
        let totalBrightness = 0
        let samples = 0
        
        for (let dx = -gridSize; dx <= gridSize; dx += gridSize) {
          for (let dy = -gridSize; dy <= gridSize; dy += gridSize) {
            const sx = Math.floor(x + dx)
            const sy = Math.floor(y + dy)
            
            if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
              const index = (sy * width + sx) * 4
              const r = imageData.data[index]
              const g = imageData.data[index + 1]
              const b = imageData.data[index + 2]
              const brightness = (r + g + b) / 3
              totalBrightness += brightness
              samples++
            }
          }
        }
        
        const avgBrightness = totalBrightness / samples
        
        // Only add point if dark enough (inverse density)
        if (avgBrightness < 200 || Math.random() < 0.3) {
          const size = 2 + (255 - avgBrightness) / 64
          newPoints.push({
            x,
            y,
            targetX: x,
            targetY: y,
            size,
            vx: 0,
            vy: 0
          })
        }
      }

      setPoints(newPoints)
    }
  }, [imageUrl, width, height])

  // Handle mouse movement
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
    }

    canvas.addEventListener('mousemove', handleMouseMove)
    return () => canvas.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || points.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const animate = () => {
      ctx.fillStyle = 'rgb(250, 250, 250)'
      ctx.fillRect(0, 0, width, height)

      // Update and draw points
      points.forEach(point => {
        // Calculate distance from mouse
        const dx = mousePos.x - point.x
        const dy = mousePos.y - point.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const maxDist = 150

        if (dist < maxDist) {
          // Move away from mouse
          const angle = Math.atan2(dy, dx)
          const force = (1 - dist / maxDist) * 0.5
          point.vx -= Math.cos(angle) * force
          point.vy -= Math.sin(angle) * force
        }

        // Pull back to original position
        const returnForce = 0.05
        point.vx += (point.targetX - point.x) * returnForce
        point.vy += (point.targetY - point.y) * returnForce

        // Apply velocity with damping
        point.vx *= 0.95
        point.vy *= 0.95
        point.x += point.vx
        point.y += point.vy

        // Draw point
        ctx.fillStyle = 'rgb(20, 20, 20)'
        ctx.beginPath()
        ctx.arc(point.x, point.y, point.size, 0, Math.PI * 2)
        ctx.fill()
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [points, mousePos, width, height])

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded-lg shadow-2xl cursor-pointer"
      />
      <div className="absolute bottom-6 left-6 right-6 bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg">
        <p className="text-sm text-muted-foreground">This week's curator</p>
        <h2 className="text-2xl font-bold text-foreground">{curatorName}</h2>
        <p className="text-lg text-muted-foreground mt-1">{themeName}</p>
      </div>
    </div>
  )
}
