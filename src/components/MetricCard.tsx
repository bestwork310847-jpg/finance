import React from 'react'

interface Props {
  label: string
  value: string
  sub?: string
  color?: 'default' | 'green' | 'yellow' | 'red'
}

const colorMap = {
  default: 'bg-white border-gray-200',
  green: 'bg-green-50 border-green-200',
  yellow: 'bg-yellow-50 border-yellow-200',
  red: 'bg-red-50 border-red-200',
}

export function MetricCard({ label, value, sub, color = 'default' }: Props) {
  return (
    <div className={`border rounded-lg p-4 ${colorMap[color]} shadow-sm`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}
