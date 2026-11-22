// @ts-nocheck
const CONFIG = {
  color: "#9fef00", // Standardfarbe, siehe Abschnitt unten zum Ändern
  density: 9000, // kleiner = mehr Knoten
  maxPerZone: 70,
  linkDist: 130, // ab dieser Distanz werden Linien gezogen
  mouseDist: 160, // Reichweite der Maus
  speed: 0.5,
  dotAlpha: 0.8,
  lineAlpha: 0.35,
}

function start() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

  if (!window.__pc) {
    const canvas = document.createElement("canvas")
    canvas.id = "particles-bg"
    window.__pc = canvas
    const ctx = canvas.getContext("2d")
    const mouse = { x: -9999, y: -9999 }
    const zones = [
      { x0: 0, x1: 0, pts: [] },
      { x0: 0, x1: 0, pts: [] },
    ]
    let w = 0
    let h = 0
    let color = CONFIG.color
    let tick = 0
    let lastL = -1
    let lastR = -1

    const getCenter = () => {
      const el = document.querySelector(".center") || document.querySelector("article")
      if (el) {
        const r = el.getBoundingClientRect()
        if (r.width > 0) return { l: r.left, r: r.right }
      }
      return { l: w * 0.2, r: w * 0.8 }
    }

    const fit = (z) => {
      const width = z.x1 - z.x0
      if (width < 80) {
        z.pts = []
        return
      }
      const target = Math.min(CONFIG.maxPerZone, Math.floor((width * h) / CONFIG.density))
      for (const p of z.pts) {
        if (p.x < z.x0 || p.x > z.x1) p.x = z.x0 + Math.random() * width
      }
      while (z.pts.length < target) {
        z.pts.push({
          x: z.x0 + Math.random() * width,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * CONFIG.speed * 2,
          vy: (Math.random() - 0.5) * CONFIG.speed * 2,
          r: Math.random() * 1.5 + 1,
        })
      }
      while (z.pts.length > target) z.pts.pop()
    }

    const layout = () => {
      const c = getCenter()
      if (Math.abs(c.l - lastL) < 1 && Math.abs(c.r - lastR) < 1) return
      lastL = c.l
      lastR = c.r
      zones[0].x0 = 0
      zones[0].x1 = Math.max(0, c.l)
      zones[1].x0 = Math.min(w, c.r)
      zones[1].x1 = w
      zones.forEach(fit)
    }

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + "px"
      canvas.style.height = h + "px"
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      lastL = -1
      layout()
    }

    window.addEventListener("resize", resize)
    window.addEventListener("mousemove", (e) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
    })
    document.addEventListener("mouseleave", () => {
      mouse.x = -9999
      mouse.y = -9999
    })

    const frame = () => {
      tick++
      if (tick % 60 === 0) {
        const v = getComputedStyle(document.documentElement)
          .getPropertyValue("--particle-color")
          .trim()
        color = v || CONFIG.color
      }
      layout()
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = color
      ctx.strokeStyle = color

      for (const z of zones) {
        const pts = z.pts
        for (const p of pts) {
          p.x += p.vx
          p.y += p.vy
          if (p.x < z.x0 || p.x > z.x1) {
            p.vx *= -1
            p.x = Math.min(Math.max(p.x, z.x0), z.x1)
          }
          if (p.y < 0 || p.y > h) p.vy *= -1

          const dx = p.x - mouse.x
          const dy = p.y - mouse.y
          const d = Math.hypot(dx, dy)
          if (d < CONFIG.mouseDist && d > 0) {
            p.x += (dx / d) * 1.2
            p.y += (dy / d) * 1.2
            ctx.globalAlpha = (1 - d / CONFIG.mouseDist) * CONFIG.lineAlpha * 1.5
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(mouse.x, mouse.y)
            ctx.stroke()
          }
          ctx.globalAlpha = CONFIG.dotAlpha
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
          ctx.fill()
        }
        for (let i = 0; i < pts.length; i++) {
          for (let j = i + 1; j < pts.length; j++) {
            const a = pts[i]
            const b = pts[j]
            const d = Math.hypot(a.x - b.x, a.y - b.y)
            if (d < CONFIG.linkDist) {
              ctx.globalAlpha = (1 - d / CONFIG.linkDist) * CONFIG.lineAlpha
              ctx.beginPath()
              ctx.moveTo(a.x, a.y)
              ctx.lineTo(b.x, b.y)
              ctx.stroke()
            }
          }
        }
      }
      ctx.globalAlpha = 1
      requestAnimationFrame(frame)
    }

    resize()
    frame()
  }

  if (!window.__pc.isConnected) document.body.appendChild(window.__pc)
}

document.addEventListener("nav", start)