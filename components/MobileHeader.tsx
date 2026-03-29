import React from 'react';
import { Trophy, LogOut, ArrowLeft } from 'lucide-react';
import { MobileView } from './MobileBottomNav';
import { User, VolleyballEvent } from '../types';

interface MobileHeaderProps {
  mobileView: MobileView;
  currentUser: User;
  selectedEvent: VolleyballEvent | undefined;
  onBack: () => void;
  onLogout: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  mobileView,
  currentUser,
  selectedEvent,
  onBack,
  onLogout,
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
            <div className="flex items-center gap-2 font-bold text-lg">
              <Trophy size={24} />
              <span>Volejbal</span>
            </div>
            <div className="flex items-center gap-2">
              {currentUser.photoUrl && (
                <img
                  src={currentUser.photoUrl}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover border-2 border-white/30"
                />
              )}
              <button
                data-testid="mobile-logout"
                onClick={onLogout}
                className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors"
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

