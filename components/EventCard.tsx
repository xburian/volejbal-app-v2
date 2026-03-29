import React from 'react';
import { VolleyballEvent } from '../types';
import { Trash2, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

interface EventCardProps {
  event: VolleyballEvent;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  /** When true, shows a chevron instead of delete button (for mobile drill-down) */
  showChevron?: boolean;
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  isSelected,
  onSelect,
  onDelete,
  showChevron = false,
}) => {
  const joinedCount = event.participants.filter(p => p.status === 'joined').length;

  return (
    <div
      data-testid={`event-card-${event.id}`}
      onClick={() => onSelect(event.id)}
      className={`
        p-4 rounded-xl border transition-all cursor-pointer group relative
        ${isSelected
          ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-200'
          : 'bg-white border-slate-100 hover:border-blue-300 hover:shadow-md'}
      `}
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className={`font-bold pr-6 ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
          {event.title}
        </h4>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs font-bold ${isSelected ? 'text-blue-600' : 'text-slate-500'}`}>
            {format(new Date(event.date), 'd. M.', { locale: cs })}
          </span>
          <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
            {event.time}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500 mt-2">
        <span className="truncate max-w-[150px]">{event.location}</span>
        <div className="flex items-center gap-3">
          <ParticipantCount count={joinedCount} />
          {showChevron ? (
            <span className="text-slate-300">
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

