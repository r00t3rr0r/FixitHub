import { useId } from "react"
import "./UnlockPatternVisual.css"

interface UnlockPatternVisualProps {
  pattern: string[]
  size?: number
  animate?: boolean
  showSequence?: boolean
  className?: string
}

const POSITIONS = [16.5, 50, 83.5]

const DOT_CENTERS: Record<string, { x: number; y: number }> = {
  "1": { x: POSITIONS[0], y: POSITIONS[0] },
  "2": { x: POSITIONS[1], y: POSITIONS[0] },
  "3": { x: POSITIONS[2], y: POSITIONS[0] },
  "4": { x: POSITIONS[0], y: POSITIONS[1] },
  "5": { x: POSITIONS[1], y: POSITIONS[1] },
  "6": { x: POSITIONS[2], y: POSITIONS[1] },
  "7": { x: POSITIONS[0], y: POSITIONS[2] },
  "8": { x: POSITIONS[1], y: POSITIONS[2] },
  "9": { x: POSITIONS[2], y: POSITIONS[2] },
}

const ALL_DOTS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"]

// Description: Read-only visual representation of a device unlock pattern.
// Renders a 3x3 grid and draws the swipe path with directional arrows and an
// animated tracer so staff can read the gesture the way it is drawn on a phone.
// Component: UnlockPatternVisual
// Props: pattern, size, animate, showSequence, className
export function UnlockPatternVisual({
  pattern,
  size = 132,
  animate = true,
  showSequence = true,
  className = "",
}: UnlockPatternVisualProps) {
  const rawId = useId()
  const pathId = `upv-path-${rawId.replace(/:/g, "")}`

  const points = pattern
    .map((dot) => DOT_CENTERS[dot])
    .filter((p): p is { x: number; y: number } => Boolean(p))

  if (points.length === 0) {
    return null
  }

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ")

  let pathLength = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    pathLength += Math.sqrt(dx * dx + dy * dy)
  }

  const arrows = points.slice(1).map((b, i) => {
    const a = points[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const ux = dx / len
    const uy = dy / len
    const px = a.x + dx * 0.55
    const py = a.y + dy * 0.55
    const s = 4.2
    const w = 0.62
    const tip = `${px + ux * s},${py + uy * s}`
    const back1 = `${px - ux * s + -uy * s * w},${py - uy * s + ux * s * w}`
    const back2 = `${px - ux * s - -uy * s * w},${py - uy * s - ux * s * w}`
    return `${tip} ${back1} ${back2}`
  })

  const animateClass = animate ? "unlock-pattern-visual--animate" : ""

  return (
    <div
      className={`unlock-pattern-visual ${animateClass} ${className}`.trim()}
      style={
        {
          "--upv-path-length": pathLength,
        } as React.CSSProperties
      }
    >
      <svg
        className="unlock-pattern-visual__grid"
        width={size}
        height={size}
        viewBox="0 0 100 100"
        role="img"
        aria-label={`Entsperrmuster: ${pattern.join(" zu ")}`}
      >
        {/* Faint full 3x3 grid for spatial context */}
        {ALL_DOTS.map((dot) => {
          const c = DOT_CENTERS[dot]
          const active = pattern.includes(dot)
          if (active) return null
          return (
            <circle
              key={`bg-${dot}`}
              className="unlock-pattern-visual__bg-dot"
              cx={c.x}
              cy={c.y}
              r={2.6}
            />
          )
        })}

        {/* Swipe path */}
        {points.length > 1 && (
          <path
            id={pathId}
            className="unlock-pattern-visual__path"
            d={pathD}
            strokeWidth={3.4}
          />
        )}

        {/* Direction arrows (static, readable without motion) */}
        {arrows.map((pts, i) => (
          <polygon
            key={`arrow-${i}`}
            className="unlock-pattern-visual__arrow"
            points={pts}
          />
        ))}

        {/* Active dots with order numbers */}
        {pattern.map((dot, i) => {
          const c = DOT_CENTERS[dot]
          if (!c) return null
          const isStart = i === 0
          const isEnd = i === pattern.length - 1
          const dotClass = isStart
            ? "unlock-pattern-visual__dot unlock-pattern-visual__dot--start"
            : isEnd
            ? "unlock-pattern-visual__dot unlock-pattern-visual__dot--end"
            : "unlock-pattern-visual__dot"
          return (
            <g key={`dot-${dot}-${i}`}>
              <circle
                className="unlock-pattern-visual__dot-halo"
                cx={c.x}
                cy={c.y}
                r={8.5}
              />
              <circle className={dotClass} cx={c.x} cy={c.y} r={6} />
              <text
                className="unlock-pattern-visual__order"
                x={c.x}
                y={c.y}
                fontSize={6.5}
              >
                {i + 1}
              </text>
            </g>
          )
        })}

        {/* Traveling tracer depicting finger movement */}
        {animate && points.length > 1 && (
          <circle className="unlock-pattern-visual__tracer" r={3.2}>
            <animateMotion
              dur="2.4s"
              repeatCount="indefinite"
              keyPoints="0;1;1"
              keyTimes="0;0.6;1"
              calcMode="linear"
            >
              <mpath href={`#${pathId}`} />
            </animateMotion>
          </circle>
        )}
      </svg>

      {showSequence && (
        <span className="unlock-pattern-visual__sequence">
          {pattern.join(" → ")}
        </span>
      )}
    </div>
  )
}
