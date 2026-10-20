import React, { useState } from 'react';
import { SportEvent, User } from '../../types';
import { Award, Sparkles, Heart, Shield } from 'lucide-react';

interface EventAwardsSectionProps {
  event: SportEvent;
  allUsers?: User[];
  onUpdate: (updatedEvent: SportEvent) => void;
}

export const EventAwardsSection: React.FC<EventAwardsSectionProps> = ({
  event,
  allUsers = [],
  onUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  // Available joined participants
  const participants = event.participants?.filter(p => p.status === 'joined') || [];
  if (participants.length === 0) return null;

  const currentAwards = event.eventAwards || {};

  const handleSelectAward = (type: 'mvpUserId' | 'fairPlayUserId' | 'ironmanUserId', userId: string) => {
    const updatedAwards = {
      ...currentAwards,
      [type]: userId ? userId : undefined,
    };
    onUpdate({
      ...event,
      eventAwards: updatedAwards,
    });
  };

  const getUserName = (userId?: string) => {
    if (!userId) return null;
    const found = participants.find(p => p.userId === userId) || allUsers.find(u => u.id === userId);
    return found ? found.name : 'Neznámý hráč';
  };

  const mvpName = getUserName(currentAwards.mvpUserId);
  const fairPlayName = getUserName(currentAwards.fairPlayUserId);
  const ironmanName = getUserName(currentAwards.ironmanUserId);

  return (
    <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-amber-500/10 rounded-2xl border border-amber-300/40 p-4 shadow-2xs">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-black text-slate-800 text-sm flex items-center gap-1.5">
          <Award size={18} className="text-amber-500" />
          Ocenění večera & Hvězdy zápasu
        </h4>

        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-100/70 hover:bg-amber-200/70 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
        >
          {isEditing ? 'Hotovo' : 'Upravit ocenění'}
        </button>
      </div>

      {/* Awards summary pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* MVP */}
        <div className="bg-white/90 rounded-xl p-2.5 border border-amber-200/80 shadow-2xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Sparkles size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
              Hvězda zápasu (MVP) +40 XP
            </div>
            <div className="text-xs font-extrabold text-slate-800 truncate" data-testid="award-display-mvp">
              {mvpName || <span className="text-slate-400 font-normal italic">Nezvoleno</span>}
            </div>
          </div>
        </div>

        {/* Fair-Play */}
        <div className="bg-white/90 rounded-xl p-2.5 border border-rose-200/80 shadow-2xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <Heart size={16} className="fill-rose-700" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">
              Srdcař večera +30 XP
            </div>
            <div className="text-xs font-extrabold text-slate-800 truncate" data-testid="award-display-fairplay">
              {fairPlayName || <span className="text-slate-400 font-normal italic">Nezvoleno</span>}
            </div>
          </div>
        </div>

        {/* Ironman */}
        <div className="bg-white/90 rounded-xl p-2.5 border border-indigo-200/80 shadow-2xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <Shield size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
              Bojovník večera +30 XP
            </div>
            <div className="text-xs font-extrabold text-slate-800 truncate" data-testid="award-display-ironman">
              {ironmanName || <span className="text-slate-400 font-normal italic">Nezvoleno</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Editor Drawer with Selectors */}
      {isEditing && (
        <div className="mt-4 pt-4 border-t border-amber-200/60 space-y-3.5 animate-fade-in" data-testid="awards-editor">
          {/* MVP Selector */}
          <div>
            <label htmlFor="award-select-mvp" className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" />
              <span>Hvězda zápasu (MVP):</span>
            </label>
            <select
              id="award-select-mvp"
              data-testid="award-select-mvp"
              value={currentAwards.mvpUserId || ''}
              onChange={(e) => handleSelectAward('mvpUserId', e.target.value)}
              className="w-full text-base md:text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 outline-none cursor-pointer min-h-[44px]"
            >
              <option value="">-- Vyberte hráče (nevybráno) --</option>
              {participants.map(p => (
                <option key={p.userId} value={p.userId}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Fair-Play Selector */}
          <div>
            <label htmlFor="award-select-fairplay" className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Heart size={14} className="text-rose-500 fill-rose-500" />
              <span>Srdcař večera (Fair-Play):</span>
            </label>
            <select
              id="award-select-fairplay"
              data-testid="award-select-fairplay"
              value={currentAwards.fairPlayUserId || ''}
              onChange={(e) => handleSelectAward('fairPlayUserId', e.target.value)}
              className="w-full text-base md:text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 outline-none cursor-pointer min-h-[44px]"
            >
              <option value="">-- Vyberte hráče (nevybráno) --</option>
              {participants.map(p => (
                <option key={p.userId} value={p.userId}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Bojovník večera Selector */}
          <div>
            <label htmlFor="award-select-ironman" className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Shield size={14} className="text-indigo-500" />
              <span>Bojovník večera:</span>
            </label>
            <select
              id="award-select-ironman"
              data-testid="award-select-ironman"
              value={currentAwards.ironmanUserId || ''}
              onChange={(e) => handleSelectAward('ironmanUserId', e.target.value)}
              className="w-full text-base md:text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none cursor-pointer min-h-[44px]"
            >
              <option value="">-- Vyberte hráče (nevybráno) --</option>
              {participants.map(p => (
                <option key={p.userId} value={p.userId}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
