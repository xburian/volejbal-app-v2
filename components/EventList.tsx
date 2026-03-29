import React from 'react';
import { VolleyballEvent } from '../types';
import { EventCard } from './EventCard';
import { Plus, ListFilter, Calendar as CalendarIcon, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

interface EventListProps {
  events: VolleyballEvent[];
  selectedEventId: string | null;
  selectedDate: Date | null;
  onSelectEvent: (id: string) => void;
  onDeleteEvent: (id: string) => void;
  onShowUpcoming: () => void;
  onCreateEvent: () => void;
  /** Show chevron on cards instead of delete button (mobile mode) */
  showChevron?: boolean;
  /** Show the "Přidat" button in the header */
  showAddButton?: boolean;
}

export const EventList: React.FC<EventListProps> = ({
  events,
  selectedEventId,
  selectedDate,
  onSelectEvent,
  onDeleteEvent,
  onShowUpcoming,
  onCreateEvent,
  showChevron = false,
  showAddButton = true,
}) => {
  const isUpcomingMode = selectedDate === null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex flex-col">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            {isUpcomingMode ? (
              <>
                <ListFilter size={18} className="text-blue-500" />
                Nadcházející
              </>
            ) : (
              <>
                <CalendarIcon size={18} className="text-blue-500" />
                {format(selectedDate, 'd. MMMM', { locale: cs })}
              </>
            )}
          </h3>

          {!isUpcomingMode && (
            <button
              onClick={onShowUpcoming}
              className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1 mt-1 font-medium transition-colors"
            >
              <ArrowLeft size={12} />
              Zobrazit nadcházející
            </button>
          )}
        </div>

        {showAddButton && (
          <button
            onClick={onCreateEvent}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Plus size={16} /> Přidat
          </button>
        )}
      </div>

      <div className="space-y-3 pb-8">
        {events.length === 0 ? (
          <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
            <p className="text-sm">
              {isUpcomingMode
                ? 'Žádné nadcházející události.'
                : 'Žádné události pro tento den.'}
            </p>
            <button
              onClick={onCreateEvent}
              className="mt-2 text-blue-600 text-sm hover:underline font-medium"
            >
              Vytvořit novou
            </button>
          </div>
        ) : (
          events.map(event => (
            <EventCard
              key={event.id}
              event={event}
              isSelected={selectedEventId === event.id}
              onSelect={onSelectEvent}
              onDelete={onDeleteEvent}
              showChevron={showChevron}
            />
          ))
        )}
      </div>
    </div>
  );
};

