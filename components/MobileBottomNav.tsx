import React from 'react';
import { Calendar, BarChart3, Settings, PlusCircle } from 'lucide-react';

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

        {/* Add Event Tab */}
        <button
          data-testid="nav-create"
          onClick={onCreateEvent}
          className="flex flex-col items-center justify-center gap-0.5 transition-colors duration-200 text-slate-400 active:text-blue-600"
        >
          <PlusCircle size={22} />
          <span className="text-[10px] font-medium">Přidat</span>
        </button>

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

