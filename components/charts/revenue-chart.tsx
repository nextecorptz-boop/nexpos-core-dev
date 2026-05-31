'use client'

import React from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { nxChartTheme } from './chart-theme'

interface RevenueChartProps {
  data: {
    date: string
    revenue: number
  }[]
  height?: number
}

const formatCurrency = (val: number) => {
  if (val >= 1000000) return `TSh ${(val / 1000000).toFixed(1)}M`
  if (val >= 1000) return `TSh ${(val / 1000).toFixed(1)}K`
  return `TSh ${val}`
}

export default function RevenueChart({ data, height = 300 }: RevenueChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center border border-dashed border-nx-border/50 rounded-nx-card bg-nx-elevated/30" style={{ height }}>
        <p className="font-ui text-nx-text-muted text-[12px]">No revenue data available for this period</p>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={nxChartTheme.colors.primary} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={nxChartTheme.colors.primary} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid 
            strokeDasharray={nxChartTheme.grid.strokeDasharray} 
            stroke={nxChartTheme.grid.stroke} 
            vertical={false} 
          />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: nxChartTheme.axis.tick.fill, fontSize: nxChartTheme.axis.tick.fontSize, fontFamily: nxChartTheme.axis.tick.fontFamily }} 
            dy={10}
            minTickGap={20}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: nxChartTheme.axis.tick.fill, fontSize: nxChartTheme.axis.tick.fontSize, fontFamily: nxChartTheme.axis.tick.fontFamily }}
            tickFormatter={formatCurrency}
          />
          <Tooltip 
            contentStyle={nxChartTheme.tooltip.contentStyle}
            itemStyle={nxChartTheme.tooltip.itemStyle}
            formatter={(value: number) => [new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 0 }).format(value), 'Revenue']}
            labelStyle={{ color: nxChartTheme.colors.muted, marginBottom: '4px' }}
          />
          <Area 
            type="monotone" 
            dataKey="revenue" 
            stroke={nxChartTheme.colors.primary} 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorRevenue)" 
            activeDot={{ r: 4, fill: nxChartTheme.colors.primary, stroke: nxChartTheme.colors.surface, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
