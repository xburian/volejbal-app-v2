import React, { useState } from 'react';
import { DebtItem } from '../types';
import { AlertCircle, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

interface UnpaidBannerProps {
  debts: DebtItem[];
}

export const UnpaidBanner: React.FC<UnpaidBannerProps> = ({ debts }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (debts.length === 0) return null;

  const totalDebt = debts.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="bg-red-50 border-b border-red-200 shadow-sm animate-in slide-in-from-top duration-300">
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-red-100/50 transition-colors"
      >
        <div className="flex items-center gap-3 text-red-700">
          <div className="bg-red-200 p-2 rounded-full shrink-0">
             <AlertCircle size={20} />
          </div>
          <div>
            <p className="font-bold text-sm">
              Máte {debts.length} nezaplacené {debts.length === 1 ? 'událost' : debts.length < 5 ? 'události' : 'událostí'}
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Celkem k úhradě: <span className="font-bold">{totalDebt} Kč</span>
            </p>
          </div>
        </div>
        
        <button className="text-red-500">
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {isExpanded && (
        <div className="bg-white border-t border-red-100 p-4 space-y-3">
          <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide font-semibold">Seznam dlužných akcí</p>
          {debts.map(({ event, amount, daysOverdue }) => (
            <div key={event.id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
              <div className="flex flex-col">
                <span className="font-medium text-slate-800 text-sm">{event.title}</span>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                     <Calendar size={12} />
                     {format(new Date(event.date), 'd. M.', { locale: cs })}
                  </span>
                  <span className="text-red-500 font-medium bg-red-50 px-1.5 py-0.5 rounded">
                    {daysOverdue} dní po
                  </span>
                </div>
              </div>
              <span className="font-bold text-red-600 text-sm">{amount} Kč</span>
            </div>
          ))}
          <div className="pt-2 text-center text-xs text-slate-400 italic">
            Pro zaplacení rozklikněte detail události v kalendáři a naskenujte QR kód.
          </div>
        </div>
      )}
    </div>
  );
};