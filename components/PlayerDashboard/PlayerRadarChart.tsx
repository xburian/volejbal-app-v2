import React from 'react';
import { PlayerAttributes } from '../../types';

interface PlayerRadarChartProps {
  attributes: PlayerAttributes;
  size?: number;
}

interface StatConfig {
  key: keyof PlayerAttributes;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
}

const STAT_CONFIGS: StatConfig[] = [
  { key: 'reliability', label: 'Spolehlivost', shortLabel: 'SPO', description: 'Docházka a včasnost plateb', color: '#10b981' }, // Top
  { key: 'form', label: 'Forma', shortLabel: 'FOR', description: 'Úspěšnost v posledních zápasech a ELO síla', color: '#3b82f6' }, // Top Right
  { key: 'clutch', label: 'Koncovky', shortLabel: 'CLU', description: 'Úspěšnost v těsných setech o 2 body', color: '#f59e0b' }, // Bottom Right
  { key: 'teamplay', label: 'Týmovost', shortLabel: 'TÝM', description: 'Rozmanitost spoluhráčů a týmová souhra', color: '#8b5cf6' }, // Bottom Left
  { key: 'endurance', label: 'Zkušenost', shortLabel: 'VÝD', description: 'Celkový počet odehraných akcí', color: '#ec4899' }, // Top Left
];

export const PlayerRadarChart: React.FC<PlayerRadarChartProps> = ({
  attributes,
  size = 280,
}) => {
  const center = size / 2;
  const radius = size * 0.38; // leave room for labels
  const totalAxes = STAT_CONFIGS.length;

  // Angles: Start at top (-90 degrees), go clockwise
  const getCoordinates = (index: number, valueRatio: number) => {
    const angle = (index * 2 * Math.PI) / totalAxes - Math.PI / 2;
    const r = radius * valueRatio;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // Grid levels (50, 65, 80, 95)
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  // Map attribute score (50–99) to ratio (0.1–1.0)
  const scoreToRatio = (score: number) => {
    const clamped = Math.max(50, Math.min(99, score));
    return 0.15 + (0.85 * (clamped - 50)) / 49;
  };

  // Build points for player polygon
  const playerPoints = STAT_CONFIGS.map((stat, i) => {
    const score = attributes[stat.key];
    const ratio = scoreToRatio(score);
    const coords = getCoordinates(i, ratio);
    return `${coords.x.toFixed(1)},${coords.y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="flex flex-col items-center">
      {/* SVG Radar */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="overflow-visible select-none drop-shadow-sm"
          viewBox={`0 0 ${size} ${size}`}
        >
          <defs>
            <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
              <stop offset="70%" stopColor="#6366f1" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.05" />
            </radialGradient>
            <linearGradient id="polygonBorder" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>

          {/* Background web polygons */}
          {gridLevels.map((lvl, idx) => {
            const gridPts = Array.from({ length: totalAxes })
              .map((_, i) => {
                const c = getCoordinates(i, lvl);
                return `${c.x.toFixed(1)},${c.y.toFixed(1)}`;
              })
              .join(' ');
            return (
              <polygon
                key={idx}
                points={gridPts}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth={idx === gridLevels.length - 1 ? '1.5' : '1'}
                strokeDasharray={idx < gridLevels.length - 1 ? '2 2' : undefined}
              />
            );
          })}

          {/* Axis lines */}
          {Array.from({ length: totalAxes }).map((_, i) => {
            const endCoords = getCoordinates(i, 1.0);
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={endCoords.x}
                y2={endCoords.y}
                stroke="#cbd5e1"
                strokeWidth="1"
              />
            );
          })}

          {/* Filled player polygon */}
          <polygon
            points={playerPoints}
            fill="url(#radarGlow)"
            stroke="url(#polygonBorder)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            className="transition-all duration-500 ease-out"
          />

          {/* Vertices & values */}
          {STAT_CONFIGS.map((stat, i) => {
            const score = attributes[stat.key];
            const ratio = scoreToRatio(score);
            const pt = getCoordinates(i, ratio);
            const labelCoord = getCoordinates(i, 1.22);

            return (
              <g key={stat.key} className="transition-all duration-300">
                {/* Vertex dot */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="4.5"
                  fill="#ffffff"
                  stroke={stat.color}
                  strokeWidth="2.5"
                  className="drop-shadow-sm"
                />

                {/* Text Label outside the web */}
                <text
                  x={labelCoord.x}
                  y={labelCoord.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="text-[11px] font-bold fill-slate-700 select-none pointer-events-none"
                >
                  {stat.shortLabel}
                </text>
                <text
                  x={labelCoord.x}
                  y={labelCoord.y + 12}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="text-[10px] font-extrabold fill-blue-600 select-none pointer-events-none"
                >
                  {score}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Responsive Stat Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 w-full mt-3">
        {STAT_CONFIGS.map(stat => {
          const val = attributes[stat.key];
          return (
            <div
              key={stat.key}
              className="flex flex-col items-center p-2 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:shadow-xs transition-all"
              title={stat.description}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {stat.label}
              </span>
              <span className="text-base font-extrabold text-slate-800 mt-0.5">
                {val}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
