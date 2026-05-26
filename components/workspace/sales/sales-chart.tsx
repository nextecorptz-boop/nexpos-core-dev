'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'

interface ChartDataPoint {
  label: string
  value: number
}

interface SalesChartProps {
  data: ChartDataPoint[]
  color?: string
  formatTooltipValue?: (val: number) => string
}

export function SalesChart({ 
  data, 
  color = '#06B6D4', // nx-cyan
  formatTooltipValue
}: SalesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<SVGCircleElement>(null)
  const lineRef = useRef<SVGLineElement>(null)

  const [dimensions, setDimensions] = useState({ width: 600, height: 260 })

  // Dimensions of SVG inside container
  const paddingTop = 20
  const paddingBottom = 30
  const paddingLeft = 60
  const paddingRight = 20

  const chartWidth = dimensions.width - paddingLeft - paddingRight
  const chartHeight = dimensions.height - paddingTop - paddingBottom

  // ResizeObserver with requestAnimationFrame throttling
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return
      const { width, height } = entries[0].contentRect
      
      requestAnimationFrame(() => {
        setDimensions({
          width: width || 600,
          height: Math.max(240, height || 260)
        })
      })
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])

  // Process data points and scale them to dimensions
  const points = useMemo(() => {
    if (data.length === 0) return []

    const maxVal = Math.max(...data.map(d => d.value), 1)
    
    // Distribute points along X axis
    const stepX = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth

    return data.map((d, index) => {
      const x = index * stepX
      // Subtract from chartHeight so higher values are drawn higher up
      const y = chartHeight - (d.value / maxVal) * chartHeight
      return { x, y }
    })
  }, [data, chartWidth, chartHeight])

  // Cubic Bezier interpolation path calculation (smooth horizontal curve)
  const linePath = useMemo(() => {
    if (points.length === 0) return ''
    let d = `M ${points[0].x} ${points[0].y}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i]
      const p1 = points[i + 1]
      const cp1x = p0.x + (p1.x - p0.x) / 2
      const cp1y = p0.y
      const cp2x = p0.x + (p1.x - p0.x) / 2
      const cp2y = p1.y
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`
    }
    return d
  }, [points])

  // Under-line gradient area calculation
  const areaPath = useMemo(() => {
    if (points.length === 0) return ''
    const startX = points[0].x
    const endX = points[points.length - 1].x
    const baseY = chartHeight
    return `${linePath} L ${endX} ${baseY} L ${startX} ${baseY} Z`
  }, [linePath, points, chartHeight])

  // Calculate 4 clean horizontal grid values for the Y axis
  const yGridLines = useMemo(() => {
    const maxVal = Math.max(...data.map(d => d.value), 1)
    return [0, 0.33, 0.66, 1].map(ratio => {
      const value = Math.round(maxVal * ratio)
      const y = chartHeight - ratio * chartHeight
      return { y, value }
    })
  }, [data, chartHeight])

  // Handle direct-DOM hover interactions (60fps performance optimization)
  const handleMouseMove = (e: React.MouseEvent) => {
    const container = containerRef.current
    const tooltip = tooltipRef.current
    const dot = dotRef.current
    const line = lineRef.current

    if (!container || !tooltip || !dot || !line || points.length === 0) return

    const rect = container.getBoundingClientRect()
    // Calculate cursor x relative to SVG bounds
    const mouseX = e.clientX - rect.left - paddingLeft

    let closestIndex = 0
    let minDiff = Infinity

    points.forEach((pt, idx) => {
      const diff = Math.abs(pt.x - mouseX)
      if (diff < minDiff) {
        minDiff = diff
        closestIndex = idx
      }
    })

    const pt = points[closestIndex]
    const rawVal = data[closestIndex].value
    const label = data[closestIndex].label

    // Set tooltip text and position
    tooltip.innerHTML = `
      <p class="text-[9px] text-nx-text-sec uppercase tracking-wider font-bold">${label}</p>
      <p class="font-data text-[12px] font-bold text-nx-text mt-0.5">${formatTooltipValue ? formatTooltipValue(rawVal) : rawVal}</p>
    `
    // Hover details absolute styling overlays
    tooltip.style.transform = `translate3d(${pt.x + paddingLeft - 55}px, ${pt.y + paddingTop - 60}px, 0)`
    tooltip.style.opacity = '1'

    // Update overlay circle inside SVG
    dot.setAttribute('cx', String(pt.x + paddingLeft))
    dot.setAttribute('cy', String(pt.y + paddingTop))
    dot.style.opacity = '1'

    // Update overlay line inside SVG
    line.setAttribute('x1', String(pt.x + paddingLeft))
    line.setAttribute('x2', String(pt.x + paddingLeft))
    line.style.opacity = '0.5'
  }

  const handleMouseLeave = () => {
    const tooltip = tooltipRef.current
    const dot = dotRef.current
    const line = lineRef.current

    if (tooltip) tooltip.style.opacity = '0'
    if (dot) dot.style.opacity = '0'
    if (line) line.style.opacity = '0'
  }

  return (
    <div className="relative w-full h-full flex flex-col select-none" ref={containerRef}>
      {/* Absolute Tooltip Overlay Element (No React state triggers on hover) */}
      <div 
        ref={tooltipRef}
        className="absolute pointer-events-none bg-nx-surface border border-nx-border p-2 rounded-nx-xs shadow-[0_4px_12px_rgba(0,0,0,0.08)] opacity-0 transition-opacity duration-150 z-30 min-w-[110px]"
        style={{ left: 0, top: 0 }}
      />

      {/* Main SVG Container */}
      <svg 
        width={dimensions.width} 
        height={dimensions.height}
        className="overflow-visible"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* 1. Y Axis Grid Lines */}
        <g>
          {yGridLines.map((line, idx) => (
            <g key={idx}>
              <line 
                x1={paddingLeft} 
                y1={line.y + paddingTop} 
                x2={dimensions.width - paddingRight} 
                y2={line.y + paddingTop}
                stroke="#D9E2EC"
                strokeWidth="0.5"
                strokeDasharray="4 4"
              />
              <text 
                x={paddingLeft - 10} 
                y={line.y + paddingTop + 4} 
                textAnchor="end"
                className="font-data text-[9px] fill-nx-text-muted select-none"
              >
                {formatTooltipValue ? formatTooltipValue(line.value) : line.value}
              </text>
            </g>
          ))}
        </g>

        {/* 2. Area Chart Drawing */}
        {points.length > 0 && (
          <g transform={`translate(${paddingLeft}, ${paddingTop})`}>
            {/* Gradient Fill */}
            <path 
              d={areaPath} 
              fill="url(#areaGradient)" 
            />
            {/* Outline curve */}
            <path 
              d={linePath} 
              fill="none" 
              stroke={color} 
              strokeWidth="2" 
              strokeLinecap="round"
            />
          </g>
        )}

        {/* 3. X Axis Labels */}
        <g>
          {data.map((d, index) => {
            if (points[index]) {
              // Only render subset of X labels to avoid crowding on tablets
              const divisor = Math.max(1, Math.round(data.length / 6))
              if (index % divisor === 0 || index === data.length - 1) {
                return (
                  <text
                    key={index}
                    x={points[index].x + paddingLeft}
                    y={dimensions.height - 10}
                    textAnchor="middle"
                    className="font-data text-[9px] fill-nx-text-muted select-none"
                  >
                    {d.label}
                  </text>
                )
              }
            }
            return null
          })}
        </g>

        {/* 4. Hover elements (directly manipulated via JS refs on mouseMove) */}
        {/* Hover Line */}
        <line
          ref={lineRef}
          x1="0"
          y1={paddingTop}
          x2="0"
          y2={dimensions.height - paddingBottom}
          stroke="#64748B"
          strokeWidth="1"
          strokeDasharray="2 2"
          style={{ opacity: 0 }}
        />
        {/* Hover Dot indicator */}
        <circle
          ref={dotRef}
          r="4.5"
          fill={color}
          stroke="#FFFFFF"
          strokeWidth="2.5"
          className="shadow-[0_2px_4px_rgba(0,0,0,0.1)]"
          style={{ opacity: 0 }}
        />
      </svg>
    </div>
  )
}
