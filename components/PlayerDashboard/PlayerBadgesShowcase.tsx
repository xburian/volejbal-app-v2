import React from 'react';
import { Badge, BadgeType } from '../../types';
import { Trophy, Lock, Flame, Wallet, Zap, CheckCircle, Star, Swords } from 'lucide-react';

interface PlayerBadgesShowcaseProps {
  userBadges: Badge[];
  allBadgesCount?: number;
}

const BADGE_CONFIGS: { type: BadgeType; label: string; description: string; icon: React.ReactNode; hint: string }[] = [
  { type: 'ironman', label: 'Železný muž', description: 'Pravidelná docházka na zápasy', icon: <Flame size={20} className="text-orange-500" />, hint: 'Odehraj alespoň 5 akcí v řadě' },
  { type: 'quickPayer', label: 'Bleskový plátce', description: 'Platba do 24 hodin od zápasu', icon: <Wallet size={20} className="text-emerald-500" />, hint: 'Zaplať vždy včas do druhého dne' },
  { type: 'clutchPlayer', label: 'Bojovník koncovek', description: 'Mistr těsných setů o 2 body', icon: <Zap size={20} className="text-amber-500" />, hint: 'Vyhraj alespoň 3 těsné koncovky setů' },
  { type: 'teamPillar', label: 'Opora party', description: 'Odehráno více než 15 zápasů', icon: <Trophy size={20} className="text-blue-500" />, hint: 'Odehraj celkem 15 týmových akcí' },
  { type: 'luckyPlayer', label: 'Otočka zápasu', description: 'Výhra po prohraném prvním setu', icon: <Swords size={20} className="text-indigo-500" />, hint: 'Otoč zápas z nepříznivého stavu 0:1' },
  { type: 'consistent', label: 'Spolehlivý článek', description: '100% potvrzená účast předem', icon: <CheckCircle size={20} className="text-purple-500" />, hint: 'Přihlas se alespoň 3x s předstihem > 48h' },
  { type: 'mvpMonth', label: 'Hvězda měsíce', description: 'Zvolen nejlepším hráčem', icon: <Star size={20} className="text-yellow-500" />, hint: 'Získej ocenění Hráč zápasu (MVP)' },
];

export const PlayerBadgesShowcase: React.FC<PlayerBadgesShowcaseProps> = ({
  userBadges,
}) => {
  const earnedTypes = new Set(userBadges.map(b => b.type));

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
            <Trophy size={18} className="text-amber-500" />
            Síň slávy & Odznaky
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Odemčené trofeje a výzvy k překonání
          </p>
        </div>
        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          {earnedTypes.size} / {BADGE_CONFIGS.length}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {BADGE_CONFIGS.map(badge => {
          const isEarned = earnedTypes.has(badge.type);

          return (
            <div
              key={badge.type}
              className={`p-3 rounded-2xl border transition-all flex flex-col items-center text-center relative ${
                isEarned
                  ? 'bg-gradient-to-b from-white to-slate-50 border-slate-200/90 shadow-xs hover:border-amber-300'
                  : 'bg-slate-50/60 border-slate-200/50 opacity-60'
              }`}
              title={isEarned ? badge.description : `Zamčeno: ${badge.hint}`}
            >
              {/* Badge Icon */}
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-2 shadow-xs transition-transform ${
                  isEarned
                    ? 'bg-slate-50 border border-slate-200/80'
                    : 'bg-slate-200/80 text-slate-400 border border-slate-300/50'
                }`}
              >
                {isEarned ? badge.icon : <Lock size={18} className="text-slate-400" />}
              </div>

              {/* Title & Description */}
              <span className={`text-xs font-bold leading-tight ${isEarned ? 'text-slate-800' : 'text-slate-500'}`}>
                {badge.label}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                {isEarned ? badge.description : badge.hint}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
