import React from 'react';
import { Loader2, Check } from 'lucide-react';

export type ReloadToastStatus = 'idle' | 'loading' | 'success';

export interface ReloadToastProps {
  status: ReloadToastStatus;
  loadingMessage?: string;
  successMessage?: string;
}

export const ReloadToast: React.FC<ReloadToastProps> = ({
  status,
  loadingMessage = 'Aktualizace dat…',
  successMessage = 'Data byla úspěšně aktualizována',
}) => {
  if (status === 'idle') return null;

  const isLoading = status === 'loading';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-20 md:bottom-6 right-6 z-50 flex items-center gap-2.5 text-xs px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md border pointer-events-none transition-all duration-300 animate-fade-in ${
        isLoading
          ? 'bg-slate-900/95 text-white border-slate-700/60'
          : 'bg-emerald-950/90 text-emerald-100 border-emerald-600/50 shadow-emerald-950/30'
      }`}
      data-testid={isLoading ? 'background-refresh-indicator' : 'refresh-success-indicator'}
    >
      {isLoading ? (
        <>
          <Loader2 className="animate-spin text-cyan-400 shrink-0" size={15} />
          <span className="font-medium">{loadingMessage}</span>
        </>
      ) : (
        <>
          <div className="bg-emerald-500 text-white rounded-full p-0.5 shrink-0">
            <Check size={12} strokeWidth={3} />
          </div>
          <span className="font-semibold text-emerald-200">{successMessage}</span>
        </>
      )}
    </div>
  );
};
