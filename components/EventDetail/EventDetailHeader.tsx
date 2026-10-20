import React from 'react';
import { SportEvent, SportConfig } from '@/types.ts';
import { Trash2, Wallet, Edit2, Check, X, MapPin, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useWeather } from '@/hooks/useWeather';
import { WeatherBadge } from './WeatherBadge';

interface EventDetailHeaderProps {
  event: SportEvent;
  sportConfig: SportConfig;
  countJoined: number;
  costPerPerson: number;
  isEditingCost: boolean;
  tempTotalCost: string;
  onTempTotalCostChange: (value: string) => void;
  onStartEditCost: () => void;
  onSaveCost: () => void;
  onCancelCostEdit: () => void;
  isEditingTime?: boolean;
  tempTime?: string;
  onTempTimeChange?: (value: string) => void;
  onStartEditTime?: () => void;
  onSaveTime?: () => void;
  onCancelTimeEdit?: () => void;
  isEditingLocation?: boolean;
  tempLocation?: string;
  onTempLocationChange?: (value: string) => void;
  onStartEditLocation?: () => void;
  onSaveLocation?: () => void;
  onCancelLocationEdit?: () => void;
  onDelete: (id: string) => void;
}

export const EventDetailHeader: React.FC<EventDetailHeaderProps> = ({
  event,
  sportConfig: _sportConfig,
  countJoined: _countJoined,
  costPerPerson: _costPerPerson,
  isEditingCost,
  tempTotalCost,
  onTempTotalCostChange,
  onStartEditCost,
  onSaveCost,
  onCancelCostEdit,
  isEditingTime = false,
  tempTime = '',
  onTempTimeChange,
  onStartEditTime,
  onSaveTime,
  onCancelTimeEdit,
  isEditingLocation = false,
  tempLocation = '',
  onTempLocationChange,
  onStartEditLocation,
  onSaveLocation,
  onCancelLocationEdit,
  onDelete,
}) => {
  const { weather, isLoading: weatherLoading } = useWeather(event.date);

  return (
  <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-100">
    <div className="flex justify-between items-start">
      {/* Left: event info */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">{event.title}</h2>
          <span className="text-base sm:text-lg text-slate-500 font-medium">
            {format(new Date(event.date), 'dd.MM.yyyy')}
          </span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-slate-500 mt-2 text-sm">
          {/* Time with inline editing */}
          <div className="flex items-center gap-1" data-testid="event-time-section">
            <Clock size={16} className="shrink-0" />
            {!isEditingTime ? (
              <>
                <span className="font-mono font-medium">{event.time}</span>
                {onStartEditTime && (
                  <button
                    onClick={onStartEditTime}
                    className="ml-0.5 text-slate-400 hover:text-blue-600 transition-colors w-11 h-11 flex items-center justify-center -my-3 rounded-lg active:bg-slate-200/60"
                    title="Upravit čas"
                    aria-label="Upravit čas"
                    data-testid="edit-time-btn"
                  >
                    <Edit2 size={13} />
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-1">
                <input
                  type="time"
                  value={tempTime}
                  onChange={(e) => onTempTimeChange?.(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSaveTime?.();
                    if (e.key === 'Escape') onCancelTimeEdit?.();
                  }}
                  className="px-2 py-1 text-base md:text-sm border border-blue-300 rounded-lg focus:ring-1 focus:ring-blue-200 outline-none w-28 bg-white"
                  autoFocus
                  data-testid="edit-time-input"
                />
                <button
                  onClick={onSaveTime}
                  className="text-green-600 hover:bg-green-50 w-11 h-11 flex items-center justify-center -my-3 rounded-lg transition-colors"
                  title="Uložit čas"
                  data-testid="save-time-btn"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={onCancelTimeEdit}
                  className="text-red-600 hover:bg-red-50 w-11 h-11 flex items-center justify-center -my-3 rounded-lg transition-colors"
                  title="Zrušit úpravu času"
                  data-testid="cancel-time-btn"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Location with inline editing */}
          <div className="flex items-center gap-1">
            <MapPin size={16} className="shrink-0" />
            {!isEditingLocation ? (
              <>
                <span>{event.location}</span>
                {onStartEditLocation && (
                  <button
                    onClick={onStartEditLocation}
                    className="ml-0.5 text-slate-400 hover:text-blue-600 transition-colors w-11 h-11 flex items-center justify-center -my-3 rounded-lg active:bg-slate-200/60"
                    title="Upravit polohu / místo"
                    aria-label="Upravit polohu / místo"
                  >
                    <Edit2 size={13} />
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={tempLocation}
                  onChange={(e) => onTempLocationChange?.(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSaveLocation?.();
                    if (e.key === 'Escape') onCancelLocationEdit?.();
                  }}
                  className="px-2 py-1 text-base md:text-sm border border-blue-300 rounded-lg focus:ring-1 focus:ring-blue-200 outline-none w-36 sm:w-48 bg-white"
                  placeholder="Místo konání"
                  autoFocus
                />
                <button
                  onClick={onSaveLocation}
                  className="text-green-600 hover:bg-green-50 w-11 h-11 flex items-center justify-center -my-3 rounded-lg transition-colors"
                  title="Uložit polohu"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={onCancelLocationEdit}
                  className="text-red-600 hover:bg-red-50 w-11 h-11 flex items-center justify-center -my-3 rounded-lg transition-colors"
                  title="Zrušit úpravu polohy"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Wallet size={16} className="shrink-0" />
            {!isEditingCost ? (
              <>
                <span>Celkem: {event.totalCost} Kč</span>
                <button
                  onClick={onStartEditCost}
                  className="ml-0.5 text-slate-400 hover:text-blue-600 transition-colors w-11 h-11 flex items-center justify-center -my-3 rounded-lg active:bg-slate-200/60"
                  title="Upravit celkovou cenu"
                  aria-label="Upravit celkovou cenu"
                >
                  <Edit2 size={13} />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1">
                <span>Celkem:</span>
                <input
                  type="number"
                  value={tempTotalCost}
                  onChange={(e) => onTempTotalCostChange(e.target.value)}
                  onFocus={(e) => { if (e.target.value === '0') onTempTotalCostChange(''); }}
                  onBlur={(e) => { if (e.target.value === '') onTempTotalCostChange('0'); }}
                  className="w-20 px-2 py-1 text-base md:text-sm border border-blue-300 rounded-lg focus:ring-1 focus:ring-blue-200 outline-none bg-white"
                  min="0"
                />
                <span>Kč</span>
                <button
                  onClick={onSaveCost}
                  className="text-green-600 hover:bg-green-50 w-11 h-11 flex items-center justify-center -my-3 rounded-lg transition-colors"
                  title="Uložit cenu"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={onCancelCostEdit}
                  className="text-red-600 hover:bg-red-50 w-11 h-11 flex items-center justify-center -my-3 rounded-lg transition-colors"
                  title="Zrušit úpravu ceny"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: weather + delete */}
      <div className="flex items-start gap-3 shrink-0">
        <div className="hidden sm:flex border-l border-slate-200 pl-4 pr-4 border-r self-stretch items-center">
          <WeatherBadge weather={weather} isLoading={weatherLoading} />
        </div>
        <button
          onClick={() => onDelete(event.id)}
          className="text-red-500 hover:text-red-700 hover:bg-red-50 w-11 h-11 flex items-center justify-center rounded-xl transition-colors"
          title="Smazat událost"
        >
          <Trash2 size={20} />
        </button>
      </div>
    </div>

    {/* Mobile: weather below event info */}
    <div className="sm:hidden mt-3">
      <WeatherBadge weather={weather} isLoading={weatherLoading} />
    </div>
  </div>
  );
};
