'use client'

import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { nxChartTheme } from './chart-theme'

interface SalesChartProps {
  data: {
    name: string
    orders: number
  }[]
  height?: number
}

export default function SalesChart({ data, height = 300 }: SalesChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center border border-dashed border-nx-border/50 rounded-nx-card bg-nx-elevated/30" style={{ height }}>
        <p className="font-ui text-nx-text-muted text-[12px]">No sales data available for this period</p>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          barSize={32}
        >
          <CartesianGrid 
            strokeDasharray={nxChartTheme.grid.strokeDasharray} 
            stroke={nxChartTheme.grid.stroke} 
            vertical={false} 
          />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: nxChartTheme.axis.tick.fill, fontSize: nxChartTheme.axis.tick.fontSize, fontFamily: nxChartTheme.axis.tick.fontFamily }} 
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: nxChartTheme.axis.tick.fill, fontSize: nxChartTheme.axis.tick.fontSize, fontFamily: nxChartTheme.axis.tick.fontFamily }}
          />
          <Tooltip 
            contentStyle={nxChartTheme.tooltip.contentStyle}
            itemStyle={nxChartTheme.tooltip.itemStyle}
            cursor={{ fill: nxChartTheme.colors.surface }}
            formatter={(value: number) => [`${value} Orders`, 'Volume']}
            labelStyle={{ color: nxChartTheme.colors.muted, marginBottom: '4px' }}
          />
          <Bar 
            dataKey="orders" 
            radius={[4, 4, 0, 0]}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={nxChartTheme.colors.secondary} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
