export const nxChartTheme = {
  colors: {
    primary: '#06b6d4', // nx-cyan
    secondary: '#B48E4F', // nx-gold
    success: '#10b981', // nx-green
    destructive: '#ef4444', // nx-red
    muted: '#A19B94', // nx-text-muted
    surface: '#0A0908', // nx-surface
    grid: '#292521', // nx-border
    tooltipBg: '#12100E', // nx-elevated
  },
  font: {
    family: 'var(--font-ui), system-ui, sans-serif',
    size: 11,
  },
  grid: {
    stroke: '#292521',
    strokeDasharray: '3 3',
  },
  tooltip: {
    contentStyle: {
      backgroundColor: '#12100E',
      border: '1px solid #292521',
      borderRadius: '8px',
      color: '#FAF6EE',
      fontFamily: 'var(--font-ui), system-ui, sans-serif',
      fontSize: '12px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
    },
    itemStyle: {
      color: '#FAF6EE',
    },
  },
  axis: {
    tick: { fill: '#A19B94', fontSize: 11, fontFamily: 'var(--font-ui)' },
    tickLine: { stroke: '#292521' },
    axisLine: { stroke: '#292521' },
  }
}
