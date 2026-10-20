import React, { useState } from 'react';
import { SportEvent, User } from '../../types';
import { Award, Sparkles, Heart, Shield, Check } from 'lucide-react';

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
      [type]: currentAwards[type] === userId ? undefined : userId,
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
            <div className="text-xs font-extrabold text-slate-800 truncate">
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
            <div className="text-xs font-extrabold text-slate-800 truncate">
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
            <div className="text-xs font-extrabold text-slate-800 truncate">
              {ironmanName || <span className="text-slate-400 font-normal italic">Nezvoleno</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Editor Drawer */}
      {isEditing && (
        <div className="mt-3 pt-3 border-t border-amber-200/60 space-y-3 animate-fade-in">
          <div>
            <span className="text-xs font-bold text-slate-700 mb-1.5 block">
              Zvolit Hvězdu zápasu (MVP):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {participants.map(p => {
                const isSelected = currentAwards.mvpUserId === p.userId;
                return (
                  <button
                    key={p.userId}
                    onClick={() => handleSelectAward('mvpUserId', p.userId)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {isSelected && <Check size={12} className="stroke-[3]" />}
                    <span>{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="text-xs font-bold text-slate-700 mb-1.5 block">
              Zvolit Srdcaře večera (Fair-Play):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {participants.map(p => {
                const isSelected = currentAwards.fairPlayUserId === p.userId;
                return (
                  <button
                    key={p.userId}
                    onClick={() => handleSelectAward('fairPlayUserId', p.userId)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-rose-500 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {isSelected && <Check size={12} className="stroke-[3]" />}
                    <span>{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
