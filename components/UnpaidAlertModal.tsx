import React from 'react';
import { VolleyballEvent } from '../types';
import { AlertCircle, Calendar, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

export interface DebtItem {
  event: VolleyballEvent;
  amount: number;
  daysOverdue: number;
}

interface UnpaidAlertModalProps {
  debts: DebtItem[];
  onClose: () => void;
}

export const UnpaidAlertModal: React.FC<UnpaidAlertModalProps> = ({ debts, onClose }) => {
  if (debts.length === 0) return null;

  const totalDebt = debts.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-red-600 p-6 text-white flex items-start gap-4">
          <div className="bg-white/20 p-3 rounded-full shrink-0">
            <AlertCircle size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Nezaplacené události</h2>
            <p className="text-red-100 text-sm mt-1">
              Máte {debts.length} {debts.length === 1 ? 'nezaplacenou akci' : debts.length < 5 ? 'nezaplacené akce' : 'nezaplacených akcí'} po splatnosti.
            </p>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
          {debts.map(({ event, amount, daysOverdue }) => (
            <div key={event.id} className="bg-white border border-red-100 rounded-xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-red-100 text-red-600 text-[10px] px-2 py-1 rounded-bl-lg font-bold">
                {daysOverdue} dní po
              </div>
              
              <div className="flex justify-between items-start mb-2 pr-12">
                <h3 className="font-bold text-slate-800">{event.title}</h3>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-slate-600 mb-3">
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {format(new Date(event.date), 'd. MMMM', { locale: cs })}
                </span>
                <span>•</span>
                <span>{event.location}</span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-400">Dlužná částka</span>
                <span className="font-bold text-red-600 text-lg">{amount} Kč</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 bg-white border-t border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <span className="text-slate-600 font-medium">Celkem k úhradě</span>
            <span className="text-2xl font-bold text-slate-900">{totalDebt} Kč</span>
          </div>
          
          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Wallet size={18} />
            Rozumím, zaplatím
          </button>
        </div>

      </div>
    </div>
  );
};
