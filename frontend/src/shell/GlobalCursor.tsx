import { useEffect, useRef } from "react"

const TRAIL_MS = 320
const DOT_R    = 3
const BLUE     = "91,155,213"

interface Point { x: number; y: number; t: number }

export default function GlobalCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trail     = useRef<Point[]>([])
  const rafRef    = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!

    function resize() {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    function onMove(e: MouseEvent) {
      trail.current.push({ x: e.clientX, y: e.clientY, t: Date.now() })
    }
    window.addEventListener("mousemove", onMove)

    function draw() {
      const now = Date.now()
      trail.current = trail.current.filter(p => now - p.t < TRAIL_MS)

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const pts = trail.current
      if (pts.length > 1) {
        for (let i = 1; i < pts.length; i++) {
          const age   = now - pts[i].t
          const t     = 1 - age / TRAIL_MS
          const width = t * 3.5
          const alpha = t * 0.8

          ctx.beginPath()
          ctx.strokeStyle = `rgba(${BLUE},${alpha})`
          ctx.lineWidth   = width
          ctx.lineCap     = "round"
          ctx.lineJoin    = "round"
          ctx.moveTo(pts[i - 1].x, pts[i - 1].y)
          ctx.lineTo(pts[i].x,     pts[i].y)
          ctx.stroke()
        }
      }

      if (pts.length > 0) {
        const tip = pts[pts.length - 1]
        ctx.beginPath()
        ctx.arc(tip.x, tip.y, DOT_R, 0, Math.PI * 2)
        ctx.fillStyle   = `rgb(${BLUE})`
        ctx.shadowColor = `rgb(${BLUE})`
        ctx.shadowBlur  = 6
        ctx.fill()
        ctx.shadowBlur  = 0
      }

      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      "fixed",
        top:           0,
        left:          0,
        width:         "100%",
        height:        "100%",
        pointerEvents: "none",
        zIndex:        9998,
      }}
    />
  )
}
