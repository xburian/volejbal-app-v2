import React from 'react';
import { GameRound } from '../../types';

interface GameHistoryProps {
  gameHistory: GameRound[];
}

export const GameHistory: React.FC<GameHistoryProps> = ({ gameHistory }) => {
  if (!gameHistory || gameHistory.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-slate-200">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        Předchozí hry ({gameHistory.length})
      </h4>
      <div className="space-y-2">
        {[...gameHistory].reverse().map((round, idx) => {
          const roundNum = gameHistory.length - idx;
          const name0 = round.teamNames?.[0] ?? round.teams[0].map(p => p.name.split(' ')[0]).join(', ');
          const name1 = round.teamNames?.[1] ?? round.teams[1].map(p => p.name.split(' ')[0]).join(', ');
          const tooltip0 = round.teams[0].map(p => p.name).join(', ');
          const tooltip1 = round.teams[1].map(p => p.name).join(', ');
          const scoreStr = round.score && round.score.length > 0
            ? round.score.map(([a, b]) => `${a}:${b}`).join(', ')
            : null;
          return (
            <div key={idx} className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2" data-testid={`game-history-${roundNum}`}>
              <span className="font-bold text-slate-400 w-6 shrink-0">#{roundNum}</span>
              <div className="flex-1 flex items-center gap-1.5 min-w-0">
                <span
                  className={`font-medium truncate ${round.winningTeam === 0 ? 'text-green-600' : 'text-slate-500'}`}
                  title={tooltip0}
                >
                  {round.winningTeam === 0 && '🏆 '}
                  {name0}
                </span>
                <span className="text-slate-300 font-bold shrink-0">vs</span>
                <span
                  className={`font-medium truncate ${round.winningTeam === 1 ? 'text-green-600' : 'text-slate-500'}`}
                  title={tooltip1}
                >
                  {round.winningTeam === 1 && '🏆 '}
                  {name1}
                </span>
                {scoreStr && (
                  <span className="text-slate-400 font-mono ml-1 shrink-0" title="Skóre setů">
                    ({scoreStr})
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

