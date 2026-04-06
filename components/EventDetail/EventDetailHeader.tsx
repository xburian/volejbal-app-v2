import React from 'react';
import { SportEvent, SportConfig } from '@/types.ts';
import { Users, Trash2, Wallet, Edit2, Check, X } from 'lucide-react';
import { format } from 'date-fns';

interface EventDetailHeaderProps {
  event: SportEvent;
  sportConfig: SportConfig;
  countJoined: number;
  costPerPerson: number;
  isEditingCost: boolean;
  tempTotalCost: number;
  onTempTotalCostChange: (value: number) => void;
  onStartEditCost: () => void;
  onSaveCost: () => void;
  onCancelCostEdit: () => void;
  onDelete: (id: string) => void;
}

export const EventDetailHeader: React.FC<EventDetailHeaderProps> = ({
  event,
  sportConfig,
  countJoined,
  costPerPerson,
  isEditingCost,
  tempTotalCost,
  onTempTotalCostChange,
  onStartEditCost,
  onSaveCost,
  onCancelCostEdit,
  onDelete,
}) => (
  <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-start">
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800">{event.title}</h2>
        <span className="text-base sm:text-lg text-slate-500 font-medium">
          {format(new Date(event.date), 'dd.MM.yyyy')}
        </span>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-slate-500 mt-2 text-sm">
        <span className="flex items-center gap-1"><Users size={16} /> {event.location}</span>
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
                onChange={(e) => onTempTotalCostChange(Number(e.target.value))}
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
    <button
      onClick={() => onDelete(event.id)}
      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
      title="Smazat událost"
    >
      <Trash2 size={20} />
    </button>
  </div>
);

