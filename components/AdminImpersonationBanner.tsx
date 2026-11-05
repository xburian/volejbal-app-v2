import React from 'react';
import { ArrowLeft, LogOut, ShieldAlert } from 'lucide-react';

interface AdminImpersonationBannerProps {
  teamName: string;
  onReturnToAdmin: () => void;
  onExitSession: () => void;
}

export const AdminImpersonationBanner: React.FC<AdminImpersonationBannerProps> = ({
  teamName,
  onReturnToAdmin,
  onExitSession,
}) => {
  return (
    <aside
      role="region"
      aria-label="Režim správce"
      className="sticky top-0 z-[100] w-full bg-amber-500 text-slate-950 px-3 sm:px-5 py-2 shadow-md border-b border-amber-600 flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold transition-all select-none"
      data-testid="admin-impersonation-banner"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="flex h-2.5 w-2.5 relative shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-900 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-950" />
        </span>
        <ShieldAlert size={16} className="text-slate-900 shrink-0 hidden sm:inline" />
        <span className="truncate">
          <strong>Režim správce:</strong> Tým <u className="decoration-slate-950">{teamName}</u>
        </span>
        <span className="hidden md:inline-block bg-amber-400/90 px-2 py-0.5 rounded text-[11px] font-mono font-bold text-slate-900">
          Bypass aktivní
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onReturnToAdmin}
          className="bg-slate-950 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm cursor-pointer min-h-[36px]"
          data-testid="return-to-admin-button"
        >
          <ArrowLeft size={14} />
          <span>Zpět do administrace</span>
        </button>

        <button
          onClick={onExitSession}
          className="text-slate-900 hover:text-slate-950 p-1.5 rounded-lg hover:bg-amber-600/30 transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer min-h-[36px]"
          title="Zcela odhlásit administrátora"
          data-testid="exit-admin-session-button"
        >
          <LogOut size={14} />
          <span className="hidden lg:inline">Odhlásit správce</span>
        </button>
      </div>
    </aside>
  );
};
