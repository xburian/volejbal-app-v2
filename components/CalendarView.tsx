import React from 'react';
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
  endOfWeek
} from 'date-fns';
import { cs } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { VolleyballEvent } from '../types';

interface CalendarViewProps {
  currentDate: Date; // The month currently being viewed
  selectedDate: Date | null; // The specifically selected day (if any)
  onDateChange: (date: Date) => void;
  onMonthChange: (date: Date) => void; // New prop to handle month navigation separately
  events: VolleyballEvent[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({ 
  currentDate, 
  selectedDate, 
  onDateChange, 
  onMonthChange,
  events 
}) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextMonth = () => onMonthChange(addMonths(currentDate, 1));
  const prevMonth = () => onMonthChange(subMonths(currentDate, 1));

  const hasEvent = (day: Date) => {
    return events.some(e => isSameDay(new Date(e.date), day));
  };

  const weekDays = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800 capitalize">
          {format(currentDate, 'MMMM yyyy', { locale: cs })}
        </h2>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-semibold text-slate-400 py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          // Highlight only if selectedDate is not null AND matches the day
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const eventExists = hasEvent(day);
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateChange(day)}
              className={`
                relative h-10 w-full flex items-center justify-center rounded-lg text-sm transition-all
                ${!isCurrentMonth ? 'text-slate-300' : 'text-slate-700'}
                ${isSelected 
                  ? 'bg-blue-100 text-blue-700 font-bold ring-1 ring-blue-200' 
                  : 'hover:bg-slate-100'}
                ${!isSelected && isToday ? 'font-bold text-blue-600' : ''}
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