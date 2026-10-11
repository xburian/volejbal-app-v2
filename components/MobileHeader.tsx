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
}) => {
  return (
    <div className="flex flex-col shadow-md z-20 relative bg-blue-700 text-white">
      <div className="p-4 flex items-center justify-between">
        {mobileView === 'detail' && selectedEvent ? (
          <>
            <button
              data-testid="mobile-back"
              onClick={onBack}
              className="flex items-center gap-1.5 text-white/90 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="text-sm font-medium">Zpět</span>
            </button>
            <span data-testid="mobile-title" className="font-bold text-base truncate max-w-[200px]">
              {selectedEvent.title}
            </span>
            <div className="w-16" />
          </>
        ) : mobileView === 'stats' ? (
          <>
            <button
              data-testid="mobile-back"
              onClick={onBack}
              className="flex items-center gap-1.5 text-white/90 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="text-sm font-medium">Zpět</span>
            </button>
            <span data-testid="mobile-title" className="font-bold text-base">Statistiky</span>
            <div className="w-16" />
          </>
        ) : mobileView === 'changelog' ? (
          <>
            <button
              data-testid="mobile-back"
              onClick={onBack}
              className="flex items-center gap-1.5 text-white/90 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="text-sm font-medium">Zpět</span>
            </button>
            <span data-testid="mobile-title" className="font-bold text-base">Seznam změn</span>
            <div className="w-16" />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Trophy size={24} className="shrink-0" />
              <div>
                <div className="font-bold text-base leading-tight">Sport Plánovač</div>
                {currentTeam && (
                  <div className="text-[11px] font-medium text-blue-200 truncate max-w-[130px]">
                    Tým: {currentTeam.name}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {currentUser.photoUrl && (
                <img
                  src={currentUser.photoUrl}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover border-2 border-white/30"
                />
              )}
              {onRefresh && (
                <button
                  data-testid="mobile-refresh"
                  onClick={onRefresh}
                  className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors"
                  title="Obnovit data"
                >
                  <RefreshCw size={18} />
                </button>
              )}
              {onLogoutTeam && (
                <button
                  data-testid="mobile-logout-team"
                  onClick={onLogoutTeam}
                  className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors"
                  title="Změnit tým"
                >
                  <Users size={18} />
                </button>
              )}
              <button
                data-testid="mobile-logout"
                onClick={onLogout}
                className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors"
                title="Odhlásit hráče"
              >
                <LogOut size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
