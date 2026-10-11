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
            <Clock size={16} />
            {!isEditingTime ? (
              <>
                <span className="font-mono font-medium">{event.time}</span>
                {onStartEditTime && (
                  <button
                    onClick={onStartEditTime}
                    className="ml-1 text-slate-400 hover:text-blue-600 transition-colors p-0.5"
                    title="Upravit čas"
                    data-testid="edit-time-btn"
                  >
                    <Edit2 size={12} />
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
                  className="px-1.5 py-0.5 text-sm border border-blue-300 rounded focus:ring-1 focus:ring-blue-200 outline-none w-24"
                  autoFocus
                  data-testid="edit-time-input"
                />
                <button
                  onClick={onSaveTime}
                  className="text-green-600 hover:bg-green-50 p-0.5 rounded transition-colors"
                  title="Uložit čas"
                  data-testid="save-time-btn"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={onCancelTimeEdit}
                  className="text-red-600 hover:bg-red-50 p-0.5 rounded transition-colors"
                  title="Zrušit úpravu času"
                  data-testid="cancel-time-btn"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Location with inline editing */}
          <div className="flex items-center gap-1">
            <MapPin size={16} />
            {!isEditingLocation ? (
              <>
                <span>{event.location}</span>
                {onStartEditLocation && (
                  <button
                    onClick={onStartEditLocation}
                    className="ml-1 text-slate-400 hover:text-blue-600 transition-colors p-0.5"
                    title="Upravit polohu / místo"
                  >
                    <Edit2 size={12} />
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
                  className="px-1.5 py-0.5 text-sm border border-blue-300 rounded focus:ring-1 focus:ring-blue-200 outline-none w-36 sm:w-48"
                  placeholder="Místo konání"
                  autoFocus
                />
                <button
                  onClick={onSaveLocation}
                  className="text-green-600 hover:bg-green-50 p-0.5 rounded transition-colors"
                  title="Uložit polohu"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={onCancelLocationEdit}
                  className="text-red-600 hover:bg-red-50 p-0.5 rounded transition-colors"
                  title="Zrušit úpravu polohy"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Wallet size={16} />
            {!isEditingCost ? (
              <>
                <span>Celkem: {event.totalCost} Kč</span>
                <button
                  onClick={onStartEditCost}
                  className="ml-1 text-slate-400 hover:text-blue-600 transition-colors p-0.5"
                  title="Upravit celkovou cenu"
                >
                  <Edit2 size={12} />
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
                  className="w-16 px-1 py-0.5 text-sm border border-blue-300 rounded focus:ring-1 focus:ring-blue-200 outline-none"
                  min="0"
                />
                <span>Kč</span>
                <button onClick={onSaveCost} className="text-green-600 hover:bg-green-50 p-0.5 rounded transition-colors">
                  <Check size={14} />
                </button>
                <button onClick={onCancelCostEdit} className="text-red-600 hover:bg-red-50 p-0.5 rounded transition-colors">
                  <X size={14} />
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
          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
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
