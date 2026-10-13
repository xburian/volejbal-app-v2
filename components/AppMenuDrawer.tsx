import React from 'react';
import { User, Team } from '../types';
import { 
  X, Settings, MessageSquarePlus, Info, Download, RefreshCw, 
  Users, LogOut, Trophy, ChevronRight
} from 'lucide-react';

export interface AppMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  currentTeam?: Team | null;
  onOpenSettings: () => void;
  onOpenIssues: () => void;
  onOpenChangelog: () => void;
  onExportICS: () => void;
  onRefreshData?: () => void;
  isRefreshing?: boolean;
  onLogoutTeam?: () => void;
  onLogoutUser: () => void;
}

export const AppMenuDrawer: React.FC<AppMenuDrawerProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentTeam,
  onOpenSettings,
  onOpenIssues,
  onOpenChangelog,
  onExportICS,
  onRefreshData,
  isRefreshing = false,
  onLogoutTeam,
  onLogoutUser,
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] animate-backdrop-in"
        onClick={onClose}
        data-testid="app-menu-backdrop"
      />

      {/* Drawer */}
      <div
        className="fixed inset-y-0 right-0 z-[70] w-full sm:w-[400px] bg-white shadow-2xl flex flex-col animate-drawer-in"
        data-testid="app-menu-drawer"
      >
        {/* User Card Header */}
        <div className="p-6 bg-gradient-to-br from-blue-700 to-indigo-800 text-white flex-shrink-0 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            data-testid="app-menu-close"
            title="Zavřít menu"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-3.5 mt-2">
            {currentUser.photoUrl ? (
              <img
                src={currentUser.photoUrl}
                alt={currentUser.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-white/40 shadow-sm"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-white/20 text-white font-bold text-xl flex items-center justify-center border-2 border-white/40 shadow-sm">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-lg leading-tight truncate text-white" data-testid="menu-user-name">
                {currentUser.name}
              </h3>
              {currentTeam && (
                <div className="flex items-center gap-1.5 text-xs text-blue-200 mt-0.5 truncate">
                  <Trophy size={13} className="shrink-0" />
                  <span>Tým: <strong className="text-white font-semibold">{currentTeam.name}</strong></span>
                </div>
              )}
              {currentUser.hasMultisportCard && (
                <span className="inline-block mt-1 text-[11px] bg-purple-500/30 text-purple-200 px-2 py-0.5 rounded-full border border-purple-400/30">
                  🎫 MultiSport karta
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Menu Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Group: Nastavení & Podpora */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1.5">
              Správa & Nástroje
            </p>
            <div className="space-y-1">
              <button
                onClick={() => { onClose(); onOpenSettings(); }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group"
                data-testid="menu-item-settings"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                    <Settings size={18} />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 text-sm">Nastavení a profil</div>
                    <div className="text-xs text-slate-400">Účet, platby, sporty, heslo</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500" />
              </button>

              <button
                onClick={() => { onClose(); onOpenIssues(); }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group"
                data-testid="menu-item-issues"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition-colors">
                    <MessageSquarePlus size={18} />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 text-sm">Náměty a chyby</div>
                    <div className="text-xs text-slate-400">Návrhy vylepšení a hlášení chyb</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500" />
              </button>

              <button
                onClick={() => { onClose(); onOpenChangelog(); }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group"
                data-testid="menu-item-changelog"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors">
                    <Info size={18} />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 text-sm">Seznam změn</div>
                    <div className="text-xs text-slate-400">Novinky v aplikaci a verze</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500" />
              </button>
            </div>
          </div>

          {/* Group: Data & Synchronizace */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1.5">
              Data & Export
            </p>
            <div className="space-y-1">
              <button
                onClick={() => { onClose(); onExportICS(); }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group"
                data-testid="menu-item-export"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                    <Download size={18} />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 text-sm">Export do kalendáře</div>
                    <div className="text-xs text-slate-400">Stáhnout události jako .ics soubor</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500" />
              </button>

              {onRefreshData && (
                <button
                  onClick={() => { onClose(); onRefreshData(); }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group"
                  data-testid="menu-item-refresh"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100 transition-colors">
                      <RefreshCw size={18} className={`transition-transform ${isRefreshing ? 'animate-spin' : ''}`} />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 text-sm">Obnovit data</div>
                      <div className="text-xs text-slate-400">Aktualizovat ze serveru</div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500" />
                </button>
              )}
            </div>
          </div>

          {/* Group: Tým & Odhlášení */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1.5">
              Účet & Tým
            </p>
            <div className="space-y-1">
              {onLogoutTeam && (
                <button
                  onClick={() => { onClose(); onLogoutTeam(); }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group"
                  data-testid="menu-item-change-team"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                      <Users size={18} />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 text-sm">Změnit tým</div>
                      <div className="text-xs text-slate-400">Přepnout do jiného týmu</div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500" />
                </button>
              )}

              <button
                onClick={() => { onClose(); onLogoutUser(); }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-red-50/50 transition-colors text-left group"
                data-testid="menu-item-logout"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-50 text-red-500 group-hover:bg-red-100 transition-colors">
                    <LogOut size={18} />
                  </div>
                  <div>
                    <div className="font-semibold text-red-600 text-sm">Odhlásit hráče</div>
                    <div className="text-xs text-slate-400">Odhlásit z profilu {currentUser.name}</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-red-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 text-center text-xs text-slate-400 flex items-center justify-between">
          <span>Sport Plánovač</span>
          <span className="font-mono text-[11px]">v1.12.0</span>
        </div>
      </div>
    </>
  );
};
