import React, { useState } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks
} from 'date-fns';
import { cs } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CalendarDays } from 'lucide-react';
import { SportEvent } from '../types';

export type CalendarViewMode = 'month' | 'week';

export interface CalendarViewProps {
  currentDate: Date; // The month or week currently being viewed
  selectedDate: Date | null; // The specifically selected day (if any)
  onDateChange: (date: Date) => void;
  onMonthChange: (date: Date) => void; // Prop to handle navigation
  events: SportEvent[];
  initialMode?: CalendarViewMode;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ 
  currentDate, 
  selectedDate, 
  onDateChange, 
  onMonthChange,
  events,
  initialMode = 'month',
}) => {
  const [mode, setMode] = useState<CalendarViewMode>(initialMode);

  const isWeekMode = mode === 'week';

  // Calculate days for month vs week mode
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);

  const startDate = isWeekMode
    ? startOfWeek(currentDate, { weekStartsOn: 1 })
    : startOfWeek(monthStart, { weekStartsOn: 1 });

  const endDate = isWeekMode
    ? endOfWeek(currentDate, { weekStartsOn: 1 })
    : endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextInterval = () => {
    if (isWeekMode) {
      onMonthChange(addWeeks(currentDate, 1));
    } else {
      onMonthChange(addMonths(currentDate, 1));
    }
  };

  const prevInterval = () => {
    if (isWeekMode) {
      onMonthChange(subWeeks(currentDate, 1));
    } else {
      onMonthChange(subMonths(currentDate, 1));
    }
  };

  const hasEvent = (day: Date) => {
    return events.some(e => isSameDay(new Date(e.date), day));
  };

  const weekDays = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 transition-all" data-testid="calendar-view">
      {/* Calendar Header with Title, Toggle and Navigation */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800 capitalize leading-tight" data-testid="calendar-title">
            {isWeekMode ? (
              <span>{format(startDate, 'd. M.', { locale: cs })} – {format(endDate, 'd. M. yyyy', { locale: cs })}</span>
            ) : (
              format(currentDate, 'MMMM yyyy', { locale: cs })
            )}
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mode switch pill */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/60" data-testid="calendar-mode-toggle">
            <button
              type="button"
              onClick={() => setMode('week')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1 ${
                isWeekMode 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Zobrazit týdenní pásku"
              data-testid="calendar-mode-week"
            >
              <CalendarDays size={12} />
              Týden
            </button>
            <button
              type="button"
              onClick={() => setMode('month')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1 ${
                !isWeekMode 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Zobrazit měsíční kalendář"
              data-testid="calendar-mode-month"
            >
              <CalendarIcon size={12} />
              Měsíc
            </button>
          </div>

          {/* Navigation Arrows */}
          <div className="flex gap-0.5">
            <button 
              onClick={prevInterval} 
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
              title={isWeekMode ? 'Předchozí týden' : 'Předchozí měsíc'}
              data-testid="calendar-prev-btn"
            >
              <ChevronLeft size={18} />
            </button>
            <button 
              onClick={nextInterval} 
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
              title={isWeekMode ? 'Další týden' : 'Další měsíc'}
              data-testid="calendar-next-btn"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Week day names header */}
      <div className="grid grid-cols-7 mb-1">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-semibold text-slate-400 py-1.5">
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid (7 columns, 1 row in week mode, 4-6 rows in month mode) */}
      <div className={`grid grid-cols-7 gap-1 transition-all ${isWeekMode ? '' : ''}`} data-testid="calendar-grid">
        {days.map((day) => {
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const eventExists = hasEvent(day);
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateChange(day)}
              className={`
                relative h-9 sm:h-10 w-full flex items-center justify-center rounded-lg text-sm transition-all
                ${!isWeekMode && !isCurrentMonth ? 'text-slate-300' : 'text-slate-700'}
                ${isSelected 
                  ? 'bg-blue-100 text-blue-700 font-bold ring-1 ring-blue-300' 
                  : 'hover:bg-slate-100'}
                ${!isSelected && isToday ? 'font-bold text-blue-600 ring-1 ring-blue-200/50' : ''}
              `}
            >
              {format(day, 'd')}
              {eventExists && (
                <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-blue-600' : 'bg-blue-400'}`}></span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};