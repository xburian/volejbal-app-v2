import React from 'react';
import { SportEvent, SPORT_EMOJI, SportType, SportConfig, DEFAULT_SPORT_CONFIGS } from '../types';
import { Trash2, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

interface EventCardProps {
  event: SportEvent;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  /** When true, shows a chevron instead of delete button (for mobile drill-down) */
  showChevron?: boolean;
  sportConfigs?: SportConfig[];
  maxPlayers?: number;
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  isSelected,
  onSelect,
  onDelete,
  showChevron = false,
  sportConfigs,
  maxPlayers,
}) => {
  const joinedCount = event.participants.filter(p => p.status === 'joined').length;
  const sportType = (event.sportType ?? 'volejbal') as SportType;
  const emoji = SPORT_EMOJI[sportType] ?? '🏅';

  // Capacity calculation
  const effectiveMax = Math.max(
    1,
    maxPlayers ??
      sportConfigs?.find(c => c.type === sportType)?.maxPlayers ??
      DEFAULT_SPORT_CONFIGS.find(c => c.type === sportType)?.maxPlayers ??
      12
  );
  const spotsRemaining = Math.max(0, effectiveMax - joinedCount);
  const isFull = joinedCount >= effectiveMax;

  let capacityText: string;
  let capacityStyle: string;

  if (isFull) {
    capacityText = 'Plno';
    capacityStyle = 'bg-red-50 text-red-700 border-red-200';
  } else if (spotsRemaining <= 2) {
    capacityText = `${spotsRemaining} ${spotsRemaining === 1 ? 'volné místo' : 'volná místa'}`;
    capacityStyle = 'bg-amber-50 text-amber-700 border-amber-200';
  } else {
    capacityText = `${spotsRemaining} ${spotsRemaining < 5 ? 'volná místa' : 'volných míst'}`;
    capacityStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  // Cost calculation
  const totalCost = Number(event.totalCost) || 0;
  const costPerPerson = joinedCount > 0 ? Math.ceil(totalCost / joinedCount) : 0;
  const costText = totalCost <= 0
    ? '0 Kč'
    : joinedCount > 0
      ? `${costPerPerson} Kč / os.`
      : `${totalCost} Kč`;

  return (
    <div
      data-testid={`event-card-${event.id}`}
      onClick={() => onSelect(event.id)}
      className={`
        p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer group relative
        min-h-[72px] sm:min-h-[80px] flex flex-col justify-between gap-2
        ${isSelected
          ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-200'
          : 'bg-white border-slate-100 hover:border-blue-300 hover:shadow-md'}
      `}
    >
      <div className="flex justify-between items-start gap-2">
        <h4 className={`font-bold pr-2 flex items-center gap-1.5 text-sm sm:text-base leading-tight ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
          <span data-testid="sport-emoji">{emoji}</span>
          <span className="truncate">{event.title}</span>
        </h4>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <span className={`text-xs font-bold ${isSelected ? 'text-blue-600' : 'text-slate-500'}`}>
            {format(new Date(event.date), 'd. M.', { locale: cs })}
          </span>
          <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
            {event.time}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs sm:text-sm text-slate-500 mt-1 gap-2 flex-wrap">
        <span className="truncate max-w-[140px] sm:max-w-[180px] text-slate-600 font-medium">{event.location}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span
            data-testid="capacity-pill"
            className={`text-xs font-medium px-2 py-0.5 rounded-full border ${capacityStyle}`}
          >
            {capacityText}
          </span>
          <span
            data-testid="cost-display"
            className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full"
          >
            {costText}
          </span>
          <ParticipantCount count={joinedCount} />
          {showChevron ? (
            <span className="text-slate-300 group-hover:text-slate-500 transition-colors">
              <ChevronRight size={18} />
            </span>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(event.id);
              }}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors z-10"
              title="Smazat událost"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const ParticipantCount: React.FC<{ count: number }> = ({ count }) => (
  <div className="flex items-center gap-1 text-xs font-medium">
    <div className="flex -space-x-2">
      {[...Array(Math.min(count, 3))].map((_, i) => (
        <div key={i} className="w-5 h-5 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[8px] text-blue-600">
          U
        </div>
      ))}
    </div>
    <span>{count}</span>
  </div>
);

