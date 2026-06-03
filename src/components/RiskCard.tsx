import React from 'react'
import type { RiskCard as RiskCardType } from '../engine/types'

const levelConfig = {
  red:    { border: 'border-red-500',    bg: 'bg-red-50',    badge: 'bg-red-500',    label: 'ความเสี่ยงสูง' },
  yellow: { border: 'border-yellow-500', bg: 'bg-yellow-50', badge: 'bg-yellow-500', label: 'ควรระวัง' },
  green:  { border: 'border-green-500',  bg: 'bg-green-50',  badge: 'bg-green-600',  label: 'ดี' },
}

export function RiskCardComponent({ card }: { card: RiskCardType }) {
  const cfg = levelConfig[card.level]
  return (
    <div className={`border-l-4 ${cfg.border} ${cfg.bg} rounded-r-lg p-4 shadow-sm`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-800 text-sm">{card.name}</h3>
        <span className={`${cfg.badge} text-white text-xs px-2 py-0.5 rounded-full ml-2 flex-shrink-0`}>
          {cfg.label}
        </span>
      </div>
      <p className="text-gray-700 text-sm mb-2">{card.punchline}</p>
      <p className="text-gray-500 text-xs border-t border-gray-200 pt-2 mt-2">
        <span className="font-medium">แนวทาง:</span> {card.advice}
      </p>
    </div>
  )
}
