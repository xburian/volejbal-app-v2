import React from 'react';
import { Participant, User } from '@/types.ts';
import { Users } from 'lucide-react';

interface WaitlistSectionProps {
  waitlistedParticipants: Participant[];
  currentUser: User;
}

export const WaitlistSection: React.FC<WaitlistSectionProps> = ({ waitlistedParticipants, currentUser }) => {
  if (waitlistedParticipants.length === 0) return null;

  return (
    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3" data-testid="waitlist-section">
      <h4 className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
        <Users size={14} />
        Čekací listina ({waitlistedParticipants.length})
      </h4>
      <div className="space-y-1.5">
        {waitlistedParticipants.map((p, idx) => (
          <div key={p.userId} className="flex items-center gap-2 text-sm text-amber-800">
            <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center text-[10px] font-bold">
              {idx + 1}
            </span>
            {p.photoUrl ? (
              <img src={p.photoUrl} alt={p.name} className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center text-[10px] font-bold text-amber-700">
                {p.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span>{p.name}</span>
            {p.userId === currentUser.id && (
              <span className="text-xs text-amber-600">(Já)</span>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-amber-600 mt-2 italic">
        Automaticky zařazeni při uvolnění místa.
      </p>
    </div>
  );
};

