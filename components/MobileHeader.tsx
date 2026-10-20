import React from 'react';
import { Trophy, LogOut, ArrowLeft, RefreshCw, Users } from 'lucide-react';
import { MobileView } from './MobileBottomNav';
import { User, SportEvent, Team } from '../types';

interface MobileHeaderProps {
  mobileView: MobileView;
  currentUser: User;
  selectedEvent: SportEvent | undefined;
  currentTeam?: Team | null;
  onBack: () => void;
  onLogout: () => void;
  onLogoutTeam?: () => void;
  onRefresh?: () => void;
  onOpenMenu?: () => void;
  isRefreshing?: boolean;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  mobileView,
  currentUser,
  selectedEvent,
  currentTeam,
  onBack,
  onLogout,
  onLogoutTeam,
  onRefresh,
  onOpenMenu,
  isRefreshing = false,
}) => {
  return (
    <header className="sticky top-0 z-30 shrink-0 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white shadow-md border-b border-white/10 pt-[env(safe-area-inset-top,0px)]">
      <div className="px-4 py-2.5 flex items-center justify-between gap-2 min-h-[56px]">
        {mobileView === 'detail' && selectedEvent ? (
          <>
            <button
              data-testid="mobile-back"
              onClick={onBack}
              className="min-w-[44px] min-h-[44px] flex items-center gap-1.5 text-white/90 hover:text-white px-2.5 py-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <ArrowLeft size={18} />
              <span className="text-sm font-semibold">Zpět</span>
            </button>
            <span data-testid="mobile-title" className="font-bold text-sm sm:text-base truncate flex-1 text-center px-2">
              {selectedEvent.title}
            </span>
            <div className="w-16 shrink-0 flex justify-end">
              {onRefresh && (
                <button
                  data-testid="mobile-refresh-detail"
                  onClick={onRefresh}
                  className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 transition-all flex items-center justify-center text-white border border-white/15 cursor-pointer shadow-sm"
                  title="Obnovit data"
                >
                  <RefreshCw size={18} className={isRefreshing ? 'animate-spin text-cyan-200' : ''} />
                </button>
              )}
            </div>
          </>
        ) : mobileView === 'stats' ? (
          <>
            <button
              data-testid="mobile-back"
              onClick={onBack}
              className="min-w-[44px] min-h-[44px] flex items-center gap-1.5 text-white/90 hover:text-white px-2.5 py-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <ArrowLeft size={18} />
              <span className="text-sm font-semibold">Zpět</span>
            </button>
            <span data-testid="mobile-title" className="font-bold text-sm sm:text-base truncate flex-1 text-center px-2">
              Statistiky
            </span>
            <div className="w-16 shrink-0" />
          </>
        ) : mobileView === 'changelog' ? (
          <>
            <button
              data-testid="mobile-back"
              onClick={onBack}
              className="min-w-[44px] min-h-[44px] flex items-center gap-1.5 text-white/90 hover:text-white px-2.5 py-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <ArrowLeft size={18} />
              <span className="text-sm font-semibold">Zpět</span>
            </button>
            <span data-testid="mobile-title" className="font-bold text-sm sm:text-base truncate flex-1 text-center px-2">
              Seznam změn
            </span>
            <div className="w-16 shrink-0" />
          </>
        ) : mobileView === 'profile' ? (
          <>
            <button
              data-testid="mobile-back"
              onClick={onBack}
              className="flex items-center gap-1.5 text-white/90 hover:text-white px-2 py-1.5 rounded-xl hover:bg-white/10 active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <ArrowLeft size={18} />
              <span className="text-sm font-semibold">Zpět</span>
            </button>
            <span data-testid="mobile-title" className="font-bold text-sm sm:text-base flex-1 text-center px-2">
              Můj profil
            </span>
            <div className="w-16 shrink-0" />
          </>
        ) : (
          <>
            {/* Calendar View Header: Team/App info */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
              <div className="p-1.5 bg-white/15 backdrop-blur-sm rounded-xl shrink-0 border border-white/20 flex items-center justify-center shadow-inner">
                <Trophy size={20} className="text-amber-300 drop-shadow-sm shrink-0" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-sm sm:text-base leading-tight truncate">
                  Sport Plánovač
                </div>
                {currentTeam ? (
                  <div className="text-[11px] font-semibold text-blue-100/90 truncate flex items-center gap-1 mt-0.5">
                    <span className="bg-white/15 px-1.5 py-0.2 rounded border border-white/20">
                      Tým: {currentTeam.name}
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-blue-200 truncate">Vítejte</div>
                )}
              </div>
            </div>

            {/* Calendar View Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {onOpenMenu ? (
                <button
                  type="button"
                  data-testid="mobile-user-menu"
                  onClick={onOpenMenu}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full ring-2 ring-white/30 hover:ring-white/70 active:scale-95 transition-all focus:outline-none shrink-0 cursor-pointer"
                  title="Menu profilu a týmu"
                >
                  {currentUser.photoUrl ? (
                    <img
                      src={currentUser.photoUrl}
                      alt={currentUser.name}
                      className="w-8 h-8 rounded-full object-cover shadow-sm"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/20 text-white font-bold text-xs flex items-center justify-center border border-white/40">
                      {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </button>
              ) : (
                currentUser.photoUrl && (
                  <img
                    src={currentUser.photoUrl}
                    alt={currentUser.name}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-white/30 shrink-0"
                  />
                )
              )}

              {onRefresh && (
                <button
                  data-testid="mobile-refresh"
                  onClick={onRefresh}
                  className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 transition-all flex items-center justify-center text-white border border-white/15 shrink-0 cursor-pointer shadow-sm"
                  title="Obnovit data"
                >
                  <RefreshCw size={18} className={`transition-transform ${isRefreshing ? 'animate-spin text-cyan-200' : ''}`} />
                </button>
              )}

              {onLogoutTeam && (
                <button
                  data-testid="mobile-logout-team"
                  onClick={onLogoutTeam}
                  className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 transition-all flex items-center justify-center text-white border border-white/15 shrink-0 cursor-pointer shadow-sm"
                  title="Změnit tým"
                >
                  <Users size={18} />
                </button>
              )}

              <button
                data-testid="mobile-logout"
                onClick={onLogout}
                className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 transition-all flex items-center justify-center text-white border border-white/15 shrink-0 cursor-pointer shadow-sm"
                title="Odhlásit hráče"
              >
                <LogOut size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
};
