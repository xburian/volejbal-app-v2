import React from 'react';
import { QrCode, Loader2 } from 'lucide-react';

export interface EventBottomActionDockProps {
  isCurrentUserJoined: boolean;
  isWaitlisted: boolean;
  isAtCapacity: boolean;
  countJoined: number;
  maxPlayers: number;
  costPerPerson: number;
  hasPaid: boolean;
  isSaving?: boolean;
  onJoinOrWaitlist: () => void;
  onDecline: () => void;
  onGoToPayment: () => void;
}

export const EventBottomActionDock: React.FC<EventBottomActionDockProps> = ({
  isCurrentUserJoined,
  isWaitlisted,
  isAtCapacity,
  countJoined,
  maxPlayers,
  costPerPerson,
  hasPaid,
  isSaving = false,
  onJoinOrWaitlist,
  onDecline,
  onGoToPayment,
}) => {
  const isRegistered = isCurrentUserJoined || isWaitlisted;

  return (
    <div
      data-testid="event-bottom-action-dock"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 shadow-[0_-8px_25px_rgba(0,0,0,0.08)] px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] transition-all"
    >
      {!isRegistered ? (
        !isAtCapacity ? (
          <button
            type="button"
            data-testid="action-dock-join"
            onClick={onJoinOrWaitlist}
            disabled={isSaving}
            className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white h-12 rounded-2xl font-bold flex items-center justify-between px-5 active:scale-[0.98] shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            <span className="flex items-center gap-2">
              {isSaving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Ukládání...</span>
                </>
              ) : (
                <span>🏐 Jdu hrát</span>
              )}
            </span>
            <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-xs font-semibold backdrop-blur-xs">
              {countJoined}/{maxPlayers} hráčů
            </span>
          </button>
        ) : (
          <button
            type="button"
            data-testid="action-dock-join"
            onClick={onJoinOrWaitlist}
            disabled={isSaving}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white h-12 rounded-2xl font-bold flex items-center justify-between px-5 active:scale-[0.98] shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            <span className="flex items-center gap-2">
              {isSaving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Ukládání...</span>
                </>
              ) : (
                <span>⏳ Na čekací listinu</span>
              )}
            </span>
            <span className="bg-black/20 px-2.5 py-0.5 rounded-full text-xs font-semibold">
              {countJoined}/{maxPlayers} plno
            </span>
          </button>
        )
      ) : (
        <div className="flex items-center gap-2.5 w-full">
          {/* Status card */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-3 h-12 flex items-center justify-between flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0 mr-2">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 animate-pulse ${
                  isWaitlisted
                    ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                    : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                }`}
              />
              <span
                className={`text-xs font-bold truncate ${
                  isWaitlisted ? 'text-amber-800' : 'text-emerald-800'
                }`}
              >
                {isWaitlisted ? 'Na čekačce' : '✓ Jdeš hrát'}
              </span>
            </div>
            <button
              type="button"
              data-testid="action-dock-decline"
              onClick={onDecline}
              disabled={isSaving}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-xl transition-colors shrink-0 disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              Odhlásit
            </button>
          </div>

          {/* Payment button */}
          <button
            type="button"
            data-testid="action-dock-pay"
            onClick={onGoToPayment}
            className={`h-12 px-4 rounded-2xl font-bold flex items-center gap-2 shrink-0 transition-all active:scale-[0.98] cursor-pointer ${
              hasPaid
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
            }`}
          >
            <QrCode size={18} className={hasPaid ? 'text-emerald-700' : 'text-white'} />
            <span className="text-xs font-bold whitespace-nowrap">
              {hasPaid ? 'Zaplaceno ✓' : `Zaplatit ${costPerPerson} Kč`}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
