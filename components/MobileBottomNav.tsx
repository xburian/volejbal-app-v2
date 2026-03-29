import React from 'react';
import { Calendar, BarChart3, Settings, Plus } from 'lucide-react';

export type MobileView = 'calendar' | 'detail' | 'stats' | 'changelog';

interface MobileBottomNavProps {
  activeView: MobileView;
  onNavigate: (view: MobileView) => void;
  onOpenSettings: () => void;
  onCreateEvent: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  onNavigate,
  onOpenSettings,
  onCreateEvent,
}) => {
  return (
    <nav
      data-testid="mobile-bottom-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]"
    >
      <div className="grid grid-cols-4 h-16 max-w-md mx-auto relative">
        {/* Calendar Tab */}
        <button
          data-testid="nav-calendar"
          onClick={() => onNavigate('calendar')}
          className={`flex flex-col items-center justify-center gap-0.5 transition-colors duration-200 ${
            activeView === 'calendar' ? 'text-blue-600' : 'text-slate-400 active:text-slate-600'
          }`}
        >
          <Calendar size={22} />
          <span className="text-[10px] font-medium">Kalendář</span>
        </button>

        {/* Center FAB placeholder — keeps grid balanced */}
        <div className="relative flex items-center justify-center">
          <button
            data-testid="nav-create"
            onClick={onCreateEvent}
            className="absolute -top-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-300/50 flex items-center justify-center active:scale-95 transition-transform"
          >
            <Plus size={26} strokeWidth={2.5} />
          </button>
        </div>

        {/* Stats Tab */}
        <button
          data-testid="nav-stats"
          onClick={() => onNavigate('stats')}
          className={`flex flex-col items-center justify-center gap-0.5 transition-colors duration-200 ${
            activeView === 'stats' ? 'text-blue-600' : 'text-slate-400 active:text-slate-600'
          }`}
        >
          <BarChart3 size={22} />
          <span className="text-[10px] font-medium">Statistiky</span>
        </button>

        {/* Settings Tab */}
        <button
          data-testid="nav-settings"
          onClick={onOpenSettings}
          className="flex flex-col items-center justify-center gap-0.5 transition-colors duration-200 text-slate-400 active:text-slate-600"
        >
          <Settings size={22} />
          <span className="text-[10px] font-medium">Nastavení</span>
        </button>
      </div>
    </nav>
  );
};

