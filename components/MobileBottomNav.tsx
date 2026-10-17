import React from 'react';
import { Calendar, BarChart3, User, Plus } from 'lucide-react';

export type MobileView = 'calendar' | 'detail' | 'stats' | 'changelog' | 'profile';

interface MobileBottomNavProps {
  activeView: MobileView;
  onNavigate: (view: MobileView) => void;
  onOpenSettings: () => void;
  onCreateEvent: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  onNavigate,
  onCreateEvent,
}) => {
  return (
    <nav
      data-testid="mobile-bottom-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
    >
      <div className="grid grid-cols-4 h-16 max-w-md mx-auto relative px-2">
        {/* Calendar Tab */}
        <button
          data-testid="nav-calendar"
          onClick={() => onNavigate('calendar')}
          className={`flex flex-col items-center justify-center gap-1 transition-all duration-200 cursor-pointer ${
            activeView === 'calendar' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600 active:scale-95'
          }`}
        >
          <Calendar size={20} className={activeView === 'calendar' ? 'stroke-[2.5]' : ''} />
          <span className="text-[10px] font-medium leading-none">Kalendář</span>
        </button>

        {/* Elevated FAB: Add Event Tab */}
        <button
          data-testid="nav-create"
          onClick={onCreateEvent}
          className="flex flex-col items-center justify-center -mt-3.5 group active:scale-95 transition-transform cursor-pointer"
          title="Nová událost"
        >
          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/35 border-2 border-white group-active:scale-90 transition-transform">
            <Plus size={22} className="stroke-[2.5]" />
          </div>
          <span className="text-[10px] font-medium text-slate-500 mt-1 leading-none">Přidat</span>
        </button>

        {/* Stats Tab */}
        <button
          data-testid="nav-stats"
          onClick={() => onNavigate('stats')}
          className={`flex flex-col items-center justify-center gap-1 transition-all duration-200 cursor-pointer ${
            activeView === 'stats' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600 active:scale-95'
          }`}
        >
          <BarChart3 size={20} className={activeView === 'stats' ? 'stroke-[2.5]' : ''} />
          <span className="text-[10px] font-medium leading-none">Statistiky</span>
        </button>

        {/* Profile / Gamification Tab */}
        <button
          data-testid="nav-profile"
          onClick={() => onNavigate('profile')}
          className={`flex flex-col items-center justify-center gap-1 transition-all duration-200 cursor-pointer ${
            activeView === 'profile' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600 active:scale-95'
          }`}
        >
          <User size={20} className={activeView === 'profile' ? 'stroke-[2.5]' : ''} />
          <span className="text-[10px] font-medium leading-none">Můj profil</span>
        </button>
      </div>
    </nav>
  );
};
